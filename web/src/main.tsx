import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './app.css'
import { App } from './App'

declare const __HOMEXDR_MOCK__: boolean

async function boot() {
  // `__HOMEXDR_MOCK__` is a build-time constant (vite.config.ts). In a normal build it is
  // `false`, this branch is removed, and no mock code or fixtures ship in dist/.
  if (__HOMEXDR_MOCK__) {
    const { installMock } = await import('./mock')
    installMock()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
