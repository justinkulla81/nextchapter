// Links and toggles inside the job board change one or two URL parameters and keep
// every other one: the search (q, loc, remote, sort), the view, work types,
// seniority, great-pay / great-benefits, the pivot path and the tab. Every in-board
// link and toggle builds its URL here, so none of them drops an active search or
// filter. Pure (no I/O): used by server-rendered links and client toggles alike.

/** The board's own URL parameters (anything else on the URL is kept too). */
export const BOARD_URL_PARAMS = ['q', 'loc', 'remote', 'sort', 'view', 'types', 'seniority', 'great', 'pivot', 'tab'] as const
export type BoardUrlParam = (typeof BOARD_URL_PARAMS)[number]

/** The search's parameters, for "Clear the search". */
export const BOARD_SEARCH_URL_PARAMS = ['q', 'loc', 'remote', 'sort'] as const satisfies readonly BoardUrlParam[]

type Current = URLSearchParams | string | Record<string, string | string[] | undefined> | null | undefined

function toParams(current: Current): URLSearchParams {
  if (!current) return new URLSearchParams()
  if (typeof current === 'string' || current instanceof URLSearchParams) return new URLSearchParams(current.toString())
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(current)) {
    if (typeof v === 'string') sp.set(k, v)
    else if (Array.isArray(v)) v.forEach((x) => sp.append(k, x))
  }
  return sp
}

/**
 * The current board URL with `changes` applied — a string sets that parameter, null
 * or '' removes it — and every other parameter kept. `view: 'all'` and `tab:
 * 'board'` are the defaults and are removed rather than written. Returns
 * `{pathname}?{query}#{hash}`; with no pathname, a relative `?query` link.
 */
export function boardHref(
  current: Current,
  changes: Partial<Record<BoardUrlParam, string | null>> = {},
  opts: { pathname?: string; hash?: string } = {}
): string {
  const sp = toParams(current)
  for (const [k, v] of Object.entries(changes)) {
    const isDefault = (k === 'view' && v === 'all') || (k === 'tab' && v === 'board') || (k === 'sort' && v === 'best')
    if (v === null || v === undefined || v === '' || isDefault) sp.delete(k)
    else sp.set(k, v)
  }
  const query = sp.toString()
  const hash = opts.hash ? `#${opts.hash.replace(/^#/, '')}` : ''
  const path = opts.pathname ?? ''
  // A relative link with no query still needs the "?" so it clears the current one.
  return `${path}${query || !path ? `?${query}` : ''}${hash}`
}

/** Every parameter in `keys` removed (the rest kept) — "Clear the search", "Turn off the other filters". */
export function boardHrefWithout(current: Current, keys: readonly BoardUrlParam[], opts: { pathname?: string; hash?: string } = {}): string {
  return boardHref(current, Object.fromEntries(keys.map((k) => [k, null])), opts)
}
