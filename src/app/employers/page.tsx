import { redirect } from 'next/navigation'

// This used to be the outplacement pitch itself, which conflated two
// different products under one confusing name — "Employers" here meant
// outplacement (help a company's departing employees relaunch), while a
// separate, fully-built "hire our candidates" product sat at /talent with
// no marketing page at all. The outplacement content moved to /outplacement
// (see /outplacement/page.tsx); this now just forwards anyone with an old
// link or bookmark.
export default function EmployersRedirectPage() {
  redirect('/outplacement')
}
