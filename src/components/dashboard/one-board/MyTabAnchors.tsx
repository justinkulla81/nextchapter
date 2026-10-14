'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// Old deep links (/dashboard/find-my-job#jobs-applied, #company-tracker…) point at
// sections that now live in the My jobs view; send them there.
const MY_JOBS_ANCHORS = new Set(['jobs-applied', 'interview-tracking', 'company-tracker', 'mock-interview', 'my-jobs'])

export function MyTabAnchors({ onMyJobs }: { onMyJobs: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (onMyJobs || !MY_JOBS_ANCHORS.has(hash)) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', 'my_jobs')
    router.replace(`${pathname}?${next.toString()}#${hash}`)
  }, [onMyJobs, pathname, router, searchParams])
  return null
}
