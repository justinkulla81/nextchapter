import { describe, it, expect } from 'vitest'

// news-check imports the database client; the query list is plain data, so it
// is read from the source rather than loading that module graph.

describe('layoff news queries', () => {
  it('has no duplicates and keeps the original five', async () => {
    const src = (await import('node:fs')).readFileSync('src/lib/warn/news-check.ts', 'utf8')
    const block = src.slice(src.indexOf('export const QUERIES'), src.indexOf(']\n', src.indexOf('export const QUERIES')))
    const queries = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(new Set(queries).size).toBe(queries.length)
    for (const q of ['layoffs', 'lays off employees', 'to cut jobs', 'job cuts announced', 'announces layoffs']) expect(queries).toContain(q)
    expect(queries.length).toBeGreaterThan(15)
    expect(queries.length).toBeLessThan(40)
  })
})
