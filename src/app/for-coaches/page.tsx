import { redirect } from 'next/navigation'

// /for-coaches -> /coaches: Partners Master Build Script §C3.2's route
// table names /coaches as the canonical coach landing page. Permanent
// redirect rather than deleting the route outright, so any existing
// inbound links/bookmarks still land somewhere real.
export default function ForCoachesRedirect() {
  redirect('/coaches')
}
