import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canManageFirm, getTalentContext } from '@/lib/recruiter/intake/access'
import { INTAKE_FORWARD_DOMAIN, TALENT_PRODUCT_NAME } from '@/lib/recruiter/intake/constants'
import { firmForwardAddress, recruiterForwardAddress } from '@/lib/recruiter/intake/slug'
import { websiteButtonHtml, firmTheme } from '@/lib/recruiter/brand'
import { appUrl } from '@/lib/email/send-intake'
import { AvatarUploadForm } from '@/components/ui/avatar-upload-form'
import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { TalentActionForm } from '@/components/recruiter/talent/TalentForms'
import { BrandForm } from '@/components/recruiter/onboarding/BrandForm'
import { HeroUploadForm } from '@/components/recruiter/onboarding/HeroUploadForm'
import { WebhookManager } from '@/components/recruiter/onboarding/WebhookManager'
import { uploadMyFirmLogo, removeMyFirmLogo } from '../../settings/actions'
import { inviteRecruiterToFirm } from '../actions'
import { finishOnboarding, removeFirmHero, saveFirmBasics, uploadFirmHero } from './actions'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1, label: 'Your firm' },
  { n: 2, label: 'Your look' },
  { n: 3, label: 'Your website' },
  { n: 4, label: 'Your tools' },
  { n: 5, label: 'Your team' },
] as const

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs">{value}</code>
        <CopyButton text={value} />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const PLATFORMS: { name: string; steps: string[] }[] = [
  { name: 'Squarespace', steps: ['Edit the page and click an insert point.', 'Add a Button block. Type "Submit your resume".', 'Paste your link into the button link box, then save.'] },
  { name: 'WordPress', steps: ['Edit the page. Add a Buttons block.', 'Type "Submit your resume" and paste your link in the link field.', 'Update the page.'] },
  { name: 'Wix', steps: ['Open the editor and add a Button.', 'Click Link, choose Web address, and paste your link.', 'Publish.'] },
  { name: 'Webflow', steps: ['Drag a Button onto the page.', 'In settings, set the link to URL and paste your link.', 'Publish.'] },
  { name: 'Any other site', steps: ['Ask whoever edits your site to add a button that opens your link.', 'Or paste the button code below into an HTML or embed block.'] },
]

export default async function TalentOnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const ctx = await getTalentContext()
  if (!ctx.firm) redirect('/recruiters/talent')
  if (!canManageFirm(ctx)) redirect('/recruiters/talent/setup')
  const firm = ctx.firm
  const me = ctx.recruiter
  const { step: stepRaw } = await searchParams
  const step = Math.min(5, Math.max(1, Number(stepRaw) || 1))

  const [endpoints, members, invites] = await Promise.all([
    prisma.firmWebhookEndpoint.findMany({
      where: { firmId: firm.id },
      orderBy: { createdAt: 'asc' },
      include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 5 } },
    }),
    prisma.recruiter.findMany({ where: { recruiterFirmId: firm.id, firmRole: { not: null } }, orderBy: { fullName: 'asc' } }),
    prisma.recruiterFirmInvite.findMany({ where: { firmId: firm.id, acceptedAt: null }, orderBy: { createdAt: 'desc' } }),
  ])

  const base = appUrl()
  const firmPage = `${base}/in/${firm.slug}`
  const myPage = me.intakeSlug ? `${firmPage}/${me.intakeSlug}` : firmPage
  const theme = firmTheme(firm)
  const done: Record<number, boolean> = {
    1: !!firm.website,
    2: !!firm.logoUrl && !!firm.accentColor,
    3: false,
    4: endpoints.length > 0,
    5: members.length > 1 || invites.length > 0,
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{TALENT_PRODUCT_NAME} · {firm.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your firm</h1>
        <p className="mt-1 text-muted-foreground">About 10 minutes. Every step can be changed later.</p>
      </div>

      <nav aria-label="Setup steps" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {STEPS.map((s) => (
          <Link
            key={s.n}
            href={`/recruiters/talent/onboarding?step=${s.n}`}
            aria-current={s.n === step ? 'step' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              s.n === step ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {done[s.n] ? '✓ ' : `${s.n}. `}
            {s.label}
          </Link>
        ))}
      </nav>

      {step === 1 && (
        <section className="space-y-4 rounded-lg border border-border p-6">
          <div>
            <h2 className="text-lg font-semibold">Your firm and your website</h2>
            <p className="text-sm text-muted-foreground">We use your website for your header link and for your setup instructions.</p>
          </div>
          <TalentActionForm action={saveFirmBasics} submitLabel="Save and continue" pendingLabel="Saving…">
            <div className="space-y-2">
              <Label>Firm name</Label>
              <p className="text-sm">{firm.name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" defaultValue={firm.website ?? ''} placeholder="yourfirm.com" inputMode="url" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Page address</Label>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>launchyournextchapter.com/in/</span>
                <Input id="slug" name="slug" defaultValue={firm.slug ?? ''} className="max-w-48" required />
              </div>
            </div>
          </TalentActionForm>
          <Link href="/recruiters/talent/onboarding?step=2" className="text-sm text-brand underline underline-offset-4">Next: your look</Link>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6 rounded-lg border border-border p-6">
          <div>
            <h2 className="text-lg font-semibold">Your look</h2>
            <p className="text-sm text-muted-foreground">Candidates see your logo, colors and font, not ours. Changes show in the preview.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Logo</p>
              <AvatarUploadForm displayName={firm.name} currentUrl={firm.logoUrl} uploadAction={uploadMyFirmLogo} removeAction={removeMyFirmLogo} />
              <p className="text-xs text-muted-foreground">A logo with a transparent or light background works best.</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Banner photo (optional)</p>
              <HeroUploadForm currentUrl={firm.brandHeroUrl} uploadAction={uploadFirmHero} removeAction={removeFirmHero} />
            </div>
          </div>
          <BrandForm
            firmName={firm.name}
            logoUrl={firm.logoUrl}
            heroUrl={firm.brandHeroUrl}
            initial={{ accentColor: firm.accentColor, brandFont: firm.brandFont, brandTone: firm.brandTone }}
          />
          <Link href="/recruiters/talent/onboarding?step=3" className="text-sm text-brand underline underline-offset-4">Next: your website</Link>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5 rounded-lg border border-border p-6">
          <div>
            <h2 className="text-lg font-semibold">Put it on your website</h2>
            <p className="text-sm text-muted-foreground">One button and one link. No developer needed.</p>
          </div>
          <Row label="Your resume link" value={myPage} hint="This is the page candidates land on. It uses your logo, colors and font." />
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Copy your link.</li>
            <li>Add a button on your website that says &quot;Submit your resume&quot; and opens that link.</li>
            <li>Open your page once to check it.</li>
          </ol>
          <div className="space-y-2">
            {PLATFORMS.map((p) => (
              <details key={p.name} className="rounded-md border border-border px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium">{p.name}</summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                  {p.steps.map((x) => <li key={x}>{x}</li>)}
                </ol>
              </details>
            ))}
          </div>
          <Row label="Or paste this button code" value={websiteButtonHtml(myPage, theme.accent)} hint="Goes into any HTML or embed block." />
          <Row
            label="Forwarding address"
            value={me.intakeSlug ? recruiterForwardAddress(firm.slug!, me.intakeSlug, INTAKE_FORWARD_DOMAIN) : firmForwardAddress(firm.slug!, INTAKE_FORWARD_DOMAIN)}
            hint="Forward resumes from your inbox here and they land in the same place."
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <a href={myPage} target="_blank" rel="noreferrer" className="text-brand underline underline-offset-4">Open my page</a>
            <Link href="/recruiters/talent/onboarding?step=4" className="text-brand underline underline-offset-4">Next: your tools</Link>
          </div>
          {firm.status !== 'VERIFIED' && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Your page goes live as soon as NextChapter verifies your firm. You can set everything up now.
            </p>
          )}
        </section>
      )}

      {step === 4 && (
        <section className="space-y-5 rounded-lg border border-border p-6">
          <div>
            <h2 className="text-lg font-semibold">Connect your tools</h2>
            <p className="text-sm text-muted-foreground">
              We send each new resume, and what we learn from it, to your ATS, CRM or Zapier as it happens. Skip this if you do not need it yet.
            </p>
          </div>
          <WebhookManager
            endpoints={endpoints.map((e) => ({
              id: e.id,
              url: e.url,
              events: e.events,
              isActive: e.isActive,
              lastSuccessAt: e.lastSuccessAt?.toISOString() ?? null,
              lastFailureAt: e.lastFailureAt?.toISOString() ?? null,
              deliveries: e.deliveries.map((d) => ({
                id: d.id,
                event: d.event,
                status: d.status,
                responseStatus: d.responseStatus,
                error: d.error,
                createdAt: d.createdAt.toISOString(),
              })),
            }))}
          />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">What a delivery looks like</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{`POST your-url
NextChapter-Event: lead.created
NextChapter-Signature: t=1700000000,v1=<hmac-sha256 of "t.body" with your secret>

{
  "id": "…", "event": "lead.created", "firmId": "…",
  "data": {
    "leadId": "…", "source": "PAGE",
    "candidate": { "name": "Dana R.", "email": "dana@example.com" },
    "recruiter": { "id": "…", "name": "…" },
    "resume": { "fileName": "dana-r.pdf" }
  }
}`}</pre>
          </details>
          <Link href="/recruiters/talent/onboarding?step=5" className="text-sm text-brand underline underline-offset-4">Next: your team</Link>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-5 rounded-lg border border-border p-6">
          <div>
            <h2 className="text-lg font-semibold">Your team</h2>
            <p className="text-sm text-muted-foreground">Invite your recruiters. Each gets their own page, focus areas and leads.</p>
          </div>
          <ul className="space-y-1 text-sm">
            {members.map((m) => (
              <li key={m.id}>{m.fullName} <span className="text-muted-foreground">· {m.firmRole?.toLowerCase()}</span></li>
            ))}
            {invites.map((i) => (
              <li key={i.id} className="text-muted-foreground">{i.email} · invited</li>
            ))}
          </ul>
          <TalentActionForm action={inviteRecruiterToFirm} submitLabel="Send invite" pendingLabel="Sending…">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="inv">Work email</Label>
                <Input id="inv" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select id="role" name="role" defaultValue="RECRUITER" className="h-9 rounded-md border border-input bg-transparent px-2 text-sm">
                  <option value="RECRUITER">Recruiter</option>
                  <option value="COORDINATOR">Coordinator</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
          </TalentActionForm>
          <p className="text-sm text-muted-foreground">
            Add your firm&apos;s functions, industries and levels on the <Link href="/recruiters/talent/setup" className="text-brand underline underline-offset-4">Setup</Link> page so resumes route to the right person.
          </p>
          <form action={finishOnboarding}>
            <SubmitButton pendingLabel="Finishing…">Finish setup</SubmitButton>
          </form>
        </section>
      )}
    </div>
  )
}
