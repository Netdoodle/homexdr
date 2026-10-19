import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { api, isApiError, queryKeys, type HuntResultRow } from '../api'
import { useCan } from '../components/Auth'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { KV, Pager, RelTime } from '../components/Misc'
import { ConfirmDialog } from '../components/Modal'
import { EmptyState, ErrorState, Loading, QueryView, Spinner } from '../components/States'
import { useToast } from '../components/Toast'
import { formatNumber } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { describeTarget } from '../lib/hunts'
import { formatDateTime } from '../lib/time'
import { RowsTable } from './HostCommands'
import { HuntProgress, HuntStatusBadge } from './Hunts'

const LIMIT = 100

export function HuntDetailPage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const canStop = useCan('analyst')
  const [stopOpen, setStopOpen] = useState(false)
  const [hostFilter, setHostFilter] = useState('')
  const [offset, setOffset] = useState(0)

  const q = useQuery({
    queryKey: queryKeys.hunt(id),
    queryFn: () => api.getHunt(id),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 3000 : false),
  })
  const running = q.data?.status === 'running'
  const results = useQuery({
    queryKey: queryKeys.huntResults(id, hostFilter, offset),
    queryFn: () => api.huntResults(id, { host_id: hostFilter || undefined, limit: LIMIT, offset }),
    placeholderData: keepPreviousData,
    refetchInterval: running ? 5000 : false,
  })
  const artifacts = useQuery({ queryKey: queryKeys.artifacts, queryFn: api.listArtifacts, staleTime: Infinity })
  // Host list for the filter, from all rows (first page is enough to discover hosts).
  const allRows = useQuery({
    queryKey: queryKeys.huntResults(id, '', 0),
    queryFn: () => api.huntResults(id, { limit: LIMIT, offset: 0 }),
    enabled: hostFilter !== '' || offset !== 0,
  })
  useDocumentTitle(q.data ? `Hunt ${q.data.artifact}` : 'Hunt')

  if (q.isPending) return <Loading />
  if (q.isError) {
    return (
      <div className="panel">
        {isApiError(q.error) && q.error.status === 404 ? (
          <EmptyState title="Hunt not found" action={<Link to="/hunts">Back to hunts</Link>} />
        ) : (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        )}
      </div>
    )
  }
  const h = q.data
  const def = artifacts.data?.artifacts.find((a) => a.name === h.artifact)
  const sourceRows: HuntResultRow[] = (hostFilter || offset ? allRows.data?.rows : results.data?.rows) ?? []
  const resultHosts = [...new Map(sourceRows.map((r) => [r.host_id, r.hostname])).entries()]
  const params = Object.entries(h.params ?? {})

  return (
    <>
      <div className="row small muted" style={{ marginBottom: 6 }}>
        <Link to="/hunts">Hunts</Link>
        <Icon name="chevronRight" size={10} />
        <span className="mono">{h.id}</span>
      </div>
      <PageHeader
        title={
          <span className="row" style={{ gap: 10 }}>
            <span className="mono">{h.artifact}</span>
            <HuntStatusBadge status={h.status} />
            {running && q.isFetching ? <Spinner small /> : null}
          </span>
        }
        subtitle={h.description}
        actions={
          canStop && running ? (
            <button type="button" className="btn danger" onClick={() => setStopOpen(true)}>
              <Icon name="stop" size={12} /> Stop hunt
            </button>
          ) : null
        }
      />
      <div className="stats" style={{ marginBottom: 12 }}>
        <div className="stat">
          <span className="label">Scheduled hosts</span>
          <span className="value">{formatNumber(h.stats.scheduled)}</span>
        </div>
        <div className="stat">
          <span className="label">Completed</span>
          <span className="value">{formatNumber(h.stats.completed)}</span>
          <HuntProgress hunt={h} />
        </div>
        <div className="stat">
          <span className="label">Failed</span>
          <span className="value">{formatNumber(h.stats.failed)}</span>
        </div>
        <div className="stat">
          <span className="label">Result rows</span>
          <span className="value">{formatNumber(h.stats.rows)}</span>
        </div>
      </div>
      <div className="grid grid-sidebar" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-header">
            <h2>Results</h2>
            <span className="row">
              {results.isFetching ? <Spinner small /> : null}
              <select
                className="select"
                value={hostFilter}
                onChange={(e) => {
                  setHostFilter(e.target.value)
                  setOffset(0)
                }}
                aria-label="Filter by host"
              >
                <option value="">All hosts</option>
                {resultHosts.map(([hid, name]) => (
                  <option key={hid} value={hid}>
                    {name}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <QueryView
            query={results}
            isEmpty={(d) => d.rows.length === 0}
            empty={<EmptyState title={running ? 'Waiting for hosts to report…' : 'No rows collected'}>{running ? 'Rows appear as each host finishes.' : undefined}</EmptyState>}
          >
            {(d) => (
              <>
                <RowsTable rows={d.rows.map((r) => r.row)} columns={def?.columns} extraFirst={(_, i) => <Link to={`/hosts/${encodeURIComponent(d.rows[i].host_id)}`}>{d.rows[i].hostname}</Link>} />
                <Pager offset={offset} limit={LIMIT} total={d.total} shown={d.rows.length} onChange={setOffset} />
              </>
            )}
          </QueryView>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Hunt</h2>
          </div>
          <div className="panel-body">
            <KV
              items={[
                ['Artifact', <span key="a" className="mono">{h.artifact}</span>],
                ['Parameters', params.length ? <span className="mono small">{params.map(([k, v]) => `${k}=${v}`).join(' ')}</span> : 'defaults'],
                ['Target', describeTarget(h.target)],
                ['Created', <span key="c">{formatDateTime(h.created_at)} by {h.created_by}</span>],
                ['Expires', <span key="e">{formatDateTime(h.expires_at)} (<RelTime iso={h.expires_at} />)</span>],
                ['Description', h.description],
              ]}
            />
            {def ? <p className="muted xsmall" style={{ marginTop: 12 }}>{def.description}</p> : null}
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        title="Stop this hunt?"
        danger
        confirmLabel="Stop hunt"
        onConfirm={async () => {
          const updated = await api.stopHunt(h.id)
          qc.setQueryData(queryKeys.hunt(h.id), updated)
          qc.invalidateQueries({ queryKey: queryKeys.hunts })
          toast.success('Hunt stopped')
        }}
      >
        <p>This will:</p>
        <ul className="effect-list">
          <li>Stop scheduling {h.artifact} on hosts that have not run it yet, including hosts that come online later.</li>
          <li>Keep the {formatNumber(h.stats.rows)} rows already collected.</li>
        </ul>
      </ConfirmDialog>
    </>
  )
}
