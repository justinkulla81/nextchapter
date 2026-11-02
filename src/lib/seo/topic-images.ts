import { INDUSTRIES, JOB_FUNCTIONS } from '@/lib/seo/topics'

// The header picture on industry and job-title pages (public/images/topics, made once by scripts/topic-images/generate.ts).
// src/test/topic-images.test.ts checks every industry and function has its file, so a new one cannot ship without a picture.

export const industryImage = (slug: string): string | undefined => (INDUSTRIES.some((i) => i.slug === slug) ? `/images/topics/industry-${slug}.webp` : undefined)
export const functionImage = (name: string | null | undefined): string | undefined => {
  const f = JOB_FUNCTIONS.find((x) => x.name === name)
  return f ? `/images/topics/function-${f.slug}.webp` : undefined
}
