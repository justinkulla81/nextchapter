/**
 * Create the launch-kit links for workforce boards and print the addresses to send (the kit page is unlisted and needs a claim page).
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/branding/prepare-board-kits.ts --ids KY-247,IN-1 [--apply]
 *
 * Default is a dry run: it checks each board has a claim page, a brand, and a kit page that would resolve, and says what is missing.
 * --apply creates the four tracked links per board (ob:<boardId>:email|web|social|print). Nothing is sent to anyone.
 */
import { prisma } from '../../src/lib/prisma'
import { getOrgBrand } from '../../src/lib/branding/store'
import { claimSlugFor } from '../../src/lib/seo/org-pages'
import { boardKitContext, ensureBoardKitLinks } from '../../src/lib/org-claims/board-kit-data'
import { boardKitQrLink } from '../../src/lib/org-claims/board-kit'
import { SITE_URL } from '../../src/lib/org-claims/urls'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const ids = (arg('--ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (ids.length === 0) {
    console.log('usage: prepare-board-kits.ts --ids KY-247,... [--apply]')
    return
  }
  const apply = process.argv.includes('--apply')
  for (const id of ids) {
    const board = await prisma.workforceBoard.findUnique({ where: { id }, select: { id: true, name: true, state: true } })
    if (!board) { console.log(`\n${id}: not found`); continue }
    console.log(`\n${board.name} (${board.state}, ${board.id})`)
    const [claim, brand] = await Promise.all([claimSlugFor('WORKFORCE_BOARD', id), getOrgBrand('WORKFORCE_BOARD', id)])
    console.log(`  claim page: ${claim ? `${SITE_URL}/prepared/${claim}` : 'NONE (no linked CRM organization with a unique address)'}`)
    console.log(`  brand: ${brand ? `${brand.pair.primary} / ${brand.pair.secondary}` : 'none yet (run scan-orgs.ts --apply)'}`)
    if (!claim) continue
    const ctx = await boardKitContext(claim)
    if (!ctx) { console.log('  kit page would not resolve (board not found through its claim address)'); continue }
    console.log(`  area: ${ctx.area}\n  page: ${SITE_URL}${ctx.pagePath}`)
    if (!apply) { console.log('  (dry run: no links created)'); continue }
    const codes = await ensureBoardKitLinks(id, 'prepare-board-kits')
    const qr = boardKitQrLink(SITE_URL, codes.print, ctx.pagePath)
    console.log(`  kit: ${SITE_URL}/prepared/${claim}/kit`)
    console.log(`  flyer: ${SITE_URL}/prepared/${claim}/kit/flyer   (QR link ${qr.length} characters${qr.includes('?to=') ? '' : ', page link dropped: too long'})`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
