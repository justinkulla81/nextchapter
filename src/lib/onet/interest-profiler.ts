import 'server-only'
import {
  INTEREST_AREA_ORDER,
  INTEREST_QUESTION_COUNT,
  type InterestArea,
  type InterestQuestion,
} from '@/lib/work-interests/areas'

// O*NET Web Services v2 — Interest Profiler short form (60 questions).
// Auth is an X-API-Key header; the key lives in ONET_API_KEY and never
// reaches the browser. Endpoint shape follows the v2 docs
// (https://services.onetcenter.org/reference/mnm/interest_profiler).
const BASE_URL = 'https://api-v2.onetcenter.org'

// The question bank is static, so cache it a day rather than hit O*NET on
// every page load.
const REVALIDATE_SECONDS = 60 * 60 * 24

const AREA_ALIASES: Record<string, InterestArea> = {
  realistic: 'REALISTIC',
  investigative: 'INVESTIGATIVE',
  artistic: 'ARTISTIC',
  social: 'SOCIAL',
  enterprising: 'ENTERPRISING',
  conventional: 'CONVENTIONAL',
}

export class OnetUnavailableError extends Error {}

function normalizeArea(raw: unknown): InterestArea | null {
  if (typeof raw !== 'string') return null
  return AREA_ALIASES[raw.trim().toLowerCase()] ?? null
}

/** Pure parser, split out so the response shape is easy to adjust. */
export function parseInterestQuestions(body: unknown): InterestQuestion[] {
  const list = (body as { question?: unknown })?.question
  if (!Array.isArray(list)) throw new OnetUnavailableError('Unexpected O*NET response shape')
  const questions = list.map((q: { index?: unknown; area?: unknown; text?: unknown }) => {
    const area = normalizeArea(q.area)
    if (!area || typeof q.index !== 'number' || typeof q.text !== 'string') {
      throw new OnetUnavailableError('Unexpected O*NET question shape')
    }
    return { index: q.index, area, text: q.text }
  })
  const perArea = INTEREST_AREA_ORDER.map((a) => questions.filter((q) => q.area === a).length)
  if (questions.length !== INTEREST_QUESTION_COUNT || perArea.some((n) => n !== 10)) {
    throw new OnetUnavailableError('O*NET returned an incomplete question set')
  }
  return questions.sort((a, b) => a.index - b.index)
}

export async function fetchInterestQuestions(): Promise<InterestQuestion[]> {
  const key = process.env.ONET_API_KEY
  if (!key) throw new OnetUnavailableError('ONET_API_KEY is not set')
  let res: Response
  try {
    res = await fetch(
      `${BASE_URL}/mnm/interest_profiler/questions?start=1&end=${INTEREST_QUESTION_COUNT}`,
      {
        headers: { 'X-API-Key': key, Accept: 'application/json' },
        next: { revalidate: REVALIDATE_SECONDS },
      }
    )
  } catch {
    throw new OnetUnavailableError('Could not reach O*NET')
  }
  if (!res.ok) throw new OnetUnavailableError(`O*NET responded ${res.status}`)
  return parseInterestQuestions(await res.json())
}
