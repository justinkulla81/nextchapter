import { NotFoundView } from '@/components/not-found/NotFoundView'
import { SUPPORT_HELP_PATH } from '@/lib/help/constants'

// A dashboard page that exists as a route but has nothing to show (renders inside the dashboard layout).
export default function DashboardNotFound() {
  return <NotFoundView audience="candidate" homeHref="/dashboard" homeLabel="Back to your dashboard" reportHref={SUPPORT_HELP_PATH} />
}
