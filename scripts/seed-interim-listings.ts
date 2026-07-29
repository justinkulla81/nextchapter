// One-time content seed for the Interim Work page's fractional-marketplace,
// expert-network, and board/advisory listings (Prompt 68). This is real
// page content the admin portal can edit afterward — NOT test/fixture
// data — so this script skips any (category, name) pair that already
// exists rather than delete-then-recreate, so re-running it never clobbers
// an admin's edits.
//
// Designation status reflects what was actually confirmed as of this
// writing (see IDEAS.md) — most of these are INCLUDED_FOR_QUALITY, not
// PARTNER, because no revenue arrangement has been confirmed yet.
//
// Run: npm run seed:interim-listings

import { PrismaClient, InterimListingCategory, InterimListingDesignation } from '@prisma/client'

const prisma = new PrismaClient()

interface SeedListing {
  category: InterimListingCategory
  name: string
  description: string
  url: string
  designation: InterimListingDesignation
  designationNote?: string
  sortOrder: number
}

const LISTINGS: SeedListing[] = [
  // Fractional / talent marketplaces
  {
    category: 'MARKETPLACE_TECHNICAL',
    name: 'Mercor',
    description: 'AI-vetted marketplace matching experts with AI training, evaluation, and technical contract work.',
    url: 'https://mercor.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 1,
  },
  {
    category: 'MARKETPLACE_TECHNICAL',
    name: 'Toptal',
    description: 'Vetted freelance network for top-tier engineering, design, and finance talent.',
    url: 'https://www.toptal.com',
    designation: 'INCLUDED_FOR_QUALITY',
    designationNote:
      'Toptal has an active referral program, but it is structured for referring paying client companies, not talent — not labeled "Partner" for candidate referrals until a bespoke talent-referral arrangement is separately confirmed.',
    sortOrder: 2,
  },
  {
    category: 'MARKETPLACE_GENERAL',
    name: 'Catalant',
    description: 'Marketplace connecting consultants and fractional executives with enterprise projects.',
    url: 'https://www.catalant.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 1,
  },
  {
    category: 'MARKETPLACE_GENERAL',
    name: 'Business Talent Group',
    description: 'Independent consultants and executives for strategy, ops, and marketing engagements.',
    url: 'https://www.businesstalentgroup.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 2,
  },
  {
    category: 'MARKETPLACE_MARKETING',
    name: 'MarketerHire',
    description: 'Vetted marketplace specifically for fractional and contract marketing talent.',
    url: 'https://www.marketerhire.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 1,
  },
  {
    category: 'MARKETPLACE_STARTUP',
    name: 'Bolster',
    description: 'Fractional and interim executive marketplace built specifically for startup-stage companies.',
    url: 'https://bolster.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 1,
  },
  {
    category: 'MARKETPLACE_ANY_FUNCTION',
    name: 'Fractional Jobs',
    description: 'Function-agnostic job board for fractional and interim roles across every discipline.',
    url: 'https://fractionaljobs.co',
    designation: 'INCLUDED_FOR_QUALITY',
    designationNote:
      'A flat per-placement referral fee model exists; candidate-side vs. client-side fee structure not yet confirmed.',
    sortOrder: 1,
  },

  // Expert networks
  {
    category: 'EXPERT_NETWORK',
    name: 'GLG (Gerson Lehrman Group)',
    description: 'Expert network connecting professionals with paid consulting calls and short projects.',
    url: 'https://glg.it',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 1,
  },
  {
    category: 'EXPERT_NETWORK',
    name: 'AlphaSights',
    description: 'Expert network connecting professionals with paid consulting engagements, primarily for investors and consulting firms.',
    url: 'https://www.alphasights.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 2,
  },
  {
    category: 'EXPERT_NETWORK',
    name: 'Guidepoint',
    description: 'Expert network similar to GLG, spanning most industries.',
    url: 'https://www.guidepoint.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 3,
  },
  {
    category: 'EXPERT_NETWORK',
    name: 'Third Bridge',
    description: 'Expert network connecting industry specialists with investors and corporations for paid calls.',
    url: 'https://www.thirdbridge.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 4,
  },

  // Board & advisory (seniority-gated)
  {
    category: 'BOARD_ADVISORY',
    name: 'NACD (National Association of Corporate Directors)',
    description: 'The standard credential and network for board-readiness — director registry, education, and matching.',
    url: 'https://www.nacdonline.org',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 1,
  },
  {
    category: 'BOARD_ADVISORY',
    name: 'BoardProspects',
    description: 'Board seat matching platform for executives seeking director or advisory roles.',
    url: 'https://www.boardprospects.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 2,
  },
  {
    category: 'BOARD_ADVISORY',
    name: 'Athena Alliance',
    description: 'Board-readiness network and matching platform, with a focus on increasing board diversity.',
    url: 'https://www.athenaalliance.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 3,
  },
  {
    category: 'BOARD_ADVISORY',
    name: 'theBoardlist',
    description: 'Board seat matching platform originally focused on qualified women executives.',
    url: 'https://www.theboardlist.com',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 4,
  },

  // Nonprofit board — shown below the seniority gate instead of hiding the section
  {
    category: 'NONPROFIT_BOARD',
    name: 'BoardSource',
    description: 'The leading resource for nonprofit board governance, including board-matching guidance.',
    url: 'https://boardsource.org',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 1,
  },
  {
    category: 'NONPROFIT_BOARD',
    name: 'Catchafire',
    description: 'Matches professionals with nonprofits for skilled volunteering, including board and advisory roles.',
    url: 'https://www.catchafire.org',
    designation: 'INCLUDED_FOR_QUALITY',
    sortOrder: 2,
  },
]

async function main() {
  let created = 0
  let skipped = 0
  for (const listing of LISTINGS) {
    const existing = await prisma.interimListing.findFirst({
      where: { category: listing.category, name: listing.name },
    })
    if (existing) {
      skipped++
      continue
    }
    await prisma.interimListing.create({ data: listing })
    created++
  }
  console.log(`Created ${created} listings, skipped ${skipped} already-existing.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
