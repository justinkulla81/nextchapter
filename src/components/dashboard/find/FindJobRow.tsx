'use client'

import { Avatar } from '@/components/candidate/ui'
import type { JobListItem } from '@/lib/jobs/find-list'
import { cn } from '@/lib/utils'
import { PostingSignalTag } from '@/components/jobs/PostingSignalTag'
import { AiExposureBadge } from '@/components/jobs/AiExposure'

// One job in the list: title, company and place, ONE verdict with its ONE reason, ONE fact. Nothing else
// (a High AI exposure badge shares the fact line; it adds no line and shows on about one row in nine)
// (docs/candidate-redesign.md, page contract 5). Opening it is a link to the job's own address with the
// job in the URL, so a new tab or a copied link opens the same job; a plain click only switches the pane.
export function FindJobRow({ item, selected, passed, href, onChoose }: { item: JobListItem; selected: boolean; passed: boolean; href: string; onChoose: () => void }) {
  const tone = item.verdict === 'worth_a_look' ? 'text-muted-foreground' : 'text-success'
  return (
    <li className={cn(selected && 'border-l-[3px] border-l-ink bg-muted/40', passed && 'opacity-60')}>
      <a
        href={href}
        aria-current={selected ? 'true' : undefined}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
          e.preventDefault()
          onChoose()
        }}
        className={cn('flex gap-3 p-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink', !selected && 'border-l-[3px] border-l-transparent')}
      >
        <Avatar name={item.company} />
        <span className="min-w-0 space-y-0.5">
          <span className="block text-base leading-snug font-semibold text-ink">{item.title}</span>
          <span className="block text-sm text-ink">{[item.company, item.place].filter(Boolean).join(' · ')}</span>
          <span className="block pt-1 text-sm text-ink">
            {passed ? (
              <span className="text-muted-foreground">Passed on. We will hide it next time.</span>
            ) : (
              <>
                {item.verdictLabel && <span className={cn('font-semibold', tone)}>{item.verdictLabel}.</span>} {item.reason}
              </>
            )}
          </span>
          {(item.fact || item.aiExposureHigh) && !passed && (
            <span className="block text-xs text-muted-foreground">
              {item.aiExposureHigh && <AiExposureBadge />}
              {item.signal ? <PostingSignalTag jobId={item.id} signal={item.signal} surface="find_list" /> : item.fact}
            </span>
          )}
        </span>
      </a>
    </li>
  )
}
