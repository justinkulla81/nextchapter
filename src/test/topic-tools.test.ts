import { describe, expect, it } from 'vitest'
import { TOPIC_TOOLS } from '@/lib/seo/topic-tools'
import { TOPICS } from '@/lib/seo/explainers'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('topic tools', () => {
  it('names only guides that exist', () => {
    const slugs = new Set(TOPICS.map((t) => t.slug))
    for (const slug of Object.keys(TOPIC_TOOLS)) expect(slugs.has(slug), slug).toBe(true)
  })
  it('links only tools and pages that exist', () => {
    for (const tool of Object.values(TOPIC_TOOLS).flat()) {
      expect(existsSync(join(process.cwd(), 'src/app', `${tool.href}/page.tsx`)), tool.href).toBe(true)
    }
  })
})
