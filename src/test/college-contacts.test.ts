import { describe, expect, it } from 'vitest'
import { pageLinks, pageText, pickRoleLink, pickStaffLink, sameSite, usualPlaces } from '@/lib/workforce/college-pages'
import { isLeaderTitle, verifiedContacts } from '@/lib/workforce/college-contacts'

const home = 'https://www.example.edu/'

describe('finding office pages', () => {
  const html = `<a href="/about/careers">Careers</a><a href="/news/career-center-wins">Career center wins award</a>
    <a href="https://career.example.edu/">Career Center</a><a href="https://alumni.example.edu">Alumni</a>
    <a href="https://www.facebook.com/exampleu">Alumni on Facebook</a><a href="/continuing-education/">Continuing Education</a>
    <a href="/giving">Make a gift</a><a href="mailto:x@example.edu">Email</a>`
  const links = pageLinks(html, home)
  it('takes the office, not jobs at the college, a news story, or another site', () => {
    expect(pickRoleLink(links, 'career', home)).toBe('https://career.example.edu/')
    expect(pickRoleLink(links, 'alumni', home)).toBe('https://alumni.example.edu/')
    expect(pickRoleLink(links, 'execEd', home)).toBe('https://www.example.edu/continuing-education/')
    // "Make a gift" has no office word, but its address does.
    expect(pickRoleLink(links, 'development', home)).toBe('https://www.example.edu/giving')
  })
  it('treats subdomains as the college and other domains as not', () => {
    expect(sameSite('https://alumni.example.edu/x', home)).toBe(true)
    expect(sameSite('https://www.facebook.com/exampleu', home)).toBe(false)
  })
  it('finds a department’s staff page', () => {
    const dept = pageLinks('<a href="/staff">Meet Our Team</a><a href="/apply">Apply</a>', 'https://career.example.edu/')
    expect(pickStaffLink(dept, 'https://career.example.edu/')).toBe('https://career.example.edu/staff')
  })
  it('knows where offices usually live', () => {
    expect(usualPlaces('alumni', home)).toEqual(['https://alumni.example.edu/', 'https://www.example.edu/alumni/', 'https://www.example.edu/alumni-relations/'])
  })
  it('keeps the address behind an "Email" link', () => {
    expect(pageText('<main><p>Jane Roe, Director <a href="mailto:jroe@example.edu">Email</a></p><script>x()</script></main>'))
      .toBe('Jane Roe, Director Email (jroe@example.edu)')
  })
})

describe('checking what the model returns', () => {
  const pages = [
    { url: 'https://career.example.edu/staff', role: 'career' as const, text: 'Jane Roe\nExecutive Director, Career Center\njroe@example.edu\n(555) 123-4567\nSam Poe, Coordinator of Employer Relations' },
    { url: 'https://alumni.example.edu/', role: 'alumni' as const, text: 'Contact the Alumni Office at alumni@example.edu or 555-765-4321' },
  ]
  const run = (contacts: unknown[]) => verifiedContacts(JSON.stringify({ contacts }), pages)

  it('keeps a leader whose name and email are on the page', () => {
    expect(run([{ role: 'career', name: 'Jane Roe', title: 'Executive Director, Career Center', email: 'jroe@example.edu', phone: '(555) 123-4567', sourceUrl: pages[0].url }]))
      .toEqual([{ role: 'career', name: 'Jane Roe', title: 'Executive Director, Career Center', email: 'jroe@example.edu', phone: '(555) 123-4567', sourceUrl: pages[0].url }])
  })
  it('drops a name that is not on the page, and an email that is not either', () => {
    expect(run([{ role: 'career', name: 'John Doe', title: 'Director', email: null, phone: null, sourceUrl: pages[0].url }])).toEqual([])
    expect(run([{ role: 'career', name: 'Jane Roe', title: 'Executive Director', email: 'jane.roe@example.edu', phone: null, sourceUrl: pages[0].url }])[0].email).toBeNull()
  })
  it('drops someone who runs one program, not the office', () => {
    expect(run([{ role: 'career', name: 'Sam Poe', title: 'Coordinator of Employer Relations', email: null, phone: null, sourceUrl: pages[0].url }])).toEqual([])
  })
  it('keeps an office line with a way to reach it', () => {
    expect(run([{ role: 'alumni', name: null, title: null, email: 'alumni@example.edu', phone: '555-765-4321', sourceUrl: pages[1].url }]))
      .toMatchObject([{ role: 'alumni', name: null, email: 'alumni@example.edu', phone: '555-765-4321' }])
  })
  it('reads leader titles from a list', () => {
    expect(isLeaderTitle('Vice President for Advancement')).toBe(true)
    expect(isLeaderTitle('Director of Donor Services')).toBe(false)
    expect(isLeaderTitle('Program Coordinator')).toBe(false)
  })
})
