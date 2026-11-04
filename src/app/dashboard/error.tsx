'use client'

import { ErrorView } from '@/components/errors/ErrorView'

// A dashboard page that fails to render or whose data does not arrive. The member is signed in, so "Tell us about this" files the
// problem in the Help inbox for them (app/api/error-report), with the page and the error reference attached.
export default function DashboardError({ error }: { error: Error & { digest?: string } }) {
  return <ErrorView error={error} homeHref="/dashboard" homeLabel="Go to your home page" canFile />
}
