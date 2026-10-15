// Pings IndexNow (Bing, Yandex and others; Google ignores it) with the report
// URLs so the search engines recrawl them promptly after a deploy.
//
// The key is served as a static file at /<key>.txt from public/, which
// IndexNow fetches to verify ownership. Keep INDEXNOW_KEY in sync with that
// filename.
//
// Run: npm run report:indexnow            (submits the standard report URLs)
//      npm run report:indexnow -- <url>…  (submits specific URLs instead)
import { REPORT_EDITIONS } from '../../src/lib/reports'

const SITE = 'https://launchyournextchapter.com'
const HOST = 'launchyournextchapter.com'
const INDEXNOW_KEY = '24d478db8c3dd0e0f650b53caba7befd'

function defaultUrls(): string[] {
  return [
    `${SITE}/reports`,
    `${SITE}/reports/white-collar-index`,
    ...REPORT_EDITIONS.map((e) => `${SITE}/reports/${e.slug}`),
  ]
}

async function main() {
  const fromArgs = process.argv.slice(2).filter((a) => a.startsWith('http'))
  const urlList = fromArgs.length ? fromArgs : defaultUrls()

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  })

  // IndexNow returns 200 or 202 on success; log the body for anything else.
  console.log(`IndexNow responded ${res.status} ${res.statusText} for ${urlList.length} URL(s):`)
  urlList.forEach((u) => console.log(`  ${u}`))
  if (!res.ok && res.status !== 202) {
    console.error(await res.text())
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
