// Measures relevance (src/lib/jobs/relevance.ts) on real members: the old and new relevant
// counts, which criterion removes the most jobs, Narrow / Wide counts and market tier, the
// explanation line, example bridges, market size, and timings. Read-only.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/measure-search-breadth.ts <candidateId>...
import { prisma } from '../../src/lib/prisma'
import { findLightRows } from '../../src/lib/jobs/board-light-rows'
import { boardLevelWindowWhere, liveBoardWhere, loadBoardShortlist } from '../../src/lib/jobs/board-shortlist'
import { memberStageWindow } from '../../src/lib/jobs/career-stage'
import { boardBreadthFor, passesSkillsThreshold } from '../../src/lib/jobs/search-breadth'
import { buildBridge, relevanceLine } from '../../src/lib/jobs/relevance'
import { subFunctionLabel } from '../../src/lib/jobs/sub-functions'
import { jobSkillGap } from '../../src/lib/jobs/job-skill-gap'
import { memberSkillKeywords } from '../../src/lib/jobs/skill-gap-data'
import { jobIndustryBucket } from '../../src/lib/profile/industry-reading'
import { loadMarketSize } from '../../src/lib/market/market-size-server'
import { growthPhrase } from '../../src/lib/market/market-size'

async function main() {
  for (const id of process.argv.slice(2)) {
    const profile = await prisma.candidateProfile.findUniqueOrThrow({ where: { id } })
    const window = memberStageWindow(profile)
    const base = { candidate: profile, isCandidatePlus: true, stageWindow: window, includeMidLevel: true, includeEarlyCareer: true }
    // Warm the shared board, the classifier and the side reads.
    await loadBoardShortlist({ ...base, breadth: 'narrow' })
    let t = Date.now()
    const narrow = await loadBoardShortlist({ ...base, breadth: 'narrow' })
    const narrowMs = Date.now() - t
    t = Date.now()
    const wide = await loadBoardShortlist({ ...base, breadth: 'wide' })
    const wideMs = Date.now() - t
    const c = narrow.breadth.classifier!
    const m = c.member

    // Funnel over the member's level window.
    const rows = await findLightRows(liveBoardWhere(boardLevelWindowWhere(undefined, { window, includeMidLevel: true, includeEarlyCareer: true })))
    let oldField = 0, oldNarrow = 0, fnOwn = 0, fnGeo = 0, fnGeoSkills = 0, allFour = 0
    const removed = { function: 0, geography: 0, skills: 0, industry: 0 }
    for (const r of rows) {
      const { cls, crit } = c.criteria(r)
      if (cls?.kind === 'field') oldField++
      if (cls && (cls.kind === 'field' || cls.kind === 'pivot' || (cls.kind === 'skills' && passesSkillsThreshold({ score: cls.score ?? 0, related: cls.related }, 'narrow')))) oldNarrow++
      if (cls?.kind === 'field') {
        if (crit.fn !== 'own') removed.function++
        if (!crit.geo) removed.geography++
        if (crit.skills === 'weak' || crit.skills === 'none') removed.skills++
        if (!crit.industry) removed.industry++
      }
      if (crit.fn !== 'own') continue
      fnOwn++
      if (!crit.geo) continue
      fnGeo++
      if (crit.skills === 'weak' || crit.skills === 'none') continue
      fnGeoSkills++
      if (crit.industry) allFour++
    }
    const total = (b: typeof narrow) => b.openTotal + b.lockedTotal
    console.log(`\n=== ${id} | ${profile.highestLevelReached ?? '-'} ${profile.yearsExperience ?? '-'}y | ${profile.primaryFunction} | "${profile.resumeLatestJobTitle ?? ''}" | ${profile.industryContext ?? ''} | ${profile.currentCity ?? '-'}, ${profile.currentState ?? '-'} | remote ${profile.remotePreference ?? '-'} | relocate ${profile.openToRelocation ? profile.relocationNotes ?? 'yes' : 'no'}`)
    console.log(`member: sub ${m.subFunction} | soc ${m.soc} (from title ${m.socFromTitle}) | industries ${[...m.industries].join(', ') || '-'} | skills vocab ${m.vocab?.size ?? 0} | geo ${m.geo?.unknown ? 'unknown' : `home ${m.geo?.homeArea ? m.geo.homeArea.size + ' places' : (m.geo?.homeState ?? 'none')}, remote ${m.geo?.acceptsRemote}, relocate ${[...(m.geo?.relocation ?? [])].join('/') || '-'}`}`)
    console.log(`window ${rows.length} | OLD: bare-function field ${oldField}, old Narrow set ${oldNarrow}`)
    console.log(`NEW funnel: own sub-function/occupation ${fnOwn} → + place ${fnGeo} → + skills ${fnGeoSkills} → + own industry ${allFour} | relevant (incl. strong fits outside their industries) ${narrow.breadth.relevantTotal}`)
    console.log(`of the ${oldField} old-field jobs, each criterion alone removes: ${JSON.stringify(removed)}`)
    console.log(`default ${boardBreadthFor(profile)} | tier ${narrow.breadth.marketTier} | Narrow ${total(narrow)} (more good matches ${narrow.breadth.goodMoreIds.length}) | Wide ${total(wide)} (extras ${wide.breadth.extrasTotal})`)
    console.log(`line: ${relevanceLine({ breadth: 'narrow', relevant: narrow.breadth.relevantTotal, shown: narrow.breadth.narrowTotal, field: subFunctionLabel(m.subFunction) ?? m.functionLabel ?? 'matching', place: null, extras: 0 })}`)
    console.log(`ms: narrow warm ${narrowMs} | wide warm ${wideMs}`)
    const keywords = memberSkillKeywords(profile)
    let shown = 0
    for (const p of wide.open) {
      const placed = c.place(p)
      if (!placed || placed.relaxed === null || placed.relaxed === 'out' || shown >= 4) continue
      shown++
      const gap = jobSkillGap({ title: p.title, description: p.description, skills: p.skills, memberKeywords: keywords })
      const soc = c.occupations.socs.get(p.id)
      const b = buildBridge({ relaxed: placed.relaxed, fieldLabel: subFunctionLabel(m.subFunction) ?? m.functionLabel ?? 'your field', have: gap.have, missing: gap.missing.length > 0 ? gap.missing : soc && m.occupationGaps ? m.occupationGaps(soc) : [], occupationShared: soc ? m.similar.get(soc)?.shared : undefined, jobIndustry: jobIndustryBucket(p.industry), companyName: p.companyName })
      console.log(`  bridge [${b.relaxed}] ${p.title} @ ${p.companyName} (${p.location}) | transfers: ${b.transfers} | missing: ${b.missing} | ${b.learn.label} · ${b.network.label}`)
    }
    const market = await loadMarketSize(profile, { count: narrow.breadth.relevantTotal, tier: narrow.breadth.marketTier })
    if (market) {
      console.log(`market: ${market.target.label} | relevant ${narrow.breadth.relevantTotal} | wider market open ${market.counts.openNow} | ${growthPhrase(market.growth)} | prompt ${market.prompt}`)
      for (const a of market.areas) console.log(`  area: ${a.label} · ${a.openNow} open`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
