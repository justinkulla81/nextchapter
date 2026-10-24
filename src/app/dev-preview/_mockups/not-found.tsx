import { NotFoundView } from '@/components/not-found/NotFoundView'
import { SUPPORT_HELP_PATH } from '@/lib/help/constants'

// The built page-not-found view, the code that ships, with a sample address.
export const NotFoundCandidate = () => (
  <NotFoundView audience="candidate" homeHref="/dashboard" homeLabel="Back to your dashboard" reportHref={SUPPORT_HELP_PATH} pathOverride="/dashboard/old-page" />
)
export const NotFoundAdmin = () => (
  <NotFoundView audience="admin" homeHref="/" homeLabel="Back to admin home" reportHref="https://launchyournextchapter.com/contact" pathOverride="/support/admin/organizations" />
)
