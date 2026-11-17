'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { linkSuggestedOrgs, type RelatedState } from '@/app/i/[slug]/(portal)/related-actions'

export type PickerGroup = { key: string; label: string; items: { orgId: string; name: string; reason: string; onNextChapter: boolean }[] }

// The organizations we think you know, grouped. Everything starts ticked: linking sends nothing, and you review the invites afterwards.
// `link` is the action that links the ticked ones; the portal's own by default, an employer's from the hiring portal.
export function NetworkPicker({ slug, groups, disabled, link }: { slug: string; groups: PickerGroup[]; disabled: boolean; link?: (prev: RelatedState, f: FormData) => Promise<RelatedState> }) {
  const all = groups.flatMap((g) => g.items.map((i) => i.orgId))
  const [chosen, setChosen] = useState<Set<string>>(new Set(all))
  const [state, action] = useActionState<RelatedState, FormData>(link ?? linkSuggestedOrgs.bind(null, slug), undefined)
  const toggle = (id: string, on: boolean) =>
    setChosen((cur) => {
      const n = new Set(cur)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const setGroup = (g: PickerGroup, on: boolean) =>
    setChosen((cur) => {
      const n = new Set(cur)
      for (const i of g.items) {
        if (on) n.add(i.orgId)
        else n.delete(i.orgId)
      }
      return n
    })
  return (
    <form action={action} className="space-y-6">
      {groups.map((g) => (
        <fieldset key={g.key} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-sm font-semibold">{g.label}</legend>
            <span className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setGroup(g, true)} disabled={disabled}>
                Select all
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setGroup(g, false)} disabled={disabled}>
                Select none
              </Button>
            </span>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {g.items.map((i) => (
              <li key={i.orgId}>
                <label className="flex cursor-pointer items-start gap-3 p-3 text-sm">
                  <input type="checkbox" name="orgId" value={i.orgId} checked={chosen.has(i.orgId)} onChange={(e) => toggle(i.orgId, e.target.checked)} disabled={disabled} className="mt-0.5 size-4" />
                  <span>
                    <span className="font-medium">{i.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {i.reason}
                      {i.onNextChapter ? ' · Already on NextChapter: you connect at once' : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      {disabled ? (
        <p className="text-sm text-muted-foreground">Linking is off in the preview. A staff member does this on a real organization’s portal.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton disabled={chosen.size === 0} pendingLabel="Linking…">
            {chosen.size === 0 ? 'Pick at least one to link' : `Link ${chosen.size} and get the invites`}
          </SubmitButton>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state?.ok && state.message && (
            <p role="status" className="text-sm text-muted-foreground">
              {state.message}
            </p>
          )}
        </div>
      )}
    </form>
  )
}
