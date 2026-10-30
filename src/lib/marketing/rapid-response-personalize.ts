import 'server-only'
import { prisma } from '@/lib/prisma'
import { extractEmailLinkId } from '@/lib/marketing/email-attribution'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'
import { getStateBoards, getStateCenters, getStateLayoffs } from '@/lib/seo/workforce-pages'

// What https://launchyournextchapter.com/for-rapid-response says to one visitor. The page itself is the same cached
// page for everyone; a small band fills in from this, in order of how well we know the visitor:
//   email    they clicked a tracked link in one of our emails (nc_e): we name their organization and its state
//   state    an ad or link carries ?s=KY: we show that state
//   region   neither: the state Vercel reads from their connection, a guess about where they are and nothing more
//   none     we show nothing extra
// LinkedIn does not tell us who clicked an ad, so an ad click is never "email". Only the organization name, city and
// state of an emailed contact leave this module: no person name, no email address.

export type PersonalizationSource = 'email' | 'state_param' | 'region' | 'none'

export interface RapidResponsePersonalization {
  source: PersonalizationSource
  org?: { name: string; city: string | null }
  state?: { code: string; name: string; notices: number; boards: number; centers: number }
}

const STATE_CODES = new Set(ALL_STATE_CODES)

/** A two-letter US state (or DC) in upper case, or null. */
export function cleanStateCode(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toUpperCase()
  return STATE_CODES.has(code) ? code : null
}

/** An email link id from a query value, or null when it is not shaped like one. */
export function cleanLinkId(value: string | null | undefined): string | null {
  return extractEmailLinkId(`?nc_e=${encodeURIComponent(value ?? '')}`)
}

export async function stateFigures(code: string): Promise<NonNullable<RapidResponsePersonalization['state']> | null> {
  try {
    const [boards, centers, layoffs] = await Promise.all([getStateBoards(code), getStateCenters(code), getStateLayoffs(code)])
    if (boards.length === 0) return null
    return { code, name: stateName(code), notices: layoffs.notices, boards: boards.length, centers: centers.length }
  } catch {
    return null
  }
}

/** The organization an emailed contact works for: their current primary affiliation. */
async function orgOfEmailLink(linkId: string): Promise<{ name: string; city: string | null; state: string | null } | null> {
  const link = await prisma.crmOutreachLink.findUnique({
    where: { id: linkId },
    select: {
      tracking: {
        select: {
          activity: {
            select: {
              person: {
                select: {
                  affiliations: {
                    where: { isCurrent: true },
                    orderBy: { isPrimary: 'desc' },
                    take: 1,
                    select: { org: { select: { name: true, hqCity: true, usState: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  const org = link?.tracking.activity.person?.affiliations[0]?.org
  return org ? { name: org.name, city: org.hqCity, state: org.usState } : null
}

export async function personalizeRapidResponse(input: {
  linkId: string | null
  stateParam: string | null
  regionHeader: string | null
}): Promise<RapidResponsePersonalization> {
  if (input.linkId) {
    const org = await orgOfEmailLink(input.linkId).catch(() => null)
    if (org) {
      const code = cleanStateCode(org.state) ?? cleanStateCode(input.stateParam)
      const state = code ? await stateFigures(code) : null
      return { source: 'email', org: { name: org.name, city: org.city }, ...(state ? { state } : {}) }
    }
  }
  const fromParam = cleanStateCode(input.stateParam)
  const code = fromParam ?? cleanStateCode(input.regionHeader)
  if (!code) return { source: 'none' }
  const state = await stateFigures(code)
  return state ? { source: fromParam ? 'state_param' : 'region', state } : { source: 'none' }
}
