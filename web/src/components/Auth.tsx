import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { api, isApiError, queryKeys, type Role, type User } from '../api'
import { hasRole } from '../lib/roles'
import { ErrorState, Loading } from './States'

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => (await api.me()).user,
    staleTime: 60_000,
    retry: false,
  })
}

/** The signed-in user. Only valid below <RequireAuth>. */
export function useUser(): User {
  const { data } = useMe()
  if (!data) throw new Error('useUser outside RequireAuth')
  return data
}

export function useCan(min: Role): boolean {
  const { data } = useMe()
  return hasRole(data, min)
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe()
  const loc = useLocation()
  if (me.isPending) {
    return (
      <div className="auth-page">
        <Loading label="Connecting to HomeXDR…" />
      </div>
    )
  }
  if (me.isError) {
    if (isApiError(me.error) && me.error.status === 401) {
      return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
    }
    return (
      <div className="auth-page">
        <div className="auth-card">
          <ErrorState error={me.error} onRetry={() => me.refetch()} title="Cannot reach the server" />
        </div>
      </div>
    )
  }
  return <>{children}</>
}

/** Renders children only for users with at least `min` role; otherwise `fallback`. */
export function RoleGate({ min, children, fallback = null }: { min: Role; children: ReactNode; fallback?: ReactNode }) {
  const can = useCan(min)
  return <>{can ? children : fallback}</>
}
