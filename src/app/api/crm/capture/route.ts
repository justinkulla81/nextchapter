import { NextRequest, NextResponse } from 'next/server'
import type { CrmPersonRole, CrmPriorityTier, CrmWarmth } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifyCaptureToken } from '@/lib/crm/capture-token'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isRealOrgName } from '@/lib/crm/normalize'
import { captureServerEvent } from '@/lib/posthog/server'
import { isPlaceholderName } from '@/lib/resume/placeholder-name'
import { PERSON_ROLES } from '@/lib/crm/labels'
import { computePriority, warmPathFromContacts } from '@/lib/crm/scoring'
import { slugOf } from '@/lib/crm/linkedin'

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
  connectionDegree?: string
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

      const existing = slug ? await prisma.crmPerson.findUnique({ where: { linkedinSlug: slug } }) : null
      if (existing) {
        return NextResponse.json(
          { ok: true, existing: true, personId: existing.id, message: `${existing.fullName} is already in the CRM.` },
          { headers: CORS }
        )
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
      const roles = Array.isArray(body.roles)
        ? body.roles.filter((r): r is CrmPersonRole => (PERSON_ROLES as string[]).includes(r))
        : []
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
          // The LinkedIn URL you were actually on — captured even when the
          // slug lookup above fails, so a person from a non-/in/ page still
          // gets whatever link you had open.
          linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : (body.url ?? null),
          location: body.location?.trim() || null,
          notes: body.note?.trim() || null,
          // The Review List's own definition is "missing a title or an
          // organization" — now that the scraper reliably fills both, a
          // capture that already has them is a finished record, not a
          // half-done one. Only flag it when something's actually missing.
          needsCompletion: !(body.jobTitle?.trim() && orgId),
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
      return NextResponse.json({ ok: true, personId: person.id, message: `Saved ${full}.` }, { headers: CORS })
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
