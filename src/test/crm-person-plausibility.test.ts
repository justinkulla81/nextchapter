import { describe, it, expect } from 'vitest'
import { looksLikeOrgOrSpamName, looksLikeNotAPerson } from '@/lib/crm/person-plausibility'

describe('looksLikeOrgOrSpamName', () => {
  it('flags a name containing a digit', () => {
    expect(looksLikeOrgOrSpamName('826NYC')).toBe(true)
    expect(looksLikeOrgOrSpamName('1636 Forum')).toBe(true)
    expect(looksLikeOrgOrSpamName('321 W 78th Street')).toBe(true)
  })
  it('flags a known organizational/venue word', () => {
    expect(looksLikeOrgOrSpamName('Acquiring Minds Webinars')).toBe(true)
    expect(looksLikeOrgOrSpamName('Tyton Partners')).toBe(true)
  })
  it('flags bare initials', () => {
    expect(looksLikeOrgOrSpamName('a. e.')).toBe(true)
    expect(looksLikeOrgOrSpamName('J.D.')).toBe(true)
  })
  it('leaves an ordinary human name alone', () => {
    expect(looksLikeOrgOrSpamName('Allison Fass')).toBe(false)
    expect(looksLikeOrgOrSpamName('Jonathan Betz')).toBe(false)
  })
  it('does not flag an email-derived fallback name with a trailing number', () => {
    // A real person with no display name on file gets fullName from their
    // email local part (getOrCreatePerson) — a trailing digit there is an
    // ordinary username suffix, not evidence of a non-person. Caught a real
    // false positive: "omerutah14" is Omer's actual record, not spam.
    expect(looksLikeOrgOrSpamName('omerutah14')).toBe(false)
  })
})

describe('looksLikeNotAPerson', () => {
  it('flags an automated-looking email even with an otherwise plausible name', () => {
    expect(looksLikeNotAPerson('Building Updates', 'notify@buildinglink.com')).toBe(true)
  })
  it('flags a mailbox that is literally its own domain', () => {
    expect(looksLikeNotAPerson('826NYC', '826nyc@826nyc.org')).toBe(true)
  })
  it('flags a name that is just the company brand', () => {
    expect(looksLikeNotAPerson('American Express', 'statements@americanexpress.com')).toBe(true)
    expect(looksLikeNotAPerson('Amazon.com', 'order-update@amazon.com')).toBe(true)
  })
  it('leaves a real person at a real company alone', () => {
    expect(looksLikeNotAPerson('Jonathan Betz', 'jtb@plaidmatrix.fund')).toBe(false)
  })
  it('flags a brand-name subdomain, not just the registrable domain', () => {
    // The naive "first label" domain-root check missed this: the brand is
    // "americanexpress", but that's the SECOND label here, not the first.
    expect(looksLikeNotAPerson('American Express', 'americanexpress@welcome.americanexpress.com')).toBe(true)
  })
  it('flags a no-reply variant that is not an exact local-part match', () => {
    expect(looksLikeNotAPerson('Amazon', 'digital-no-reply@amazon.com')).toBe(true)
  })
  it('flags customer-service style local-parts', () => {
    expect(looksLikeNotAPerson('ASICS', 'customercare-us@asics.com')).toBe(true)
  })
  it('flags a bulk-notification subdomain regardless of the local part', () => {
    expect(looksLikeNotAPerson('Aspen Society', 'aspensociety@email.aspeninstitute.org')).toBe(true)
  })
  it('flags "notification"/"service" as a substring, not just a full local-part match', () => {
    expect(looksLikeNotAPerson('Marshall Chess Club', 'auto-notification@marshallchessclub.org')).toBe(true)
    expect(looksLikeNotAPerson('Beckett Simonon', 'service@beckettsimonon.com')).toBe(true)
  })
})
