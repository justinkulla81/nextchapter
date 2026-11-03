import { describe, expect, it } from 'vitest'
import { followAlertEmail } from './follow-alert'

const member = { id: 'c1', name: 'Dana Reyes', email: 'dana@example.com', registered: true }

describe('followAlertEmail', () => {
  it('says who expressed interest in which firm', () => {
    const m = followAlertEmail({ kind: 'recruiter', target: 'Summit Search Consultants', source: 'directory', member, adminUrl: 'https://admin.example/c1' })
    expect(m.subject).toBe('Dana Reyes expressed interest in Summit Search Consultants')
    expect(m.text).toContain('From: directory')
    expect(m.text).toContain('https://admin.example/c1')
  })
  it('says who followed which company, and handles a visitor with no name', () => {
    const m = followAlertEmail({ kind: 'company', target: 'Acme', source: null, member: { ...member, name: null, email: null, registered: false }, adminUrl: 'https://admin.example/c1' })
    expect(m.subject).toBe('A visitor followed Acme')
    expect(m.text).toContain('Not registered yet')
  })
  it('escapes the names in the html', () => {
    const m = followAlertEmail({ kind: 'company', target: '<b>x</b>', source: null, member, adminUrl: 'https://admin.example/c1' })
    expect(m.html).not.toContain('<b>x</b>')
  })
})
