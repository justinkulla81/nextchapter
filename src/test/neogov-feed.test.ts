import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/companies/posting-company', () => ({ linkPostingsToCompanies: async () => new Map() }))

import { parseJobPage, parseSitemap, isRelevantTitle } from '@/lib/jobs/neogov-feed'
import { parseK12Sitemap } from '@/lib/jobs/k12jobspot-core'
import { gradedTitle, joaToKept } from '@/lib/jobs/usajobs-board-core'

describe('neogov feed title screen', () => {
  it('keeps professional and management titles', () => {
    for (const t of ['senior accountant', 'budget analyst ii', 'finance director', 'software engineer', 'registered nurse', 'human resources manager'])
      expect(isRelevantTitle(t), t).toBe(true)
  })
  it('drops trades, protective, service and clerical titles', () => {
    for (const t of ['police officer', 'plumber', 'custodian', 'water treatment operator', 'office assistant', 'parking enforcement officer pt', 'correctional deputy i'])
      expect(isRelevantTitle(t), t).toBe(false)
  })
})

describe('neogov feed parsing', () => {
  it('reads job ids, urls and title slugs from the sitemap', () => {
    const xml = '<urlset><url><loc>https://www.governmentjobs.com/jobs/5074137-0/budget-analyst</loc></url><url><loc>https://www.governmentjobs.com/category/x</loc></url></urlset>'
    expect(parseSitemap(xml)).toEqual([{ id: '5074137-0', url: 'https://www.governmentjobs.com/jobs/5074137-0/budget-analyst', title: 'budget analyst' }])
  })
  it('reads the JobPosting block of a job page', () => {
    const ld = JSON.stringify({
      '@type': 'JobPosting', title: 'Budget Analyst', description: '&lt;p&gt;Prepare the budget.&lt;/p&gt;', datePosted: '2026-10-21', employmentType: 'FULL_TIME',
      hiringOrganization: { name: 'Rock County' },
      jobLocation: { address: { addressLocality: 'Janesville', addressRegion: 'WI' } },
      baseSalary: { value: { minValue: 60000, maxValue: 80000, unitText: 'YEAR' } },
    })
    const p = parseJobPage(`<html><script type="application/ld+json">${ld}</script></html>`)
    expect(p).toMatchObject({ title: 'Budget Analyst', employer: 'Rock County', location: 'Janesville, WI', state: 'WI', employmentType: 'full_time', salaryMin: 60000, salaryMax: 80000 })
    expect(p?.description).toBe('Prepare the budget.')
  })
  it('returns null when the page has no JobPosting', () => {
    expect(parseJobPage('<html></html>')).toBeNull()
  })
})

describe('k12jobspot sitemap', () => {
  it('reads the id and a title from the job url slug', () => {
    const xml = '<urlset><url><loc>https://www.k12jobspot.com/en/job-postings/6af659be9d5f5f88e73c1a97-employee-relations-specialist---human-resources</loc></url></urlset>'
    const [job] = parseK12Sitemap(xml)
    expect(job.id).toBe('6af659be9d5f5f88e73c1a97')
    expect(job.title).toBe('employee relations specialist human resources')
  })
})

describe('usajobs board rows', () => {
  const open = { usajobsControlNumber: 123, positionTitle: 'Program Analyst', hiringAgencyName: 'Bureau X', hiringDepartmentName: 'Department Y', positionOpeningStatus: 'Accepting applications', positionCloseDate: '2999-01-01', payScale: 'GS', minimumGrade: '12', maximumGrade: '13', salaryType: 'Per Year', minimumSalary: 90000, maximumSalary: 120000, workSchedule: 'Full-time', hiringpaths: [{ hiringPath: 'The public' }], positionlocations: [{ positionLocationCity: 'Denver', positionLocationState: 'Colorado', positionLocationCountry: 'United States' }] }
  it('adds the grade to a title that has none', () => {
    expect(gradedTitle(open)).toBe('Program Analyst (GS-13)')
  })
  it('keeps an open-to-the-public announcement with a link, pay and expiry', () => {
    const v = joaToKept(open, new Date('2026-11-13'))
    expect(v.keep).toBe(true)
    if (v.keep) {
      expect(v.kept.url).toBe('https://www.usajobs.gov/job/123')
      expect(v.kept.posting.salaryMin).toBe(90000)
      expect(v.closesAt?.getFullYear()).toBe(2999)
    }
  })
  it('skips announcements that are closed or not open to the public', () => {
    expect(joaToKept({ ...open, positionCloseDate: '2020-01-01' }, new Date('2026-11-13')).keep).toBe(false)
    expect(joaToKept({ ...open, hiringpaths: [{ hiringPath: 'Federal employees - Competitive service' }] }, new Date('2026-11-13')).keep).toBe(false)
  })
})

describe('edjoin and careersingovernment sitemaps', () => {
  it('reads EdJoin job ids (no titles in the sitemap)', async () => {
    const { parseEdjoinSitemap } = await import('@/lib/jobs/edjoin-core')
    expect(parseEdjoinSitemap('<urlset><url><loc>https://www.edjoin.org/Home/JobPosting/459520</loc></url></urlset>')).toEqual([{ id: '459520', url: 'https://www.edjoin.org/Home/JobPosting/459520', title: '' }])
  })
  it('reads CareersInGovernment ids and title slugs', async () => {
    const { parseCigSitemap } = await import('@/lib/jobs/careersingov-core')
    const [job] = parseCigSitemap('<urlset><url><loc>https://www.careersingovernment.com/job/734713/speech-language-pathologist-clinical-fellow/</loc></url><url><loc>https://www.careersingovernment.com/company/1/x/</loc></url></urlset>')
    expect(job).toMatchObject({ id: '734713', title: 'speech language pathologist clinical fellow' })
  })
  it('matches the same job across sources', async () => {
    const { dedupeKey } = await import('@/lib/jobs/gov-feed-core')
    expect(dedupeKey('City of San Jose', 'Building Inspector, Senior')).toBe(dedupeKey('CITY OF SAN JOSE', 'building inspector senior'))
  })
})

describe('government Workday boards', () => {
  it('reads a yearly pay range from a description', async () => {
    const { yearlyPayFrom } = await import('@/lib/jobs/gov-workday-core')
    expect(yearlyPayFrom('The salary range is $137,134.40 - $181,230.40 annually.')).toEqual({ min: 137134, max: 181230 })
    expect(yearlyPayFrom('Pay is $37.23-$50.91 Hourly')).toBeNull()
  })
  it('builds the job url from the board and path', async () => {
    const { jobUrl, boardPrefix } = await import('@/lib/jobs/gov-workday-core')
    const b = { host: 'calvertcountymd.wd1', site: 'calvertcountymdemploymentopportunities', employer: 'Calvert County Government', place: 'Calvert County, MD' }
    expect(jobUrl(b, '/job/X/Grant-Writer_JR1')).toBe('https://calvertcountymd.wd1.myworkdayjobs.com/calvertcountymdemploymentopportunities/job/X/Grant-Writer_JR1')
    expect(jobUrl(b, '/job/X/Grant-Writer_JR1').startsWith(boardPrefix(b))).toBe(true)
  })
  it('only lists boards that are verified and unique', async () => {
    const { GOV_WORKDAY_BOARDS } = await import('@/lib/jobs/gov-workday-boards')
    const keys = GOV_WORKDAY_BOARDS.map((b) => `${b.host}/${b.site}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(GOV_WORKDAY_BOARDS.length).toBeGreaterThan(50)
  })
})

describe('government Oracle boards', () => {
  it('reads the title out of a Dallas County requisition label', async () => {
    const { cleanOracleTitle } = await import('@/lib/jobs/gov-oracle-core')
    expect(cleanOracleTitle('0000007224.SYSTEM ENGINEER LEAD.INFO TECH - OPERATIONS')).toBe('SYSTEM ENGINEER LEAD')
    expect(cleanOracleTitle('Fleet Operations Manager (Facilities & Operations Department)')).toBe('Fleet Operations Manager (Facilities & Operations Department)')
  })
  it('builds the job url from the board and requisition id', async () => {
    const { oracleUrl, oracleAdapter } = await import('@/lib/jobs/gov-oracle-core')
    const b = oracleAdapter.boards[0]
    expect(oracleUrl(b, '42').startsWith(oracleAdapter.prefix(b))).toBe(true)
  })
})

describe('government Workday boards: bad listings', () => {
  it('has no duplicate boards after the second round', async () => {
    const { GOV_WORKDAY_BOARDS } = await import('@/lib/jobs/gov-workday-boards')
    const keys = GOV_WORKDAY_BOARDS.map((b) => `${b.host}/${b.site}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(GOV_WORKDAY_BOARDS.length).toBeGreaterThan(95)
  })
})

describe('Florida state jobs and Cornerstone boards', () => {
  it('reads Florida job ids from the sitemap and cleans the title in a job page', async () => {
    const { parseFloridaSitemap, parseJobs2Web } = await import('@/lib/jobs/gov-florida-core')
    const [job] = parseFloridaSitemap('<urlset><url><loc>https://jobs.myflorida.com/job/DELRAY-BEACH-ACCOUNTANT-III-64964553-FL-33444/1446542600/</loc></url></urlset>')
    expect(job.id).toBe('1446542600')
    const page = `<span itemprop="title">SENIOR ATTORNEY II - 42000504 1\n</span><meta itemprop="addressLocality" content="DELRAY BEACH"><meta itemprop="addressRegion" content="FL"><meta itemprop="datePosted" content="Tue Oct 27 00:00:00 UTC 2026"><span class="jobdescription"><p>Agency: State Courts System</p></span><span class="jobGeoLocation">`
    expect(parseJobs2Web(page)).toMatchObject({ title: 'SENIOR ATTORNEY II', employer: 'State of Florida, State Courts System', location: 'Delray Beach, FL', state: 'FL' })
  })
  it('builds the Cornerstone job url under the board prefix', async () => {
    const { csodAdapter, csodUrl } = await import('@/lib/jobs/gov-csod-core')
    const b = csodAdapter.boards[0]
    expect(csodUrl(b, '82635').startsWith(csodAdapter.prefix(b))).toBe(true)
  })
})

describe('NYC, KEPS, Taleo and CalCareers readers', () => {
  it('names the NYC employer from the agency', async () => {
    const { nycEmployer, nycUrl } = await import('@/lib/jobs/gov-nyc-core')
    expect(nycEmployer("ADMIN FOR CHILDREN'S SVCS")).toBe("City of New York, Admin For Children's Svcs")
    expect(nycUrl('807877')).toContain('JobOpeningId=807877')
  })
  it('reads the KEPS vacancy table', async () => {
    const { parseKepsTable } = await import('@/lib/jobs/gov-keps-core')
    const html = `<table><tr class="dlheader"><th>Vacancy ID</th></tr><tr><td><a href="JobDetails.aspx?vID=2026202702312">20262027 - 02312</a></td><td>Exceptional Child Instructor</td><td>Exceptional Child/LBD Instructor</td><td>11/13/2026</td><td>P-5 Elementary</td><td>Hardin County</td><td><span>Meadow View Elementary School</span></td><td><span>LBD</span></td></tr></table>`
    const [p] = parseKepsTable(html)
    expect(p).toMatchObject({ key: '2026202702312', title: 'Exceptional Child/LBD Instructor' })
    expect((p.data as { district: string }).district).toBe('Hardin County')
  })
  it('reads the Taleo job list', async () => {
    const { parseTaleoList, GOV_TALEO_BOARDS } = await import('@/lib/jobs/gov-taleo-core')
    const html = `<a href="https://phh.tbe.taleo.net/phh04/ats/careers/v2/viewRequisition?org=PCG&cws=47&rid=21444" class="viewJobLink">911 Public Safety Center Supervisor 1</a><a href="https://phh.tbe.taleo.net/phh04/ats/careers/v2/viewRequisition?org=PCG&cws=47&rid=21444" class="viewJobLink">View</a>`
    expect(parseTaleoList(html, GOV_TALEO_BOARDS[0])).toEqual([{ key: '21444', title: '911 Public Safety Center Supervisor 1' }])
  })
  it('reads a CalCareers posting and skips an id that is not one', async () => {
    const { parseCalCareers, calcareersJobs } = await import('@/lib/jobs/gov-calcareers-core')
    const page = `<span id="lblDepartmentName">Department of Motor Vehicles</span><span id="lblWorkingTitle">Analyst II</span><span id="lblPrimarySalary">$6,000.00 - $7,500.00 per Month</span><span id="lblFinalFilingDate">11/19/2026</span><span id="lblWorkLocation">Sacramento County</span><span id="lblJobType">Permanent, Full Time</span>`
    expect(parseCalCareers(page)).toMatchObject({ title: 'Analyst II', employer: 'State of California, Department of Motor Vehicles', location: 'Sacramento County, CA', salaryMin: 72000, salaryMax: 90000, employmentType: 'full_time' })
    expect(parseCalCareers('<html>nothing</html>')).toBeNull()
    expect(calcareersJobs(538401, 3).map((j) => j.id)).toEqual(['538401', '538402', '538403'])
  })
})

describe('UKG government boards', () => {
  it('builds the job url under the board prefix and lists each board once', async () => {
    const { ukgAdapter, ukgUrl, GOV_UKG_BOARDS } = await import('@/lib/jobs/gov-ukg-core')
    const b = GOV_UKG_BOARDS[0]
    expect(ukgUrl(b, 'abc').startsWith(ukgAdapter.prefix(b))).toBe(true)
    const keys = GOV_UKG_BOARDS.map((x) => `${x.tenant}/${x.guid}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('reads the city and state of a UKG opportunity', async () => {
    const { ukgLocation } = await import('@/lib/jobs/gov-ukg-core')
    expect(ukgLocation({ Id: '1', Locations: [{ Address: { City: 'Loveland', State: { Code: 'CO' } } }] })).toBe('Loveland, CO')
    expect(ukgLocation({ Id: '2', Locations: [] })).toBeNull()
  })
})
