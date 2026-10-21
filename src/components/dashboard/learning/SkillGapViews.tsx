'use client'

import { useState, type ReactNode } from 'react'
import { AiViewToggle } from '@/components/dashboard/AiViewToggle'
import type { AiView } from '@/lib/jobs/ai-view'

/** The Learning page's skill rows (rendered on the server) behind AI skills / Other skills / All. */
export function SkillGapViews({ items }: { items: { key: string; ai: boolean; node: ReactNode }[] }) {
  const [view, setView] = useState<AiView>('all')
  const shown = items.filter((i) => view === 'all' || i.ai === (view === 'ai'))
  const ai = items.filter((i) => i.ai).length
  return (
    <div className="space-y-4">
      <AiViewToggle surface="learning" kind="skills" current={view} onChange={setView} counts={{ ai, other: items.length - ai, all: items.length }} />
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {view === 'ai'
            ? 'The jobs that fit you don’t ask for a specific AI skill, so AI isn’t what’s holding this search back. The AI Training below is still worth it.'
            : 'The jobs that fit you don’t list other skills we can read.'}
        </p>
      ) : (
        shown.map((i) => <div key={i.key}>{i.node}</div>)
      )}
    </div>
  )
}
