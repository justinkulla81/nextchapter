'use server'

import { revalidatePath } from 'next/cache'
import { requireWorkspace } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { recordInstitutionAudit } from '@/lib/higher-ed/partner-audit'

export type UnitState = { ok?: boolean; message?: string; error?: string; values?: { school: string; department: string } } | undefined

const clean = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

// Admin › Schools and departments (owner decision 2026-11-18): the whole institution's administrator adds a school or
// department as its own account. It starts on the free plan; NextChapter switches a unit to paid.
export async function addUnitAction(slug: string, _prev: UnitState, f: FormData): Promise<UnitState> {
  const ctx = await requireWorkspace(slug, 'admin', { write: true })
  const values = { school: clean(f.get('school')), department: clean(f.get('department')) }
  if (ctx.units?.length) return { error: 'Only the whole institution’s administrator can add schools and departments.', values }
  if (!ctx.tokens.has('INSTITUTION_ADMIN')) return { error: 'Only an administrator can add schools and departments.', values }
  if (values.school.length < 2 || values.school.length > 120) return { error: 'Enter the school’s name as it appears in your roster’s school column.', values }
  if (values.department.length > 120) return { error: 'Keep the department under 120 characters.', values }
  const existing = await prisma.institutionUnit.findMany({ where: { institutionId: ctx.institution.id }, select: { school: true, department: true } })
  const same = (a: string | null, b: string) => (a ?? '').toLowerCase() === b.toLowerCase()
  if (existing.some((u) => same(u.school, values.school) && same(u.department, values.department))) return { error: 'That school or department is already set up.', values }
  const name = values.department ? `${values.school}, ${values.department}` : values.school
  const unit = await prisma.institutionUnit.create({
    data: { institutionId: ctx.institution.id, name, school: values.school, department: values.department || null, createdBy: ctx.email ?? ctx.userId },
    select: { id: true },
  })
  captureServerEvent(ctx.userId, 'institution_unit_added', { institutionId: ctx.institution.id, unitId: unit.id, department: !!values.department })
  await recordInstitutionAudit(ctx, 'unit.added', { type: 'unit', id: unit.id, detail: { name } })
  revalidatePath(`/i/${slug}`, 'layout')
  return { ok: true, message: `${name} added. Invite its administrator below.` }
}
