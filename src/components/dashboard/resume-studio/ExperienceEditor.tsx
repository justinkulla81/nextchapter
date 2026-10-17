'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { ResumeDocumentData, ResumeWorkHistoryItem } from '@/lib/resume/export/document-data'
import { checkBullet } from '@/lib/resume/studio/writing-checks'
import { Field, ReorderControls, moveItem, removeAt, replaceAt } from '@/components/dashboard/resume-studio/EditorParts'

type Roles = ResumeDocumentData['workHistory']

export function ExperienceEditor({ roles, onChange }: { roles: Roles; onChange: (roles: Roles) => void }) {
  const setRole = (i: number, role: ResumeWorkHistoryItem) => onChange(replaceAt(roles, i, role))

  return (
    <section className="space-y-3" aria-labelledby="studio-experience">
      <h2 id="studio-experience" className="text-lg font-semibold tracking-tight">
        Experience
      </h2>
      {roles.length === 0 && <p className="text-sm text-muted-foreground">No roles yet. Add your most recent role first.</p>}

      {roles.map((role, i) => (
        <Card key={i}>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Role {i + 1}</p>
              <ReorderControls noun="role" index={i} count={roles.length} onMove={(d) => onChange(moveItem(roles, i, d))} onRemove={() => onChange(removeAt(roles, i))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Job title" value={role.roleTitle} onChange={(v) => setRole(i, { ...role, roleTitle: v })} maxLength={150} />
              <Field label="Company" value={role.companyName} onChange={(v) => setRole(i, { ...role, companyName: v })} maxLength={150} />
            </div>
            <Field label="Dates" value={role.dateRangeLabel} onChange={(v) => setRole(i, { ...role, dateRangeLabel: v })} placeholder="Jan 2020 – Present" maxLength={60} />

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Bullets</p>
              {role.bullets.length === 0 && <p className="text-xs text-muted-foreground">Add a few lines on what you did and what came of it.</p>}
              {role.bullets.map((bullet, b) => {
                const notes = checkBullet(bullet)
                return (
                  <div key={b} className="space-y-1">
                    <div className="flex items-start gap-2">
                      <Label className="flex-1">
                        <span className="sr-only">{`Bullet ${b + 1} for role ${i + 1}`}</span>
                        <Textarea
                          value={bullet}
                          rows={2}
                          maxLength={400}
                          onChange={(e) => setRole(i, { ...role, bullets: replaceAt(role.bullets, b, e.target.value) })}
                        />
                      </Label>
                      <ReorderControls
                        noun="bullet"
                        index={b}
                        count={role.bullets.length}
                        onMove={(d) => setRole(i, { ...role, bullets: moveItem(role.bullets, b, d) })}
                        onRemove={() => setRole(i, { ...role, bullets: removeAt(role.bullets, b) })}
                      />
                    </div>
                    {notes.length > 0 && (
                      <ul className="space-y-0.5 pl-1 text-xs text-muted-foreground" aria-label={`Suggestions for bullet ${b + 1}`}>
                        {notes.map((n) => (
                          <li key={n.code}>{n.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
              <Button type="button" size="sm" variant="outline" disabled={role.bullets.length >= 12} onClick={() => setRole(i, { ...role, bullets: [...role.bullets, ''] })}>
                Add a bullet
              </Button>
              {role.bullets.length >= 12 && <p className="text-xs text-muted-foreground">That is the most bullets a role can have. Remove or combine some to add more.</p>}
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        disabled={roles.length >= 25}
        onClick={() => onChange([...roles, { companyName: '', roleTitle: '', dateRangeLabel: '', bullets: [''] }])}
      >
        Add a role
      </Button>
      {roles.length >= 25 && <p className="text-xs text-muted-foreground">That is the most roles a resume can hold here. Remove one to add another.</p>}
    </section>
  )
}
