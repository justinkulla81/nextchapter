'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { mergeOrganizations } from '@/lib/crm/merge-organization'
import { mergeCompanies } from '@/lib/companies/merge-company'
import { normalizeOrgName } from '@/lib/text/org-name-match'

const PAGE = '/support/admin/crm/duplicates'

export type DuplicateResult = { ok: true; message: string } | { ok: false; error: string }

/** Keeps one organization and merges the others in the group into it. */
export async function mergeOrganizationGroup(survivorId: string, sourceIds: string[]): Promise<DuplicateResult> {
  const admin = await requireAdmin()
  const merged: string[] = []
  const refused: string[] = []
  for (const id of sourceIds.filter((i) => i !== survivorId)) {
    const r = await mergeOrganizations(survivorId, id, admin.email ?? null)
    if (r.ok) merged.push(r.merged)
    else refused.push(r.reason)
  }
  captureServerEvent(admin.email ?? 'admin', 'duplicate_organizations_merged', {
    survivorId, requested: sourceIds.length - (sourceIds.includes(survivorId) ? 1 : 0), merged: merged.length, refused: refused.length,
  })
  revalidatePath(PAGE)
  revalidatePath('/support/admin/crm/organizations')
  if (merged.length === 0) return { ok: false, error: refused[0] ?? 'Nothing to merge.' }
  return {
    ok: true,
    message: `Merged ${merged.length} ${merged.length === 1 ? 'organization' : 'organizations'}.${refused.length ? ` ${refused.length} could not be merged: ${refused.join(' ')}` : ''}`,
  }
}

/**
 * Records an admin's decision on a suggested abbreviation. "Same company" saves the
 * alias (so future resume and posting names resolve to the company) and merges the
 * abbreviation's company record into the full one, including their CRM organizations. "Not the same" is remembered so the pair is never suggested again.
 */
export async function decideAbbreviation(
  abbreviationCompanyId: string,
  fullCompanyId: string,
  decision: 'same' | 'different',
): Promise<DuplicateResult> {
  const admin = await requireAdmin()
  const [abbr, full] = await Promise.all([
    prisma.company.findUnique({ where: { id: abbreviationCompanyId }, select: { id: true, name: true, canonicalNameNormalized: true } }),
    prisma.company.findUnique({ where: { id: fullCompanyId }, select: { id: true, name: true } }),
  ])
  if (!abbr || !full) return { ok: false, error: 'One of these companies no longer exists. Reload the page.' }

  try {
    await prisma.companyAlias.upsert({
      where: { aliasKey_companyId: { aliasKey: abbr.canonicalNameNormalized, companyId: full.id } },
      create: { aliasKey: abbr.canonicalNameNormalized, companyId: full.id, status: decision === 'same' ? 'CONFIRMED' : 'REJECTED', createdByEmail: admin.email ?? null },
      update: { status: decision === 'same' ? 'CONFIRMED' : 'REJECTED' },
    })
  } catch {
    return { ok: false, error: 'Decisions can’t be saved yet. The company alias table hasn’t been created in the database.' }
  }

  if (decision === 'different') {
    captureServerEvent(admin.email ?? 'admin', 'abbreviation_rejected', { abbreviationCompanyId, fullCompanyId })
    revalidatePath(PAGE)
    return { ok: true, message: `Marked ${abbr.name} and ${full.name} as different companies.` }
  }

  // Everything on the abbreviation's company record (resumes, postings, intel, its CRM
  // organization) now belongs to the full company.
  const r = await mergeCompanies(full.id, abbr.id, admin.email ?? null)
  if (!r.ok) return { ok: false, error: r.reason }
  captureServerEvent(admin.email ?? 'admin', 'abbreviation_confirmed', { abbreviationCompanyId, fullCompanyId })
  revalidatePath(PAGE)
  revalidatePath('/support/admin/crm/organizations')
  return { ok: true, message: `${abbr.name} now means ${full.name}. Everything on its record moved over.${r.orgNote}` }
}

/** Keeps one company and merges the other records in the group into it. */
export async function mergeCompanyGroup(survivorId: string, sourceIds: string[]): Promise<DuplicateResult> {
  const admin = await requireAdmin()
  const merged: string[] = []
  const refused: string[] = []
  for (const id of sourceIds.filter((i) => i !== survivorId)) {
    const r = await mergeCompanies(survivorId, id, admin.email ?? null)
    if (r.ok) { merged.push(r.merged); if (r.orgNote.includes('not merged')) refused.push(r.orgNote.trim()) }
    else refused.push(r.reason)
  }
  captureServerEvent(admin.email ?? 'admin', 'duplicate_companies_merged', {
    survivorId, merged: merged.length, notes: refused.length,
  })
  revalidatePath(PAGE)
  revalidatePath('/support/admin/crm/organizations')
  if (merged.length === 0) return { ok: false, error: refused[0] ?? 'Nothing to merge.' }
  return {
    ok: true,
    message: `Merged ${merged.length} ${merged.length === 1 ? 'company' : 'companies'}.${refused.length ? ` ${refused.join(' ')}` : ''}`,
  }
}

/**
 * "This name means that company", typed by hand, for renames and abbreviations the
 * suggestions can't find (Rtx / Raytheon). If a company already exists under the
 * name, it is merged into the target; otherwise the alias is saved so future names
 * resolve to it.
 */
export async function addManualAlias(aliasName: string, companyName: string): Promise<DuplicateResult> {
  const admin = await requireAdmin()
  const aliasKey = normalizeOrgName(aliasName)
  const targetKey = normalizeOrgName(companyName)
  if (!aliasKey) return { ok: false, error: 'Enter the name that should point at a company.' }
  if (!targetKey) return { ok: false, error: 'Enter the company it stands for.' }
  if (aliasKey === targetKey) return { ok: false, error: 'Those are the same name. Enter a different one on the left.' }
  const target = await prisma.company.findUnique({ where: { canonicalNameNormalized: targetKey }, select: { id: true, name: true } })
  if (!target) return { ok: false, error: `No company named “${companyName.trim()}” is in the directory. Check the spelling, or find it under Organizations first.` }

  const existing = await prisma.company.findUnique({ where: { canonicalNameNormalized: aliasKey }, select: { id: true, name: true } })
  if (existing) {
    const r = await mergeCompanies(target.id, existing.id, admin.email ?? null)
    if (!r.ok) return { ok: false, error: r.reason }
    captureServerEvent(admin.email ?? 'admin', 'company_alias_added', { aliasKey, companyId: target.id, merged: true })
    revalidatePath(PAGE)
    revalidatePath('/support/admin/crm/organizations')
    return { ok: true, message: `${existing.name} now means ${target.name}. Everything on its record moved over.${r.orgNote}` }
  }
  try {
    await prisma.companyAlias.upsert({
      where: { aliasKey_companyId: { aliasKey, companyId: target.id } },
      create: { aliasKey, companyId: target.id, status: 'CONFIRMED', createdByEmail: admin.email ?? null },
      update: { status: 'CONFIRMED' },
    })
  } catch {
    return { ok: false, error: 'The alias couldn’t be saved. Try again in a moment.' }
  }
  captureServerEvent(admin.email ?? 'admin', 'company_alias_added', { aliasKey, companyId: target.id, merged: false })
  revalidatePath(PAGE)
  return { ok: true, message: `“${aliasName.trim()}” will now resolve to ${target.name}. No company existed under that name yet.` }
}

/** "These are not duplicates": hides the group from the Duplicates page for good. */
export async function dismissDuplicateGroup(kind: 'ORGANIZATION' | 'COMPANY', groupKey: string): Promise<DuplicateResult> {
  const admin = await requireAdmin()
  if (!groupKey) return { ok: false, error: 'This group is missing its key. Reload the page.' }
  try {
    await prisma.duplicateDismissal.upsert({
      where: { kind_groupKey: { kind, groupKey } },
      create: { kind, groupKey, createdByEmail: admin.email ?? null },
      update: {},
    })
  } catch {
    return { ok: false, error: 'This can’t be saved yet. The dismissals table hasn’t been created in the database.' }
  }
  captureServerEvent(admin.email ?? 'admin', 'duplicate_group_dismissed', { kind, groupKey })
  revalidatePath(PAGE)
  return { ok: true, message: 'Dismissed. These won’t be listed as duplicates again.' }
}
