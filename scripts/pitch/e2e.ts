import { writeFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'
import { buildFromParams } from '../../src/lib/pitch/request'
import { renderPdf } from '../../src/lib/pitch/pdf'
import { renderPptx } from '../../src/lib/pitch/pptx'
;(async () => {
  const prisma = new PrismaClient()
  const lead = await prisma.geoOrgLead.findFirst({ where: { name: { startsWith: 'Louisville Economic Development Alliance' } } })
  if (!lead) throw new Error('lead missing')
  const built = await buildFromParams({ type: 'ECON_DEV', lead: lead.id, go: '1', ppl: ['justin', 'board:0'] })
  if (!built) throw new Error('no deck')
  const d = built.deck
  console.log('slides', d.slides.length, '| org', d.brand.orgName, '| area', d.title)
  console.log('board slide:', d.slides.find((s) => s.kind === 'board')?.rows?.[0]?.slice(0, 2))
  console.log('people:', d.slides.find((s) => s.kind === 'people')?.people?.map((p) => `${p.name} (${p.org})`))
  console.log('layoffs row sample:', d.slides.find((s) => s.id === 'a-warn')?.rows?.slice(0, 2) ?? 'none')
  console.log('warnings:', d.warnings)
  const out = process.argv[2]
  writeFileSync(`${out}/e2e.pdf`, await renderPdf(d)); writeFileSync(`${out}/e2e.pptx`, await renderPptx(d))
  await prisma.$disconnect()
})()
