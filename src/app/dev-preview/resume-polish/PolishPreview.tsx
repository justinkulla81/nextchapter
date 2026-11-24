'use client'

import { useState } from 'react'
import { PolishPanel } from '@/components/dashboard/resume-studio/PolishPanel'
import { BulletStrengthener } from '@/components/dashboard/resume-studio/BulletStrengthener'
import { summarizeDocument } from '@/lib/resume/studio/writing-checks'
import type { ResumeDocumentData } from '@/lib/resume/export/document-data'
import type { CheckWritingResult } from '@/app/dashboard/resume/studio/polish-actions'

const START: ResumeDocumentData = {
  name: 'Jordan Avery',
  contact: { email: 'jordan.avery@example.com', phone: null, location: 'Springfield, NY', linkedinUrl: null },
  targetTitle: null,
  summary: null,
  workHistory: [
    {
      companyName: 'Northbridge Capital',
      roleTitle: 'Partner',
      dateRangeLabel: '2023 - present',
      location: 'New York,NY',
      bullets: ['Responsible for the sales pipeline across the portfolio.', 'Recieved the firm award for leading the diligence program.'],
    },
    { companyName: 'Hearst Corporation', roleTitle: 'Associate', dateRangeLabel: '2009', location: 'New York, NY', bullets: ['Worked on the deal team for the Series A investment.'] },
  ],
  education: [],
  skills: [],
  certifications: [],
}

// Sample data and stand-in actions: nothing here calls a model or the database.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function PolishPreview() {
  const [doc, setDoc] = useState(START)
  const run = async (): Promise<CheckWritingResult> => {
    await wait(600)
    return {
      ok: true,
      checked: 9,
      modelRan: true,
      fixes: [
        { id: 'role:0:location', label: 'Location, Partner at Northbridge Capital', original: 'New York,NY', replacement: 'New York, NY', kind: 'spacing', reason: 'Add a space after the comma.', source: 'rule' },
        {
          id: 'role:0:bullet:1',
          label: 'Bullet 2, Partner at Northbridge Capital',
          original: 'Recieved the firm award for leading the diligence program.',
          replacement: 'Received the firm award for leading the diligence program.',
          kind: 'spelling',
          reason: '“Recieved” is spelled “received”.',
          source: 'model',
        },
      ],
    }
  }
  const actions = {
    getEvidenceQuestions: async () => {
      await wait(500)
      return {
        ok: true as const,
        questions: [
          { question: 'How many deals or companies did this cover?', why: 'Scale shows how much responsibility you carried.' },
          { question: 'What changed because of your work: revenue, time saved, win rate?', why: 'A result is what a reader remembers.' },
        ],
      }
    },
    draftStrongerBullet: async () => {
      await wait(700)
      return { ok: true as const, bullet: 'Managed the sales pipeline across 14 portfolio companies and raised win rate from 18% to 27% in 2023.', changed: 'Added scale and result from your answers; opened with an action verb.' }
    },
  }
  const role = doc.workHistory[0]
  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Experience (preview)</h1>
        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">{`${role.roleTitle} at ${role.companyName}`}</p>
          <p className="text-xs text-muted-foreground">{`${role.location} · ${role.dateRangeLabel}`}</p>
          {role.bullets.map((b, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm text-foreground">{`• ${b}`}</p>
              {i === 0 && (
                <BulletStrengthener
                  draftId="preview"
                  role={role}
                  bullet={b}
                  otherBullets={role.bullets.filter((_, j) => j !== i)}
                  actions={actions}
                  onUse={(text) => setDoc((d) => ({ ...d, workHistory: d.workHistory.map((w, k) => (k === 0 ? { ...w, bullets: w.bullets.map((x, j) => (j === 0 ? text : x)) } : w)) }))}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <PolishPanel draftId="preview" doc={doc} summary={summarizeDocument(doc)} onApply={setDoc} run={run} />
    </div>
  )
}
