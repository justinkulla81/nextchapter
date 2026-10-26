// /indexnow.txt: the ownership file for IndexNow (indexnow.org). Bing, Yandex and the other IndexNow engines fetch
// it to confirm that URL submissions for this host come from us. The key is INDEXNOW_KEY; scripts/seo/indexnow.ts
// reads it back from here, so the key lives in one place. Without the variable the route is a 404.
export const dynamic = 'force-dynamic'

export function GET() {
  const key = process.env.INDEXNOW_KEY
  if (!key || !/^[a-f0-9]{16,128}$/.test(key)) return new Response('Not found', { status: 404 })
  return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
