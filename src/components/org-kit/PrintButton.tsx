'use client'

import { usePostHog } from '@/lib/posthog/client'

export function PrintButton({ kind, orgId }: { kind: string; orgId: string }) {
  const posthog = usePostHog()
  return (
    <button
      type="button"
      onClick={() => {
        posthog?.capture('org_kit_flyer_printed', { kind, orgId })
        window.print()
      }}
      className="rounded-full bg-orange px-5 py-2 text-sm font-semibold text-navy hover:bg-orange/90"
    >
      Print or save as PDF
    </button>
  )
}
