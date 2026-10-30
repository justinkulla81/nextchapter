// OpenAI's domain check for the ChatGPT apps directory: the dashboard gives a token and expects it back as plain text at
// /.well-known/openai-apps-challenge (no JSON, no newline fuss). Set OPENAI_APPS_CHALLENGE to the token; until then this 404s.
export const dynamic = 'force-dynamic'

export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim()
  if (!token) return new Response('Not found', { status: 404 })
  return new Response(token, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
