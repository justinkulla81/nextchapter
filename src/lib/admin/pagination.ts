export interface ParsedListParams {
  q: string
  page: number
  pageSize: number
  skip: number
  take: number
  filters: Record<string, string>
}

// Parses `?q=&page=&<filterKeys>=...` from a Next.js searchParams object into
// a shape any admin list page can hand straight to Prisma's `skip`/`take`.
// The URL is the only state — no client-side filter state anywhere — so a
// bookmarked/shared link reproduces the exact same view.
export function parseListParams(
  searchParams: Record<string, string | string[] | undefined>,
  filterKeys: string[],
  pageSize = 25
): ParsedListParams {
  const q = (typeof searchParams.q === 'string' ? searchParams.q : '').trim()
  const pageRaw = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const filters: Record<string, string> = {}
  for (const key of filterKeys) {
    const value = searchParams[key]
    if (typeof value === 'string' && value.length > 0) filters[key] = value
  }

  return { q, page, pageSize, skip: (page - 1) * pageSize, take: pageSize, filters }
}

export interface PaginatedResult<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function paginatedResult<T>(rows: T[], total: number, params: ParsedListParams): PaginatedResult<T> {
  return {
    rows,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  }
}
