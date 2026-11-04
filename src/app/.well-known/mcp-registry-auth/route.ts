// Proves to the official MCP Registry (registry.modelcontextprotocol.io) that we control launchyournextchapter.com, so the server can be
// published under the name com.launchyournextchapter/*. The registry fetches this path from its own servers: it must answer 200 with the
// proof record, no redirect. The record holds only the PUBLIC half of an Ed25519 key; the private half stays with whoever publishes
// (docs/mcp/README.md). To publish with a new key, replace the record below.
export const dynamic = 'force-static'

const PROOF = 'v=MCPv1; k=ed25519; p=emn99JNJv+LyGNR8vRQH2a9c0gFIZwt93CzGIh9epzA='

export function GET() {
  return new Response(PROOF + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}
