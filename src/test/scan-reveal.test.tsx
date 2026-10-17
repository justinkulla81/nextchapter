import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// The polling action pulls in the database; the markup tests never call it.
vi.mock('@/app/onboarding/reveal/actions', () => ({ getScanSummaryAction: vi.fn() }))

import { ScanReveal } from '@/components/onboarding/ScanReveal'
import type { ScanSummary } from '@/lib/onboarding/scan-summary-core'

const counts = { applications: 14, interviews: 1, networking: 22, followUps: 3, rejections: 9 }
const empty = { applications: 0, interviews: 0, networking: 0, followUps: 0, rejections: 0 }
const html = (summary: ScanSummary, tracking: 'on' | 'pending' | 'off' | null = 'on') =>
  renderToStaticMarkup(<ScanReveal initial={summary} tracking={tracking} />)

describe('ScanReveal', () => {
  it('shows progress, and the numbers so far, while the first read is running', () => {
    const out = html({ state: 'reading', progress: 0.5, counts })
    expect(out).toContain('Reading the last 3 months of your search')
    expect(out).toContain('role="progressbar"')
    expect(out).toContain('aria-valuenow="50"')
    expect(out).toContain('14')
    expect(out).not.toContain("Here&#x27;s what we found")
  })

  it('shows the findings once done: counts for applications and interviews, "about" for networking', () => {
    const out = html({ state: 'done', progress: 1, counts })
    expect(out).toContain("Here&#x27;s what we found")
    expect(out).toContain('applications')
    expect(out).toContain('1</dd>')
    expect(out).toContain('about 22')
    expect(out).not.toContain('role="progressbar"')
    expect(out).toContain('9 replies were a no')
  })

  it('says so plainly when nothing was found, instead of showing a wall of zeros as a result', () => {
    const out = html({ state: 'done', progress: 1, counts: empty })
    expect(out).toContain('any job-search activity yet')
    expect(out).not.toContain('a normal part of a search')
  })

  it('explains that tracking is waiting for approval, with no link that would not work yet', () => {
    const out = html({ state: 'not_connected', progress: 0, counts: empty }, 'pending')
    expect(out).toContain('waiting for approval')
    expect(out).not.toContain('/dashboard/network')
  })

  it('offers a way to turn tracking on later when they signed in without it', () => {
    const out = html({ state: 'not_connected', progress: 0, counts: empty }, 'off')
    expect(out).toContain('Inbox tracking is off')
    expect(out).toContain('href="/dashboard/network"')
  })
})
