import { Briefcase, LifeBuoy, Sprout } from 'lucide-react'
import { EMPLOYER_SECTIONS, type EmployerSection, type EmployerSectionKey } from '@/lib/employer/sections'

const ICONS: Record<EmployerSectionKey, typeof Briefcase> = { hiring: Briefcase, employees: Sprout, outplacement: LifeBuoy }

export interface ChooserEntry {
  key: EmployerSectionKey
  href: string
  action: string
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
      <a href={entry.href} className="mt-auto inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
        {entry.action}
      </a>
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
