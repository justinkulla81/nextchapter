import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CRON_BUNDLES, cronSchedules } from '@/lib/cron/schedule'

const route = (job: string) => join(process.cwd(), 'src/app/api/cron', job, 'route.ts')
const vercel = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: { path: string; schedule: string }[] }

describe('cron bundles', () => {
  it('has a bundle route that runs exactly the jobs listed for it', () => {
    for (const [bundle, jobs] of Object.entries(CRON_BUNDLES)) {
      expect(existsSync(route(bundle)), bundle).toBe(true)
      const source = readFileSync(route(bundle), 'utf8')
      const imported = [...source.matchAll(/from '\.\.\/([a-z0-9-]+)\/route'/g)].map((m) => m[1])
      expect(imported.sort(), bundle).toEqual([...jobs].sort())
      for (const job of jobs) expect(existsSync(route(job)), job).toBe(true)
    }
  })

  it('is scheduled once in vercel.json, and no bundled job also has its own cron', () => {
    const paths = vercel.crons.map((c) => c.path)
    for (const bundle of Object.keys(CRON_BUNDLES)) expect(paths.filter((p) => p === `/api/cron/${bundle}`)).toHaveLength(1)
    for (const job of Object.values(CRON_BUNDLES).flat()) expect(paths).not.toContain(`/api/cron/${job}`)
  })

  it('puts no job in two bundles', () => {
    const all = Object.values(CRON_BUNDLES).flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('has the watchdog check each bundled job on its bundle schedule', () => {
    const schedules = cronSchedules()
    const byJob = new Map(schedules.map((s) => [s.job, s]))
    for (const [bundle, jobs] of Object.entries(CRON_BUNDLES)) {
      const cron = vercel.crons.find((c) => c.path === `/api/cron/${bundle}`)!
      expect(byJob.has(bundle)).toBe(false)
      for (const job of jobs) expect(byJob.get(job)?.schedule).toBe(cron.schedule)
    }
  })
})

describe('cronBundle', () => {
  const load = async () => {
    vi.resetModules()
    vi.doMock('server-only', () => ({}))
    process.env.CRON_SECRET = 'test-secret-0123456789'
    return (await import('@/lib/cron/bundle')).cronBundle
  }
  const req = (auth?: string) => ({ headers: new Headers(auth ? { authorization: auth } : {}) }) as never

  it('rejects a request without the secret and runs nothing', async () => {
    const cronBundle = await load()
    const a = vi.fn(async () => new Response('{}'))
    const res = await cronBundle({ a })(req())
    expect(res.status).toBe(401)
    expect(a).not.toHaveBeenCalled()
  })

  it('runs every job in order even when one fails or throws', async () => {
    const cronBundle = await load()
    const order: string[] = []
    const res = await cronBundle({
      a: async () => (order.push('a'), new Response('{}', { status: 500 })),
      b: async () => { order.push('b'); throw new Error('boom') },
      c: async () => (order.push('c'), new Response('{}')),
    })(req('Bearer test-secret-0123456789'))
    expect(order).toEqual(['a', 'b', 'c'])
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, results: { a: 500, b: 500, c: 200 } })
  })

  it('answers 200 when every job succeeds', async () => {
    const cronBundle = await load()
    const res = await cronBundle({ a: async () => new Response('{}') })(req('Bearer test-secret-0123456789'))
    expect(res.status).toBe(200)
  })
})
