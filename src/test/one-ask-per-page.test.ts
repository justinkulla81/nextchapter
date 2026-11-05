import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Owner rule: a public page makes one registration ask. The 2026-11-05 crawl found these pages carrying a second one
// (a state-colored band, a bottom action band, a footer band, a repeated button). They must not get it back.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('one registration ask per page', () => {
  it('layoff state and company pages have no candidate band beside the box', () => {
    for (const p of ['src/app/layoffs/[state]/page.tsx', 'src/app/layoffs/company/[slug]/page.tsx']) expect(read(p)).not.toContain('<OrgCandidateBand')
  })
  it('pages with their own ask turn the footer band off', () => {
    for (const [p, page] of [['src/app/about/page.tsx', 'about'], ['src/app/ai-skills/page.tsx', 'ai-skills'], ['src/app/funding/page.tsx', 'funding'], ['src/app/scam-watch/page.tsx', 'scam-watch'], ['src/app/layoffs/company/[slug]/page.tsx', 'layoffs']]) {
      expect(read(p), p).toContain(`<PublicSiteFooter page="${page}" cta={false} />`)
    }
  })
  it('seeker tool pages have no bottom action band; the box carries the tool-specific copy', () => {
    for (const t of ['job-loss-readiness', 'layoff-runway', 'layoff-deadlines', 'unemployment-estimator', 'ai-job-check', 'pay-check', 'salary-converter', 'resume-check', 'resume-job-match']) {
      expect(read(`src/app/tools/${t}/page.tsx`), t).not.toContain('<ActionBand')
    }
  })
  it('AI job check detail and compare pages leave the ask to the box', () => {
    for (const p of ['src/app/tools/ai-job-check/[slug]/page.tsx', 'src/app/tools/ai-job-check/compare/[pair]/page.tsx']) expect(read(p), p).not.toContain('MARKET_REALITY_START_HREF')
  })
  it('the home page asks once, in the hero', () => {
    const home = read('src/components/home/NewHome.tsx')
    expect(home.match(/MARKET_REALITY_START_HREF/g)?.length).toBe(2) // the import and the hero link
    expect(read('src/components/home/HomeFunding.tsx')).not.toContain('MARKET_REALITY_START_HREF')
  })
})

describe('box above the tool', () => {
  const pages = (dir: string): string[] =>
    readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? pages(`${dir}/${e.name}`) : e.name === 'page.tsx' ? [`${dir}/${e.name}`] : []))
  it('every tool page opens with the box, above the tool', () => {
    for (const p of pages('src/app/tools')) expect(read(p), p).toMatch(/<SeoPage\s+boxFirst/)
  })
  it('the WARN tools sit under Rapid response, so they show the organization box, not the job seeker one', () => {
    for (const t of ['warn-act-checker', 'warn-notice-generator']) expect(read(`src/app/tools/${t}/page.tsx`), t).toContain("{ name: 'Rapid response', path: '/rapid-response' }")
  })
})

describe('directory pages (workforce boards, job centers, economic development)', () => {
  it('open with the organization box and carry no job seeker band', () => {
    const src = read('src/components/seo/OrgPageView.tsx')
    expect(src).toMatch(/look="audience"\s+boxFirst/)
    expect(src).not.toContain('<OrgCandidateBand')
    expect(src).toContain('Independent page. Not run by or affiliated with')
  })
})
