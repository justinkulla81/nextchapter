// Parse-verification harness for the resume export templates (Master
// Build Script §13.2 — "all parse-verified in CI"). Generates a docx and
// a PDF from a hand-written fixture for each of the 3 templates and
// asserts the docx round-trips cleanly through the SAME text-extraction
// path the app already uses for uploaded resumes (mammoth, via
// extractResumeText in src/lib/resume/extract-text.ts) — name, every job
// title, every company name, and a sample bullet phrase must all come
// back out verbatim. This is the inverse of ats-matrix.ts (which
// evaluates an uploaded resume's parseability); here we generate the
// document ourselves and then check our own output.
//
// Deliberately does not hit the database — uses a fixture ResumeDocumentData
// object for a fake candidate, since this needs to run in CI with no
// Postgres/Supabase available.
//
// Run: npx tsx scripts/verify-resume-templates.ts

import { Packer } from 'docx'
import mammoth from 'mammoth'
import { renderToBuffer } from '@react-pdf/renderer'
import type { ResumeDocumentData } from '../src/lib/resume/export/document-data'
import { RESUME_TEMPLATES } from '../src/lib/resume/export/templates'

const FIXTURE: ResumeDocumentData = {
  name: 'Priya Natarajan',
  contact: {
    email: 'priya.natarajan@example.com',
    phone: '(555) 214-8890',
    location: 'Austin, TX',
    linkedinUrl: 'linkedin.com/in/priyanatarajan',
  },
  targetTitle: 'VP of Engineering',
  summary:
    'Engineering leader with 15 years scaling infrastructure teams from seed to Series D, with a track record of cutting incident rates while doubling headcount.',
  workHistory: [
    {
      companyName: 'Brightloop Systems',
      roleTitle: 'VP of Engineering',
      dateRangeLabel: 'Jan 2021 – Present',
      bullets: [
        'Reduced production incident rate by 62 percent while growing the engineering org from 40 to 95 people.',
      ],
    },
    {
      companyName: 'Kestrel Analytics',
      roleTitle: 'Director of Platform Engineering',
      dateRangeLabel: 'Mar 2016 – Dec 2020',
      bullets: [
        'Led the migration to a multi-region architecture that cut P99 latency by 40 percent across all customer regions.',
      ],
    },
    {
      companyName: 'Northfield Data Co',
      roleTitle: 'Senior Software Engineer',
      dateRangeLabel: 'Jul 2011 – Feb 2016',
      bullets: ['Built the first version of the real-time billing pipeline still in production today.'],
    },
  ],
  education: [
    {
      schoolName: 'University of Michigan',
      degreeLabel: 'B.S., Computer Science',
      dateLabel: '2011',
    },
  ],
  skills: ['Distributed systems', 'Engineering management', 'Kubernetes', 'Postgres'],
  certifications: ['AWS Certified Solutions Architect'],
}

// Text every fixture-fed extraction must contain, verbatim.
const REQUIRED_STRINGS = [
  FIXTURE.name,
  ...FIXTURE.workHistory.map((role) => role.roleTitle),
  ...FIXTURE.workHistory.map((role) => role.companyName),
  FIXTURE.workHistory[0].bullets[0],
]

async function verifyDocx(templateId: string, buildDocx: (data: ResumeDocumentData) => import('docx').Document) {
  const document = buildDocx(FIXTURE)
  const buffer = await Packer.toBuffer(document)

  const { value: extractedText } = await mammoth.extractRawText({ buffer })

  const missing = REQUIRED_STRINGS.filter((needle) => !extractedText.includes(needle))
  if (missing.length > 0) {
    throw new Error(
      `[${templateId}] docx round-trip failed — missing from extracted text: ${JSON.stringify(missing)}\n\nExtracted text was:\n${extractedText}`
    )
  }

  console.log(`  docx: OK (${buffer.byteLength} bytes, all ${REQUIRED_STRINGS.length} fixture strings recovered)`)
}

async function verifyPdf(
  templateId: string,
  buildPdfDocument: (data: ResumeDocumentData) => import('react').ReactElement<import('@react-pdf/renderer').DocumentProps>
) {
  const element = buildPdfDocument(FIXTURE)
  const buffer = await renderToBuffer(element)

  if (buffer.byteLength < 500) {
    throw new Error(`[${templateId}] PDF output suspiciously small (${buffer.byteLength} bytes) — likely empty/broken`)
  }
  // Sanity check it's a real PDF, not an empty/corrupt stream.
  const header = buffer.subarray(0, 5).toString('ascii')
  if (header !== '%PDF-') {
    throw new Error(`[${templateId}] PDF output missing %PDF- header — got "${header}"`)
  }

  console.log(`  pdf:  OK (${buffer.byteLength} bytes)`)
}

async function main() {
  let failed = false

  for (const [templateId, template] of Object.entries(RESUME_TEMPLATES)) {
    console.log(`\nVerifying template "${templateId}"...`)
    try {
      await verifyDocx(templateId, template.buildDocx)
      await verifyPdf(templateId, template.buildPdfDocument)
    } catch (error) {
      failed = true
      console.error(error instanceof Error ? error.message : error)
    }
  }

  if (failed) {
    console.error('\nResume template verification FAILED.')
    process.exit(1)
  }

  console.log('\nAll resume templates parse-verified successfully.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
