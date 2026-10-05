import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canManageFirm, getTalentContext, visibleConnectionsWhere } from '@/lib/recruiter/intake/access'
import { INTAKE_FORWARD_DOMAIN, INTAKE_LEVELS, INTAKE_ROUTING_MODE_LABELS, TALENT_PRODUCT_NAME } from '@/lib/recruiter/intake/constants'
import { firmForwardAddress, recruiterForwardAddress } from '@/lib/recruiter/intake/slug'
import { DEFAULT_NICHE_REPLY, DEFAULT_OUTSIDE_REPLY } from '@/lib/recruiter/intake/reply-templates'
import { appUrl } from '@/lib/email/send-intake'
import { TalentSubnav } from '@/components/recruiter/talent/TalentSubnav'
import { ConfirmingActionButton, TalentActionForm } from '@/components/recruiter/talent/TalentForms'
import { CopyButton } from '@/components/ui/copy-button'
import { SegmentedRadio } from '@/components/recruiter/talent/SegmentedRadio'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  addFirmSpecialty,
  changeMemberRole,
  inviteRecruiterToFirm,
  removeFirmSpecialty,
  updateFirmSettings,
  updateMyTalentProfile,
} from '../actions'

const TYPE_LABEL = { FUNCTION: 'Functions', INDUSTRY: 'Industries', LEVEL: 'Levels', GEO: 'Geographies', TAG: 'Niche tags' } as const
const ROLE_LABEL = { ADMIN: 'Admin', RECRUITER: 'Recruiter', COORDINATOR: 'Coordinator' } as const

function LinkRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
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

export default async function TalentSetupPage() {
  const ctx = await getTalentContext()
  if (!ctx.firm) redirect('/recruiters/talent')
  const firm = ctx.firm
  const me = ctx.recruiter
  const isAdmin = canManageFirm(ctx)

  const [specialties, mine, members, invites, draftCount] = await Promise.all([
    prisma.intakeSpecialty.findMany({ where: { firmId: firm.id }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.recruiterIntakeSpecialty.findMany({ where: { recruiterId: me.id } }),
    prisma.recruiter.findMany({ where: { recruiterFirmId: firm.id, firmRole: { not: null } }, orderBy: { fullName: 'asc' } }),
    prisma.recruiterFirmInvite.findMany({ where: { firmId: firm.id, acceptedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.intakeReply.count({ where: { status: 'DRAFT', connection: visibleConnectionsWhere(ctx) } }),
  ])
  const myWeights = new Map(mine.map((m) => [m.specialtyId, m.weight]))
  const base = appUrl()
  const firmPage = `${base}/in/${firm.slug}`
  const myPage = me.intakeSlug ? `${firmPage}/${me.intakeSlug}` : null
  const snippet = myPage
    ? `<a href="${myPage}" style="display:inline-block;padding:10px 16px;background:#1d4e89;color:#fff;border-radius:6px;text-decoration:none">Submit your resume</a>`
    : ''
  const live = firm.status === 'VERIFIED'

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{TALENT_PRODUCT_NAME} · {firm.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Setup</h1>
        <p className="mt-1 text-muted-foreground">About 10 minutes, once. After that there&apos;s nothing to maintain.</p>
      </div>
      <TalentSubnav active="/recruiters/talent/setup" draftCount={draftCount} />

      <section className="space-y-4 rounded-lg border border-border p-6">
        <div>
          <h2 className="text-lg font-semibold">1. Your links</h2>
          <p className="text-sm text-muted-foreground">
            {live
              ? 'Put these where candidates already find you.'
              : 'These go live once NextChapter verifies your firm. You can copy them now.'}
          </p>
        </div>
        {myPage && (
          <>
            <LinkRow label="Your Inbound page" value={myPage} hint="Your bio page, LinkedIn and email signature. Goes straight to you." />
            <LinkRow
              label='"Not a fit now" link'
              value={`${myPage}?nf=1`}
              hint="For your rejection email template. Skips Fit matching and offers free NextChapter support."
            />
            <LinkRow
              label="Your forwarding address"
              value={recruiterForwardAddress(firm.slug!, me.intakeSlug!, INTAKE_FORWARD_DOMAIN)}
              hint="Forward resumes here, or set up auto-forwarding. Microsoft 365 blocks auto-forwarding to outside addresses by default, and Google Workspace admins can too; if a test forward never shows up under Candidates, ask your IT team to allow forwarding to this address."
            />
            <LinkRow label="Website button" value={snippet} hint="Paste into your firm's candidates page or your bio page. No developer needed." />
          </>
        )}
        <LinkRow label="Firm Inbound page" value={firmPage} hint="Routes each resume to the right recruiter." />
        <LinkRow label="Firm forwarding address" value={firmForwardAddress(firm.slug!, INTAKE_FORWARD_DOMAIN)} />
      </section>

      <section className="space-y-4 rounded-lg border border-border p-6">
        <div>
          <h2 className="text-lg font-semibold">2. Your profile and specialties</h2>
          <p className="text-sm text-muted-foreground">Pre-scan and routing match resumes against these.</p>
        </div>
        <TalentActionForm action={updateMyTalentProfile} submitLabel="Save my profile">
          <div className="space-y-2">
            <Label htmlFor="intakeSlug">Personal page address</Label>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>/in/{firm.slug}/</span>
              <Input id="intakeSlug" name="intakeSlug" defaultValue={me.intakeSlug ?? ''} className="max-w-48" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Short bio, shown on your Inbound page</Label>
            <Textarea id="bio" name="bio" rows={3} defaultValue={me.intakeBio ?? ''} />
          </div>
          {specialties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Add your firm’s specialty list below first.' : 'Your firm admin hasn’t added a specialty list yet.'}
            </p>
          ) : (
            (['FUNCTION', 'INDUSTRY', 'LEVEL', 'GEO', 'TAG'] as const).map((type) => {
              const ofType = specialties.filter((s) => s.type === type)
              if (ofType.length === 0) return null
              return (
                <fieldset key={type} className="space-y-2">
                  <legend className="text-sm font-medium">{TYPE_LABEL[type]}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ofType.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="specialty" value={s.id} defaultChecked={myWeights.has(s.id)} className="size-4" />
                          {s.name}
                        </label>
                        <SegmentedRadio
                          name={`weight-${s.id}`}
                          legend={`${s.name} weight`}
                          size="sm"
                          defaultValue={myWeights.get(s.id) ?? 'PRIMARY'}
                          options={[
                            { value: 'PRIMARY', label: 'Primary' },
                            { value: 'SECONDARY', label: 'Secondary' },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>
              )
            })
          )}
          {firm.intakeRecruitersCanEditTemplates && (
            <details className="space-y-3">
              <summary className="cursor-pointer text-sm font-medium">My reply wording (optional)</summary>
              <p className="text-xs text-muted-foreground">Blank uses your firm&apos;s wording. Placeholders: {'{first_name}'}, {'{recruiter_name}'}, {'{firm_name}'}.</p>
              <Label htmlFor="myNiche">&quot;In your niche&quot; reply</Label>
              <Textarea id="myNiche" name="nicheTemplate" rows={6} defaultValue={me.intakeNicheReplyTemplate ?? ''} placeholder={DEFAULT_NICHE_REPLY} />
              <Label htmlFor="myOutside">&quot;Outside current focus&quot; reply</Label>
              <Textarea id="myOutside" name="outsideTemplate" rows={6} defaultValue={me.intakeOutsideReplyTemplate ?? ''} placeholder={DEFAULT_OUTSIDE_REPLY} />
            </details>
          )}
        </TalentActionForm>
      </section>

      {isAdmin && (
        <>
          <section className="space-y-4 rounded-lg border border-border p-6">
            <div>
              <h2 className="text-lg font-semibold">3. Firm specialty list</h2>
              <p className="text-sm text-muted-foreground">One shared list so routing can match resumes to people.</p>
            </div>
            <div className="space-y-3">
              {(['FUNCTION', 'INDUSTRY', 'LEVEL', 'GEO', 'TAG'] as const).map((type) => {
                const ofType = specialties.filter((s) => s.type === type)
                if (ofType.length === 0) return null
                return (
                  <div key={type}>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{TYPE_LABEL[type]}</p>
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {ofType.map((s) => (
                        <li key={s.id} className="flex items-center gap-1 rounded-full border border-border py-0.5 pr-1 pl-3 text-sm">
                          {s.name}
                          <ConfirmingActionButton
                            label="Remove"
                            variant="ghost"
                            confirmText={`Remove ${s.name}? Recruiters who picked it lose it.`}
                            onAction={removeFirmSpecialty.bind(null, s.id)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
            <TalentActionForm action={addFirmSpecialty} submitLabel="Add to list" pendingLabel="Adding…">
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select id="type" name="type" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {Object.entries(TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="names">Names, comma separated</Label>
                  <Input id="names" name="names" placeholder="Finance, Operations, Healthcare" />
                  <p className="text-xs text-muted-foreground">
                    For functions and levels, use the same words as NextChapter ({INTAKE_LEVELS.join(', ')}) so matching is exact.
                  </p>
                </div>
              </div>
            </TalentActionForm>
          </section>

          <section className="space-y-4 rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold">4. Firm settings</h2>
            <TalentActionForm action={updateFirmSettings} submitLabel="Save firm settings">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firmSlug">Firm page address</Label>
                  <Input id="firmSlug" name="slug" defaultValue={firm.slug ?? ''} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Brand color</Label>
                  <Input id="accentColor" name="accentColor" defaultValue={firm.accentColor ?? ''} placeholder="#1d4e89" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minLevel">Out of scope below</Label>
                  <select id="minLevel" name="minLevel" defaultValue={firm.intakeMinLevel ?? ''} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">No floor</option>
                    {INTAKE_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <SegmentedRadio
                name="routingMode"
                legend="Routing for the firm page and firm address"
                defaultValue={firm.intakeRoutingMode}
                options={Object.entries(INTAKE_ROUTING_MODE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="adminSeesAll" defaultChecked={firm.intakeAdminSeesAll} className="size-4" />
                Admins see every candidate at the firm
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="recruitersCanEditTemplates" defaultChecked={firm.intakeRecruitersCanEditTemplates} className="size-4" />
                Recruiters can edit their own reply wording
              </label>
              <div className="space-y-2">
                <Label htmlFor="nicheTemplate">Firm &quot;in your niche&quot; reply</Label>
                <Textarea id="nicheTemplate" name="nicheTemplate" rows={7} defaultValue={firm.intakeNicheReplyTemplate ?? DEFAULT_NICHE_REPLY} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outsideTemplate">Firm &quot;outside current focus&quot; reply</Label>
                <Textarea id="outsideTemplate" name="outsideTemplate" rows={7} defaultValue={firm.intakeOutsideReplyTemplate ?? DEFAULT_OUTSIDE_REPLY} />
                <p className="text-xs text-muted-foreground">
                  Keep it about your current searches, never the person. Placeholders: {'{first_name}'}, {'{recruiter_name}'}, {'{firm_name}'}.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Resumes read per day: up to {firm.intakeDailyParseCap}. Extra resumes are read the next day.</p>
            </TalentActionForm>
          </section>

          <section className="space-y-4 rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold">5. Team</h2>
            <ul className="divide-y divide-border rounded-md border border-border">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{m.fullName}{m.id === me.id && ' (you)'}</p>
                    <p className="text-xs text-muted-foreground">{m.workEmail}</p>
                  </div>
                  {m.id === me.id ? (
                    <span className="text-xs text-muted-foreground">{ROLE_LABEL[m.firmRole!]}</span>
                  ) : (
                    <div className="flex gap-1" role="group" aria-label={`${m.fullName} role`}>
                      {(['RECRUITER', 'COORDINATOR', 'ADMIN'] as const).map((role) => (
                        <ConfirmingActionButton
                          key={role}
                          label={ROLE_LABEL[role]}
                          variant={m.firmRole === role ? 'default' : 'outline'}
                          onAction={changeMemberRole.bind(null, m.id, role)}
                        />
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                  <span>{inv.email}</span>
                  <span className="text-xs">Invited as {ROLE_LABEL[inv.role]}</span>
                </li>
              ))}
            </ul>
            <TalentActionForm action={inviteRecruiterToFirm} submitLabel="Send invite" pendingLabel="Sending…">
              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Work email</Label>
                <Input id="inviteEmail" name="email" type="email" required className="max-w-md" />
              </div>
              <SegmentedRadio
                name="role"
                legend="Role"
                defaultValue="RECRUITER"
                options={[
                  { value: 'RECRUITER', label: 'Recruiter: own hopper' },
                  { value: 'COORDINATOR', label: 'Coordinator: assigns the general hopper' },
                  { value: 'ADMIN', label: 'Admin: settings and all hoppers' },
                ]}
              />
            </TalentActionForm>
          </section>
        </>
      )}
    </div>
  )
}
