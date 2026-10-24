import { PreviewShell } from '@/components/candidate/PreviewShell'
import { Module } from '@/components/candidate/Module'
import { CareerHighPointLine } from '@/components/dashboard/CareerHighPointLine'

// Career high point (2026-10-23): one line under "Seniority — highest level reached" on Search
// Strategy, with an inline correction. It adds no section, card or toggle: it replaces nothing and
// sits inside the existing seniority field (docs/candidate-redesign.md).
export function CareerHighPointPreview() {
  return (
    <PreviewShell place="home" entry="tailored">
      <Module title="Seniority — highest level reached">
        <p className="text-base text-ink">VP</p>
        <CareerHighPointLine
          store={{ derived: { level: 'VP', sizeBand: 'LARGE', startup: false, companyName: 'Acme Health', title: 'VP Operations', source: 'derived', at: '' } }}
          fallbackLevel="VP"
        />
      </Module>
      <Module title="A startup peak">
        <CareerHighPointLine
          store={{ member: { level: 'C-Suite', sizeBand: 'SMALL', startup: true, source: 'member', at: '' } }}
          fallbackLevel="C-Suite"
        />
      </Module>
    </PreviewShell>
  )
}
