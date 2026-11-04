import { describe, expect, it } from 'vitest'
import { checkStory, MAX_STORY_CHARS, nextStorySlot, PRESS_SLOT_ET, storyDue, storyFirstComment } from './story-rules'

const LINES = ['Skill: SQL', 'Named in 22% of the job postings that list skills', 'Open postings that name it: 12,431', 'Median posted yearly pay of postings that name it: $98k']

const GOOD = [
  'SQL shows up in 22% of the postings that list skills.',
  '',
  'That is 12,431 open roles right now. For anyone who hires analysts or trains career changers, it is the skill that most often appears next to the job title.',
  '',
  'The median posted pay for roles that name it is $98k. Posted pay is what employers advertise, so it is a floor for the conversation and not a promise.',
  '',
  'If you screen for it, what do you actually test?',
  '',
  '#Hiring #DataSkills #LaborMarket',
].join('\n')

describe('checkStory', () => {
  it('accepts a post that keeps to the facts', () => expect(checkStory(GOOD, LINES)).toEqual({ ok: true }))

  it('rejects a number that is not in the facts', () => {
    const r = checkStory(GOOD.replace('22%', '25%'), LINES)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toContain('25')
  })
  it('wants a short hook standing alone, followed by a blank line', () => {
    expect(checkStory(GOOD.replace('SQL shows up in 22% of the postings that list skills.', `SQL shows up in 22% of the postings that list skills ${'and more '.repeat(20)}`), LINES).ok).toBe(false)
    expect(checkStory(GOOD.replace('skills.\n\nThat', 'skills.\nThat'), LINES).ok).toBe(false)
  })
  it('puts the link in a comment, not the post', () => {
    expect(checkStory(GOOD.replace('That is', 'See https://example.com. That is'), LINES).ok).toBe(false)
  })
  it('needs exactly three hashtags, all on the last line', () => {
    expect(checkStory(GOOD.replace('#Hiring #DataSkills #LaborMarket', '#Hiring #DataSkills'), LINES).ok).toBe(false)
    expect(checkStory(GOOD.replace('#Hiring #DataSkills #LaborMarket', '#Hiring #DataSkills #LaborMarket #More'), LINES).ok).toBe(false)
    expect(checkStory(GOOD.replace('That is', '#Hiring That is'), LINES).ok).toBe(false)
  })
  it('needs a closing question, and no brand hashtag or filler about what was or was not reported', () => {
    expect(checkStory(GOOD.replace('what do you actually test?', 'tell us what you test.'), LINES).ok).toBe(false)
    expect(checkStory(GOOD.replace('#LaborMarket', '#NextChapter'), LINES).ok).toBe(false)
    expect(checkStory(GOOD.replace('That is', 'No further breakdown has been reported. That is'), LINES).ok).toBe(false)
  })
  it('rejects emojis, dashes and exclamation marks', () => {
    for (const bad of [GOOD.replace('That is', '🚀 That is'), GOOD.replace('right now.', 'right now — wow.'), GOOD.replace('right now.', 'right now!')]) {
      expect(checkStory(bad, LINES).ok).toBe(false)
    }
  })
  it('rejects a post that is too short or too long', () => {
    expect(checkStory('SQL is common.\n\n#A #B #C', LINES).ok).toBe(false)
    expect(checkStory(`${GOOD}\n\n${'x'.repeat(MAX_STORY_CHARS)}`, LINES).ok).toBe(false)
  })
})

describe('storyFirstComment', () => {
  it('leads the tracked link by topic', () => {
    expect(storyFirstComment('help', 'https://x.test/a')).toBe('What the state pays and how to file: https://x.test/a')
    expect(storyFirstComment('unknown', 'https://x.test/a')).toBe('More: https://x.test/a')
  })
})

const etDay = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(d)

describe('nextStorySlot', () => {
  it('picks a weekday lunch-hour slot Eastern, at least an hour out, never a weekend', () => {
    // Saturday 2026-11-07 15:00 UTC
    const s = nextStorySlot(new Date('2026-11-07T15:00:00Z'), [])
    expect(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).toContain(etDay(s).split(' ')[0])
    expect(etDay(s)).toContain('12:10')
    expect(s.getTime()).toBeGreaterThan(new Date('2026-11-07T16:00:00Z').getTime())
  })
  it('puts one story on a day at most', () => {
    const first = nextStorySlot(new Date('2026-11-09T12:00:00Z'), [])
    const second = nextStorySlot(new Date('2026-11-09T12:00:00Z'), [first])
    expect(second.getTime()).toBeGreaterThan(first.getTime() + 20 * 3_600_000)
  })
  it('prefers Tuesday to Thursday when one is within four days of the earliest slot', () => {
    // Friday 2026-11-06 after the lunch slot: Monday would be first, Tuesday is a preferred day within four days
    const s = nextStorySlot(new Date('2026-11-06T20:00:00Z'), [])
    expect(etDay(s).startsWith('Tue')).toBe(true)
  })
  it('puts the press post on Tuesday at 10:00 Eastern, on both sides of the clock change', () => {
    const winter = nextStorySlot(new Date('2026-11-04T12:00:00Z'), [], true)
    expect(etDay(winter)).toBe(`Tue ${PRESS_SLOT_ET.hour}:00`)
    expect(winter.toISOString()).toBe('2026-11-10T15:00:00.000Z')
    const summer = nextStorySlot(new Date('2026-06-01T12:00:00Z'), [], true)
    expect(summer.toISOString()).toBe('2026-06-02T14:00:00.000Z')
  })
})

describe('storyDue', () => {
  const slot = new Date('2026-11-10T17:10:00Z')
  it('is due only when approved, unposted, and within a day of its slot', () => {
    expect(storyDue({ status: 'APPROVED', scheduledFor: slot, postUrn: null }, new Date('2026-11-10T17:20:00Z'))).toBe(true)
    expect(storyDue({ status: 'DRAFT', scheduledFor: slot, postUrn: null }, new Date('2026-11-10T17:20:00Z'))).toBe(false)
    expect(storyDue({ status: 'APPROVED', scheduledFor: slot, postUrn: 'urn:li:share:1' }, new Date('2026-11-10T17:20:00Z'))).toBe(false)
    expect(storyDue({ status: 'APPROVED', scheduledFor: slot, postUrn: null }, new Date('2026-11-10T17:00:00Z'))).toBe(false)
    expect(storyDue({ status: 'APPROVED', scheduledFor: slot, postUrn: null }, new Date('2026-11-11T18:00:00Z'))).toBe(false)
  })
})
