import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { candidateFromAuthHeader, issueConnectCode } from '@/lib/apply-helper/token'
import { externalSourceId, isSupportedJobUrl } from '@/lib/apply-helper/log-application'

const M = createRequire(import.meta.url)('../../extensions/apply-helper/field-map.js')

describe('apply helper: field mapping', () => {
  it.each([
    [{ label: 'First Name *' }, 'first_name'],
    [{ label: 'Last Name' }, 'last_name'],
    [{ label: 'Email' }, 'email'],
    [{ label: 'Phone', type: 'tel' }, 'phone'],
    [{ label: 'Full name' }, 'full_name'],
    [{ label: 'Current company' }, 'current_company'],
    [{ label: 'Current location' }, 'location'],
    [{ label: 'LinkedIn URL' }, 'linkedin'],
    [{ label: 'Resume/CV', type: 'file' }, 'resume'],
    [{ name: 'first_name' }, 'first_name'],
    [{ autocomplete: 'family-name' }, 'last_name'],
    [{ label: 'Your name', name: 'name' }, 'full_name'],
  ])('maps %j to %s', (desc, want) => expect(M.classifyField(desc)).toBe(want))

  it.each([
    [{ label: 'Cover letter', type: 'textarea' }],
    [{ label: 'Why do you want to work here?', type: 'textarea' }],
    [{ label: 'What are your salary expectations?' }],
    [{ label: 'Are you legally authorized to work in the US?' }],
    [{ label: 'Gender' }],
    [{ label: 'Cover letter', type: 'file' }],
    [{ label: 'Submit application', type: 'submit' }],
    [{ label: 'Email me updates', type: 'checkbox' }],
  ])('leaves %j alone', (desc) => expect(M.classifyField(desc)).toBeNull())

  it('builds values and drops empty ones', () => {
    expect(M.valuesFromProfile({ firstName: 'Ada', lastName: 'Lovelace', email: 'a@b.co', phone: null, currentCompany: 'Acme', currentTitle: 'CFO' })).toEqual({
      first_name: 'Ada', last_name: 'Lovelace', preferred_name: 'Ada', full_name: 'Ada Lovelace', email: 'a@b.co', current_company: 'Acme', current_title: 'CFO',
    })
  })

  it('knows the three sites and nothing else', () => {
    expect(M.siteOf('https://boards.greenhouse.io/acme/jobs/1')).toBe('greenhouse')
    expect(M.siteOf('https://job-boards.greenhouse.io/acme/jobs/1')).toBe('greenhouse')
    expect(M.siteOf('https://jobs.ashbyhq.com/acme/abc')).toBe('ashby')
    expect(M.siteOf('https://jobs.lever.co/acme/abc/apply')).toBe('lever')
    expect(M.siteOf('https://www.workday.com/x')).toBeNull()
    expect(M.siteOf('https://evil.com/greenhouse.io')).toBeNull()
  })

  it('spots confirmation screens', () => {
    expect(M.isConfirmation('lever', 'https://jobs.lever.co/acme/abc/thanks', '')).toBe(true)
    expect(M.isConfirmation('greenhouse', 'https://boards.greenhouse.io/acme/jobs/1', 'Thank you for applying.')).toBe(true)
    expect(M.isConfirmation('ashby', 'https://jobs.ashbyhq.com/acme/abc/application', 'Fill the form')).toBe(false)
  })

  it('reads company and canonical url', () => {
    expect(M.companyFromUrl('https://jobs.lever.co/acme-corp/abc/apply')).toBe('Acme Corp')
    expect(M.canonicalJobUrl('https://jobs.lever.co/acme/abc/apply?utm=1')).toBe('https://jobs.lever.co/acme/abc')
    expect(M.canonicalJobUrl('https://job-boards.greenhouse.io/acme/jobs/55?gh_jid=55&x=1')).toBe('https://job-boards.greenhouse.io/acme/jobs/55?gh_jid=55')
  })
})

describe('apply helper: connect code and logging', () => {
  process.env.LINK_SIGNING_SECRET = 'test-secret'
  it('round-trips and rejects tampering and expiry', () => {
    const { code } = issueConnectCode('cand1', 1_000_000)
    expect(candidateFromAuthHeader(`Bearer ${code}`, 1_000_000)).toBe('cand1')
    expect(candidateFromAuthHeader(`Bearer ${code.replace('cand1', 'cand2')}`, 1_000_000)).toBeNull()
    expect(candidateFromAuthHeader(`Bearer ${code}`, 1_000_000 + 31 * 86400 * 1000)).toBeNull()
    expect(candidateFromAuthHeader(null)).toBeNull()
  })
  it('only logs supported job pages, one row per posting', () => {
    expect(isSupportedJobUrl('https://jobs.lever.co/a/b')).not.toBeNull()
    expect(isSupportedJobUrl('http://jobs.lever.co/a/b')).toBeNull()
    expect(isSupportedJobUrl('https://evil.com/')).toBeNull()
    expect(externalSourceId('https://jobs.lever.co/a/b')).toBe(externalSourceId('https://jobs.lever.co/a/b'))
  })
})

describe('apply helper: download', () => {
  it('ships a zip that matches the extension manifest', async () => {
    const { readFileSync } = await import('node:fs')
    const { execSync } = await import('node:child_process')
    const manifest = JSON.parse(readFileSync('extensions/apply-helper/manifest.json', 'utf8'))
    const inZip = JSON.parse(execSync('unzip -p public/downloads/nextchapter-apply-helper.zip nextchapter-apply-helper/manifest.json').toString())
    const content = execSync('unzip -p public/downloads/nextchapter-apply-helper.zip nextchapter-apply-helper/content.js').toString()
    expect(inZip.version).toBe(manifest.version)
    expect(content).toBe(readFileSync('extensions/apply-helper/content.js', 'utf8'))
  })
})
