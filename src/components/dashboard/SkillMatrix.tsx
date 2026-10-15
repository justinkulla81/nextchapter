'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { removeSkill, setSkillLevel } from '@/app/dashboard/skills-assessment/matrix-actions'
import { SKILL_LEVELS, SOURCE_LABEL, type SkillLevel, type SkillRow } from '@/lib/profile/skill-matrix'

// The skills matrix: every skill from the resume, the person's own list and
// certifications, with a level they can set (three buttons) and a way to drop
// one that isn't really theirs. Job matches, pivot paths and skill gaps all
// read this list.
export function SkillMatrix({ rows: initial, removed }: { rows: SkillRow[]; removed: string[] }) {
  const [rows, setRows] = useState(initial)
  const [gone, setGone] = useState(removed)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  if (!rows.length && !gone.length)
    return <p className="text-sm text-muted-foreground">No skills yet. Upload your resume, or add skills in the inventory below, and they appear here.</p>

  return (
    <div className={cn('space-y-3', pending && 'cursor-wait')}>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground">
                {r.sources.map((s) => SOURCE_LABEL[s]).join(' · ')}
                {r.levelSetBy === 'inferred' && ' · level guessed from your sources'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {SKILL_LEVELS.map((l) => (
                <Button
                  key={l.key}
                  size="sm"
                  variant={r.level === l.key ? 'default' : 'outline'}
                  aria-pressed={r.level === l.key}
                  title={l.help}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const out = await setSkillLevel(r.key, l.key as SkillLevel)
                      if (out.error) setError(out.error)
                      else setRows(rows.map((x) => (x.key === r.key ? { ...x, level: l.key as SkillLevel, levelSetBy: 'person' } : x)))
                    })
                  }
                >
                  {l.label}
                </Button>
              ))}
              {confirm === r.key ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const out = await removeSkill(r.key, true)
                        if (out.error) setError(out.error)
                        else {
                          setRows(rows.filter((x) => x.key !== r.key))
                          setGone([...gone, r.label])
                          setConfirm(null)
                        }
                      })
                    }
                  >
                    Remove {r.label}
                  </Button>
                  <Button size="sm" variant="ghost" autoFocus onClick={() => setConfirm(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" aria-label={`Remove ${r.label}`} onClick={() => setConfirm(r.key)}>
                  Not a skill of mine
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {gone.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Removed:{' '}
          {gone.map((g, i) => (
            <span key={g}>
              {i > 0 && ', '}
              <button
                type="button"
                className="underline"
                onClick={() =>
                  start(async () => {
                    const out = await removeSkill(g, false)
                    if (out.error) setError(out.error)
                    else setGone(gone.filter((x) => x !== g))
                  })
                }
              >
                put {g} back
              </button>
            </span>
          ))}
          . Refresh to see it in the list.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
