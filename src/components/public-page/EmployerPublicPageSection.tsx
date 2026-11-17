// "Your public page" in an employer portal (Hiring Settings, Outplacement Program). Paid accounts edit; others see what the
// paid plan adds and the one step to get it.

import { editorStateFor } from '@/lib/public-page/store'
import { publicPageUrlFor } from '@/lib/public-page/where'
import type { EmployerPageAccess } from '@/lib/public-page/employer'
import { PublicPageEditor, type PublicPageFormState } from './PublicPageEditor'

export async function EmployerPublicPageSection({ access, picturesHref, action }: { access: EmployerPageAccess; picturesHref: string; action: (prev: PublicPageFormState, fd: FormData) => Promise<PublicPageFormState> }) {
  const url = await publicPageUrlFor(access.crmOrgId)
  return (
    <section id="public-page" aria-labelledby="public-page-h" className="scroll-mt-6 space-y-3 rounded-lg border border-border p-4">
      <h2 id="public-page-h" className="text-base font-semibold">
        Your public page
      </h2>
      {!access.crmOrgId ? (
        <p className="text-sm text-muted-foreground">
          Your account is not linked to your company&apos;s page on NextChapter yet. Claim the page from it, or email support@launchyournextchapter.com and we will
          link it.
        </p>
      ) : !access.paid ? (
        <p className="text-sm text-muted-foreground">
          On a paid plan you write your own section on {url ? <a href={url} className="font-medium text-primary hover:underline">your company page</a> : 'your company page'}:
          an introduction, why people should work here, hiring events and how to reach you, with your office and product pictures. Email
          support@launchyournextchapter.com to switch it on.
        </p>
      ) : (
        <EditorFor crmOrgId={access.crmOrgId} url={url} picturesHref={picturesHref} action={action} />
      )}
    </section>
  )
}

async function EditorFor({ crmOrgId, url, picturesHref, action }: { crmOrgId: string; url: string | null; picturesHref: string; action: (prev: PublicPageFormState, fd: FormData) => Promise<PublicPageFormState> }) {
  const state = await editorStateFor(crmOrgId)
  return (
    <PublicPageEditor
      kind="EMPLOYER"
      draft={state?.draft ?? null}
      status={state?.status ?? null}
      reviewNote={state?.reviewNote ?? null}
      firstApproved={state?.firstApproved ?? false}
      pageUrls={url ? [url] : []}
      picturesHref={picturesHref}
      action={action}
    />
  )
}
