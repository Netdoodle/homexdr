// Confirm dialog + mutation for response actions. Every action goes through here so the
// user always sees what will happen before a command is queued.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { api, queryKeys, type CommandRecord, type CommandRequest, type Host } from '../api'
import { describeCommand } from '../lib/commands'
import { ConfirmDialog } from './Modal'
import { useToast } from './Toast'

export function useHostAction(hostId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CommandRequest) => api.hostAction(hostId, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.hostCommands(hostId) })
      qc.invalidateQueries({ queryKey: queryKeys.host(hostId) })
      qc.invalidateQueries({ queryKey: queryKeys.hosts() })
    },
  })
}

export function ActionConfirmDialog({
  host,
  request,
  onClose,
  onDone,
  children,
}: {
  host: Pick<Host, 'id' | 'hostname'>
  request: CommandRequest | null
  onClose: () => void
  onDone?: (c: CommandRecord) => void
  /** Extra options shown above the effects (e.g. "kill the whole tree"). */
  children?: ReactNode
}) {
  const action = useHostAction(host.id)
  const toast = useToast()
  const d = request ? describeCommand(request, host) : null
  return (
    <ConfirmDialog
      open={request !== null}
      onClose={onClose}
      title={d?.title ?? ''}
      danger={d?.danger}
      confirmLabel={d?.confirmLabel}
      onConfirm={async () => {
        if (!request) return
        const cmd = await action.mutateAsync(request)
        toast.success(
          <span>
            Command queued for {host.hostname}.{' '}
            <Link to={`/hosts/${encodeURIComponent(host.id)}?tab=commands`}>View status</Link>
          </span>,
        )
        onDone?.(cmd)
      }}
    >
      {d ? (
        <>
          {children ? <div style={{ marginBottom: 12 }}>{children}</div> : null}
          <p>This will:</p>
          <ul className="effect-list">
            {d.effects.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="muted small" style={{ marginTop: 12 }}>
            The command is signed by the server, and the agent checks it against its local policy before it runs.
            The action is written to the audit log.
          </p>
        </>
      ) : null}
    </ConfirmDialog>
  )
}
