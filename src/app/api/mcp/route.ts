import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { handleMcpMessage, type JsonRpcRequest } from '@/lib/mcp/jobs-mcp'

export const maxDuration = 30

// Public MCP endpoint (Streamable HTTP, stateless, JSON replies). See src/lib/mcp/jobs-mcp.ts.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export function GET() {
  return NextResponse.json({ error: 'This is an MCP endpoint. Send JSON-RPC with POST.', docs: 'https://launchyournextchapter.com/mcp' }, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: CORS })
  }
  const allowSearch = () => allowByIp('mcp-search', 120, HOUR_MS)
  const messages = (Array.isArray(body) ? body : [body]) as JsonRpcRequest[]
  if (messages.length === 0 || messages.length > 10) {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Send 1 to 10 messages' } }, { status: 400, headers: CORS })
  }
  const replies = (await Promise.all(messages.map((m) => handleMcpMessage(m, allowSearch)))).filter((r) => r !== null)
  if (replies.length === 0) return new NextResponse(null, { status: 202, headers: CORS })
  return NextResponse.json(Array.isArray(body) ? replies : replies[0], { headers: CORS })
}
