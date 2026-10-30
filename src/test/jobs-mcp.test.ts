import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/layoffs/public-query', () => ({ validState: (s: string | null) => !s || /^[A-Za-z]{2}$/.test(s), queryLayoffs: async (q: { employer?: string | null }) => ({ asOf: '2026-10-30', count: 1, totalWorkers: 159, notices: [{ employer: q.employer ?? 'Comcast', state: 'WA', workers: 159, employerPage: 'https://launchyournextchapter.com/layoffs/company/comcast' }], license: 'CC BY 4.0' }) }))
vi.mock('@/lib/jobs/public-board', () => ({
  cleanPublicQuery: (r: { q?: string; loc?: string; remote?: string }) => ({ q: r.q ?? '', loc: r.loc ?? '', remote: r.remote === '1' }),
  searchPublicBoardCached: async () => ({ total: 1, jobs: [{ id: 'a', title: 'Director of Finance', company: 'Acme', location: 'Denver, CO', postedAt: '2026-10-27', salaryMin: 180000, salaryMax: 220000, url: 'https://acme.example/jobs/1', pagePath: '/jobs/abc' }] }),
}))

vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/careers/candidate-occupation', () => ({ searchOccupationTitles: async () => [{ socCode: '11-2021.00', title: 'Marketing Managers', score: 1 }] }))
vi.mock('@/lib/skills/ai-exposure-server', () => ({ loadExposureMap: async () => new Map([['11-2021', { title: 'Marketing Managers', score: 0.31 }]]) }))
vi.mock('@/lib/ai-check/load', () => ({
  loadOccupationCheck: async () => ({ exposure: { soc6: '11-2021', title: 'Marketing Managers', score: 0.31, band: 'high' }, need: 'build_now', medianWage: 159000, growthPct: 6, annualOpenings: 30000, bets: [{ soc6: '11-2022', title: 'Sales Managers', reasons: ['pays_more'], exposure: 0.12, medianWage: 168000 }], skillsToBuild: ['Data analysis'] }),
}))

import { captureServerEvent } from '@/lib/posthog/server'
import { findGuides, handleMcpMessage } from '@/lib/mcp/jobs-mcp'

const allow = async () => true
type Prog = { programPage?: string; lastCheckedOn?: string; status: string; coverage: string; goal: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

describe('jobs MCP server', () => {
  it('answers initialize with the requested protocol version and tools capability', async () => {
    const r = await handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, allow)
    expect((r?.result as { protocolVersion: string }).protocolVersion).toBe('2025-03-26')
    expect((r?.result as { capabilities: object }).capabilities).toHaveProperty('tools')
  })
  it('lists the read-only tools', async () => {
    const r = await handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, allow)
    const tools = (r?.result as { tools: { name: string }[] }).tools
    expect(tools.map((t) => t.name)).toEqual(['search_jobs', 'find_career_guide', 'recent_layoff_notices', 'unemployment_benefits_by_state', 'laid_off_benefits_and_programs', 'ai_exposure_for_job_title'])
  })
  it('returns no reply for a notification', async () => {
    expect(await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, allow)).toBeNull()
  })
  it('searches jobs and links to our own page', async () => {
    const r = await handleMcpMessage({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_jobs', arguments: { query: 'finance director' } } }, allow)
    const data = (r?.result as { structuredContent: { jobs: { url: string; pay: string }[] } }).structuredContent
    expect(data.jobs[0].url).toBe('https://launchyournextchapter.com/jobs/abc')
    expect(data.jobs[0].pay).toBe('$180k–$220k')
  })
  it('says so when rate limited', async () => {
    const r = await handleMcpMessage({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_jobs', arguments: {} } }, async () => false)
    expect((r?.result as { isError: boolean }).isError).toBe(true)
  })
  it('rejects unknown tools and methods', async () => {
    expect((await handleMcpMessage({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } }, allow))?.error?.code).toBe(-32602)
    expect((await handleMcpMessage({ jsonrpc: '2.0', id: 6, method: 'resources/list' }, allow))?.error?.code).toBe(-32601)
  })
  it('answers a layoff question from the notices, with a page to link to', async () => {
    const r = await handleMcpMessage({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'recent_layoff_notices', arguments: { employer: 'Comcast', days: 14 } } }, allow)
    const data = (r?.result as { structuredContent: { count: number; notices: { employer: string; employerPage: string }[] } }).structuredContent
    expect(data.count).toBe(1)
    expect(data.notices[0].employerPage).toContain('/layoffs/company/comcast')
  })
  it('finds the severance guide for a severance question', () => {
    expect(findGuides('how do I negotiate severance')[0].url).toContain('/topics/severance')
  })
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await handleMcpMessage({ jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name, arguments: args } }, allow)
    return (r?.result as { structuredContent: Record<string, Any> }).structuredContent
  }
  it('gives unemployment basics for a state with a source and date', async () => {
    const d = await call('unemployment_benefits_by_state', { state: 'tx' })
    expect(d.stateName).toBe('Texas')
    expect(d.maxWeeklyBenefitUsd.source).toMatch(/^https:/)
    expect(d.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(d.source).toBe('https://launchyournextchapter.com/unemployment-benefits/texas')
    expect((await call('unemployment_benefits_by_state', { state: 'ZZ' })).error).toBeTruthy()
  })
  it('lists only verified, open, unrestricted programs, state first', async () => {
    const d = await call('laid_off_benefits_and_programs', { state: 'NY', limit: 25 })
    expect(d.programs.length).toBeGreaterThan(0)
    expect(d.programs.every((p: Prog) => p.programPage?.startsWith('https://') && p.lastCheckedOn && ['OPEN', 'ROLLING'].includes(p.status))).toBe(true)
    expect(d.programs.every((p: Prog) => p.coverage === 'Nationwide' || p.coverage === 'New York')).toBe(true)
    const firstNational = d.programs.findIndex((p: Prog) => p.coverage === 'Nationwide')
    expect(d.programs.slice(Math.max(firstNational, 0)).every((p: Prog) => firstNational < 0 || p.coverage === 'Nationwide')).toBe(true)
    const retrain = await call('laid_off_benefits_and_programs', { state: 'NY', goal: 'retrain' })
    expect(retrain.programs.every((p: Prog) => p.goal === 'retrain')).toBe(true)
    expect(d.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('answers AI exposure from a job title, with source and link', async () => {
    const d = await call('ai_exposure_for_job_title', { title: 'marketing manager' })
    expect(d.aiExposure.band).toBe('High')
    expect(d.page).toContain('/tools/ai-job-check/marketing-managers-11-2021')
    expect(d.source.url).toMatch(/^https:/)
    expect(d.relatedJobsWorthConsidering[0].reasons).toEqual(['pays more'])
  })
  it('records an analytics event on every tool call', async () => {
    vi.mocked(captureServerEvent).mockClear()
    await call('unemployment_benefits_by_state', { state: 'CA' })
    expect(captureServerEvent).toHaveBeenCalledWith('mcp_client', 'mcp_tool_called', expect.objectContaining({ tool: 'unemployment_benefits_by_state', ok: true }))
  })
})
