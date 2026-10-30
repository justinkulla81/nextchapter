import { API_URL } from '@/lib/config'
import { getAccessToken } from '@/lib/auth'

export interface Job { id: string; title: string; company: string; location: string | null; postedAt: string | null; salaryMin: number | null; salaryMax: number | null; url: string }
export interface JobsPage { total: number; jobs: Job[]; nextOffset?: number | null }
export interface JobFilters { q: string; loc: string; remote: boolean; minPay: number }

export interface OccupationMatch { title: string; soc6: string; exact: boolean }
export interface AiCheck {
  soc6: string; title: string; scorePercent: string; band: 'high' | 'some' | 'little'; bandLabel: string; sentence: string; why: string; retraining: string
  medianWage: number | null; tasks: string[]; skillsToBuild: string[]; related: { title: string; soc6: string; medianWage: number | null; payDelta: number | null }[]
  source: string; shareUrl: string; shareMessage: string
}

export interface Notice { employer: string; state: string; place: string | null; workers: number | null; filedOn: string; effectiveOn: string | null; type: string | null; employerPage: string }
export interface LayoffFeed { count: number; totalWorkers: number; notices: Notice[] }
export interface EmployerFacts { name: string; slug: string; recentNotices: number; recentMonths: number; latest: string | null; announcedRecently: boolean }

export interface SavedItem { id: string; kind: 'jobs' | 'employer'; q: string; loc: string; remote: boolean; minPay: number }

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function call<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) }
  if (init?.auth) {
    const token = await getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? 'Something went wrong. Try again.')
  return body as T
}

const qs = (o: Record<string, string | number | boolean | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== false && v !== 0) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const searchJobs = (f: JobFilters, offset = 0) => call<JobsPage>(`/api/mobile/jobs${qs({ q: f.q, loc: f.loc, remote: f.remote, minPay: f.minPay, offset })}`)
export const findOccupations = (q: string) => call<{ matches: OccupationMatch[] }>(`/api/mobile/ai-check${qs({ q })}`)
export const getAiCheck = (soc: string) => call<AiCheck>(`/api/mobile/ai-check${qs({ soc })}`)
export const getLayoffs = (state?: string) => call<LayoffFeed>(`/api/mobile/layoffs${qs({ state })}`)
export const lookupEmployer = (q: string) => call<{ employers: EmployerFacts[] }>(`/api/layoffs/employer-lookup${qs({ q })}`)
export const registerDevice = (pushToken: string, platform: 'ios' | 'android') => call<{ ok: true }>('/api/mobile/devices', { method: 'POST', auth: true, body: JSON.stringify({ pushToken, platform }) })
export const listSaved = () => call<{ items: SavedItem[] }>('/api/mobile/saved', { auth: true })
export const saveItem = (item: Omit<SavedItem, 'id'>) => call<{ item: SavedItem }>('/api/mobile/saved', { method: 'POST', auth: true, body: JSON.stringify(item) })
export const removeSaved = (id: string) => call<{ ok: true }>(`/api/mobile/saved${qs({ id })}`, { method: 'DELETE', auth: true })
export const deleteAccount = (password: string, confirm: string) => call<{ ok: true }>('/api/mobile/account', { method: 'POST', auth: true, body: JSON.stringify({ password, confirm }) })
