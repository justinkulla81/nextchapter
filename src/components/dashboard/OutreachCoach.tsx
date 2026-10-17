'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ContactWarmth } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { personalizeOutreachDraft } from '@/app/dashboard/network/actions'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { SentItPrompt } from '@/components/dashboard/SentItPrompt'
import {
  ASK_SIZES,
  HOOKS,
  PLAYBOOK_PURPOSES,
  buildPlaybook,
  type AskSize,
  type HookKind,
  type PlaybookPurpose,
} from '@/lib/network/playbook'

const SELECT_CLASS =
  'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand'

// Per-contact networking coach: pick what you want from this person, and get a
// specific draft plus the judgment around it (why you have a reason to write,
// how big an ask is fair, what to offer, when to follow up, a forwardable
// blurb). Everything is computed locally from templates, so it is instant and
// the draft is fully editable before it goes anywhere.
export function OutreachCoach({
  contactId,
  contactName,
  contactEmail,
  contactCompany,
  contactTitle,
  warmth,
  daysSinceLastContact,
  candidateFirstName,
  targetRole,
  discreet,
  initial,
}: {
  contactId: string
  contactName: string
  contactEmail: string | null
  contactCompany: string | null
  contactTitle: string | null
  warmth: ContactWarmth
  daysSinceLastContact: number | null
  candidateFirstName: string
  targetRole: string | null
  discreet: boolean
  initial?: { purpose?: PlaybookPurpose; askSize?: AskSize; hook?: HookKind; roleTitle?: string; fromThisWeek?: boolean }
}) {
  const [purpose, setPurpose] = useState<PlaybookPurpose>(
    initial?.purpose ?? (daysSinceLastContact !== null && daysSinceLastContact > 180 ? 'REACH_OUT' : 'INFO_CHAT')
  )
  const [askSize, setAskSize] = useState<AskSize>(initial?.askSize ?? 'MEDIUM')
  const [hook, setHook] = useState<HookKind>(initial?.hook ?? 'SHARED_HISTORY')
  const [hookDetail, setHookDetail] = useState('')
  const [offer, setOffer] = useState('')
  const [roleTitle, setRoleTitle] = useState(initial?.roleTitle ?? '')
  // Once the candidate edits the draft by hand, further option changes must
  // not silently overwrite their words.
  const [editedBody, setEditedBody] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copySignal, setCopySignal] = useState(0)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPending, startAi] = useTransition()

  const playbook = useMemo(
    () =>
      buildPlaybook({
        purpose,
        askSize,
        hook,
        hookDetail,
        contactFirstName: contactName.split(' ')[0] ?? '',
        contactCompany,
        contactTitle,
        warmth,
        candidateFirstName,
        targetRole,
        discreet,
        offer,
        roleTitle,
        daysSinceLastContact,
      }),
    [purpose, askSize, hook, hookDetail, offer, roleTitle, contactName, contactCompany, contactTitle, warmth, candidateFirstName, targetRole, discreet, daysSinceLastContact]
  )

  const body = editedBody ?? playbook.body
  const eventProps = { contactId, fromThisWeek: initial?.fromThisWeek ?? false, purpose, askSize, hook, warmth, edited: editedBody !== null }

  function polishWithAi() {
    setAiError(null)
    startAi(async () => {
      try {
        const result = await personalizeOutreachDraft(contactId, body, PLAYBOOK_PURPOSES.find((p) => p.purpose === purpose)?.label ?? purpose)
        if (result.error) setAiError(result.error)
        else if (result.draft) setEditedBody(result.draft)
      } catch {
        setAiError("We couldn't reach the AI polish just now. Your draft is unchanged; try again in a moment.")
      }
    })
  }

  function copyDraft() {
    navigator.clipboard.writeText(`Subject: ${playbook.subject}\n\n${body}`)
    setCopied(true)
    setCopySignal((n) => n + 1)
    setTimeout(() => setCopied(false), 1500)
    posthog.capture('outreach_draft_copied', eventProps)
  }

  return (
    <Card id="outreach-coach" className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Reach out to {contactName.split(' ')[0]}</CardTitle>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick what you want from this conversation. We&apos;ll draft it and tell you what to offer, how big an ask is fair, and when to follow up.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 pb-4">
        <div className="space-y-1.5">
          <Label htmlFor="coach-purpose">What do you want to do?</Label>
          <select
            id="coach-purpose"
            className={SELECT_CLASS}
            value={purpose}
            onChange={(e) => {
              setPurpose(e.target.value as PlaybookPurpose)
              setEditedBody(null)
            }}
          >
            {PLAYBOOK_PURPOSES.map((p) => (
              <option key={p.purpose} value={p.purpose}>
                {p.label}: {p.blurb}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label id="coach-ask-label">How big is the ask?</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="coach-ask-label">
            {ASK_SIZES.map((a) => (
              <Button
                key={a.size}
                type="button"
                size="sm"
                variant={askSize === a.size ? 'default' : 'outline'}
                aria-pressed={askSize === a.size}
                onClick={() => {
                  setAskSize(a.size)
                  setEditedBody(null)
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{ASK_SIZES.find((a) => a.size === askSize)?.description}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="coach-hook">Your reason to write</Label>
          <select
            id="coach-hook"
            className={SELECT_CLASS}
            value={hook}
            onChange={(e) => {
              setHook(e.target.value as HookKind)
              setEditedBody(null)
            }}
          >
            {HOOKS.map((h) => (
              <option key={h.kind} value={h.kind}>
                {h.label}
              </option>
            ))}
          </select>
          <Input
            aria-label="One specific detail for your reason to write"
            placeholder={HOOKS.find((h) => h.kind === hook)?.prompt}
            value={hookDetail}
            onChange={(e) => {
              setHookDetail(e.target.value)
              setEditedBody(null)
            }}
          />
        </div>

        {purpose === 'ASK_REFERRAL' && (
          <div className="space-y-1.5">
            <Label htmlFor="coach-role">Exact role title</Label>
            <Input id="coach-role" value={roleTitle} onChange={(e) => { setRoleTitle(e.target.value); setEditedBody(null) }} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="coach-offer">What can you offer in return? (optional)</Label>
          <Input
            id="coach-offer"
            placeholder="e.g. I'll send you the market data I've been collecting"
            value={offer}
            onChange={(e) => {
              setOffer(e.target.value)
              setEditedBody(null)
            }}
          />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Ideas for what to offer</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {playbook.offerIdeas.map((idea) => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
          </details>
        </div>

        {playbook.warnings.length > 0 && (
          <ul role="status" className="space-y-1 rounded-lg border border-orange/30 bg-orange/5 p-3 text-xs text-foreground">
            {playbook.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="coach-body">Your draft (edit freely)</Label>
          <p className="text-xs text-muted-foreground">
            Subject: <span className="font-medium text-foreground">{playbook.subject}</span>
          </p>
          <Textarea
            id="coach-body"
            value={body}
            onChange={(e) => setEditedBody(e.target.value)}
            className="min-h-48"
          />
          <p className="text-xs text-muted-foreground">Replace anything in [brackets] before you send.</p>
          {aiError && (
            <p role="alert" className="text-xs text-destructive">
              {aiError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {contactEmail ? (
              <a
                href={gmailComposeHref(contactEmail, playbook.subject, body)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setCopySignal((n) => n + 1)
                  posthog.capture('outreach_draft_opened_in_gmail', eventProps)
                }}
                className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open draft in Gmail
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add {contactName.split(' ')[0]}&apos;s email address to this contact to open the draft in Gmail.
              </p>
            )}
            <Button type="button" size="sm" variant="outline" onClick={copyDraft}>
              {copied ? 'Copied' : 'Copy draft'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={aiPending} onClick={polishWithAi} className={aiPending ? 'cursor-wait' : undefined}>
              {aiPending ? 'Polishing…' : 'Polish with AI'}
            </Button>
            {editedBody !== null && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditedBody(null)}>
                Reset to suggested draft
              </Button>
            )}
          </div>
          <SentItPrompt
            context={{ source: 'outreach_coach', subjectKey: `contact:${contactId}`, contactId }}
            note={`${playbook.subject}\n\n${body}`}
            copySignal={copySignal}
            reaskOnMount
          />
        </div>

        <div className="grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-2">
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this works</h3>
            <ul className="list-disc space-y-1 pl-4 text-xs text-foreground">
              {playbook.whyItWorks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="pt-1 text-xs text-muted-foreground">{playbook.askGuidance}</p>
          </section>
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-up plan</h3>
            <ul className={cn('list-disc space-y-1 pl-4 text-xs text-foreground')}>
              {playbook.followUpPlan.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        </div>

        <details
          className="rounded-lg border border-border p-3 text-sm"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) posthog.capture('outreach_leave_behind_viewed', eventProps)
          }}
        >
          <summary className="cursor-pointer text-sm font-medium text-foreground">Leave-behind they can forward</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            A short paragraph about you that a busy contact can paste into an email. Fill the brackets, then send it after the call or with your ask.
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-foreground">{playbook.leaveBehind}</p>
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(playbook.leaveBehind)
                posthog.capture('outreach_leave_behind_copied', eventProps)
              }}
            >
              Copy leave-behind
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
