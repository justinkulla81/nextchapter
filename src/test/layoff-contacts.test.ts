import { describe, it, expect } from 'vitest'
import { verifiedContacts, crmRolesFor, buildContactRequest, type ArticleRead } from '@/lib/crm/layoff-contacts'

const url = 'https://example.com/amazon-layoffs'
const text = `Amazon is cutting roughly 1,000 corporate roles in its retail and stores organization.
"These changes reflect our focus on reducing layers," Amazon spokesperson Jane Doe said in a statement. Beth Galetti, senior vice president of people experience and technology, wrote in a memo to staff that the affected teams would be notified Wednesday. Reporting by Sam Reporter in Seattle.`
const articles: ArticleRead[] = [{ url, text }]

const c = (o: object) => ({ name: 'Jane Doe', title: 'spokesperson', kind: 'spokesperson', sourceUrl: url, evidence: '"These changes reflect our focus on reducing layers," Amazon spokesperson Jane Doe said in a statement.', ...o })
const ans = (...cs: object[]) => JSON.stringify({ contacts: cs })

describe('verifiedContacts', () => {
  it('keeps a person whose name and evidence are in the article', () => {
    const out = verifiedContacts(ans(c({})), articles)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'Jane Doe', kind: 'spokesperson', sourceUrl: url })
  })

  it('keeps an HR lead who is not a chief', () => {
    const out = verifiedContacts(ans(c({
      name: 'Beth Galetti', title: 'senior vice president of people experience and technology', kind: 'hr',
      evidence: 'Beth Galetti, senior vice president of people experience and technology, wrote in a memo to staff that the affected teams would be notified Wednesday.',
    })), articles)
    expect(out.map((x) => x.name)).toEqual(['Beth Galetti'])
  })

  it('drops a name that is not in the article', () => {
    expect(verifiedContacts(ans(c({ name: 'John Smith' })), articles)).toEqual([])
  })

  it('drops evidence the article does not contain', () => {
    expect(verifiedContacts(ans(c({ evidence: 'Jane Doe said the company had no further comment on the matter.' })), articles)).toEqual([])
  })

  it('drops evidence that does not name the person', () => {
    expect(verifiedContacts(ans(c({ evidence: 'Amazon is cutting roughly 1,000 corporate roles in its retail and stores organization.' })), articles)).toEqual([])
  })

  it('drops a person named only as background to the story', () => {
    const bg: ArticleRead[] = [{ url, text: `${text}\nCEO Andy Jassy, who succeeded Jeff Bezos in 2021, has urged staff to embrace the company's AI drive.` }]
    expect(verifiedContacts(ans(c({
      name: 'Andy Jassy', title: 'CEO', kind: 'executive',
      evidence: "CEO Andy Jassy, who succeeded Jeff Bezos in 2021, has urged staff to embrace the company's AI drive.",
    })), bg)).toEqual([])
  })

  it('drops a credit to an article that was not read', () => {
    expect(verifiedContacts(ans(c({ sourceUrl: 'https://other.com/x' })), articles)).toEqual([])
  })

  it('drops a single name, a description, and an unknown kind', () => {
    expect(verifiedContacts(ans(c({ name: 'Jane' })), articles)).toEqual([])
    expect(verifiedContacts(ans(c({ name: 'Amazon spokesperson' })), articles)).toEqual([])
    expect(verifiedContacts(ans(c({ kind: 'journalist' })), articles)).toEqual([])
  })

  it('drops a byline', () => {
    const byline: ArticleRead[] = [{ url, text: `${text}\nBy Sam Reporter, staff writer` }]
    expect(verifiedContacts(ans(c({ name: 'Sam Reporter', kind: 'executive', evidence: 'By Sam Reporter, staff writer' })), byline)).toEqual([])
  })

  it('returns a person once', () => {
    expect(verifiedContacts(ans(c({}), c({ name: 'jane  doe' })), articles)).toHaveLength(1)
  })

  it('survives a malformed answer', () => {
    expect(verifiedContacts('not json', articles)).toEqual([])
    expect(verifiedContacts('{}', articles)).toEqual([])
  })
})

describe('crmRolesFor', () => {
  it('makes HR, executives and site leaders worth a follow-up, and spokespeople and officials contacts only', () => {
    expect(crmRolesFor('hr')).toEqual({ roles: ['HIRING_MANAGER'], priority: 'P2' })
    expect(crmRolesFor('executive').priority).toBe('P2')
    expect(crmRolesFor('spokesperson')).toEqual({ roles: ['OTHER'], priority: null })
    expect(crmRolesFor('official').priority).toBeNull()
  })
})

describe('buildContactRequest', () => {
  it('sends only the articles and asks for a schema-shaped answer', () => {
    const req = buildContactRequest('Amazon', articles)
    expect(JSON.stringify(req.messages)).toContain(url)
    expect(req.model).toBe('claude-haiku-4-5')
  })
})
