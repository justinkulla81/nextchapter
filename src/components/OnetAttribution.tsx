import { cn } from '@/lib/utils'

// O*NET data is licensed CC BY 4.0, which requires this credit wherever it is used, and requires saying
// we changed it. We rescale, filter and combine its ratings, so the "modified" sentence applies.
// Keep the wording; it is the licence's, not ours.
export function OnetAttribution({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      This page includes information from the{' '}
      <a href="https://www.onetcenter.org/database.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
        O*NET Database
      </a>{' '}
      by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the{' '}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
        CC BY 4.0
      </a>{' '}
      license. O*NET® is a trademark of USDOL/ETA. NextChapter has modified all or some of this information. USDOL/ETA has not approved, endorsed, or tested these modifications. Pay and
      growth figures are from the U.S. Bureau of Labor Statistics.
    </p>
  )
}
