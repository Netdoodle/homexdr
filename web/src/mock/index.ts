// Mock mode (VITE_MOCK=1): intercepts same-origin /api and /healthz requests and answers
// them from in-browser fixtures. Imported only when the build-time mock flag is on.

import { applyMockUrlFlags, handleMockRequest } from './server'

export function installMock() {
  applyMockUrlFlags(window.location.search)
  const realFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href, window.location.origin)
    const isApi = url.origin === window.location.origin && (url.pathname.startsWith('/api/') || url.pathname === '/healthz')
    if (!isApi) return realFetch(input, init)

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    let body: string | null = null
    if (typeof init?.body === 'string') body = init.body
    else if (input instanceof Request && method !== 'GET') body = await input.text()
    return handleMockRequest(method, url, headers, body)
  }

  console.info(
    '%c[HomeXDR] mock mode%c API answered from fixtures. URL flags: ?mock_role=viewer|analyst|admin, ?mock_setup=1, ?mock_logout=1',
    'color:#4c8dff;font-weight:bold',
    'color:inherit',
  )
}
