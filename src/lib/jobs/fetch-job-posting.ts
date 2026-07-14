import 'server-only'
import * as cheerio from 'cheerio'
import { getBlockedJobHost } from './blocked-job-hosts'

export interface FetchJobResult {
  status: 'success' | 'fetch_failed' | 'parse_failed' | 'blocked'
  text: string | null
  error: string | null
}

const MAX_TEXT_LENGTH = 8000
const MIN_REAL_POSTING_LENGTH = 200

// Sites that return a 200 with a sign-in/verification page instead of the
// actual posting (rather than a clean 403/401) — a fetch can "succeed" here
// and still hand back nothing usable, which previously got passed straight
// to the fit-analysis LLM and produced a nonsense "0/100" result. Checked
// against the cleaned page text so it doesn't matter which specific site did
// this, only that the content itself doesn't look like a real posting.
const LOGIN_WALL_PATTERNS = [
  /sign in to/i,
  /log in to/i,
  /join now to/i,
  /create an account to/i,
  /verify you.{0,3}re (a )?human/i,
  /enable javascript/i,
  /are you a robot/i,
  /captcha/i,
  /join linkedin/i,
  /continue with google/i,
  /continue with facebook/i,
]

function looksLikeLoginWall(text: string): boolean {
  if (text.length < MIN_REAL_POSTING_LENGTH) return true
  return LOGIN_WALL_PATTERNS.some((pattern) => pattern.test(text))
}

// Some job boards (Indeed, LinkedIn, and others) run bot-detection that goes
// well beyond the User-Agent header — TLS fingerprinting, IP reputation, JS
// challenges — none of which a plain server-side fetch can satisfy. A
// realistic browser header set clears the sites with lighter checks; for the
// rest, the UI offers a "paste the description instead" fallback rather than
// attempting to evade detection.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

export async function fetchJobPosting(url: string): Promise<FetchJobResult> {
  const blockedHost = getBlockedJobHost(url)
  if (blockedHost) {
    return {
      status: 'blocked',
      text: null,
      error: `${blockedHost.name} ${blockedHost.reason}, so it can't be fetched automatically. Paste the job description text below instead.`,
    }
  }

  let html: string
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: BROWSER_HEADERS,
    })
    if (!response.ok) {
      const error =
        response.status === 403
          ? 'This site blocks automated requests and could not be fetched. Paste the job description text instead using the option below.'
          : `Request failed with status ${response.status}.`
      return { status: 'fetch_failed', text: null, error }
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
    $('script, style, noscript').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH)

    if (!text) {
      return { status: 'parse_failed', text: null, error: 'No readable text found on the page.' }
    }

    if (looksLikeLoginWall(text)) {
      return {
        status: 'parse_failed',
        text: null,
        error:
          'This page looks like a sign-in or verification page rather than the job posting itself, so there was nothing real to analyze. Paste the job description text below instead.',
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
