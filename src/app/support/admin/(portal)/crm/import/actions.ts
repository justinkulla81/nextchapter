'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { isRealOrgName } from '@/lib/crm/normalize'
import type { CrmPersonRole } from '@prisma/client'

/** Minimal RFC-4180 parse. Quoted newlines are real in exported CRM files. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

function pick(rec: Record<string, string>, names: string[]): string | null {
  for (const n of names) {
    const hit = Object.keys(rec).find((k) => k.toLowerCase().trim() === n.toLowerCase())
    if (hit && rec[hit]?.trim()) return rec[hit].trim()
  }
  return null
}

function slugOf(url: string | null): string | null {
  if (!url) return null
  const m = url.toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/)
  return m ? m[1].replace(/\/+$/, '') : null
}

export interface ImportRowPlan {
  index: number
  name: string
  company: string | null
  title: string | null
  email: string | null
  linkedinUrl: string | null
  action: 'create' | 'update' | 'confirm'
  matchedOn: string | null
  matchedId: string | null
  matchedName: string | null
}

export interface ImportPreview {
  ok: boolean
  message: string
  fileName?: string
  headers?: string[]
  plan?: ImportRowPlan[]
  counts?: { create: number; update: number; confirm: number }
  payload?: string
}

/**
 * Reads an uploaded CSV and returns what WOULD happen — nothing is written.
 *
 * The match ladder is the same one the migration used: LinkedIn slug, then
 * email, then name+company. A name-only collision is never resolved
 * automatically; it comes back as 'confirm' so you decide per row, because a
 * shared name is not evidence of a shared person.
 */
export async function previewImport(_prev: unknown, formData: FormData): Promise<ImportPreview> {
  await requireAdmin()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose a CSV file to upload.' }
  }
  if (file.size > 8_000_000) {
    return { ok: false, message: 'That file is larger than 8 MB. Split it and upload in parts.' }
  }

  const text = await file.text()
  const grid = parseCsv(text)
  if (grid.length < 2) return { ok: false, message: 'That file has a header but no rows.' }

  const headers = grid[0].map((h) => h.trim())
  const records = grid.slice(1).map((cells) => {
    const r: Record<string, string> = {}
    headers.forEach((h, i) => { if (h) r[h] = (cells[i] ?? '').trim() })
    return r
  })

  const nameCols = ['Full Name', 'Name', 'full_name']
  const firstCols = ['First Name', 'first_name']
  const lastCols = ['Last Name', 'last_name']

  const plan: ImportRowPlan[] = []
  for (const [i, rec] of records.entries()) {
    const name =
      pick(rec, nameCols) ??
      ([pick(rec, firstCols), pick(rec, lastCols)].filter(Boolean).join(' ').trim() || null)
    if (!name) continue
    const company = pick(rec, ['Company', 'Organization', 'Organisation'])
    const title = pick(rec, ['Position', 'Title', 'Job Title'])
    const email = pick(rec, ['Email', 'Email Address'])?.toLowerCase() ?? null
    const linkedinUrl = pick(rec, ['LinkedIn URL', 'LinkedIn', 'URL', 'Profile'])
    const slug = slugOf(linkedinUrl)

    let action: ImportRowPlan['action'] = 'create'
    let matchedOn: string | null = null
    let matched: { id: string; fullName: string } | null = null

    if (slug) {
      const hit = await prisma.crmPerson.findUnique({ where: { linkedinSlug: slug }, select: { id: true, fullName: true } })
      if (hit) { action = 'update'; matchedOn = 'LinkedIn URL'; matched = hit }
    }
    if (!matched && email) {
      const hit = await prisma.crmPerson.findFirst({ where: { email }, select: { id: true, fullName: true } })
      if (hit) { action = 'update'; matchedOn = 'email'; matched = hit }
    }
    if (!matched && isRealOrgName(company)) {
      const key = normalizeOrgName(company)
      const nk = `${name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()}|${key}`
      const hit = await prisma.crmPerson.findFirst({ where: { normalizedKey: nk }, select: { id: true, fullName: true } })
      if (hit) { action = 'update'; matchedOn = 'name + company'; matched = hit }
    }
    if (!matched) {
      const hit = await prisma.crmPerson.findFirst({
        where: { fullName: { equals: name, mode: 'insensitive' } },
        select: { id: true, fullName: true },
      })
      if (hit) { action = 'confirm'; matchedOn = 'name only'; matched = hit }
    }

    plan.push({
      index: i, name, company, title, email, linkedinUrl,
      action, matchedOn, matchedId: matched?.id ?? null, matchedName: matched?.fullName ?? null,
    })
  }

  const counts = {
    create: plan.filter((p) => p.action === 'create').length,
    update: plan.filter((p) => p.action === 'update').length,
    confirm: plan.filter((p) => p.action === 'confirm').length,
  }

  return {
    ok: true,
    fileName: file.name,
    headers,
    plan,
    counts,
    payload: JSON.stringify(plan),
    message: `${plan.length} rows read from ${file.name}. Nothing has been saved yet.`,
  }
}

/**
 * Applies a previewed plan. Rows marked 'confirm' are applied only where you
 * explicitly chose merge or create on the preview screen.
 */
export async function applyImport(_prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const admin = await requireAdmin()
  const raw = String(formData.get('payload') ?? '')
  if (!raw) return { ok: false, message: 'Nothing to apply — upload a file first.' }

  let plan: ImportRowPlan[]
  try { plan = JSON.parse(raw) as ImportRowPlan[] }
  catch { return { ok: false, message: "Couldn't read that plan. Upload the file again." } }

  const decisions = new Map<number, string>()
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('decide-')) decisions.set(Number(k.slice(7)), String(v))
  }

  let created = 0, updated = 0, skipped = 0

  for (const row of plan) {
    const decision = row.action === 'confirm' ? decisions.get(row.index) ?? 'skip' : row.action
    if (decision === 'skip') { skipped++; continue }

    const slug = slugOf(row.linkedinUrl)
    let orgId: string | null = null
    let orgKey: string | null = null
    if (isRealOrgName(row.company)) {
      orgKey = normalizeOrgName(row.company)
      if (orgKey) {
        const org = await prisma.crmOrganization.upsert({
          where: { canonicalNameNormalized: orgKey },
          create: { name: row.company, canonicalNameNormalized: orgKey, orgTypes: ['EMPLOYER'] },
          update: {},
        })
        orgId = org.id
      }
    }

    const targetId = decision === 'merge' ? row.matchedId : decision === 'update' ? row.matchedId : null

    if (targetId) {
      const existing = await prisma.crmPerson.findUniqueOrThrow({ where: { id: targetId } })
      await prisma.crmPerson.update({
        where: { id: targetId },
        data: {
          email: existing.email ?? row.email,
          linkedinSlug: existing.linkedinSlug ?? slug,
          linkedinUrl: existing.linkedinUrl ?? row.linkedinUrl,
        },
      })
      if (orgId) {
        await prisma.crmAffiliation.upsert({
          where: { personId_orgId_title: { personId: targetId, orgId, title: row.title ?? '' } },
          create: { personId: targetId, orgId, title: row.title ?? '' },
          update: {},
        })
      }
      updated++
    } else {
      const person = await prisma.crmPerson.create({
        data: {
          fullName: row.name,
          firstName: row.name.split(' ')[0] ?? null,
          lastName: row.name.split(' ').slice(1).join(' ') || null,
          linkedinSlug: slug, linkedinUrl: row.linkedinUrl,
          email: row.email, emails: row.email ? [row.email] : [],
          normalizedKey: orgKey
            ? `${row.name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()}|${orgKey}`
            : null,
          roles: [] as CrmPersonRole[],
          needsCompletion: !row.title || !orgId,
        },
      })
      if (orgId) await prisma.crmAffiliation.create({ data: { personId: person.id, orgId, title: row.title ?? '' } })
      await prisma.crmSourceRecord.create({
        data: { sourceFile: 'MANUAL', rawJson: { ...row }, personId: person.id, matchTier: 'CREATE' },
      })
      created++
    }
  }

  captureServerEvent(admin.email ?? 'admin', 'crm_csv_imported', { created, updated, skipped, rows: plan.length })
  revalidatePath('/support/admin/crm')
  return { ok: true, message: `Added ${created}, updated ${updated}, skipped ${skipped}.` }
}
