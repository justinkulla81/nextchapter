import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { INDUSTRIES, JOB_FUNCTIONS } from '@/lib/seo/topics'
import { functionImage, industryImage } from '@/lib/seo/topic-images'

const onDisk = (url: string | undefined) => !!url && fs.existsSync(path.join(process.cwd(), 'public', url))

describe('topic header pictures', () => {
  it('every industry has one', () => {
    expect(INDUSTRIES.filter((i) => !onDisk(industryImage(i.slug))).map((i) => i.slug)).toEqual([])
  })
  it('every job function has one', () => {
    expect(JOB_FUNCTIONS.filter((f) => !onDisk(functionImage(f.name))).map((f) => f.name)).toEqual([])
  })
})
