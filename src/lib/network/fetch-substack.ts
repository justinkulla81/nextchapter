import 'server-only'
import * as cheerio from 'cheerio'

export interface FetchSubstackResult {
  status: 'success' | 'fetch_failed' | 'parse_failed'
  text: string | null
  error: string | null
}

const MAX_TEXT_LENGTH = 8000
const MIN_REAL_CONTENT_LENGTH = 200

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

export async function fetchSubstack(url: string): Promise<FetchSubstackResult> {
  let html: string
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: BROWSER_HEADERS,
    })
    if (!response.ok) {
      return {
        status: 'fetch_failed',
        text: null,
        error: `Couldn't reach that URL (status ${response.status}). Double-check the link.`,
      }
    }
    html = await response.text()
  } catch (error) {
    return {
      status: 'fetch_failed',
      text: null,
      error: error instanceof Error ? error.message : 'Failed to fetch the URL.',
    }
  }

  try {
    const $ = cheerio.load(html)
    $('script, style, noscript, nav, footer').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH)

    if (!text || text.length < MIN_REAL_CONTENT_LENGTH) {
      return {
        status: 'parse_failed',
        text: null,
        error: 'Not enough readable content came back from that link — double-check it points at your Substack.',
      }
    }

    return { status: 'success', text, error: null }
  } catch (error) {
    return {
      status: 'parse_failed',
      text: null,
      error: error instanceof Error ? error.message : 'Failed to parse the page content.',
    }
  }
}
