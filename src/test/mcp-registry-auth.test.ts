import { describe, expect, it } from 'vitest'
import { GET } from '@/app/.well-known/mcp-registry-auth/route'
import server from '../../docs/mcp/server.json'

describe('MCP registry proof and server.json', () => {
  it('serves the proof record as plain text with a 200', async () => {
    const res = GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toMatch(/^v=MCPv1; k=ed25519; p=[A-Za-z0-9+/]{43}=\n$/)
  })
  it('keeps the registry description within 100 characters and names the live endpoint', () => {
    expect(server.description.length).toBeLessThanOrEqual(100)
    expect(server.name).toMatch(/^com\.launchyournextchapter\/[a-z0-9-]+$/)
    expect(server.remotes[0]).toEqual({ type: 'streamable-http', url: 'https://launchyournextchapter.com/api/mcp' })
  })
})
