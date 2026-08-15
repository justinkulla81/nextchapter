import {
  SAMPLE_DOSSIER_CANDIDATE,
  SAMPLE_DOSSIER_ROLE,
  SAMPLE_DOSSIER_SECTIONS,
  SAMPLE_DOSSIER_REFERENCES_AVAILABLE,
  SAMPLE_DOSSIER_REFERENCES_TOTAL,
} from '@/lib/marketing/sample-dossier'
import { Card, CardContent } from '@/components/ui/card'

export function SampleDossier() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Sample Executive Dossier — {SAMPLE_DOSSIER_CANDIDATE}, {SAMPLE_DOSSIER_ROLE}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
          Illustrative, not a real person
        </span>
      </div>
      <Card className="border-brand/20">
        <CardContent className="divide-y divide-border pt-6">
          {SAMPLE_DOSSIER_SECTIONS.map((section) => (
            <div key={section.id} className="py-4 first:pt-0 last:pb-0">
              <h3 className="text-sm font-semibold text-navy">{section.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{section.body}</p>
            </div>
          ))}
          <div className="py-4">
            <h3 className="text-sm font-semibold text-navy">References</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">
              {SAMPLE_DOSSIER_REFERENCES_AVAILABLE} of {SAMPLE_DOSSIER_REFERENCES_TOTAL} references available for
              hiring-manager calls.
            </p>
          </div>
        </CardContent>
      </Card>
      <p className="mt-4 rounded-lg border border-light-gray bg-off-white p-4 text-sm leading-relaxed text-muted-foreground">
        These are what five people said about working with this candidate, collected and scored consistently.{' '}
        <span className="font-medium text-foreground">
          We don&apos;t independently verify their claims, and we don&apos;t pretend to.
        </span>
      </p>
    </div>
  )
}
