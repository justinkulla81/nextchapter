import { describe, expect, it } from 'vitest'
import { STAGES } from '@/lib/journey/journey'
import { MENU_LABELS, MENU_RULES, itemVisibility, menuMode, type MenuItemKey } from '@/lib/journey/menu'
import { STAGE_GUIDE, STAGE_ORDER, menuFor, stageDescription } from '@/lib/journey/stage-guide'

describe('stage guide', () => {
  it('covers every stage the product has, in order', () => {
    expect(STAGE_ORDER).toEqual(STAGES.map((s) => s.key))
    expect(Object.keys(STAGE_GUIDE).sort()).toEqual([...STAGE_ORDER].sort())
  })
  it('every activity is served by a feature that is on the menu in that stage', () => {
    for (const stage of STAGE_ORDER) {
      const mode = menuMode(stage)
      for (const a of STAGE_GUIDE[stage].activities) {
        expect(itemVisibility(a.feature, mode), `${stage}: ${a.activity} -> ${a.feature}`).toBe('show')
      }
    }
  })
  it('every stage says who is in it, how it is marketed and which emails they get', () => {
    for (const stage of STAGE_ORDER) {
      const g = STAGE_GUIDE[stage]
      expect(g.who.length).toBeGreaterThan(15)
      expect(g.marketing.headline.length).toBeGreaterThan(8)
      expect(g.marketing.body.length).toBeGreaterThan(40)
      expect(g.activities.length).toBeGreaterThanOrEqual(4)
      expect(g.emails.length).toBeGreaterThan(0)
      expect(stageDescription(stage).length).toBeGreaterThan(20)
    }
  })
  it('no marketing text promises a point-score, an outcome rate or the word paused', () => {
    for (const stage of STAGE_ORDER) {
      const text = `${STAGE_GUIDE[stage].marketing.headline} ${STAGE_GUIDE[stage].marketing.body}`
      expect(text).not.toMatch(/\d+%|guarantee|paused|break/i)
    }
  })
  it('the menu summary comes from the real rules: locked while exploring, nothing locked while applying', () => {
    expect(menuFor('EXPLORING').locked).toContain(MENU_LABELS.jobs)
    expect(menuFor('APPLYING').locked).toEqual([])
    expect(menuFor('STAYING').shown).toContain(MENU_LABELS.growCase)
    expect(menuFor('LANDED').shown).not.toContain(MENU_LABELS.jobs)
  })
  it('every menu item has a label and a rule', () => {
    const keys = Object.keys(MENU_RULES) as MenuItemKey[]
    expect(Object.keys(MENU_LABELS).sort()).toEqual([...keys].sort())
    for (const k of keys) expect(MENU_LABELS[k].length).toBeGreaterThan(2)
  })
})
