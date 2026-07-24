import 'server-only'
import * as cheerio from 'cheerio'

export interface FetchArticleResult {
  status: 'success' | 'fetch_failed' | 'parse_failed'
  title: string | null
  text: string | null
  error: string | null
}

const MAX_TEXT_LENGTH = 12000
const MIN_REAL_ARTICLE_LENGTH = 200

// Reuses the same login-wall heuristic as fetch-job-posting.ts — a page can
// 200 and still hand back a sign-in/paywall screen instead of the article.
const LOGIN_WALL_PATTERNS = [
  /sign in to/i,
  /log in to/i,
  /subscribe to (continue|read)/i,
  /create an account to/i,
  /verify you.{0,3}re (a )?human/i,
  /enable javascript/i,
  /are you a robot/i,
  /captcha/i,
]

function looksLikePaywall(text: string): boolean {
  if (text.length < MIN_REAL_ARTICLE_LENGTH) return true
  return LOGIN_WALL_PATTERNS.some((pattern) => pattern.test(text))
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

export async function fetchArticle(url: string): Promise<FetchArticleResult> {
  let html: string
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: BROWSER_HEADERS,
    })
    if (!response.ok) {
      return { status: 'fetch_failed', title: null, text: null, error: `Request failed with status ${response.status}.` }
    }
    html = await response.text()
  } catch (error) {
    return {
      status: 'fetch_failed',
      title: null,
      text: null,
      error: error instanceof Error ? error.message : 'Failed to fetch the URL.',
    }
  }

  try {
    const $ = cheerio.load(html)
    const title = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim() || null
    $('script, style, noscript').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH)

    if (!text) {
      return { status: 'parse_failed', title, text: null, error: 'No readable text found on the page.' }
    }

    if (looksLikePaywall(text)) {
      return {
        status: 'parse_failed',
        title,
        text: null,
        error: 'This page looks like a paywall or sign-in screen rather than the article itself — could not fetch full content.',
      }
    }

    return { status: 'success', title, text, error: null }
  } catch (error) {
    return {
      status: 'parse_failed',
      title: null,
      text: null,
      error: error instanceof Error ? error.message : 'Failed to parse the page content.',
    }
  }
}
