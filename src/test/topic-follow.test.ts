import { describe, expect, it } from 'vitest'
import { isFollowable, topicFollowKey, topicSource } from '@/lib/leads/topic-follow'

describe('topic follow key', () => {
  it('is the saved search the email box stores: cleaned and lower-cased, email lower-cased', () => {
    expect(topicFollowKey(' Dana@Example.com ', '  Chief   Revenue Officer ', 'Austin, TX')).toEqual({
      email: 'dana@example.com', kind: 'job_alert', situation: '', searchQ: 'chief revenue officer', searchLoc: 'austin, tx', searchRemote: false,
    })
  })
  it('keeps a function scope as typed (the board reads "function:<name>")', () => {
    expect(topicFollowKey('a@b.co', 'function:Finance', '').searchQ).toBe('function:finance')
  })
  it('treats "remote" as the remote flag, like the email box', () => {
    expect(topicFollowKey('a@b.co', 'nurse', 'Remote')).toMatchObject({ searchLoc: '', searchRemote: true })
  })
})

describe('what can be followed', () => {
  it('needs a search or a place', () => {
    expect(isFollowable('', '')).toBe(false)
    expect(isFollowable('  ', ' ')).toBe(false)
    expect(isFollowable('finance', '')).toBe(true)
    expect(isFollowable('', 'Ohio')).toBe(true)
  })
  it('accepts only the page boxes the email box accepts', () => {
    expect(topicSource('page:function')).toBe('page:function')
    expect(topicSource('page:title')).toBe('page:title')
    expect(topicSource('page:evil')).toBe('jobs')
    expect(topicSource('')).toBe('jobs')
  })
})
