import { describe, expect, it } from 'vitest'
import { groupPicksByMember, joinedSubject } from '@/lib/recruiter-interest/joined-format'

const pick = (id: string, candidateId: string, firmOrgId: string) => ({ id, candidateId, firmOrgId })

describe('firm-joined notices', () => {
  it('groups a member\'s picks so they get one email', () => {
    const by = groupPicksByMember([pick('1', 'a', 'f1'), pick('2', 'b', 'f1'), pick('3', 'a', 'f2')])
    expect([...by.keys()]).toEqual(['a', 'b'])
    expect(by.get('a')?.map((p) => p.firmOrgId)).toEqual(['f1', 'f2'])
  })
  it('names the firm, or counts several', () => {
    expect(joinedSubject(['Summit Search'], false)).toBe('Summit Search has joined NextChapter')
    expect(joinedSubject(['A', 'B'], false)).toBe('2 firms you picked have joined NextChapter')
  })
  it('is generic for a member in confidential search mode', () => {
    expect(joinedSubject(['Summit Search'], true)).toBe('An update from NextChapter')
  })
})
