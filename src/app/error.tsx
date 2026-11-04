'use client'

import { ErrorView } from '@/components/errors/ErrorView'

// Any page below the root layout that fails to render. Dashboard pages have their own (app/dashboard/error.tsx).
export default function RootError({ error }: { error: Error & { digest?: string } }) {
  return <ErrorView error={error} homeHref="/" homeLabel="Go to the home page" canFile={false} />
}
