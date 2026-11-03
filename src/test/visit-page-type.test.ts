import { describe, expect, it } from 'vitest'
import { classifyVisitPage } from '@/lib/admin/visit-page-type'

describe('classifyVisitPage', () => {
  it.each([
    ['/', 'Homepage'],
    ['/?utm_source=x', 'Homepage'],
    [null, 'Homepage'],
    ['/jobs/abc123', 'Job posting'],
    ['/jobs', 'Public page'],
    ['/layoffs/2026', 'Public page'],
    ['/start/laid-off', 'Public page'],
    ['/employers/acme', 'Public page'],
    ['/auth/login', 'Candidate login'],
    ['/auth/callback?code=1', 'Candidate login'],
    ['/onboarding/desire', 'Candidate sign-up'],
    ['/checkin/weekly', 'Candidate portal'],
    ['/dashboard', 'Candidate portal'],
    ['/employers', 'B2B public page'],
    ['/for-colleges/alumni-giving', 'B2B public page'],
    ['/workforce-boards/nj', 'B2B public page'],
    ['/recruiters', 'B2B public page'],
    ['/talent', 'B2B public page'],
    ['/talent/login', 'B2B login'],
    ['/recruiters/signup', 'B2B login'],
    ['/support/coach/login', 'B2B login'],
    ['/login', 'B2B login'],
    ['/i/login', 'B2B login'],
    ['/talent/dashboard', 'B2B portal'],
    ['/recruiters/dashboard', 'B2B portal'],
    ['/i/wju/members', 'B2B portal'],
    ['/i/wju/join', 'Candidate sign-up'],
    ['/i/wju/give', 'Public page'],
  ])('%s → %s', (path, expected) => {
    expect(classifyVisitPage(path)).toBe(expected)
  })
})
