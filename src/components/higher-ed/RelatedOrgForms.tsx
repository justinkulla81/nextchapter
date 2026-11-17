'use client'

import { useActionState } from 'react'
import { posthog } from '@/lib/posthog/client'
import { CopyButton } from '@/components/ui/copy-button'
import { addRelatedOrgAction, type RelatedState } from '@/app/i/[slug]/(portal)/related-actions'

// "Link" for one search result, with the invite to send shown in place once it is linked.
export function LinkOrgButton({ slug, crmOrgId, orgName, inviter }: { slug: string; crmOrgId: string; orgName: string; inviter: string }) {
  const [state, action, pending] = useActionState<RelatedState, FormData>(addRelatedOrgAction.bind(null, slug, crmOrgId), undefined)
  if (state?.ok) return <RelatedInvite message={state.message} inviteUrl={state.inviteUrl ?? null} orgName={orgName} inviter={inviter} slug={slug} />
  return (
    <form action={action} className={pending ? 'cursor-wait' : undefined}>
      <button type="submit" disabled={pending} aria-label={`Link ${orgName}`} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-70">
        {pending ? 'Linking…' : 'Link'}
      </button>
      {state?.error && <p role="alert" className="mt-1 text-xs text-destructive">{state.error}</p>}
    </form>
  )
}

const inviteText = (orgName: string, inviter: string, url: string) =>
  `${inviter} added ${orgName} as a partner on NextChapter, where job seekers in our area find jobs, training and help. Claim your free page with your work email and we are connected: ${url}`

// The invite to send: copy the link, or open an email draft in your own mail program. Nothing is sent by NextChapter.
export function RelatedInvite({ message, inviteUrl, orgName, inviter, slug }: { message?: string; inviteUrl: string | null; orgName: string; inviter: string; slug: string }) {
  const text = inviteUrl ? inviteText(orgName, inviter, inviteUrl) : null
  return (
    <div role="status" className="space-y-1.5">
      {message && <p className="text-xs text-success">{message}</p>}
      {text && inviteUrl && (
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={text} label={`Copy the invite for ${orgName}`} onCopy={() => posthog.capture('related_org_invite_copied', { slug, orgName })} />
          <a
            href={`mailto:?subject=${encodeURIComponent(`${inviter} linked ${orgName} on NextChapter`)}&body=${encodeURIComponent(text)}`}
            onClick={() => posthog.capture('related_org_invite_emailed', { slug, orgName })}
            className="text-xs font-medium text-primary hover:underline"
          >
            Email it
          </a>
        </div>
      )}
    </div>
  )
}
