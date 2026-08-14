/**
 * NextChapter — Test Resume Seeder (STEP 2 of 2)
 *
 * Uploads each seed profile's resume to the real Supabase Storage `resumes`
 * bucket, creates a real Resume row, and runs the real scoring engine
 * (computeResumeAnalysis — the Phase 2 engine, NOT the legacy
 * analyzeResume) against it, producing a real ResumeAnalysis row plus real
 * ResumeIssue rows via the Part B capture pipeline
 * (src/lib/analytics/capture-resume-issues.ts). Run AFTER seed_profiles.ts.
 *
 * Rewritten for Phase 2 Part B — the previous version of this file inserted
 * into a `resume_versions` table via raw @supabase/supabase-js with a
 * `user_id` column and a literal "CLAUDE CODE: confirm RESUME_BUCKET and
 * the resume_versions column names" TODO; no such table exists in this
 * schema (the real model is `Resume`, keyed by `candidateId`). This version
 * uploads to the same `resumes` Storage bucket and follows the same
 * `${candidateId}/${uuid}.${ext}` path convention the real upload path uses
 * (see uploadResume in src/app/dashboard/resume/actions.ts), then calls the
 * real Prisma models and the real compute.ts engine directly.
 *
 * COST NOTE: computeResumeAnalysis makes 2 real Anthropic (claude-sonnet-5)
 * calls per resume (extract-facts.ts's structural + qualitative passes).
 * Running this against all 50 profiles is ~100 real API calls. Use
 * --email=<one address> to verify against a single candidate first.
 *
 * `import 'server-only'` sits at the top of compute.ts/extract-facts.ts/
 * modifiers.ts (Next.js's guard against accidentally bundling server code
 * into a client component) — that package throws when required under plain
 * Node, but resolves to a no-op via its package.json's "react-server"
 * export condition. Hence the `--conditions=react-server` flag below; this
 * script is NOT runnable via a plain `tsx` invocation.
 *
 * DEV / STAGING ONLY. Refuses to run against a DATABASE_URL or Supabase URL
 * containing "prod".
 *
 * Usage:
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/seed/seed_resumes.ts
 *   npm run seed:resumes                       (all 50 — real Anthropic cost, see above)
 *   npm run seed:resumes -- --email=justin.kulla+1@gmail.com   (one candidate, for verification)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import profiles from './nextchapter_seed_profiles.json'
import { extractResumeText } from '@/lib/resume/extract-text'
import { computeResumeAnalysis } from '@/lib/scoring/resume-analysis/compute'

const prisma = new PrismaClient()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESUME_DIR = path.join(__dirname, 'resumes')
const RESUME_BUCKET = 'resumes'
const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}
if (SUPABASE_URL.includes('prod') || (process.env.DATABASE_URL ?? '').includes('prod')) {
  console.error('Refusing to run against a URL containing "prod".')
  process.exit(1)
}
if (!fs.existsSync(RESUME_DIR)) {
  console.error(`Missing ${RESUME_DIR} — the 50 seed .docx files should already be checked in there.`)
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const onlyEmailArg = process.argv.find((a) => a.startsWith('--email='))
const ONLY_EMAIL = onlyEmailArg ? onlyEmailArg.slice('--email='.length) : null

interface SeedProfile {
  email: string
  resume_file: string | null
}

async function seedOne(p: SeedProfile, candidateId: string): Promise<void> {
  const localPath = path.join(RESUME_DIR, p.resume_file as string)
  if (!fs.existsSync(localPath)) throw new Error(`missing file ${p.resume_file}`)

  const buffer = fs.readFileSync(localPath)
  const fileName = p.resume_file as string
  const key = `${candidateId}/${crypto.randomUUID()}.docx`

  const { error: uploadError } = await admin.storage
    .from(RESUME_BUCKET)
    .upload(key, buffer, { contentType: DOCX_CONTENT_TYPE, upsert: true })
  if (uploadError) throw new Error(`storage upload failed: ${uploadError.message}`)

  // Same extraction path a real upload goes through (extractResumeText
  // takes a browser File; Node 20+ has a global File constructor).
  const file = new File([buffer], fileName, { type: DOCX_CONTENT_TYPE })
  const { text, error: extractionError } = await extractResumeText(file, 'docx')

  const resume = await prisma.resume.create({
    data: {
      candidateId,
      filePath: key,
      fileName,
      fileType: 'docx',
      extractedText: text,
      extractionError,
    },
  })

  if (!text) {
    console.warn(`  (no extracted text for ${p.email} — skipping computeResumeAnalysis)`)
    return
  }

  // The real Phase 2 engine — NOT the legacy analyzeResume(). This is what
  // produces ResumeAnalysis + ReviewerQuestion + ResumeIssue rows.
  const result = await computeResumeAnalysis(resume.id)
  if (!result) {
    console.warn(`  (computeResumeAnalysis returned null for ${p.email} — see console output above for the self-check failure, if any)`)
    return
  }

  const issueCount = await prisma.resumeIssue.count({ where: { resumeAnalysisId: result.resumeAnalysisId } })
  console.log(
    `  experience ${result.experienceBand} / resume ${result.resumeBand} — ${issueCount} ResumeIssue row(s) captured`
  )

  await prisma.candidateProfile.update({ where: { id: candidateId }, data: { resumeStepComplete: true } })
}

async function main(): Promise<void> {
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const uidByEmail = new Map((userList?.users ?? []).map((u) => [u.email as string, u.id]))

  const candidateProfiles = await prisma.candidateProfile.findMany({
    where: { userId: { in: [...uidByEmail.values()] } },
    select: { id: true, userId: true },
  })
  const candidateIdByUid = new Map(candidateProfiles.map((c) => [c.userId, c.id]))

  let list = profiles as SeedProfile[]
  if (ONLY_EMAIL) list = list.filter((p) => p.email === ONLY_EMAIL)
  if (ONLY_EMAIL && list.length === 0) {
    console.error(`No seed profile matches --email=${ONLY_EMAIL}`)
    process.exit(1)
  }

  let ok = 0
  let skipped = 0
  for (const p of list) {
    const uid = uidByEmail.get(p.email)
    const candidateId = uid ? candidateIdByUid.get(uid) : undefined
    if (!candidateId) {
      console.warn(`- no CandidateProfile for ${p.email} (run seed_profiles.ts first)`)
      skipped++
      continue
    }
    if (!p.resume_file) {
      skipped++
      continue
    }

    console.log(`→ ${p.email}`)
    try {
      await seedOne(p, candidateId)
      ok++
    } catch (error) {
      console.error(`✗ ${p.email}: ${error instanceof Error ? error.message : String(error)}`)
      skipped++
    }
  }

  console.log(`\nProcessed ${ok}, skipped ${skipped}.`)
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
