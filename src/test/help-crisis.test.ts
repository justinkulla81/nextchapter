// The Help & feedback form shows the 988 line and flags the request when a
// message uses crisis language. It must catch the real phrasings, including
// curly apostrophes from phones, and stay quiet on ordinary job-search talk.
import { describe, it, expect } from 'vitest'
import { mentionsCrisis, isConversationKind } from '@/lib/help/constants'

describe('mentionsCrisis', () => {
  for (const t of [
    'I honestly can’t go on like this',
    "I can't go on",
    'some days I want to die',
    'thinking about suicide',
    'I feel suicidal after another rejection',
    'I keep thinking I should end it all',
    'I might hurt myself',
    'everyone would be better off dead without me',
  ]) it(`flags: ${t}`, () => expect(mentionsCrisis(t)).toBe(true))

  for (const t of [
    'My application to Pearl died in the ATS',
    'This job search is killing me, the Gmail sync is broken',
    'Can I go on vacation and pause my plan?',
    'The deadline to apply ends tomorrow',
    'How do I end my membership?',
  ]) it(`does not flag: ${t}`, () => expect(mentionsCrisis(t)).toBe(false))
})

describe('isConversationKind', () => {
  it('help and problems are conversations; ideas and feedback are not', () => {
    expect(isConversationKind('help')).toBe(true)
    expect(isConversationKind('problem')).toBe(true)
    expect(isConversationKind('idea')).toBe(false)
    expect(isConversationKind('feedback')).toBe(false)
  })
})
