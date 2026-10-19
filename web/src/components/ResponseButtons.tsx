// Kill-process and isolate/release buttons used on alert detail and process trees.

import { useState } from 'react'
import type { CommandRequest, Host } from '../api/types'
import { actionAllowed } from '../lib/commands'
import { ActionConfirmDialog } from './ActionDialog'
import { useCan } from './Auth'
import { Icon } from './Icon'

export function ResponseButtons({
  host,
  process,
  small,
}: {
  host: Host
  process?: { pid?: number; entity_id?: string; name?: string; ended?: boolean }
  small?: boolean
}) {
  const canAct = useCan('analyst')
  const [request, setRequest] = useState<CommandRequest | null>(null)
  const [tree, setTree] = useState(false)
  const cls = small ? 'btn sm' : 'btn'

  if (!canAct) return null
  if (host.kind === 'network') {
    return <span className="muted small">Response actions are not available for network devices.</span>
  }

  const killAllowed = actionAllowed(host, 'process.kill')
  const isoType = host.isolated ? 'host.release' : 'host.isolate'
  const isoAllowed = actionAllowed(host, isoType)
  const pid = process?.pid
  const killTitle = !pid
    ? 'No PID known for this process'
    : process?.ended
      ? 'This process has already exited'
      : !killAllowed
        ? 'process.kill is not allowed by the agent’s local policy'
        : `Kill ${process?.name ?? 'process'} (PID ${pid})`

  return (
    <>
      <button
        type="button"
        className={cls}
        disabled={!pid || !killAllowed || process?.ended}
        title={killTitle}
        onClick={() => {
          setTree(false)
          setRequest({ type: 'process.kill', params: { pid: pid!, entity_id: process?.entity_id, tree: false } })
        }}
      >
        <Icon name="kill" size={14} /> Kill process
      </button>
      <button
        type="button"
        className={cls}
        disabled={!isoAllowed}
        title={isoAllowed ? undefined : `${isoType} is not allowed by the agent’s local policy`}
        onClick={() => setRequest(host.isolated ? { type: 'host.release', params: {} } : { type: 'host.isolate', params: {} })}
      >
        <Icon name={host.isolated ? 'release' : 'isolate'} size={14} /> {host.isolated ? 'Release host' : 'Isolate host'}
      </button>
      <ActionConfirmDialog host={host} request={request} onClose={() => setRequest(null)}>
        {request?.type === 'process.kill' ? (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={tree}
              onChange={(e) => {
                setTree(e.target.checked)
                setRequest({ type: 'process.kill', params: { ...request.params, tree: e.target.checked } })
              }}
            />
            Also kill every process it started (process tree)
          </label>
        ) : null}
      </ActionConfirmDialog>
    </>
  )
}
