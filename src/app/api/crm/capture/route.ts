import { NextRequest, NextResponse } from 'next/server'
import type { CrmPersonRole, CrmPriorityTier, CrmWarmth } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyCaptureToken } from '@/lib/crm/capture-token'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isRealOrgName, placeholderOrgKindFor, ORG_PLACEHOLDER_NAME } from '@/lib/crm/normalize'
import { captureServerEvent } from '@/lib/posthog/server'
import { isPlaceholderName } from '@/lib/resume/placeholder-name'
import { PERSON_ROLES } from '@/lib/crm/labels'
import { computePriority, warmPathFromContacts } from '@/lib/crm/scoring'
import { slugOf } from '@/lib/crm/linkedin'
import { logManualContact } from '@/lib/crm/log-contact'
import { completionUpdate } from '@/lib/crm/completion'
import { markInvitedAsCandidate } from '@/lib/candidates/invite'
import { normalizeEmail } from '@/lib/crm/sync-matching'

export const maxDuration = 30

const CORS = {
  // The extension calls from a chrome-extension:// origin, which is opaque —
  // there is no origin to allowlist, so the bearer token is the whole control.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

interface CapturePayload {
  kind: 'person' | 'layoff' | 'research' | 'product'
  url?: string
  title?: string
  name?: string
  company?: string
  jobTitle?: string
  headcount?: number
  announcedAt?: string
  note?: string
  selection?: string
  roles?: string[]
  priority?: string
  categories?: string[]
  location?: string
  email?: string
  phone?: string
  connectionDegree?: string
  /** "I messaged them on LinkedIn today" — logs a LinkedIn message, dated now. */
  messagedToday?: boolean
  /** "I invited them to join NextChapter as a candidate." */
  invitedAsCandidate?: boolean
}

const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2'])

// LinkedIn network distance, read off the profile page, doubles as a
// starting warmth: someone already 1st-degree is a genuinely warmer lead
// than someone you've never interacted with. Only ever narrows to this on a
// real signal — no signal (not LinkedIn, scrape failed) leaves `warmth`
// unset so the schema's own UNKNOWN default applies instead of a false COLD.
function warmthFromConnectionDegree(degree: string | undefined): CrmWarmth | null {
  if (!degree) return null
  const d = degree.toLowerCase()
  if (d.includes('1st')) return 'HOT'
  if (d.includes('2nd')) return 'WARM'
  return 'COLD' // 3rd-degree, or any other value LinkedIn ever sends here
}

async function logLinkedInMessage(personId: string) {
  // Same path as logging from the People list, so the date, touch count and
  // "waiting on a reply" come out identical wherever you record it.
  await logManualContact({ personId, channel: 'LINKEDIN', date: null, loggedByEmail: null })
  captureServerEvent('extension', 'crm_activity_logged', { personId, type: 'LINKEDIN_MESSAGE', auto: false, surface: 'extension' })
}

function rolesFrom(body: CapturePayload): CrmPersonRole[] {
  return Array.isArray(body.roles)
    ? body.roles.filter((r): r is CrmPersonRole => (PERSON_ROLES as string[]).includes(r))
    : []
}

/**
 * The stored name looks like it was parsed out of the job title.
 *
 * A real case: a record whose name was "Product Development" and whose title
 * was "SVP, Innovation & Product Development" — an import took a fragment of
 * the headline as the person's name, and no search for their actual name
 * could ever find them. The plausibility checks don't catch it, because
 * "Product Development" is perfectly well-formed; what gives it away is that
 * it sits INSIDE the title.
 *
 * Deliberately narrow. It is the one case where the page in front of you is
 * better evidence than the database, and everything else keeps what's stored.
 */
function nameLooksLikeTitleFragment(
  storedName: string,
  scrapedName: string,
  title: string | null | undefined,
): boolean {
  const stored = storedName.trim().toLowerCase()
  const t = (title ?? '').trim().toLowerCase()
  if (!stored || !t || stored === t) return false
  if (!t.includes(stored)) return false

  // A real name often appears in its owner's own headline — "Charlene Li
  // Keynote Speaker & Strategic Advisor" contains "Charlene Li", and that
  // record is perfectly correct. So containment alone is not enough: the
  // scraped name must share NO word with the stored one before this is
  // treated as a bad parse rather than a person who leads with their name.
  const words = (v: string) => new Set(v.split(/[^a-z0-9]+/i).filter((w) => w.length > 1))
  const storedWords = words(stored)
  for (const w of words(scrapedName.trim().toLowerCase())) {
    if (storedWords.has(w)) return false
  }
  return true
}

/**
 * Someone already in the CRM, captured again.
 *
 * Fills what's missing and never overwrites what's there: the record is the
 * accumulated judgement (a priority you set, a warmth you graded), and a
 * profile page is a snapshot of one moment. The single exception is a name
 * that is demonstrably a fragment of the stored job title — see above.
 *
 * Roles are unioned rather than replaced, so capturing someone as an
 * Investor doesn't erase that they're also an Advisor.
 */
async function fillBlanks(
  existing: {
    id: string
    fullName: string
    location: string | null
    email: string | null
    emails: string[]
    phone: string | null
    notes: string | null
    linkedinUrl: string | null
    priority: CrmPriorityTier | null
    warmth: CrmWarmth
    roles: CrmPersonRole[]
    needsCompletion: boolean
    affiliations: { id: string; title: string | null; orgId: string }[]
  },
  body: CapturePayload,
  parsed: { name: string; orgId: string | null; roles: CrmPersonRole[] },
) {
  const data: Record<string, unknown> = {}
  const filled: string[] = []
  const primary = existing.affiliations[0] ?? null

  if (parsed.name && parsed.name !== existing.fullName && nameLooksLikeTitleFragment(existing.fullName, parsed.name, primary?.title)) {
    data.fullName = parsed.name
    data.firstName = parsed.name.split(' ')[0] ?? null
    data.lastName = parsed.name.split(' ').slice(1).join(' ') || null
    filled.push(`name (was “${existing.fullName}”)`)
  }

  const location = body.location?.trim()
  if (location && !existing.location) { data.location = location; filled.push('location') }

  const note = body.note?.trim()
  if (note && !existing.notes) { data.notes = note; filled.push('note') }

  if (!existing.linkedinUrl && slugOf(body.url)) { data.linkedinUrl = body.url; filled.push('LinkedIn URL') }

  // A staff-directory or bio page is often the only place an address or a
  // direct line is published. Fill only what's missing; the record's own
  // email is never replaced, and a second address is kept alongside it.
  const email = normalizeEmail(body.email)
  if (email && !existing.emails.includes(email)) {
    if (!existing.email) { data.email = email; filled.push('email') }
    data.emails = { push: email }
  }
  const phone = body.phone?.trim()
  if (phone && !existing.phone) { data.phone = phone; filled.push('phone') }

  if (!existing.priority && body.priority && VALID_PRIORITIES.has(body.priority)) {
    data.priority = body.priority as CrmPriorityTier
    filled.push('priority')
  }

  const warmth = warmthFromConnectionDegree(body.connectionDegree)
  if (warmth && existing.warmth === 'UNKNOWN') { data.warmth = warmth; filled.push('warmth') }

  const newRoles = parsed.roles.filter((r) => !existing.roles.includes(r))
  if (newRoles.length > 0) { data.roles = { push: newRoles }; filled.push('contact type') }

  const jobTitle = body.jobTitle?.trim()
  if (primary) {
    // An empty title on an existing affiliation is a blank like any other.
    if (jobTitle && !primary.title?.trim()) {
      await prisma.crmAffiliation.update({ where: { id: primary.id }, data: { title: jobTitle } })
      filled.push('job title')
    }
  } else if (parsed.orgId) {
    await prisma.crmAffiliation.create({
      data: { personId: existing.id, orgId: parsed.orgId, title: jobTitle || '', isPrimary: true },
    })
    filled.push('organization')
  }

  // Capturing someone by hand approves them, even if the mail sync had
  // already added and flagged them first.
  if (existing.needsCompletion) {
    Object.assign(data, completionUpdate(true, true))
  }

  if (Object.keys(data).length > 0) {
    await prisma.crmPerson.update({ where: { id: existing.id }, data })
  }
  if (filled.length > 0) {
    await prisma.crmSourceRecord.create({
      data: {
        sourceFile: 'CHROME_EXTENSION',
        rawJson: { ...body, via: 'extension', filled },
        personId: existing.id,
        matchTier: 'FILL_BLANKS',
      },
    })
  }
  captureServerEvent('extension', 'crm_capture_filled', {
    personId: existing.id, fields: filled.length, filled,
  })

  const who = (data.fullName as string | undefined) ?? existing.fullName
  return {
    ok: true,
    existing: true,
    personId: existing.id,
    message: filled.length > 0
      ? `${who} was already in the CRM — filled in ${filled.join(', ')}.`
      : `${who} is already in the CRM, and nothing here was missing.`,
  }
}

/**
 * Capture endpoint for the browser extension.
 *
 * Authenticated with a scoped bearer token rather than the admin session: an
 * extension runs on every page you visit, and a token it holds can do exactly
 * what this route allows and nothing else.
 *
 * Everything written here is marked as extension-sourced, and nothing is
 * auto-published anywhere — a captured person lands in the completion queue, a
 * captured layoff opens an opportunity at stage one.
 */
export async function POST(req: NextRequest) {
  const tokenId = await verifyCaptureToken(req.headers.get('authorization'))
  if (!tokenId) {
    return NextResponse.json({ error: 'Invalid or revoked token.' }, { status: 401, headers: CORS })
  }

  let body: CapturePayload
  try {
    body = (await req.json()) as CapturePayload
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400, headers: CORS })
  }

  try {
    if (body.kind === 'person') {
      const slug = slugOf(body.url)
      const name = (body.name ?? '').trim()
      if (!name && !slug) {
        return NextResponse.json({ error: 'Need a name or a LinkedIn URL.' }, { status: 400, headers: CORS })
      }

      let orgId: string | null = null
      let orgKey: string | null = null
      if (isRealOrgName(body.company)) {
        orgKey = normalizeOrgName(body.company)
        if (orgKey) {
          const org = await prisma.crmOrganization.upsert({
            where: { canonicalNameNormalized: orgKey },
            create: { name: body.company.trim(), canonicalNameNormalized: orgKey, orgTypes: ['EMPLOYER'] },
            update: {},
          })
          orgId = org.id
        }
      } else {
        // "looking for new opportunity", "Self-employed": not an employer,
        // but it says which bucket they're in, and an affiliation is the only
        // place a title can live — without one the headline was dropped.
        const placeholder = placeholderOrgKindFor(body.company)
        if (placeholder) {
          const name = ORG_PLACEHOLDER_NAME[placeholder]
          const key = normalizeOrgName(name)
          const org = await prisma.crmOrganization.upsert({
            where: { canonicalNameNormalized: key },
            create: { name, canonicalNameNormalized: key, orgTypes: ['EMPLOYER'] },
            update: {},
          })
          orgId = org.id
        }
      }

      // A LinkedIn profile is matched by its slug; any other page (a staff
      // directory, a bio) has no slug, so an email published there is what
      // says it's someone already saved.
      const email = normalizeEmail(body.email)
      const include = { affiliations: { where: { isPrimary: true }, take: 1 } } as const
      const existing = slug
        ? await prisma.crmPerson.findUnique({ where: { linkedinSlug: slug }, include })
        : (email
            ? await prisma.crmPerson.findFirst({ where: { OR: [{ email }, { emails: { has: email } }] }, include })
            : null) ??
          // No slug and no matching email: the same name at the same
          // organization is the same person — this is what lets a second
          // capture of a bio page fill in the phone or email the first one
          // missed, instead of creating a duplicate. Both must match, so two
          // different people who share a common name are never merged — and
          // never on a placeholder ("- Unemployed" is not an organization).
          (name && orgId && orgKey
            ? await prisma.crmPerson.findFirst({
                where: { fullName: { equals: name, mode: 'insensitive' }, affiliations: { some: { orgId } } },
                include,
              })
            : null)
      if (existing?.deletedAt) {
        // Writing to a removed record changes something you can't see. Say
        // it's removed and where to bring it back instead.
        const when = existing.deletedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
        return NextResponse.json(
          { error: `${existing.fullName} was removed from the CRM on ${when}. Restore them from Ecosystem → Removed, then save again.`, removed: true, personId: existing.id },
          { status: 409, headers: CORS }
        )
      }
      if (existing) {
        const result = await fillBlanks(existing, body, { name, orgId, roles: rolesFrom(body) })
        if (body.messagedToday) {
          await logLinkedInMessage(existing.id)
          result.message = `${result.message} Logged your LinkedIn message today.`
        }
        if (body.invitedAsCandidate) {
          const { alreadyMember } = await markInvitedAsCandidate(existing.id, 'You — invited via the capture extension')
          captureServerEvent('extension', 'crm_candidate_invited', { personId: existing.id, alreadyMember })
          result.message = `${result.message} ${alreadyMember ? 'They’re already a NextChapter member.' : 'Marked as invited to NextChapter.'}`
        }
        return NextResponse.json(result, { headers: CORS })
      }

      // See crm/actions.ts's resolveInput for why a slug-derived fallback
      // needs a plausibility check — the same "candidate-123456789" style
      // slug produces this same bug here.
      const slugDerivedName = slug
        ? slug.replace(/-+\d*$/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : null
      const full = name || (slugDerivedName && !isPlaceholderName(slugDerivedName) ? slugDerivedName : null)
      if (!full) {
        return NextResponse.json(
          { error: "Couldn't work out a real name from that page — try adding the name manually." },
          { status: 400, headers: CORS }
        )
      }
      const roles = rolesFrom(body)
      const priority = (body.priority && VALID_PRIORITIES.has(body.priority) ? body.priority : 'P2') as CrmPriorityTier
      const warmth = warmthFromConnectionDegree(body.connectionDegree)
      const now = new Date()
      // Computed inline rather than left at the schema's 0 default — someone
      // you hand-picked, on a confirmed connection, with a contact type
      // already set, should never sit at the bottom of the list until the
      // nightly recompute happens to run.
      const { score: priorityScore } = computePriority({
        quality: 'UNGRADED',
        eligibility: 'NOT_APPLICABLE',
        warmPath: warmPathFromContacts([]),
        warmth: warmth ?? undefined,
        isCategorized: roles.length > 0,
        nextDueAt: null,
        committedFollowUpAt: null,
        stageProgress: 0,
        lastTouchedAt: null,
        createdAt: now,
        now,
      })

      const person = await prisma.crmPerson.create({
        data: {
          fullName: full,
          firstName: full.split(' ')[0] ?? null,
          lastName: full.split(' ').slice(1).join(' ') || null,
          linkedinSlug: slug,
          // Only ever a real LinkedIn link — a staff-directory URL here would
          // show up on the record labelled "LinkedIn". The page you were on is
          // kept in the source record below.
          linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : null,
          email,
          emails: email ? [email] : [],
          phone: body.phone?.trim() || null,
          location: body.location?.trim() || null,
          notes: body.note?.trim() || null,
          // Someone you hand-picked from their profile is approved by the act
          // of saving them — the Review List is for people the sync added on
          // its own, not for anyone you chose. A missing title or org stays
          // visible on the row; it just doesn't ask to be reviewed.
          needsCompletion: false,
          roles,
          // Someone worth capturing mid-browse is worth a baseline follow-up
          // by default — P2 unless you picked a different priority yourself.
          priority,
          priorityScore,
          priorityComputedAt: now,
          ...(warmth ? { warmth } : {}),
        },
      })
      if (orgId) {
        await prisma.crmAffiliation.create({ data: { personId: person.id, orgId, title: body.jobTitle?.trim() || '' } })
      }
      await prisma.crmSourceRecord.create({
        data: { sourceFile: 'CHROME_EXTENSION', rawJson: { ...body, via: 'extension' }, personId: person.id, matchTier: 'CREATE' },
      })
      captureServerEvent('extension', 'crm_captured', { kind: 'person', personId: person.id })
      if (body.messagedToday) await logLinkedInMessage(person.id)
      if (body.invitedAsCandidate) {
        await markInvitedAsCandidate(person.id, 'You — invited via the capture extension')
        captureServerEvent('extension', 'crm_candidate_invited', { personId: person.id, alreadyMember: false })
      }
      const extras = [
        body.messagedToday && 'logged your LinkedIn message today',
        body.invitedAsCandidate && 'marked as invited to NextChapter',
      ].filter(Boolean)
      return NextResponse.json({
        ok: true, personId: person.id,
        message: extras.length > 0 ? `Saved ${full}, and ${extras.join(' and ')}.` : `Saved ${full}.`,
      }, { headers: CORS })
    }

    if (body.kind === 'layoff') {
      const companyName = (body.company ?? body.title ?? '').trim()
      if (!isRealOrgName(companyName)) {
        return NextResponse.json({ error: 'Need a company name.' }, { status: 400, headers: CORS })
      }
      const key = normalizeOrgName(companyName)
      const org = await prisma.crmOrganization.upsert({
        where: { canonicalNameNormalized: key },
        create: { name: companyName, canonicalNameNormalized: key, orgTypes: ['OUTPLACEMENT_LEAD'] },
        update: { orgTypes: { push: 'OUTPLACEMENT_LEAD' } },
      })
      await prisma.crmOutplacementProfile.upsert({
        where: { orgId: org.id },
        create: {
          orgId: org.id,
          headcountAffected: body.headcount ?? null,
          announcedAt: body.announcedAt ? new Date(body.announcedAt) : new Date(),
          sourceUrl: body.url ?? null,
          outreachAngle: body.selection?.slice(0, 500) ?? null,
        },
        update: { sourceUrl: body.url ?? undefined, headcountAffected: body.headcount ?? undefined },
      })

      const pipeline = await prisma.crmPipeline.findUnique({
        where: { key: 'outplacement' }, include: { stages: { where: { key: 'identified' }, take: 1 } },
      })
      let opportunityId: string | null = null
      if (pipeline?.stages[0]) {
        const dupe = await prisma.crmOpportunity.findFirst({ where: { pipelineId: pipeline.id, orgId: org.id } })
        opportunityId = dupe?.id ?? (await prisma.crmOpportunity.create({
          data: {
            pipelineId: pipeline.id, stageId: pipeline.stages[0].id, orgId: org.id,
            title: `${companyName} — ${body.headcount ? `${body.headcount} roles` : 'reduction'}`,
            leadQuality: 'B', eligibility: 'NOT_APPLICABLE', nextStep: body.note?.trim() || null,
          },
        })).id
      }
      captureServerEvent('extension', 'crm_captured', { kind: 'layoff', orgId: org.id })
      return NextResponse.json(
        { ok: true, orgId: org.id, opportunityId, message: `Saved ${companyName} as an outplacement lead.` },
        { headers: CORS }
      )
    }

    if (body.kind === 'research') {
      const title = (body.title ?? body.url ?? '').trim()
      if (!title) return NextResponse.json({ error: 'Need a title or URL.' }, { status: 400, headers: CORS })

      const existing = body.url ? await prisma.crmResearchItem.findFirst({ where: { url: body.url } }) : null
      if (existing) {
        return NextResponse.json({ ok: true, existing: true, message: 'Already saved as research.' }, { headers: CORS })
      }
      let orgId: string | null = null
      if (isRealOrgName(body.company)) {
        const key = normalizeOrgName(body.company)
        orgId = (await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key } }))?.id ?? null
      }
      const item = await prisma.crmResearchItem.create({
        data: {
          title, url: body.url ?? null, orgId,
          keyClaim: body.selection?.slice(0, 1000) ?? null,
          relevanceNote: body.note?.trim() || null,
          // Stance is a judgement about your own thesis and is never
          // inferred — it waits for you on the research page.
          stance: 'UNSET',
        },
      })
      captureServerEvent('extension', 'crm_captured', { kind: 'research', itemId: item.id })
      return NextResponse.json({ ok: true, itemId: item.id, message: 'Saved as research — set its stance when you get a moment.' }, { headers: CORS })
    }

    if (body.kind === 'product') {
      const categories = Array.isArray(body.categories) ? body.categories.filter(Boolean) : []
      const note = body.note?.trim() || ''
      if (!note && categories.length === 0) {
        return NextResponse.json({ error: 'Need a note or at least one category.' }, { status: 400, headers: CORS })
      }
      // No dedicated category field on ProductFeedback — folded into rawText
      // as a bracketed tag rather than adding a schema column for what's
      // really just a quick-capture label, reviewed and reclassified from
      // the Vision feedback page anyway.
      const rawText = [categories.length > 0 ? `[${categories.join(', ')}]` : null, note, body.url ? `\n\n${body.url}` : null]
        .filter(Boolean).join(' ').trim() || (body.url ?? '')
      const item = await prisma.productFeedback.create({
        data: {
          source: 'SELF',
          rawText,
          channel: 'extension',
          receivedAt: new Date(),
          status: 'NEW',
        },
      })
      captureServerEvent('extension', 'crm_captured', { kind: 'product', itemId: item.id })
      return NextResponse.json({ ok: true, itemId: item.id, message: 'Saved to Vision feedback for review.' }, { headers: CORS })
    }

    return NextResponse.json({ error: `Unknown capture kind: ${body.kind}` }, { status: 400, headers: CORS })
  } catch (e) {
    console.error('CRM capture failed:', e)
    return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500, headers: CORS })
  }
}
