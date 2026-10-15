'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

// Fires once per month opened, so we can see whether the report is read.
export function ReportViewed({ monthKey, memberCount }: { monthKey: string; memberCount: number }) {
  useEffect(() => {
    posthog.capture('monthly_report_viewed', { monthKey, memberCount })
  }, [monthKey, memberCount])
  return null
}
