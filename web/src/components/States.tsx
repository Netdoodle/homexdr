// Loading, empty and error states.

import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { errorMessage, isApiError } from '../api/client'
import { Icon } from './Icon'

export function Spinner({ small }: { small?: boolean }) {
  return <span className={small ? 'spinner sm' : 'spinner'} role="status" aria-label="Loading" />
}

export function Loading({ label = 'Loading…', compact }: { label?: string; compact?: boolean }) {
  return (
    <div className={compact ? 'state compact' : 'state'} aria-busy="true">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  title,
  children,
  compact,
  action,
}: {
  title: string
  children?: ReactNode
  compact?: boolean
  action?: ReactNode
}) {
  return (
    <div className={compact ? 'state compact' : 'state'}>
      <span className="state-title">{title}</span>
      {children ? <span className="small">{children}</span> : null}
      {action}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  compact,
  title,
}: {
  error: unknown
  onRetry?: () => void
  compact?: boolean
  title?: string
}) {
  const forbidden = isApiError(error) && error.status === 403
  return (
    <div className={compact ? 'state compact error' : 'state error'} role="alert">
      <Icon name="warning" size={20} />
      <span className="state-title">{title ?? (forbidden ? 'Not allowed' : 'Something went wrong')}</span>
      <span className="small">{errorMessage(error)}</span>
      {onRetry && !forbidden ? (
        <button type="button" className="btn sm" onClick={onRetry}>
          <Icon name="refresh" size={14} /> Retry
        </button>
      ) : null}
    </div>
  )
}

/**
 * Renders loading / error / empty states for a query and calls `children` with the data
 * once it is available.
 */
export function QueryView<T>({
  query,
  children,
  isEmpty,
  empty,
  loading,
  compact,
}: {
  query: UseQueryResult<T>
  children: (data: T) => ReactNode
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
  loading?: ReactNode
  compact?: boolean
}) {
  if (query.isPending) return <>{loading ?? <Loading compact={compact} />}</>
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} compact={compact} />
  if (isEmpty && isEmpty(query.data)) return <>{empty ?? <EmptyState title="Nothing here yet" compact={compact} />}</>
  return <>{children(query.data)}</>
}
