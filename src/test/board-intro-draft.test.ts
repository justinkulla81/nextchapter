import { describe, expect, it } from 'vitest'
import { ALONGSIDE, CLOSE, SIGN_OFF } from '@/lib/warn/layoff-alert-drafts'
import { MIN_LOCAL_NOTICES, boardIntroDraft, type BoardIntroInput } from '@/lib/workforce/board-intro-draft'

const base: BoardIntroInput = {
  contactName: 'Ken Denning', org: 'EmployIndy', page: 'https://launchyournextchapter.com/workforce-boards/indiana/employindy', area: 'Marion County',
  jobs: 1521, entryLevel: 519, topEmployers: ['Eli Lilly', 'Masco', 'V2X', 'Other'], nationalNotices: 2563, nationalWorkers: 271304, areaNotices: 6, areaWorkers: 964,
}

describe('board intro draft', () => {
  const d = boardIntroDraft(base)
  it('shares the layoff alert notes\' paragraph, close and signature, and ends on the 15-minute call before the signature', () => {
    expect(d.body).toContain(ALONGSIDE)
    expect(d.body).toContain(CLOSE)
    expect(d.body.endsWith(SIGN_OFF)).toBe(true)
    expect(d.body).toContain('Could we grab 15 minutes this week?')
  })
  it('opens with a first-name greeting and the founder line, keeping the 20 years sentence', () => {
    expect(d.body.startsWith('Hi Ken,\n\nI\'m Justin Kulla, founder of NextChapter, the leading job transition platform built for laid-off professionals.')).toBe(true)
    expect(d.body).toContain('about 20 years building and investing in education, training and workforce companies')
  })
  it('states checkable numbers, names three employers and carries one link', () => {
    expect(d.subject).toBe('1,521 open jobs in Marion County')
    expect(d.body).toContain('1,521 professional jobs are open in Marion County, 519 of them entry-level, and Eli Lilly, Masco and V2X are hiring the most')
    expect(d.body).not.toContain('Other')
    expect(d.body.match(/https:\/\//g)?.length).toBe(1)
  })
  it('rounds national workers down, never up', () => {
    expect(d.body).toContain('2,563 layoff notices nationally, covering 271,000 workers')
  })
  it('gives the local layoff figure only with enough notices', () => {
    expect(d.body).toContain('including 6 notices and 964 workers in your area')
    const few = boardIntroDraft({ ...base, areaNotices: MIN_LOCAL_NOTICES - 1 })
    expect(few.body).not.toContain('in your area')
    expect(few.body).toContain('covering 271,000 workers.')
  })
  it('greets "team" with no contact, and does not name employers when fewer than two are known', () => {
    expect(boardIntroDraft({ ...base, contactName: null }).body.startsWith('Hi team,')).toBe(true)
    expect(boardIntroDraft({ ...base, topEmployers: ['Eli Lilly'] }).body).not.toContain('hiring the most')
  })
  it('does not offer a handout or a reply-yes in place of the call', () => {
    const all = d.body.toLowerCase()
    for (const w of ['one-pager', 'flyer', 'reply yes', 'free tool']) expect(all).not.toContain(w)
  })
})
