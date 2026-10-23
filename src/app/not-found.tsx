import { headers } from 'next/headers'
import { NotFoundView } from '@/components/not-found/NotFoundView'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { SUPPORT_HELP_PATH } from '@/lib/help/constants'

// Every unknown address, on the main site and the portal hosts. Home depends on who is looking:
// admins go back to the admin portal, signed-in candidates to their dashboard, everyone else to the front page.
export default async function NotFound() {
  const host = ((await headers()).get('host') ?? '').toLowerCase()
  if (host.startsWith('admin.')) {
    return <NotFoundView audience="admin" homeHref="/" homeLabel="Back to admin home" reportHref="https://launchyournextchapter.com/contact" />
  }
  const user = await getCurrentUser().catch(() => null)
  if (user) {
    return <NotFoundView audience="candidate" homeHref="/dashboard" homeLabel="Back to your dashboard" reportHref={SUPPORT_HELP_PATH} />
  }
  return <NotFoundView audience="public" homeHref="/" homeLabel="Go to the home page" reportHref="/contact" />
}
