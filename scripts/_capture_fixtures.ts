import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID!
  const clientSecret = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_SECRET!
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  })
  const data = await response.json()
  return data.access_token
}
interface GmailMessagePart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailMessagePart[]
}
interface GmailHeader {
  name: string
  value: string
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}
function findPartByMimeType(part: GmailMessagePart | undefined, mimeType: string, depth = 0): string | null {
  if (!part || depth > 8) return null
  if (part.mimeType === mimeType && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf-8')
  }
  for (const sub of part.parts ?? []) {
    const found = findPartByMimeType(sub, mimeType, depth + 1)
    if (found) return found
  }
  return null
}
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const TARGETS: Record<string, string> = {
  beyGroup: '19fec97ae04163d0',
  bgbxLinkedin: '19fe95e8885e40c4',
  bgbxGreenhouse: '19fe95eb00cef187',
  evidenceActionLinkedin: '19fe7d56537810dd',
  evidenceActionWorkable: '19fe7d5c6d41aad3',
  bigWaveDigital: '19fe7bd2fef793bb',
  bioUrjaIndeed: '19fe429993287fa7',
  codaSearch: '19fd378593d5334c',
  hanover: '19fe325d4b396fa6',
  carterPierce: '19fe25f8a7717cc9',
  onPurposeCareersNewsletter: '19fd23c6217f1bc7',
}

async function main() {
  const connection = await prisma.emailConnection.findUniqueOrThrow({ where: { id: 'cmsfmmntl0004l704sbh3i75x' } })
  const accessToken = await refreshAccessToken(connection.refreshToken)
  const out: Record<string, { subject: string; from: string; bodyPreview: string; hasListUnsubscribe: boolean }> = {}

  for (const [key, id] of Object.entries(TARGETS)) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      console.error(`FAILED ${key} (${id}): ${res.status}`)
      continue
    }
    const message = await res.json()
    const subject = getHeader(message.payload?.headers, 'Subject')
    const from = getHeader(message.payload?.headers, 'From')
    const listUnsub = getHeader(message.payload?.headers, 'List-Unsubscribe')
    const plain = findPartByMimeType(message.payload, 'text/plain') ?? ''
    const html = findPartByMimeType(message.payload, 'text/html')
    const combined = (html ? `${plain} ${stripHtml(html)}` : plain).slice(0, 4000)
    out[key] = { subject, from, bodyPreview: combined, hasListUnsubscribe: !!listUnsub }
  }

  console.log(JSON.stringify(out, null, 2))
  await prisma.$disconnect()
}
main()
