import { describe, expect, it } from 'vitest'
import { COACH_TOPICS, canMoveTopic, isTopicKey, keywordsForTopics, topicByKey, type TopicStatus } from '@/lib/coach/topics'
import { coachTopicReason, coursesForTopics } from '@/lib/coach/accepted-topics-match'

describe('the topic vocabulary', () => {
  it('has unique keys, a label, and an effect that says where it takes effect', () => {
    expect(new Set(COACH_TOPICS.map((t) => t.key)).size).toBe(COACH_TOPICS.length)
    for (const t of COACH_TOPICS) {
      expect(t.label.length).toBeGreaterThan(3)
      expect(t.effect).toMatch(/^Learn: /)
      expect(t.keywords.length).toBeGreaterThan(0)
      expect(t.keywords.every((k) => k === k.toLowerCase())).toBe(true)
    }
    expect(isTopicKey('public_speaking')).toBe(true)
    expect(isTopicKey('controller_roles')).toBe(false)
    expect(topicByKey('nope')).toBeNull()
  })
})

describe('the topic state machine', () => {
  const states: TopicStatus[] = ['suggested', 'confirmed', 'accepted', 'dismissed']
  it('lets the coach confirm and take back, only', () => {
    expect(canMoveTopic('suggested', 'confirmed', 'coach')).toBe(true)
    expect(canMoveTopic('confirmed', 'suggested', 'coach')).toBe(true)
    expect(canMoveTopic('confirmed', 'accepted', 'coach')).toBe(false)
    expect(canMoveTopic('confirmed', 'dismissed', 'coach')).toBe(false)
  })
  it('lets the member decide a confirmed topic and change their mind, never a suggested one', () => {
    expect(canMoveTopic('confirmed', 'accepted', 'member')).toBe(true)
    expect(canMoveTopic('confirmed', 'dismissed', 'member')).toBe(true)
    expect(canMoveTopic('accepted', 'dismissed', 'member')).toBe(true)
    expect(canMoveTopic('dismissed', 'accepted', 'member')).toBe(true)
    expect(canMoveTopic('suggested', 'accepted', 'member')).toBe(false)
    expect(canMoveTopic('suggested', 'dismissed', 'member')).toBe(false)
  })
  it('never lets the member confirm, nor the coach reach into a decided topic', () => {
    expect(canMoveTopic('suggested', 'confirmed', 'member')).toBe(false)
    expect(canMoveTopic('accepted', 'confirmed', 'coach')).toBe(false)
    expect(canMoveTopic('accepted', 'suggested', 'coach')).toBe(false)
    expect(canMoveTopic('dismissed', 'suggested', 'coach')).toBe(false)
  })
  it('has no move from a state to itself', () => {
    for (const s of states) for (const a of ['coach', 'member'] as const) expect(canMoveTopic(s, s, a)).toBe(false)
  })
})

describe('accepted topics feed the learning plan', () => {
  const courses = [
    { title: 'Negotiating your offer', description: 'Get paid well', keywords: ['pay'] },
    { title: 'Excel basics', description: 'Spreadsheets', keywords: ['excel'] },
    { title: 'Stage presence', description: 'Public speaking for leaders', keywords: [] },
    { title: 'Leadership 101', description: 'Managing people', keywords: ['leading'] },
  ]
  it('matches courses on the accepted topics’ keywords and keeps the course order', () => {
    const out = coursesForTopics(courses, [{ key: 'public_speaking', coachFirstName: 'Maya' }, { key: 'salary_negotiation', coachFirstName: 'Maya' }])
    expect(out.map((c) => c.title)).toEqual(['Negotiating your offer', 'Stage presence'])
  })
  it('returns nothing for no topics or unknown keys, so a dismissed topic stops matching', () => {
    expect(coursesForTopics(courses, [])).toEqual([])
    expect(coursesForTopics(courses, [{ key: 'made_up', coachFirstName: 'Maya' }])).toEqual([])
  })
  it('deduplicates keywords and states where the topic came from', () => {
    expect(keywordsForTopics(['leadership', 'leadership', 'nope'])).toEqual(['leadership', 'managing', 'management'])
    expect(coachTopicReason([{ key: 'leadership', coachFirstName: 'Maya' }])).toBe('You accepted these topics from Maya after your session.')
  })
})
