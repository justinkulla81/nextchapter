import { describe, expect, it } from 'vitest'
import { emailDomain, readSearchRequest, validateSearchRequest } from './search-request'

const form = (o: Record<string, string>) => (n: string) => o[n] ?? null
const good = { roleTitle: 'VP Finance', firmName: 'Acme Search', contactName: 'Ann Lee', contactEmail: 'Ann.Lee@AcmeSearch.com', confidential: 'yes', clientName: 'Globex', level: 'Vice President' }

describe('search requests', () => {
  it('reads and normalizes a good submission', () => {
    const i = readSearchRequest(form(good))
    expect(i.contactEmail).toBe('ann.lee@acmesearch.com')
    expect(i.confidential).toBe(true)
    expect(i.level).toBe('Vice President')
    expect(validateSearchRequest(i)).toBeNull()
  })

  it('does not need a posting URL or salary band — confidential searches often have neither', () => {
    expect(validateSearchRequest(readSearchRequest(form({ ...good, clientName: '' })))).toBeNull()
  })

  it('drops an unknown level rather than storing it', () => {
    expect(readSearchRequest(form({ ...good, level: 'Wizard' })).level).toBeNull()
  })

  it('needs a role, a firm, a full name and a personal work email', () => {
    expect(validateSearchRequest(readSearchRequest(form({ ...good, roleTitle: '' })))).toMatch(/role/)
    expect(validateSearchRequest(readSearchRequest(form({ ...good, firmName: '' })))).toMatch(/firm/)
    expect(validateSearchRequest(readSearchRequest(form({ ...good, contactName: 'Ann' })))).toMatch(/full name/)
    expect(validateSearchRequest(readSearchRequest(form({ ...good, contactEmail: 'nope' })))).toMatch(/valid email/)
    expect(validateSearchRequest(readSearchRequest(form({ ...good, contactEmail: 'careers@acme.com' })))).toMatch(/shared inbox/)
  })

  it('finds the email domain', () => {
    expect(emailDomain('a@kbic.com')).toBe('kbic.com')
    expect(emailDomain('bad')).toBeNull()
  })
})
