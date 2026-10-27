/**
 * Create the launch-kit links for organizations and print the addresses to send (the kit page is unlisted and lives under the claim page).
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/branding/prepare-kits.ts --slugs employindy,careersource-broward-fl [--apply]
 *
 * A slug is the organization's claim address (https://launchyournextchapter.com/prepared/<slug>). Works for a workforce board, an American Job
 * Center, an economic development organization, a college and an employer. Default is a dry run: it checks each organization has a page we
 * make a kit for and says what colors it has. --apply creates the four tracked links per organization. Nothing is sent to anyone.
 */
import { prisma } from '../../src/lib/prisma'
import { getOrgBrand } from '../../src/lib/branding/store'
import { ensureKitLinks, orgKitContext } from '../../src/lib/org-claims/org-kit-data'
import { kitQrLink } from '../../src/lib/org-claims/org-kit'
import { SITE_URL } from '../../src/lib/org-claims/urls'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const slugs = (arg('--slugs') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (slugs.length === 0) {
    console.log('usage: prepare-kits.ts --slugs a,b,c [--apply]')
    return
  }
  const apply = process.argv.includes('--apply')
  for (const slug of slugs) {
    console.log(`\n${slug}`)
    const ctx = await orgKitContext(slug)
    if (!ctx) { console.log('  no kit: not a board, job center, economic development organization, college or employer with a page'); continue }
    const brand = await getOrgBrand(ctx.brandKind, ctx.brandId)
    console.log(`  ${ctx.kind}: ${ctx.name}${ctx.area ? ` (${ctx.area})` : ''}`)
    console.log(`  page: ${SITE_URL}${ctx.pagePath}`)
    console.log(`  brand: ${brand ? `${brand.pair.primary} / ${brand.pair.secondary}${brand.pair.secondaryDerived ? ' (second derived)' : ''}` : 'none yet'}`)
    if (!apply) { console.log('  (dry run: no links created)'); continue }
    const codes = await ensureKitLinks(ctx.kind, ctx.id, 'prepare-kits')
    const qr = kitQrLink(SITE_URL, codes.print, ctx.pagePath)
    console.log(`  kit: ${SITE_URL}/prepared/${slug}/kit`)
    console.log(`  flyer: ${SITE_URL}/prepared/${slug}/kit/flyer   (QR link ${qr.length} characters${qr.includes('?to=') ? '' : ', page link dropped: too long'})`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
