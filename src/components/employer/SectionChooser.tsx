import { Briefcase, LifeBuoy, Sprout } from 'lucide-react'
import { SectionEntry } from '@/components/employer/SectionSwitcher'
import { EMPLOYER_SECTIONS, type EmployerSection, type EmployerSectionKey } from '@/lib/employer/sections'

const ICONS: Record<EmployerSectionKey, typeof Briefcase> = { hiring: Briefcase, employees: Sprout, outplacement: LifeBuoy }

export interface ChooserEntry {
  key: EmployerSectionKey
  href: string
  action: string
  /** Signed in: a CSRF token, so the button opens the section through the sign-in bridge (it signs the person in to that section if needed). */
  csrf?: string
}

function SectionCard({ section, entry }: { section: EmployerSection; entry: ChooserEntry }) {
  const Icon = ICONS[section.key]
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{section.label}</h2>
        <p className="text-xs font-medium text-muted-foreground">{section.employees}</p>
        <p className="text-sm text-muted-foreground">{section.blurb}</p>
      </div>
      {section.key === 'employees' && <p className="text-sm text-muted-foreground">{section.services.map((s) => s.label).join(', ')}</p>}
      <div className="mt-auto">
        <SectionEntry
          item={{ key: entry.key, label: section.label, href: entry.href, csrf: entry.csrf }}
          bridge={!!entry.csrf}
          label={entry.action}
          className="inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        />
      </div>
    </li>
  )
}

/** The three employer sections as cards, one button each. The caller decides which entries to pass: only held sections when signed in. */
export function SectionChooser({ entries }: { entries: ChooserEntry[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {entries.map((entry) => (
        <SectionCard key={entry.key} section={EMPLOYER_SECTIONS.find((s) => s.key === entry.key) as EmployerSection} entry={entry} />
      ))}
    </ul>
  )
}
