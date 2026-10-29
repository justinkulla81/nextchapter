import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { heavy, memoTtl } from '@/lib/db/heavy'
import { employerSlug } from '@/lib/seo/employer-slug'
import { normalizeOrgName } from '@/lib/text/org-name-match'

export interface PeerEmployer { name: string; href: string }
export interface Peers { industry: string | null; homeState: string | null; near: PeerEmployer[]; similar: PeerEmployer[] }

/** Names that are also plain words, so a link reads like a broken label ("Remote — open jobs"). Add to this short list when one shows up. */
const AMBIGUOUS_NAMES = ['remote']

/** Brands an employer owns, so they are not shown as a different company. Small on purpose: add a line when one shows up. */
const OWN_BRANDS: Record<string, string[]> = {
  microsoft: ['swiftkey', 'linkedin', 'github', 'activision blizzard', 'nuance', 'mojang'],
  amazon: ['whole foods market', 'zappos', 'twitch', 'ring', 'audible'],
  alphabet: ['google', 'youtube', 'waymo', 'verily'],
  google: ['youtube', 'waymo', 'verily', 'fitbit'],
  meta: ['instagram', 'whatsapp'],
}

const EMPTY: Peers = { industry: null, homeState: null, near: [], similar: [] }

type Row = { name: string; cn: string; cid: string }
const toPeer = (r: Row): PeerEmployer => ({ name: r.name, href: `/employers/${employerSlug(r.cn, r.cid)}` })

/**
 * Employers like this one, from the hiring profile each employer already has (industry, the states it hires in, open roles):
 * "near" are the employers with the most open roles whose biggest hiring state is this employer's state, "similar" are the same
 * line of work whose biggest state is elsewhere (for people open to remote or relocating). Only employers with an employer page (3+ open roles) are listed,
 * and a company with no profile or industry gets no rows. Cached for an hour per industry and state, never scanned on a page view.
 */
async function load(industry: string, homeState: string | null, selfCanonical: string, selfFirstWord: string): Promise<{ near: Row[]; similar: Row[] }> {
  const [near, similar] = await Promise.all([
    // Hiring most where this employer is, same line of work first.
    homeState
      ? prisma.$queryRaw<Row[]>(Prisma.sql`
          SELECT c.name AS name, c."canonicalNameNormalized" AS cn, c.id AS cid
          FROM "CompanyHiringProfile" p JOIN "Company" c ON c.id = p."companyId"
          WHERE p.states[1] = ${homeState} AND p."openNow" >= 25 AND c."canonicalNameNormalized" <> ${selfCanonical}
            AND lower(c.name) <> ALL(${AMBIGUOUS_NAMES}) AND lower(c.name) NOT LIKE ${selfFirstWord + '%'}
          ORDER BY p."openNow" DESC LIMIT 6`)
      : Promise.resolve([] as Row[]),
    // The same line of work, based somewhere else.
    prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT c.name AS name, c."canonicalNameNormalized" AS cn, c.id AS cid
      FROM "CompanyHiringProfile" p JOIN "Company" c ON c.id = p."companyId"
      WHERE p.industry = ${industry} AND p."openNow" >= 25 AND cardinality(p.states) > 0
        AND (${homeState}::text IS NULL OR p.states[1] <> ${homeState}) AND c."canonicalNameNormalized" <> ${selfCanonical}
        AND lower(c.name) <> ALL(${AMBIGUOUS_NAMES}) AND lower(c.name) NOT LIKE ${selfFirstWord + '%'}
      ORDER BY p."openNow" DESC LIMIT 6`),
  ])
  return { near, similar }
}
const cached = memoTtl(3600_000, (industry: string, home: string | null, self: string, _first: string) => `${industry}|${home}|${self}`, (industry: string, home: string | null, self: string, first: string) => heavy(() => load(industry, home, self, first)))

/** The company's first word, lower case, so its own brands (Microsoft Research, Microsoft Azure) are not listed as someone else. */
const firstWord = (name: string) => name.trim().split(/[\s,.]+/)[0].toLowerCase()

export async function getPeerEmployers(name: string, noticeState: string | null): Promise<Peers> {
  try {
    const canonical = normalizeOrgName(name)
    const profile = await prisma.companyHiringProfile.findFirst({
      where: { company: { canonicalNameNormalized: canonical } },
      select: { industry: true, states: true },
    })
    if (!profile?.industry) return EMPTY
    const homeState = noticeState ?? profile.states[0] ?? null
    const { near, similar } = await cached(profile.industry, homeState, canonical, firstWord(name))
    const own = new Set(OWN_BRANDS[canonical] ?? [])
    const keep = (r: Row) => !own.has(r.name.toLowerCase())
    return { industry: profile.industry, homeState, near: near.filter(keep).map(toPeer), similar: similar.filter(keep).map(toPeer) }
  } catch {
    return EMPTY
  }
}
