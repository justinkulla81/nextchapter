import { describe, expect, it } from 'vitest'
import { verifiedChro } from '@/lib/crm/chro-finder'

const pages = [{ url: 'https://acme.com/leadership', text: 'Our team\nJane Roe\nChief People Officer\nJohn Poe\nChief Financial Officer' }]
const answer = (leader: object | null) => JSON.stringify({ leader })

describe('verifiedChro', () => {
  it('keeps an HR leader whose name is on the page they are credited to', () => {
    expect(verifiedChro(answer({ name: 'Jane Roe', title: 'Chief People Officer', sourceUrl: 'https://acme.com/leadership', linkedinUrl: null }), pages))
      .toMatchObject({ name: 'Jane Roe', title: 'Chief People Officer' })
  })
  it('drops a name the pages do not show', () => {
    expect(verifiedChro(answer({ name: 'Ann Lee', title: 'Chief People Officer', sourceUrl: 'https://acme.com/leadership', linkedinUrl: null }), pages)).toBeNull()
  })
  it('drops a title that does not lead HR', () => {
    expect(verifiedChro(answer({ name: 'John Poe', title: 'Chief Financial Officer', sourceUrl: 'https://acme.com/leadership', linkedinUrl: null }), pages)).toBeNull()
  })
  it('drops a LinkedIn address the page does not contain', () => {
    const r = verifiedChro(answer({ name: 'Jane Roe', title: 'Chief People Officer', sourceUrl: 'https://acme.com/leadership', linkedinUrl: 'https://www.linkedin.com/in/made-up' }), pages)
    expect(r?.linkedinUrl).toBeNull()
  })
  it('takes null and bad JSON as no answer', () => {
    expect(verifiedChro(answer(null), pages)).toBeNull()
    expect(verifiedChro('not json', pages)).toBeNull()
  })
})
