'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { ResumeCustomItem, ResumeCustomSection } from '@/lib/resume/export/document-data'
import { Field, ReorderControls, moveItem, removeAt, replaceAt } from '@/components/dashboard/resume-studio/EditorParts'

// Any section beyond the standard ones: Extracurricular, Board service, Publications, Awards. An uploaded resume
// brings its own, and each keeps the heading, order and wording it had.
export function SectionsEditor({ sections, onChange }: { sections: ResumeCustomSection[]; onChange: (sections: ResumeCustomSection[]) => void }) {
  const setSection = (i: number, s: ResumeCustomSection) => onChange(replaceAt(sections, i, s))
  const blankItem = (): ResumeCustomItem => ({ title: '', subtitle: null, dateLabel: null, bullets: [] })

  return (
    <section className="space-y-3" aria-labelledby="studio-sections">
      <h2 id="studio-sections" className="text-lg font-semibold tracking-tight">
        Other sections
      </h2>
      {sections.length === 0 && <p className="text-sm text-muted-foreground">Board seats, teaching, publications, awards, volunteering. Add a section for anything that does not fit above.</p>}
      {sections.map((section, i) => (
        <Card key={i}>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <Field label="Section heading" value={section.heading} onChange={(v) => setSection(i, { ...section, heading: v })} placeholder="Extracurricular" maxLength={60} />
              </div>
              <ReorderControls noun="section" index={i} count={sections.length} onMove={(d) => onChange(moveItem(sections, i, d))} onRemove={() => onChange(removeAt(sections, i))} />
            </div>
            {section.items.map((item, j) => {
              const setItem = (it: ResumeCustomItem) => setSection(i, { ...section, items: replaceAt(section.items, j, it) })
              return (
                <div key={j} className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{`Item ${j + 1}`}</p>
                    <ReorderControls noun="item" index={j} count={section.items.length} onMove={(d) => setSection(i, { ...section, items: moveItem(section.items, j, d) })} onRemove={() => setSection(i, { ...section, items: removeAt(section.items, j) })} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Title" value={item.title} onChange={(v) => setItem({ ...item, title: v })} maxLength={200} />
                    <Field label="Role or detail" value={item.subtitle ?? ''} onChange={(v) => setItem({ ...item, subtitle: v || null })} maxLength={200} />
                    <Field label="Dates" value={item.dateLabel ?? ''} onChange={(v) => setItem({ ...item, dateLabel: v || null })} maxLength={60} />
                  </div>
                  {item.bullets.map((bullet, b) => (
                    <div key={b} className="flex items-start gap-2">
                      <Label className="flex-1">
                        <span className="sr-only">{`Bullet ${b + 1} for item ${j + 1}`}</span>
                        <Textarea value={bullet} rows={2} maxLength={900} onChange={(e) => setItem({ ...item, bullets: replaceAt(item.bullets, b, e.target.value) })} />
                      </Label>
                      <ReorderControls noun="bullet" index={b} count={item.bullets.length} onMove={(d) => setItem({ ...item, bullets: moveItem(item.bullets, b, d) })} onRemove={() => setItem({ ...item, bullets: removeAt(item.bullets, b) })} />
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" disabled={item.bullets.length >= 15} onClick={() => setItem({ ...item, bullets: [...item.bullets, ''] })}>
                    Add a bullet
                  </Button>
                </div>
              )
            })}
            <Button type="button" size="sm" variant="outline" disabled={section.items.length >= 12} onClick={() => setSection(i, { ...section, items: [...section.items, blankItem()] })}>
              Add an item
            </Button>
          </CardContent>
        </Card>
      ))}
      <Button type="button" variant="outline" disabled={sections.length >= 6} onClick={() => onChange([...sections, { heading: '', items: [{ title: '', subtitle: null, dateLabel: null, bullets: [] }] }])}>
        Add a section
      </Button>
      {sections.length >= 6 && <p className="text-xs text-muted-foreground">That is the most extra sections a resume can hold here. Remove one to add another.</p>}
    </section>
  )
}
