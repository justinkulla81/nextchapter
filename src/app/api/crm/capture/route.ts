import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCaptureToken } from '@/lib/crm/capture-token'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isRealOrgName } from '@/lib/crm/normalize'
import { captureServerEvent } from '@/lib/posthog/server'

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
  kind: 'person' | 'layoff' | 'research' | 'article'
  url?: string
  title?: string
  name?: string
  company?: string
  jobTitle?: string
  headcount?: number
  announcedAt?: string
  note?: string
  selection?: string
}

function slugOf(url: string | undefined): string | null {
  if (!url) return null
  const m = url.toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/)
  return m ? m[1].replace(/\/+$/, '') : null
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

      const full = name || slug!.replace(/-+\d*$/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const person = await prisma.crmPerson.create({
        data: {
          fullName: full,
          firstName: full.split(' ')[0] ?? null,
          lastName: full.split(' ').slice(1).join(' ') || null,
          linkedinSlug: slug,
          linkedinUrl: slug ? `https://www.linkedin.com/in/${slug}` : (body.url ?? null),
          notes: body.note?.trim() || null,
          // Captured in a hurry from a page — it belongs in the completion
          // queue, not presented as a finished record.
          needsCompletion: true,
          roles: [],
        },
      })
      if (orgId) {
        await prisma.crmAffiliation.create({ data: { personId: person.id, orgId, title: body.jobTitle?.trim() || '' } })
      }
      await prisma.crmSourceRecord.create({
        data: { sourceFile: 'QUICK_ADD', rawJson: { ...body, via: 'extension' }, personId: person.id, matchTier: 'CREATE' },
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

    if (body.kind === 'research' || body.kind === 'article') {
      const title = (body.title ?? body.url ?? '').trim()
      if (!title) return NextResponse.json({ error: 'Need a title or URL.' }, { status: 400, headers: CORS })

      if (body.kind === 'research') {
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

      const existing = body.url ? await prisma.researchLibraryItem.findFirst({ where: { url: body.url } }) : null
      if (existing) return NextResponse.json({ ok: true, existing: true, message: 'Already in the library.' }, { headers: CORS })
      const item = await prisma.researchLibraryItem.create({
        data: { url: body.url ?? '', title, ingestionSource: 'extension', summary: body.selection?.slice(0, 1000) ?? null },
      })
      captureServerEvent('extension', 'crm_captured', { kind: 'article', itemId: item.id })
      return NextResponse.json({ ok: true, itemId: item.id, message: 'Saved to the library.' }, { headers: CORS })
    }

    return NextResponse.json({ error: `Unknown capture kind: ${body.kind}` }, { status: 400, headers: CORS })
  } catch (e) {
    console.error('CRM capture failed:', e)
    return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500, headers: CORS })
  }
}
