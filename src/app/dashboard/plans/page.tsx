import { redirect } from 'next/navigation'

// Plans and Membership used to be two separate, duplicative "pick a tier"
// pages — merged into one at /dashboard/membership. This route stays alive
// (rather than 404ing) for any bookmarked/external links to the old path.
export default function PlansRedirectPage() {
  redirect('/dashboard/membership')
}
