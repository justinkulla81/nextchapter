import { describe, expect, it } from 'vitest'
import { aggregatorKind, atsApiUrl, classifyPage } from '@/lib/jobs/liveness'
import { cardMetaParts, lastCheckedPhrase } from '@/lib/jobs/job-card'
import { mapCrawlerCloseReason, isCloseReason } from '@/lib/jobs/job-status'

describe('job liveness: page verdicts', () => {
  const url = 'https://careers.example.com/jobs/92338?lang=en-us'
  it('404 and 410 are dead', () => {
    expect(classifyPage({ url, finalUrl: url, status: 404, body: '' }).status).toBe('dead')
    expect(classifyPage({ url, finalUrl: url, status: 410, body: '' }).status).toBe('dead')
  })
  it('a redirect that drops the job id is dead; a login wall is unknown', () => {
    expect(classifyPage({ url, finalUrl: 'https://careers.example.com/careers-home', status: 200, body: '<h1>Join us</h1>' }).status).toBe('dead')
    expect(classifyPage({ url, finalUrl: 'https://sso.example.com/login?next=x', status: 200, body: '' }).status).toBe('unknown')
    expect(classifyPage({ url, finalUrl: 'https://careers.example.com/en/jobs/92338', status: 200, body: '<h1>VP Finance</h1>' }).status).toBe('live')
  })
  it('closed-job text in the visible page is dead, but not inside scripts', () => {
    expect(classifyPage({ url, finalUrl: url, status: 200, body: '<p>This position has been filled.</p>' }).status).toBe('dead')
    expect(classifyPage({ url, finalUrl: url, status: 200, body: '<p>We are no longer accepting applications</p>' }).status).toBe('dead')
    expect(classifyPage({ url, finalUrl: url, status: 200, body: '<script>var t="This job is no longer available"</script><h1>VP Finance</h1>' }).status).toBe('live')
  })
  it('JobPosting data wins over error strings shipped with every page', () => {
    const live = '<script type="application/ld+json">{"@type":"JobPosting","title":"Service Manager"}</script><div data-i18n=\'{"NO_JOBS_404":"this job may be no longer available"}\'></div><h1>Service Manager</h1>'
    expect(classifyPage({ url, finalUrl: url, status: 200, body: live }).status).toBe('live')
    const leaked = '<h1>Service Manager</h1><div>{"ERROR":{"NO_JOBS_404":"this job may be no longer available or does not exist"}}</div>'
    expect(classifyPage({ url, finalUrl: url, status: 200, body: leaked }).status).toBe('live')
    const expired = '<script type="application/ld+json">{"@type":"JobPosting","validThrough":"2026-10-01T00:00:00Z"}</script>'
    expect(classifyPage({ url, finalUrl: url, status: 200, body: expired, now: new Date('2026-10-17T00:00:00Z') }).status).toBe('dead')
  })
  it("Jooble's closedJob redirect is dead", () => {
    const j = 'https://jooble.org/jdp/4013584634546647203'
    expect(classifyPage({ url: j, finalUrl: 'https://jooble.org/SearchResult?closedJob=True&p=1', status: 200, body: '' }).status).toBe('dead')
  })
  it('403 and 5xx are unknown, never dead', () => {
    expect(classifyPage({ url, finalUrl: url, status: 403, body: '' }).status).toBe('unknown')
    expect(classifyPage({ url, finalUrl: url, status: 503, body: '' }).status).toBe('unknown')
  })
})

describe('job liveness: hosts', () => {
  it('maps ATS links to their job APIs', () => {
    expect(atsApiUrl('https://boards.greenhouse.io/anduril/jobs/5242840007?gh_jid=5242840007')?.api).toBe('https://boards-api.greenhouse.io/v1/boards/anduril/jobs/5242840007')
    expect(atsApiUrl('https://jobs.lever.co/onit/ab01e18f-5ca9-4d5e-8052-e251dba7eac3')?.api).toBe('https://api.lever.co/v0/postings/onit/ab01e18f-5ca9-4d5e-8052-e251dba7eac3')
    expect(atsApiUrl('https://humana.wd5.myworkdayjobs.com/en-US/CenterWell/job/Asheville-NC/Nurse_R-433521')?.api).toBe(
      'https://humana.wd5.myworkdayjobs.com/wday/cxs/humana/CenterWell/job/Asheville-NC/Nurse_R-433521'
    )
    expect(atsApiUrl('https://careers.example.com/jobs/1')).toBeNull()
  })
  it('knows the aggregator links it must not fetch', () => {
    expect(aggregatorKind('https://jooble.org/jdp/-1003652540639871230')).toBe('jooble')
    expect(aggregatorKind('https://jobviewtrack.com/v2/abc')).toBe('careerjet')
    expect(aggregatorKind('https://jobs.ashbyhq.com/plaid/1')).toBeNull()
  })
})

describe('job liveness: card freshness and close reason', () => {
  const now = new Date('2026-10-17T12:00:00Z')
  it('says "Last checked N days ago" only past 3 days', () => {
    expect(lastCheckedPhrase(new Date('2026-10-15T12:00:00Z'), now)).toBeNull()
    expect(lastCheckedPhrase(new Date('2026-10-12T12:00:00Z'), now)).toBe('Last checked 5 days ago')
    expect(lastCheckedPhrase(null, now)).toBeNull()
  })
  it('folds it into the posted phrase on the meta line', () => {
    const base = { location: 'Atlanta, GA', pay: null, workType: 'full_time' as const, title: 'VP', now }
    expect(cardMetaParts({ ...base, posted: 'Posted 9 days ago', verifiedAt: new Date('2026-10-12T12:00:00Z') })).toEqual(['Posted 9 days ago, last checked 5 days ago', 'Atlanta, GA'])
    expect(cardMetaParts({ ...base, posted: 'Posted 9 days ago', verifiedAt: new Date('2026-10-17T08:00:00Z') })).toEqual(['Posted 9 days ago', 'Atlanta, GA'])
  })
  it("knows 'expired_checked'", () => {
    expect(isCloseReason('expired_checked')).toBe(true)
    expect(mapCrawlerCloseReason('expired_checked')).toBe('expired_checked')
  })
})
