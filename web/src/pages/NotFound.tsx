import { Link } from 'react-router'
import { EmptyState } from '../components/States'

export function NotFoundPage() {
  return (
    <div className="panel">
      <EmptyState title="Page not found" action={<Link to="/">Back to the dashboard</Link>}>
        There is nothing at this address.
      </EmptyState>
    </div>
  )
}
