import 'server-only'
import type { InstitutionOrgType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DEMO_TENANTS } from './demo-tenants'

// A demo that opens from a public link with no login (owner rule 2026-11-18, CLAUDE.md "Demos open without a login"):
// the curated demo colleges (DEMO_TENANTS) and the demos NextChapter staff build (enabledFeatures.demo.source 'admin',
// such as One Louisville), while the row is a demo of sample data. Prospect-made demos keep their own signed guest link.
export async function openDemo(slug: string): Promise<{ id: string; orgType: InstitutionOrgType } | null> {
  const inst = await prisma.institution.findFirst({ where: { slug, isDemo: true, isSampleData: true }, select: { id: true, orgType: true, enabledFeatures: true } })
  if (!inst) return null
  const source = (inst.enabledFeatures as { demo?: { source?: string } } | null)?.demo?.source
  return DEMO_TENANTS[slug] || source === 'admin' ? { id: inst.id, orgType: inst.orgType } : null
}
