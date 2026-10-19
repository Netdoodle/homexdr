// Compact, expandable list of events used on host timelines, process side panels,
// alert detail and rule test results.

import { Fragment, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Event } from '../api/types'
import { eventCategories, eventSummary } from '../lib/fields'
import { addTerm } from '../lib/query'
import { formatTimestamp } from '../lib/time'
import { FieldTree } from './FieldTree'
import { Icon } from './Icon'

export function EventTable({
  events,
  showHost,
  onFilter,
  initiallyOpen,
  processLinks = true,
}: {
  events: Event[]
  showHost?: boolean
  onFilter?: (path: string, value: string | number | boolean, negate: boolean) => void
  initiallyOpen?: string
  processLinks?: boolean
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState<Set<string>>(() => new Set(initiallyOpen ? [initiallyOpen] : []))
  // Without a query box on the page, clicking a value starts a new search for it.
  const filter =
    onFilter ??
    ((path: string, value: string | number | boolean, negate: boolean) =>
      navigate(`/search?q=${encodeURIComponent(addTerm('', path, value, { negate }))}`))
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const cols = showHost ? 6 : 5
  return (
    <div className="table-wrap">
      <table className="table fixed compact">
        <colgroup>
          <col style={{ width: 28 }} />
          <col style={{ width: 178 }} />
          {showHost ? <col style={{ width: 140 }} /> : null}
          <col style={{ width: 110 }} />
          <col style={{ width: 120 }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th aria-label="Expand" />
            <th>Time</th>
            {showHost ? <th>Host</th> : null}
            <th>Category</th>
            <th>Action</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const isOpen = open.has(e.id)
            const summary = eventSummary(e)
            return (
              <Fragment key={e.id}>
                <tr className={isOpen ? 'clickable selected' : 'clickable'} onClick={() => toggle(e.id)}>
                  <td className="expander">
                    <button
                      type="button"
                      className="btn ghost icon sm"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? 'Collapse event' : 'Expand event'}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        toggle(e.id)
                      }}
                    >
                      <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={12} />
                    </button>
                  </td>
                  <td className="mono nowrap truncate">{formatTimestamp(e['@timestamp'])}</td>
                  {showHost ? <td className="truncate">{e.host?.name ?? e.host?.hostname ?? '—'}</td> : null}
                  <td className="truncate">{eventCategories(e) || '—'}</td>
                  <td className="truncate">{e.event?.action ?? '—'}</td>
                  <td className="truncate cmd" title={summary}>
                    {summary || <span className="empty-cell">—</span>}
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="detail-row">
                    <td colSpan={cols}>
                      <div className="stack" style={{ gap: 8 }}>
                        {processLinks && e.process?.entity_id && (e.host?.id || e.agent?.id) ? (
                          <div className="row small">
                            <Link to={`/hosts/${encodeURIComponent(e.host?.id || e.agent?.id || '')}/process/${encodeURIComponent(e.process.entity_id)}`}>
                              <Icon name="tree" size={12} /> Process tree for {e.process.name ?? 'process'}
                            </Link>
                            <Link to={`/search?q=${encodeURIComponent(`process.entity_id:${e.process.entity_id}`)}`}>
                              <Icon name="search" size={12} /> Events of this process
                            </Link>
                          </div>
                        ) : null}
                        <FieldTree value={e} onFilter={filter} />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
