import { describe, expect, it } from 'vitest'
import { NURTURE_STEPS, type NurtureStep } from '@/lib/leads/nurture/config'
import { NO_FACTS, nurtureContent, stateBenefit, type NurtureFacts } from '@/lib/leads/nurture/content'
import { classifyLead, trackOfPersona, type NurtureContext, type NurtureTrack } from '@/lib/leads/nurture/tracks'
import { PERSONAS } from '@/lib/constants/personas'
import { GUIDES } from '@/lib/constants/guides'
import { LTU_JAN_AUG } from '@/lib/press/figures'
import { ALL_STATE_CODES, stateSlug } from '@/lib/seo/states'

const TRACKS: NurtureTrack[] = ['laid_off', 'searching', 'considering', 'changing', 'layoff_watch', 'pay']

const base: NurtureContext = { personaSlug: 'laid-off', firstName: null, stateCode: null, employerSlug: null, titleSlug: null, source: '', followup: null }
const facts: NurtureFacts = { ai: { rawPct: 44.7, likePct: 16.9, nAi: 12214, nBase: 16496, asOf: '2026-10-26' } }

/** Every route an email may link to: the pages that exist (a known path, or a path with a slug in a known place). */
const ALLOWED = [
  /^\/resources\/cobra-aca(\/[a-z-]+)?$/,
  /^\/unemployment-benefits(\/[a-z-]+)?$/,
  /^\/resources\/(bridge-income|warn-act|ai-skills-pay-premium)$/,
  /^\/tools\/(pay-check|layoff-runway)$/,
  /^\/(noexperience|jobs\/title|salaries)$/,
  /^\/salaries\/[a-z0-9-]+$/,
  /^\/reports\/white-collar-index$/,
  /^\/start\/[a-z-]+$/,
]

const allEmails = () => {
  const out: { track: NurtureTrack; step: NurtureStep; ctx: NurtureContext; email: ReturnType<typeof nurtureContent> }[] = []
  for (const track of TRACKS) {
    for (const step of NURTURE_STEPS) {
      for (const ctx of [base, { ...base, firstName: 'Ana', stateCode: 'TX', titleSlug: 'project-manager', personaSlug: 'new-grad' }, { ...base, source: 'layoff_risk_check:tool', personaSlug: 'thinking-about-a-move' }]) {
        out.push({ track, step, ctx, email: nurtureContent(track, step, ctx, facts) })
      }
    }
  }
  return out
}

describe('nurture content', () => {
  it('writes every track and step with one button, plain words and no leftovers', () => {
    for (const { track, step, email } of allEmails()) {
      const where = `${track}/${step}`
      expect(email.subject.length, where).toBeGreaterThan(10)
      expect(email.subject.length, where).toBeLessThanOrEqual(70)
      expect(email.headline, where).toBeTruthy()
      expect(email.ctaLabel, where).toBeTruthy()
      expect(email.ctaPath?.startsWith('/'), where).toBe(true)
      const text = [email.subject, email.headline, ...email.paragraphs, email.footerNote].join(' ')
      expect(text, where).not.toMatch(/undefined|NaN|null|\[object|\{\{|%s/)
      expect(text, where).not.toMatch(/—|–/) // plain punctuation, as the rest of the site's mail
      expect(email.benefits, where).toEqual([])
    }
  })

  it('links only to pages that exist', () => {
    for (const { track, step, email } of allEmails()) {
      const path = email.ctaPath!
      expect(ALLOWED.some((re) => re.test(path)), `${track}/${step}: ${path}`).toBe(true)
    }
  })

  it('says how many more emails are coming, then stops', () => {
    expect(nurtureContent('laid_off', 'next_step', base).footerNote).toMatch(/first of three/)
    expect(nurtureContent('laid_off', 'data_point', base).footerNote).toMatch(/One more/)
    expect(nurtureContent('laid_off', 'assessment', base).footerNote).toMatch(/last note/)
  })

  it('sends the last email of every track to the situation page, so the answer carries over', () => {
    for (const track of TRACKS) {
      const e = nurtureContent(track, 'assessment', { ...base, personaSlug: 'promotion' })
      expect(e.ctaPath).toBe('/start/promotion')
      expect(e.paragraphs.join(' ')).toMatch(/you do not answer that question again/)
    }
  })

  it('points a laid-off person at their state COBRA and benefit pages when the state is known', () => {
    const tx = { ...base, stateCode: 'TX' }
    expect(nurtureContent('laid_off', 'next_step', tx).ctaPath).toBe(`/resources/cobra-aca/${stateSlug('TX')}`)
    expect(nurtureContent('laid_off', 'next_step', tx).paragraphs.join(' ')).toMatch(/Texas page/)
    expect(nurtureContent('laid_off', 'next_step', base).ctaPath).toBe('/resources/cobra-aca')
    const data = nurtureContent('laid_off', 'data_point', tx)
    expect(data.ctaPath).toBe(`/unemployment-benefits/${stateSlug('TX')}`)
    expect(data.paragraphs.join(' ')).toMatch(/Texas pays up to \d+ weeks/)
    expect(nurtureContent('laid_off', 'data_point', base).ctaPath).toBe('/reports/white-collar-index')
  })

  it('quotes the long-search figures exactly as the report states them', () => {
    const s = LTU_JAN_AUG.whiteCollarShare
    const text = nurtureContent('laid_off', 'data_point', base).paragraphs.join(' ')
    expect(text).toContain(`${s.y2026}%`)
    expect(text).toContain(`${s.y2025}%`)
    expect(text).toContain(`+${s.change} points`)
    expect(text).toContain(`±${s.margin90}`)
  })

  it('quotes the AI pay gap with its sample sizes and date, and says what it is not', () => {
    const text = nurtureContent('considering', 'data_point', base, facts).paragraphs.join(' ')
    expect(text).toContain('16.9% higher')
    expect(text).toContain('12,214')
    expect(text).toContain('16,496')
    expect(text).toContain('October 26')
    expect(text).toMatch(/not what anyone is paid/)
    expect(text).toMatch(/does not show that a skill causes a raise/)
  })

  it('falls back to the raw gap with a warning when there is no matched figure, and to the long-search figure with no AI data', () => {
    const raw = nurtureContent('pay', 'data_point', base, { ai: { rawPct: 44.7, likePct: null, nAi: 40, nBase: 60, asOf: '2026-10-26' } }).paragraphs.join(' ')
    expect(raw).toContain('44.7% higher')
    expect(raw).toMatch(/not matched on level or industry/)
    const none = nurtureContent('pay', 'data_point', base, NO_FACTS)
    expect(none.paragraphs.join(' ')).toContain(`${LTU_JAN_AUG.whiteCollarShare.y2026}%`)
  })

  it('uses the risk-check wording for someone who ran it and the pay check for everyone else', () => {
    const risk = nurtureContent('considering', 'next_step', { ...base, source: 'layoff_risk_check:tool' })
    expect(risk.ctaPath).toBe('/tools/layoff-runway')
    expect(nurtureContent('considering', 'next_step', base).ctaPath).toBe('/tools/pay-check')
    expect(nurtureContent('considering', 'assessment', { ...base, source: 'layoff_risk_check:tool' }).subject).toMatch(/Before you need it/)
    expect(nurtureContent('layoff_watch', 'assessment', base).subject).toMatch(/Before you need it/)
    expect(nurtureContent('considering', 'assessment', { ...base, personaSlug: 'promotion' }).subject).toMatch(/^Where do you stand/)
  })

  it('sends a new graduate to the roles that train and a career changer to the title pages', () => {
    expect(nurtureContent('changing', 'next_step', { ...base, personaSlug: 'new-grad' }).ctaPath).toBe('/noexperience')
    expect(nurtureContent('changing', 'next_step', { ...base, personaSlug: 'career-change' }).ctaPath).toBe('/jobs/title')
  })

  it('links a pay check to its own title page, and to the hub when the title is unknown', () => {
    expect(nurtureContent('pay', 'next_step', { ...base, titleSlug: 'project-manager' }).ctaPath).toBe('/salaries/project-manager')
    expect(nurtureContent('pay', 'next_step', base).ctaPath).toBe('/salaries')
  })

  it('greets by first name when we have one', () => {
    expect(nurtureContent('laid_off', 'assessment', { ...base, firstName: 'Ana' }).paragraphs[0]).toBe('Hi Ana,')
    expect(nurtureContent('laid_off', 'assessment', base).paragraphs[0]).toBe('Hi,')
  })
})

describe('state benefit figures', () => {
  it('reads them from the sourced state data and gives nothing for an unknown state', () => {
    expect(stateBenefit(null)).toBeNull()
    expect(stateBenefit('ZZ')).toBeNull()
    for (const code of ALL_STATE_CODES) {
      const b = stateBenefit(code)
      if (b) {
        expect(b.maxWeeks).toBeGreaterThan(0)
        expect(b.name.length).toBeGreaterThan(2)
      }
    }
  })
})

describe('tracks', () => {
  it('gives every persona a track', () => {
    for (const p of PERSONAS) expect(trackOfPersona(p.slug), p.slug).not.toBeNull()
  })

  it('classifies a journey lead by its situation and drops an unknown one', () => {
    expect(classifyLead({ kind: 'journey', situation: 'laid-off', followup: 'months', source: 'home' })?.track).toBe('laid_off')
    expect(classifyLead({ kind: 'journey', situation: 'resigned' })?.track).toBe('searching')
    expect(classifyLead({ kind: 'journey', situation: 'promotion' })?.track).toBe('considering')
    expect(classifyLead({ kind: 'journey', situation: 'new-grad' })?.track).toBe('changing')
    expect(classifyLead({ kind: 'journey', situation: 'not-a-persona' })).toBeNull()
  })

  it('treats a deadline lead as laid off, with its state', () => {
    const c = classifyLead({ kind: 'deadline', searchLoc: 'tx', source: 'cobra_vs_aca:state' })
    expect(c?.track).toBe('laid_off')
    expect(c?.context.stateCode).toBe('TX')
    expect(c?.context.personaSlug).toBe('laid-off')
    expect(classifyLead({ kind: 'deadline', searchLoc: 'ZZ' })?.context.stateCode).toBeNull()
  })

  it('separates a risk-check lead from a layoff watcher', () => {
    expect(classifyLead({ kind: 'layoff_alert', source: 'layoff_risk_check:tool', searchLoc: 'CA' })?.track).toBe('considering')
    const watcher = classifyLead({ kind: 'layoff_alert', source: 'layoffs', searchQ: 'acme-corp' })
    expect(watcher?.track).toBe('layoff_watch')
    expect(watcher?.context.employerSlug).toBe('acme-corp')
  })

  it('keeps a pay check title slug only when it looks like one', () => {
    expect(classifyLead({ kind: 'pay_check', searchQ: 'project-manager' })?.context.titleSlug).toBe('project-manager')
    expect(classifyLead({ kind: 'pay_check', searchQ: '../etc/passwd' })?.context.titleSlug).toBeNull()
  })

  it('sends a guide download to the track its guide was written for', () => {
    const laidOffGuide = GUIDES.find((g) => g.situations?.includes('LAID_OFF'))!
    const otherGuide = GUIDES.find((g) => !g.situations?.includes('LAID_OFF'))!
    expect(classifyLead({ kind: 'guide', guideSlug: laidOffGuide.slug })?.track).toBe('laid_off')
    expect(classifyLead({ kind: 'guide', guideSlug: otherGuide.slug })?.track).toBe('considering')
    expect(classifyLead({ kind: 'guide', guideSlug: 'nope' })).toBeNull()
  })
})
