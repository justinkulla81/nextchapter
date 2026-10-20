'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { savePromotionPlan } from '@/app/dashboard/in-work/actions'
import { GAP_STARTERS, VISIBILITY_STARTERS } from '@/lib/in-work/constants'
import { newId, type CheckItem } from '@/lib/in-work/types'
import type { WorkspaceData } from '@/lib/in-work/workspace-data'
import { ActionButton as Button, Field, NoticeLine, Section, useRunner, useType } from './shared'

function EditableList({
  items,
  onChange,
  starters,
  addLabel,
  emptyText,
}: {
  items: CheckItem[]
  onChange: (items: CheckItem[]) => void
  starters: readonly string[]
  addLabel: string
  emptyText: string
}) {
  const [draft, setDraft] = useState('')
  const t = useType()
  const add = (text: string) => {
    const t = text.trim()
    if (!t) return
    onChange([...items, { id: newId(), text: t, done: false }])
    setDraft('')
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="space-y-2">
          <p className={cn('text-muted-foreground', t.body)}>{emptyText}</p>
          <Button variant="outline" size="sm" onClick={() => onChange(starters.map((t) => ({ id: newId(), text: t, done: false })))}>
            Start from our suggestions
          </Button>
        </div>
      )}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={`Done: ${it.text}`}
              checked={it.done}
              onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, done: e.target.checked } : x)))}
            />
            <Input
              value={it.text}
              maxLength={300}
              aria-label="Item text"
              className={cn('h-9', it.done && 'text-muted-foreground line-through')}
              onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))}
            />
            <button type="button" className={cn('font-medium text-muted-foreground hover:text-destructive', t.meta)} onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={300}
          placeholder={addLabel}
          aria-label={addLabel}
          className="h-9"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
        />
        <Button variant="outline" size="sm" onClick={() => add(draft)} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}

export function PromotionTab({ data }: { data: WorkspaceData }) {
  const p = data.plan
  const [targetLevel, setTargetLevel] = useState(p?.targetLevel ?? '')
  const [gapItems, setGapItems] = useState<CheckItem[]>(p?.gapItems ?? [])
  const [stretchScope, setStretchScope] = useState(p?.stretchScope ?? '')
  const [stretchDecider, setStretchDecider] = useState(p?.stretchDecider ?? '')
  const [plan30, setPlan30] = useState(p?.plan30 ?? '')
  const [plan60, setPlan60] = useState(p?.plan60 ?? '')
  const [plan90, setPlan90] = useState(p?.plan90 ?? '')
  const [visibilityItems, setVisibilityItems] = useState<CheckItem[]>(p?.visibilityItems ?? [])
  const { pending, notice, run } = useRunner()

  const done = gapItems.filter((g) => g.done).length

  return (
    <div className={cn('space-y-6', pending && 'cursor-wait')}>
      <Section title="The next level" intro="Name it, then list what has to be true. Check off what you can already show.">
        <Field label="The title or level you want">
          <Input value={targetLevel} maxLength={300} onChange={(e) => setTargetLevel(e.target.value)} placeholder="Senior manager" />
        </Field>
        <p className="text-base font-medium text-ink">
          Gap checklist {gapItems.length > 0 && <span className="font-normal text-muted-foreground">({done} of {gapItems.length} shown)</span>}
        </p>
        <EditableList
          items={gapItems}
          onChange={setGapItems}
          starters={GAP_STARTERS}
          addLabel="Add something the next level requires"
          emptyText="List what the next level requires at your company. Ask your manager if you do not know."
        />
      </Section>

      <Section title="Stretch ask" intro="More responsibility is easier to get than a title. Say exactly what you want to take on.">
        <Field label="The scope you want" hint="A project, a team, a customer group, a budget.">
          <Textarea rows={3} maxLength={2000} value={stretchScope} onChange={(e) => setStretchScope(e.target.value)} />
        </Field>
        <Field label="Who decides" hint="Name the person, not the department.">
          <Input value={stretchDecider} maxLength={300} onChange={(e) => setStretchDecider(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="First 30 days">
            <Textarea rows={4} maxLength={2000} value={plan30} onChange={(e) => setPlan30(e.target.value)} placeholder="Learn the current state, meet the stakeholders" />
          </Field>
          <Field label="Days 31 to 60">
            <Textarea rows={4} maxLength={2000} value={plan60} onChange={(e) => setPlan60(e.target.value)} placeholder="Deliver the first measurable change" />
          </Field>
          <Field label="Days 61 to 90">
            <Textarea rows={4} maxLength={2000} value={plan90} onChange={(e) => setPlan90(e.target.value)} placeholder="Report results and propose the next step" />
          </Field>
        </div>
      </Section>

      <Section title="Visibility plan" intro="The people who decide need to see your results. Plan how they will.">
        <EditableList
          items={visibilityItems}
          onChange={setVisibilityItems}
          starters={VISIBILITY_STARTERS}
          addLabel="Add a way to make your work visible"
          emptyText="Add the ways you will make your results visible to the people who decide."
        />
      </Section>

      <div className="flex items-center gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            run(
              () =>
                savePromotionPlan({
                  targetLevel,
                  gapItems: gapItems.filter((g) => g.text.trim()),
                  stretchScope,
                  stretchDecider,
                  plan30,
                  plan60,
                  plan90,
                  visibilityItems: visibilityItems.filter((g) => g.text.trim()),
                }),
              'Saved.',
            )
          }
        >
          {pending ? 'Saving…' : 'Save promotion plan'}
        </Button>
        <NoticeLine notice={notice} />
      </div>
    </div>
  )
}
