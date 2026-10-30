import { cleanPublicQuery, type PublicBoardQuery } from '@/lib/jobs/public-board'

const MAX_PAY = 1_000_000
const MAX_OFFSET = 500

function int(v: string | null | undefined, max: number): number | undefined {
  if (!v || !/^\d{1,8}$/.test(v)) return undefined
  const n = Number(v)
  return n > 0 ? Math.min(n, max) : undefined
}

/** The jobs filters the app sends, cleaned the same way the website's search box is, plus minimum pay and paging. */
export function mobileJobQuery(sp: URLSearchParams): PublicBoardQuery {
  const base = cleanPublicQuery({ q: sp.get('q'), loc: sp.get('loc'), remote: sp.get('remote') })
  const minPay = int(sp.get('minPay'), MAX_PAY)
  const offset = int(sp.get('offset'), MAX_OFFSET)
  return { ...base, ...(minPay ? { minPay } : {}), ...(offset ? { offset } : {}) }
}

export const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,60}\]$/
