// Native <dialog>-based modal (focus trap, Escape and backdrop for free) and a confirm
// dialog for every state-changing response action.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../api/client'
import { Icon } from './Icon'
import { Spinner } from './States'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  danger,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  danger?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open ? (
        <>
          <div className="modal-header">
            {danger ? <Icon name="warning" className="icon-danger" size={18} /> : null}
            <h2 className="grow">{title}</h2>
            <button type="button" className="btn ghost icon sm" onClick={onClose} aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="modal-body">{children}</div>
          {footer ? <div className="modal-footer">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  )
}

/**
 * A confirmation step that says exactly what will happen. `onConfirm` may be async; the
 * dialog stays open with a spinner until it settles and shows the error if it throws.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  disabled,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => unknown | Promise<unknown>
  disabled?: boolean
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setPending(false)
    }
  }, [open])

  const run = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={pending ? () => undefined : onClose}
      title={title}
      danger={danger}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn danger' : 'btn primary'}
            onClick={run}
            disabled={pending || disabled}
            autoFocus={false}
          >
            {pending ? <Spinner small /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
      {error ? (
        <div className="callout danger" style={{ marginTop: 12 }} role="alert">
          <Icon name="warning" size={14} />
          <span>{errorMessage(error)}</span>
        </div>
      ) : null}
    </Modal>
  )
}
