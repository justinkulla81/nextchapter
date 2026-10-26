import type { EmployerInsights } from '@/lib/seo/employer-insights'

// Plain-language sentences for an employer page, written from its own counts (no AI). Each sentence is only produced
// when the count behind it is large enough to say something real, so a small employer gets fewer, not vaguer, lines.

const n0 = (n: number) => n.toLocaleString('en-US')
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = (key: string) => MONTH[Number(key.slice(5, 7)) - 1] ?? key

export interface InsightText {
  glance: string[]
  faq: { q: string; a: string }[]
}

export function insightText(name: string, ins: EmployerInsights, industry: string | null): InsightText {
  const { live, history, benchmark, rank } = ins
  const glance: string[] = []
  const faq: { q: string; a: string }[] = []

  const since = history.trackedSince ? `${monthLabel(history.trackedSince.slice(0, 7))} ${history.trackedSince.slice(0, 4)}` : null
  if (history.trackedDays >= 180 && (history.last90 >= 3 || history.prior90 >= 3)) {
    if (history.prior90 > 0) {
      const change = Math.round(((history.last90 - history.prior90) / history.prior90) * 100)
      const dir = change === 0 ? 'the same as' : change > 0 ? `up ${n0(change)}% on` : `down ${n0(Math.abs(change))}% on`
      glance.push(`${name} opened ${n0(history.last90)} professional roles in the last 90 days, ${dir} the 90 days before (${n0(history.prior90)}).`)
    }
  } else if (since && history.opened12mo >= 3) {
    glance.push(`We have tracked ${name}'s career site since ${since}; it has opened ${n0(history.opened12mo)} professional roles in that time.`)
  }
  if (live.open >= 3) {
    if (live.entry > 0) {
      const a = `${n0(live.entry)} of ${name}'s ${n0(live.open)} open roles (${pct(live.entry, live.open)}%) are entry-level or early-career${live.noExp > 0 ? `; ${n0(live.noExp)} of them say people without experience are welcome` : ''}${live.training > 0 ? ` and ${n0(live.training)} describe structured training` : ''}.`
      glance.push(a)
      faq.push({ q: `Does ${name} hire entry-level candidates?`, a: `Yes. ${a} Entry-level means roughly 0 to 3 years of experience, read from the title, the employer and the full posting.` })
    } else {
      glance.push(`None of ${name}'s ${n0(live.open)} open roles is entry-level; they ask for experience.`)
    }
  }
  if (live.aiSkill > 0 && live.open >= 3) {
    const tools = live.aiTools.slice(0, 4).map((t) => t.name)
    glance.push(`${n0(live.aiSkill)} open roles (${pct(live.aiSkill, live.open)}%) ask for a specific AI skill${tools.length ? `; tools named include ${tools.join(', ')}` : ''}.`)
  }
  const arrangement = live.remote + live.hybrid + live.onsite
  if (arrangement >= 3) {
    const bits = [live.remote && `${n0(live.remote)} remote`, live.hybrid && `${n0(live.hybrid)} hybrid`, live.onsite && `${n0(live.onsite)} on-site`].filter(Boolean)
    const a = `Of the ${n0(arrangement)} open roles that state where the work happens, ${bits.join(', ')}.`
    glance.push(a)
    faq.push({ q: `Does ${name} offer remote or hybrid jobs?`, a: `${a}` })
  }
  const reqBits = [
    live.clearance > 0 && `${n0(live.clearance)} require a security clearance`,
    live.noSponsorship > 0 && `${n0(live.noSponsorship)} say the employer cannot sponsor a visa`,
  ].filter(Boolean)
  if (reqBits.length) glance.push(`Among open roles, ${reqBits.join(' and ')}.`)
  if (live.open >= 5 && ins.profile.postedPayShare != null) {
    const share = Math.round(ins.profile.postedPayShare * 100)
    glance.push(`${share}% of its roles post a salary range${benchmark?.medianPostedPayShare != null ? `, against a median of ${Math.round(benchmark.medianPostedPayShare * 100)}% for ${industry ?? 'its industry'} employers` : ''}.`)
  }
  if (live.new7d > 0 && live.open >= 3) glance.push(`${n0(live.new7d)} roles were posted in the last 7 days; the median open role was posted ${live.medianAgeDays != null ? `${n0(live.medianAgeDays)} days ago` : 'recently'}.`)
  if (rank && industry) glance.push(`By open professional roles, ${name} ranks #${n0(rank.position)} of ${n0(rank.of)} ${industry} employers we track.`)

  if (live.topSkills.length >= 3) {
    faq.push({ q: `What skills does ${name} ask for?`, a: `Across its open roles the skills named most often are ${live.topSkills.slice(0, 6).map((s) => `${s.name} (${n0(s.count)})`).join(', ')}.` })
  }
  return { glance, faq }
}

/** How many separate kinds of data a page has: used to decide whether it has enough of its own to be indexed. */
export function insightRichness(ins: EmployerInsights): number {
  const { live, history, benchmark } = ins
  return [
    history.opened12mo >= 3,
    live.topSkills.length >= 3,
    live.entry > 0,
    live.aiSkill > 0,
    live.remote + live.hybrid + live.onsite >= 3,
    live.postedPay > 0,
    benchmark != null,
  ].filter(Boolean).length
}
