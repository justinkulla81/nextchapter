import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/jobs/public-board', () => ({
  cleanPublicQuery: (r: { q?: string; loc?: string; remote?: string }) => ({ q: r.q ?? '', loc: r.loc ?? '', remote: r.remote === '1' }),
  searchPublicBoardCached: async () => ({ total: 1, jobs: [{ id: 'a', title: 'Director of Finance', company: 'Acme', location: 'Denver, CO', postedAt: '2026-10-27', salaryMin: 180000, salaryMax: 220000, url: 'https://acme.example/jobs/1', pagePath: '/jobs/abc' }] }),
}))

import { findGuides, handleMcpMessage } from '@/lib/mcp/jobs-mcp'

const allow = async () => true

describe('jobs MCP server', () => {
  it('answers initialize with the requested protocol version and tools capability', async () => {
    const r = await handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, allow)
    expect((r?.result as { protocolVersion: string }).protocolVersion).toBe('2025-03-26')
    expect((r?.result as { capabilities: object }).capabilities).toHaveProperty('tools')
  })
  it('lists two read-only tools', async () => {
    const r = await handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, allow)
    const tools = (r?.result as { tools: { name: string }[] }).tools
    expect(tools.map((t) => t.name)).toEqual(['search_jobs', 'find_career_guide'])
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
  it('finds the severance guide for a severance question', () => {
    expect(findGuides('how do I negotiate severance')[0].url).toContain('/topics/severance')
  })
})
