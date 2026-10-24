import { EMPLOYER_SECTIONS, type EmployerSection } from '@/lib/employer/sections'

// A read-only picture of the employer side for marketing pages: the three sections by employee lifecycle and the
// services inside each. Server-renderable (no state, no hooks), no sign-in logic, no links and no prices; the page that
// uses it adds its own single action. Content comes from src/lib/employer/sections.ts so it cannot drift from the product.

function SectionBlock({ section }: { section: EmployerSection }) {
  const headingId = `employer-section-${section.key}`
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-6">
      <section aria-labelledby={headingId} className="flex flex-col gap-3">
        <p className="text-sm text-neutral-600">{section.employees}</p>
        <h3 id={headingId} className="text-xl font-semibold text-neutral-900">
          {section.label}
        </h3>
        <p className="text-neutral-700">{section.blurb}</p>
        <ul className="flex flex-col gap-2">
          {section.services.map((service) => (
            <li key={service.key} className="text-sm text-neutral-800">
              <span className="font-medium">{service.label}</span>
              <span className="text-neutral-600">{`: ${service.blurb}`}</span>
              {service.built ? null : <span className="text-neutral-600"> Not available yet.</span>}
            </li>
          ))}
        </ul>
      </section>
    </li>
  )
}

export function EmployerOverview({ className }: { className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-2xl font-semibold text-neutral-900">One organization, three sections</h2>
      <p className="mt-2 max-w-2xl text-neutral-700">
        Each section follows your people through their time with you. Take one, or all three together. Different people on your team can run different sections.
      </p>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {EMPLOYER_SECTIONS.map((section) => (
          <SectionBlock key={section.key} section={section} />
        ))}
      </ul>
    </div>
  )
}
