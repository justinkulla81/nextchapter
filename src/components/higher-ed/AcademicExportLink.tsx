'use client'

import { Download } from 'lucide-react'
import posthog from 'posthog-js'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Academic Affairs' one primary action: the programs table as a spreadsheet, for a program review or an accreditation report.
export function AcademicExportLink({ slug, majors }: { slug: string; majors: number }) {
  return (
    <a
      href={`/i/${slug}/export/programs`}
      download
      onClick={() => posthog.capture('programs_market_exported', { slug, majors })}
      className={cn(buttonVariants(), 'gap-2')}
    >
      <Download className="size-4" aria-hidden="true" />
      Download programs as CSV
    </a>
  )
}
