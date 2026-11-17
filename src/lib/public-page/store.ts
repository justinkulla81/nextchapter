import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sharedLoad } from '@/lib/db/heavy'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendPublicPageReviewEmail } from '@/lib/email/send-org-claim-email'
import { urlForAppPath } from '@/lib/portal-hosts'
import { hasAnything, readContent, type PublicPageContentData, type PublicPageKind } from './content'

// Stores what a paid organization writes on its public page (src/lib/public-page/content.ts). The first version waits for
// NextChapter's review (/support/admin/organizations/page-edits); after one approval, later saves publish straight away.
//
// The public pages are cached for days (ISR). Their content is read through the shared data cache under a tag per
// organization, so publishing refreshes only that organization's pages, never the whole page type (emptying every page
// cache sends crawlers back to the database). No tag here is shared between organizations, so one publish never clears
// another organization's page. Each page with a CRM link makes one small indexed read a week (shared across instances).

const orgTag = (crmOrgId: string) => `public-page:${crmOrgId}`
const sourceTag = (kind: string, sourceId: string) => `public-page-src:${kind}:${sourceId}`
const WEEK = 7 * 86_400

async function readPublished(crmOrgId: string): Promise<PublicPageContentData | null> {
  try {
    const row = await prisma.publicPageContent.findUnique({ where: { crmOrganizationId: crmOrgId }, select: { published: true } })
    const c = readContent(row?.published)
    return hasAnything(c) ? c : null
  } catch (e) {
    // Fail soft: a public page never breaks because of this section.
    console.error('public page content read failed', e)
    return null
  }
}

// For the college and employer pages, which know the CRM organization.
export async function publishedContentFor(crmOrgId: string | null | undefined): Promise<PublicPageContentData | null> {
  if (!crmOrgId) return null
  return sharedLoad(`public-page:${crmOrgId}`, WEEK, () => readPublished(crmOrgId), { reviveDates: false, tags: [orgTag(crmOrgId)] })
}

// For board, job-center and economic development pages (PublicOrgPage, keyed by kind and source id).
export async function publishedContentForSource(kind: string, sourceId: string): Promise<PublicPageContentData | null> {
  return sharedLoad(`public-page-src:${kind}:${sourceId}`, WEEK, async () => {
    const link = await prisma.publicOrgPage.findUnique({ where: { kind_sourceId: { kind, sourceId } }, select: { crmOrgId: true } }).catch(() => null)
    return link?.crmOrgId ? readPublished(link.crmOrgId) : null
  }, { reviveDates: false, tags: [sourceTag(kind, sourceId)] })
}

async function refreshPublicPages(crmOrgId: string) {
  try {
    revalidateTag(orgTag(crmOrgId), { expire: 0 })
    const pages = await prisma.publicOrgPage.findMany({ where: { crmOrgId }, select: { kind: true, sourceId: true }, take: 20 })
    for (const p of pages) revalidateTag(sourceTag(p.kind, p.sourceId), { expire: 0 })
  } catch (e) {
    console.error('public page refresh failed', e)
  }
}

export type EditorState = { draft: PublicPageContentData; status: string; reviewNote: string | null; firstApproved: boolean; publishedAt: Date | null }

export async function editorStateFor(crmOrgId: string): Promise<EditorState | null> {
  const row = await prisma.publicPageContent.findUnique({ where: { crmOrganizationId: crmOrgId }, select: { draft: true, status: true, reviewNote: true, firstApprovedAt: true, publishedAt: true } })
  if (!row) return null
  return { draft: readContent(row.draft)!, status: row.status, reviewNote: row.reviewNote, firstApproved: !!row.firstApprovedAt, publishedAt: row.publishedAt }
}

// Saves the organization's words with its current pictures. Publishes at once when an earlier version was approved;
// otherwise the version waits for review.
export async function savePublicPage(args: { crmOrgId: string; kind: PublicPageKind; content: PublicPageContentData; by: string; distinctId: string }): Promise<{ status: 'PUBLISHED' | 'PENDING' }> {
  const existing = await prisma.publicPageContent.findUnique({ where: { crmOrganizationId: args.crmOrgId }, select: { firstApprovedAt: true } })
  const now = new Date()
  const json = args.content as unknown as Prisma.InputJsonValue
  const publish = !!existing?.firstApprovedAt
  const data = publish
    ? { draft: json, published: json, status: 'PUBLISHED', publishedAt: now, submittedAt: now, updatedBy: args.by, reviewNote: null }
    : { draft: json, status: 'PENDING', submittedAt: now, updatedBy: args.by, reviewNote: null }
  await prisma.publicPageContent.upsert({ where: { crmOrganizationId: args.crmOrgId }, create: { crmOrganizationId: args.crmOrgId, kind: args.kind, ...data }, update: { kind: args.kind, ...data } })
  if (publish) await refreshPublicPages(args.crmOrgId)
  else {
    const org = await prisma.crmOrganization.findUnique({ where: { id: args.crmOrgId }, select: { name: true } }).catch(() => null)
    await sendPublicPageReviewEmail({ orgName: org?.name ?? 'An organization', by: args.by, reviewUrl: urlForAppPath('/support/admin/organizations/page-edits') }).catch(() => false)
  }
  captureServerEvent(args.distinctId, 'public_page_saved', { crmOrgId: args.crmOrgId, kind: args.kind, published: publish, highlights: args.content.highlights.length, events: args.content.events.length, intro: !!args.content.intro })
  return { status: publish ? 'PUBLISHED' : 'PENDING' }
}

// ── NextChapter review ──────────────────────────────────────────────────────

export async function pendingPageEdits() {
  const rows = await prisma.publicPageContent.findMany({ where: { status: 'PENDING' }, orderBy: { submittedAt: 'asc' }, take: 50, select: { id: true, crmOrganizationId: true, kind: true, draft: true, submittedAt: true, updatedBy: true } })
  const orgs = rows.length ? await prisma.crmOrganization.findMany({ where: { id: { in: rows.map((r) => r.crmOrganizationId) } }, select: { id: true, name: true } }) : []
  const name = new Map(orgs.map((o) => [o.id, o.name]))
  return rows.map((r) => ({ id: r.id, crmOrgId: r.crmOrganizationId, orgName: name.get(r.crmOrganizationId) ?? 'Unknown organization', kind: r.kind as PublicPageKind, draft: readContent(r.draft)!, submittedAt: r.submittedAt, by: r.updatedBy }))
}

export async function approvePageEdit(id: string, by: string): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.publicPageContent.findUnique({ where: { id }, select: { id: true, crmOrganizationId: true, draft: true, status: true, kind: true } })
  if (!row || row.status !== 'PENDING') return { ok: false, error: 'This edit is no longer waiting for review.' }
  const now = new Date()
  await prisma.publicPageContent.update({ where: { id }, data: { published: row.draft as Prisma.InputJsonValue, status: 'PUBLISHED', firstApprovedAt: now, publishedAt: now, reviewedBy: by, reviewNote: null } })
  await refreshPublicPages(row.crmOrganizationId)
  captureServerEvent(`org-claim:${row.crmOrganizationId}`, 'public_page_approved', { crmOrgId: row.crmOrganizationId, kind: row.kind })
  return { ok: true }
}

export async function declinePageEdit(id: string, note: string, by: string): Promise<{ ok: boolean; error?: string }> {
  const text = note.trim().slice(0, 500)
  if (!text) return { ok: false, error: 'Say what to change, so they can fix it and save again.' }
  const r = await prisma.publicPageContent.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'DECLINED', reviewNote: text, reviewedBy: by } })
  if (r.count === 0) return { ok: false, error: 'This edit is no longer waiting for review.' }
  const row = await prisma.publicPageContent.findUnique({ where: { id }, select: { crmOrganizationId: true, kind: true } })
  if (row) captureServerEvent(`org-claim:${row.crmOrganizationId}`, 'public_page_declined', { crmOrgId: row.crmOrganizationId, kind: row.kind })
  return { ok: true }
}
