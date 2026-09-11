import { describe, it, expect } from 'vitest'
import { renderMarkdown, slugify, extractSections } from '@/lib/vision/markdown'

describe('renderMarkdown', () => {
  it('renders headings with linkable ids', () => {
    expect(renderMarkdown('## What NextChapter Is')).toContain('id="what-nextchapter-is"')
  })
  it('renders lists, bold and inline code', () => {
    const html = renderMarkdown('- **bold** and `code`')
    expect(html).toContain('<ul')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code')
  })
  it('escapes HTML before formatting, so markup cannot be injected', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })
  it('only linkifies http and https', () => {
    expect(renderMarkdown('[x](https://a.com)')).toContain('href="https://a.com"')
    // A javascript: URL must stay inert text rather than becoming an anchor.
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a href')
  })
  it('leaves code blocks unformatted', () => {
    const html = renderMarkdown('```\n**not bold**\n```')
    expect(html).toContain('<pre')
    expect(html).not.toContain('<strong>')
  })
})

describe('extractSections', () => {
  it('lists headings so a roadmap item can point at one', () => {
    const s = extractSections('# Master\n## Background\ntext\n## What it is')
    expect(s.map((x) => x.title)).toEqual(['Master', 'Background', 'What it is'])
    expect(s[1].id).toBe('background')
  })
})

describe('slugify', () => {
  it('strips punctuation and collapses spaces', () => {
    // The em-dash is stripped and the whitespace around it collapses to ONE
    // hyphen — a doubled separator would be an ugly anchor for no reason.
    expect(slugify('1. BACKGROUND — the environment')).toBe('1-background-the-environment')
  })
})
