import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, queryKeys, type HuntTarget } from '../api'
import { ArtifactParamsForm } from '../components/ArtifactParams'
import { useCan } from '../components/Auth'
import { OsLabel, StatusDot } from '../components/Badges'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/Layout'
import { ConfirmDialog } from '../components/Modal'
import { EmptyState, ErrorState, Loading } from '../components/States'
import { useToast } from '../components/Toast'
import { artifactDefaults, normalizeArtifactParams, validateArtifactParams } from '../lib/artifacts'
import { plural } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { describeTarget, huntTargetHosts } from '../lib/hunts'
import { formatDateTime } from '../lib/time'

type Mode = 'all' | 'labels' | 'hosts' | 'platform'

export function HuntCreatePage() {
  useDocumentTitle('New hunt')
  const canCreate = useCan('analyst')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const artifactsQ = useQuery({ queryKey: queryKeys.artifacts, queryFn: api.listArtifacts, staleTime: Infinity })
  const hostsQ = useQuery({ queryKey: queryKeys.hosts({}), queryFn: () => api.listHosts({}) })

  const [artifactName, setArtifactName] = useState('persistence.autoruns')
  const [values, setValues] = useState<Record<string, string>>({})
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<Mode>('all')
  const [labels, setLabels] = useState<string[]>([])
  const [hostIds, setHostIds] = useState<string[]>([])
  const [platform, setPlatform] = useState('windows')
  const [expires, setExpires] = useState(168)
  const [touched, setTouched] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const defs = artifactsQ.data?.artifacts ?? []
  const def = defs.find((d) => d.name === artifactName) ?? defs[0]
  const current = def ? { ...artifactDefaults(def), ...values } : {}
  const errors = def ? validateArtifactParams(def, current) : {}
  const endpoints = (hostsQ.data?.hosts ?? []).filter((h) => h.kind === 'endpoint' && h.status !== 'revoked')
  const allLabels = useMemo(() => [...new Set(endpoints.flatMap((h) => h.labels))].sort(), [endpoints])

  const target: HuntTarget =
    mode === 'all' ? { all: true } : mode === 'labels' ? { labels } : mode === 'hosts' ? { host_ids: hostIds } : { platform }
  const matched = def ? huntTargetHosts(endpoints, target, def) : []
  const targetEmpty = (mode === 'labels' && labels.length === 0) || (mode === 'hosts' && hostIds.length === 0)
  const create = useMutation({
    mutationFn: () =>
      api.createHunt({
        artifact: def!.name,
        params: normalizeArtifactParams(def!, current),
        description: description.trim() || undefined,
        target,
        expires_hours: expires,
      }),
  })

  if (!canCreate) {
    return (
      <div className="panel">
        <EmptyState title="Hunts need the analyst role" action={<Link to="/hunts">Back to hunts</Link>} />
      </div>
    )
  }
  if (artifactsQ.isPending || hostsQ.isPending) return <Loading />
  if (artifactsQ.isError) return <div className="panel"><ErrorState error={artifactsQ.error} onRetry={() => artifactsQ.refetch()} /></div>
  if (!def) return <div className="panel"><EmptyState title="No artifacts available" /></div>

  const toggle = (xs: string[], v: string) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v])
  const hostName = (id: string) => endpoints.find((h) => h.id === id)?.hostname ?? id
  const expiry = new Date(Date.now() + expires * 3_600_000).toISOString()

  return (
    <>
      <div className="row small muted" style={{ marginBottom: 6 }}>
        <Link to="/hunts">Hunts</Link>
        <Icon name="chevronRight" size={10} />
        <span>New hunt</span>
      </div>
      <PageHeader title="New hunt" subtitle="Hunts queue one artifact.collect command per matching host." />
      <form
        className="grid grid-sidebar"
        style={{ alignItems: 'start' }}
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (Object.keys(errors).length || targetEmpty) return
          setConfirm(true)
        }}
      >
        <div className="stack">
          <section className="panel">
            <div className="panel-header">
              <h2>1. Artifact</h2>
            </div>
            <div className="panel-body stack" style={{ gap: 12 }}>
              <div className="field">
                <label htmlFor="hunt-art">Collector</label>
                <select
                  id="hunt-art"
                  className="select"
                  value={def.name}
                  onChange={(e) => {
                    setArtifactName(e.target.value)
                    setValues({})
                    setTouched(false)
                  }}
                >
                  {defs.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <span className="help">
                  {def.description} Platforms: {def.platforms.join(', ')}.
                </span>
              </div>
              <ArtifactParamsForm def={def} values={current} onChange={setValues} errors={touched ? errors : {}} idPrefix="hunt" />
              <div className="field">
                <label htmlFor="hunt-desc">Description (optional)</label>
                <input id="hunt-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why are you running this?" />
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>2. Target</h2>
            </div>
            <div className="panel-body stack" style={{ gap: 12 }}>
              <div className="btn-group" role="radiogroup" aria-label="Target">
                {(
                  [
                    ['all', 'All hosts'],
                    ['labels', 'By label'],
                    ['hosts', 'Pick hosts'],
                    ['platform', 'By platform'],
                  ] as [Mode, string][]
                ).map(([m, label]) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'btn active' : 'btn'} onClick={() => setMode(m)}>
                    {label}
                  </button>
                ))}
              </div>
              {mode === 'all' ? <p className="muted small" style={{ margin: 0 }}>Every endpoint that supports {def.name}, including hosts that enroll before the hunt expires.</p> : null}
              {mode === 'labels' ? (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="chips">
                    {allLabels.map((l) => (
                      <button key={l} type="button" className="chip" aria-pressed={labels.includes(l)} onClick={() => setLabels(toggle(labels, l))}>
                        {l}
                      </button>
                    ))}
                    {allLabels.length === 0 ? <span className="muted small">No host has a label yet.</span> : null}
                  </div>
                  <span className={touched && labels.length === 0 ? 'xsmall danger-text' : 'xsmall muted'}>Hosts with any of the selected labels.</span>
                </div>
              ) : null}
              {mode === 'hosts' ? (
                <div className="stack" style={{ gap: 2 }}>
                  {endpoints.map((h) => (
                    <label key={h.id} className="checkbox" style={{ padding: '3px 0' }}>
                      <input type="checkbox" checked={hostIds.includes(h.id)} onChange={() => setHostIds(toggle(hostIds, h.id))} disabled={!def.platforms.includes(h.os.platform)} />
                      <StatusDot status={h.status} />
                      <span>{h.hostname}</span>
                      <OsLabel os={h.os} />
                      {!def.platforms.includes(h.os.platform) ? <span className="xsmall faint">not supported</span> : null}
                    </label>
                  ))}
                  {touched && hostIds.length === 0 ? <span className="xsmall danger-text">Pick at least one host.</span> : null}
                </div>
              ) : null}
              {mode === 'platform' ? (
                <select className="select" style={{ width: 200 }} value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">
                  {['windows', 'linux', 'darwin'].map((p) => (
                    <option key={p} value={p} disabled={!def.platforms.includes(p)}>
                      {p === 'darwin' ? 'macOS' : p[0].toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="field" style={{ width: 220 }}>
                <label htmlFor="hunt-exp">Keep collecting for</label>
                <select id="hunt-exp" className="select" value={expires} onChange={(e) => setExpires(Number(e.target.value))}>
                  <option value={1}>1 hour</option>
                  <option value={24}>1 day</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                </select>
                <span className="help">Offline hosts run it when they come back before then.</span>
              </div>
            </div>
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panel-header">
              <h2>Summary</h2>
            </div>
            <div className="panel-body stack" style={{ gap: 10 }}>
              <dl className="kv small">
                <dt>Artifact</dt>
                <dd className="mono">{def.name}</dd>
                <dt>Target</dt>
                <dd>{describeTarget(target, hostName)}</dd>
                <dt>Matches now</dt>
                <dd>{plural(matched.length, 'host')}</dd>
                <dt>Expires</dt>
                <dd>{formatDateTime(expiry)}</dd>
              </dl>
              {matched.length ? (
                <div className="tags">
                  {matched.slice(0, 12).map((h) => (
                    <span key={h.id} className="tag">
                      {h.hostname}
                    </span>
                  ))}
                </div>
              ) : null}
              <button type="submit" className="btn primary">
                <Icon name="hunts" size={14} /> Start hunt…
              </button>
            </div>
          </section>
        </div>
      </form>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Start a ${def.name} hunt?`}
        confirmLabel="Start hunt"
        onConfirm={async () => {
          const h = await create.mutateAsync()
          qc.invalidateQueries({ queryKey: queryKeys.hunts })
          toast.success('Hunt started')
          navigate(`/hunts/${encodeURIComponent(h.id)}`)
        }}
      >
        <p>This will:</p>
        <ul className="effect-list">
          <li>
            Queue the read-only collector <span className="mono">{def.name}</span> on {plural(matched.length, 'matching host')} now (
            {describeTarget(target, hostName)}).
          </li>
          <li>Also run it on matching hosts that enroll or come online until {formatDateTime(expiry)}.</li>
          <li>Upload every result row to the server, where anyone with console access can read them.</li>
        </ul>
      </ConfirmDialog>
    </>
  )
}
