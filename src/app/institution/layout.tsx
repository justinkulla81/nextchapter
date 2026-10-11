import { notFound } from 'next/navigation'

// Hidden: /i/[slug] is the single college portal. This /institution portal
// is being folded into it as tabs (Alumni jobs, Target companies, staff
// invites); remove this directory once that merge lands.
export default function InstitutionLayout() {
  notFound()
}
