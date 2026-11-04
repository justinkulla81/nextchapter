import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/posthog/client', () => ({ posthog: { capture: vi.fn() } }))

import { InviteShell } from '@/app/dashboard/supporters/InviteShell'
import { AddPlaceShell } from '@/app/dashboard/move-plan/AddPlaceShell'

const forms = { supporterForm: <p>SUPPORTER FORM</p>, partnerForm: <p>PARTNER FORM</p> }

describe('Your people: Invite someone', () => {
  it('shows one form with a supporter / partner choice when nobody is invited yet', () => {
    const html = renderToStaticMarkup(<InviteShell startOpen canPartner supporters={0} {...forms} />)
    expect(html).toContain('A supporter')
    expect(html).toContain('A partner')
    expect(html).toContain('SUPPORTER FORM')
    expect(html).not.toContain('PARTNER FORM')
    // the weekly-note promise is said once
    expect((html.match(/one short note a week/g) ?? []).length).toBe(1)
  })
  it('opens on the partner form when asked to (the move plan links here)', () => {
    const html = renderToStaticMarkup(<InviteShell startOpen canPartner initialKind="partner" supporters={0} {...forms} />)
    expect(html).toContain('PARTNER FORM')
    expect(html).not.toContain('SUPPORTER FORM')
  })
  it('is one button when the member already has people', () => {
    const html = renderToStaticMarkup(<InviteShell startOpen={false} canPartner supporters={2} {...forms} />)
    expect(html).toContain('Invite someone')
    expect(html).not.toContain('SUPPORTER FORM')
  })
  it('offers no partner choice once there is a partner', () => {
    const html = renderToStaticMarkup(<InviteShell startOpen canPartner={false} supporters={1} {...forms} />)
    expect(html).not.toContain('A partner')
    expect(html).toContain('SUPPORTER FORM')
  })
})

describe('Your move plan: Add a place', () => {
  it('is one button when there are places, and the form when there are none', () => {
    const button = renderToStaticMarkup(<AddPlaceShell startOpen={false} places={3} form={<p>ADD FORM</p>} />)
    expect(button).toContain('Add a place')
    expect(button).not.toContain('ADD FORM')
    const open = renderToStaticMarkup(<AddPlaceShell startOpen places={0} form={<p>ADD FORM</p>} />)
    expect(open).toContain('ADD FORM')
    expect(open).not.toContain('Close without adding')
  })
})
