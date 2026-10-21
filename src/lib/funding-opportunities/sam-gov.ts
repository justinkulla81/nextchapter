import { classifySetAside } from './eligibility'
import { agencyFromSamPath, decodeEntities, parseUsDate, titleScore, type FundingNotice, type NoticeKind } from './relevance'

// SAM.gov Get Opportunities v2. Needs SAM_API_KEY (free; register at sam.gov →
// Account Details). A key with no SAM role is limited to ~10 requests a day, so
// the caller searches by a handful of NAICS codes and filters titles locally.
const API = 'https://api.sam.gov/opportunities/v2/search'

// The API takes a single ptype letter, so one request per NAICS code would be
// four times the quota. Ask for everything and keep the notice types we want
// locally: solicitation, combined synopsis/solicitation, presolicitation,
// sources sought. Award notices, J&As and surplus sales are dropped here.
const KEEP_TYPE = /solicitation|presolicitation|sources sought|request for information/i

interface SamOpp {
  noticeId?: string
  title?: string
  solicitationNumber?: string
  fullParentPathName?: string
  postedDate?: string
  type?: string
  baseType?: string
  responseDeadLine?: string | null
  typeOfSetAside?: string | null
  typeOfSetAsideDescription?: string | null
  uiLink?: string
  officeAddress?: { city?: string; state?: string }
  pointOfContact?: { fullName?: string; title?: string; email?: string; phone?: string; type?: string }[]
}

const fmt = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`

export async function searchSam(apiKey: string, ncode: string, from: Date, to: Date): Promise<SamOpp[]> {
  const url = new URL(API)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('postedFrom', fmt(from))
  url.searchParams.set('postedTo', fmt(to))
  url.searchParams.set('ncode', ncode)
  url.searchParams.set('limit', '1000')
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`SAM.gov ${res.status}`) // never echo the URL: it carries the key
  const json = (await res.json()) as { opportunitiesData?: SamOpp[] }
  return json.opportunitiesData ?? []
}

const kindOf = (o: SamOpp): NoticeKind => {
  const t = `${o.type ?? ''} ${o.baseType ?? ''}`.toLowerCase()
  if (t.includes('sources sought') || t.includes('request for information')) return 'RFI'
  if (t.includes('presolicitation')) return 'PRESOLICITATION'
  return 'RFP'
}

/** Notices whose title names our subject, one per notice id, with the NAICS that found them. */
export function noticesFromSam(byNaics: Record<string, SamOpp[]>): FundingNotice[] {
  const byId = new Map<string, FundingNotice>()
  for (const [ncode, opps] of Object.entries(byNaics)) {
    for (const o of opps) {
      if (!o.noticeId || !o.title || !titleScore(o.title)) continue
      if (!KEEP_TYPE.test(`${o.type ?? ''} ${o.baseType ?? ''}`) || /award/i.test(o.type ?? '')) continue
      const existing = byId.get(o.noticeId)
      if (existing) {
        existing.matched.push(`NAICS ${ncode}`)
        continue
      }
      // Only a contact the notice itself publishes; a primary one first.
      const poc = (o.pointOfContact ?? []).filter((p) => p.fullName?.trim())
      const best = poc.find((p) => p.type === 'primary') ?? poc[0]
      const elig = classifySetAside(o.typeOfSetAside, o.typeOfSetAsideDescription)
      byId.set(o.noticeId, {
        source: 'sam.gov',
        id: o.solicitationNumber || o.noticeId,
        title: decodeEntities(o.title),
        kind: kindOf(o),
        agency: agencyFromSamPath(o.fullParentPathName ?? ''),
        agencyType: 'GOVERNMENT',
        postedAt: parseUsDate(o.postedDate),
        closesAt: parseUsDate(o.responseDeadLine ?? undefined),
        url: o.uiLink || `https://sam.gov/opp/${o.noticeId}/view`,
        state: o.officeAddress?.state && /^[A-Za-z]{2}$/.test(o.officeAddress.state) ? o.officeAddress.state.toUpperCase() : null,
        city: o.officeAddress?.city?.trim() || null,
        matched: [`NAICS ${ncode}`],
        externalId: o.noticeId,
        eligibility: elig.eligibility,
        applicantKinds: elig.kinds,
        partnerKinds: elig.partnerKinds,
        eligibilityNote: elig.note,
        contact: best
          ? { fullName: best.fullName!.trim(), title: best.title?.trim() || null, email: best.email?.trim() || null, phone: best.phone?.trim() || null }
          : null,
      })
    }
  }
  return [...byId.values()]
}
