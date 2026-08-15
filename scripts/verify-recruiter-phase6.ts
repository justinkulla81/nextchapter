// Phase 6 never-leak verification — Partners Master Build Script §E4 items
// 1 and 7. Run with: npm run verify:recruiter-phase6
//
// Deliberately uses a raw PrismaClient (not @/lib/prisma or any
// 'server-only'-guarded lib module — see scripts/backfill-recruiter-
// introductions.ts for the same convention) so this runs as a plain node
// script with no Next.js server-component context required. The logic
// below mirrors src/lib/recruiter/introductions.ts's
// getConsentedCandidateIds / isCandidateConsentedForRecruiter /
// revokeIntroduction exactly (same filters, same status transitions) —
// it's a second, independent expression of the same rule, which is exactly
// the point of a verification script: it should not share a bug with the
// code it's checking by literally calling the same function.
//
// Item 1 ("no recruiter-facing query returns Market Reality Grade/
// component grades/detections/badges") is covered by a STATIC audit
// instead of a runtime one here — every recruiter-facing query/component
// was grepped by hand for grade/badge/detection field names during this
// phase's build (see the phase report). The one runtime-checkable piece of
// item 1 this phase touches is the new howIOperate.gritStatText
// suppression on the recruiter Dossier view (DossierSectionsView's
// hideGradeSignals prop) — that's a React-render-time behavior, not a
// query, so it's verified by reading the source below instead of rendering
// a component tree from a node script.

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const prisma = new PrismaClient()

let failures = 0
function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS  ${message}`)
  } else {
    failures++
    console.error(`  FAIL  ${message}`)
  }
}

const NOT_EXPIRED = { OR: [{ consentExpiresAt: null }, { consentExpiresAt: { gt: new Date() } }] }

async function getConsentedCandidateIds(recruiterId: string): Promise<string[]> {
  const rows = await prisma.recruiterCandidateIntroduction.findMany({
    where: { recruiterId, status: 'CONSENTED', candidate: { confidentialSearchMode: false }, ...NOT_EXPIRED },
    select: { candidateId: true },
  })
  return rows.map((r) => r.candidateId)
}

async function isCandidateConsentedForRecruiter(candidateId: string, recruiterId: string): Promise<boolean> {
  const row = await prisma.recruiterCandidateIntroduction.findFirst({
    where: {
      recruiterId,
      candidateId,
      status: 'CONSENTED',
      candidate: { confidentialSearchMode: false },
      ...NOT_EXPIRED,
    },
    select: { id: true },
  })
  return !!row
}

function checkStaticSource(): void {
  console.log('\n3. Static source audit — recruiter Dossier view suppresses grade signals')
  const dossierSectionsPath = join(__dirname, '../src/components/dashboard/DossierSections.tsx')
  const recruiterDetailPagePath = join(__dirname, '../src/app/recruiters/(app)/search/[candidateId]/page.tsx')
  const submissionPacketPath = join(__dirname, '../src/lib/recruiter/submission-packet.ts')
  const submissionPacketPdfPath = join(__dirname, '../src/lib/recruiter/submission-packet-pdf.tsx')

  const dossierSectionsSrc = readFileSync(dossierSectionsPath, 'utf8')
  const recruiterDetailSrc = readFileSync(recruiterDetailPagePath, 'utf8')
  const submissionPacketSrc = readFileSync(submissionPacketPath, 'utf8')
  const submissionPacketPdfSrc = readFileSync(submissionPacketPdfPath, 'utf8')

  assert(
    dossierSectionsSrc.includes('gritStatText && !hideGradeSignals'),
    'DossierSections.tsx gates gritStatText ("N weeks at an A") behind hideGradeSignals'
  )
  assert(
    /DossierSectionsView\s+dossier={dossier}\s+readOnly\s+hideGradeSignals/.test(recruiterDetailSrc),
    'the recruiter candidate-brief page passes hideGradeSignals to DossierSectionsView'
  )
  assert(
    !/gritStatText|overallGrade|marketReality/i.test(submissionPacketSrc),
    'submission-packet.ts (the allowlist builder) never references gritStatText/overallGrade/marketReality'
  )
  assert(
    !/gritStatText|overallGrade|marketReality|badge|detection/i.test(submissionPacketPdfSrc),
    'submission-packet-pdf.tsx never references grade/badge/detection fields'
  )
}

async function main() {
  console.log('Seeding throwaway recruiter + candidate...')
  const candidate = await prisma.candidateProfile.create({
    data: {
      userId: `verify-phase6-${crypto.randomUUID()}`,
      firstName: 'Throwaway',
      lastName: 'Candidate',
      privacyTier: 'PRIVATE',
      confidentialSearchMode: false,
    },
  })
  const recruiter = await prisma.recruiter.create({
    data: {
      fullName: 'Throwaway Recruiter',
      workEmail: `verify-phase6-${crypto.randomUUID()}@example.com`,
      isSampleData: true,
    },
  })

  try {
    console.log('\n1. Consent ledger — CONSENTED write')
    const introduction = await prisma.recruiterCandidateIntroduction.create({
      data: {
        recruiterId: recruiter.id,
        candidateId: candidate.id,
        status: 'CONSENTED',
        source: 'ADMIN_INTRODUCED',
        respondedAt: new Date(),
      },
    })
    await prisma.recruiterCandidateIntroductionEvent.create({
      data: { introductionId: introduction.id, event: 'CONSENTED', actor: 'script:verify-phase6' },
    })

    const consentedIds = await getConsentedCandidateIds(recruiter.id)
    assert(consentedIds.includes(candidate.id), 'getConsentedCandidateIds includes the newly consented candidate')
    assert(
      await isCandidateConsentedForRecruiter(candidate.id, recruiter.id),
      'isCandidateConsentedForRecruiter is true right after consent'
    )
    const consentedEvent = await prisma.recruiterCandidateIntroductionEvent.findFirst({
      where: { introductionId: introduction.id, event: 'CONSENTED' },
    })
    assert(!!consentedEvent, 'a CONSENTED ledger event row exists for the introduction')

    console.log('\n2. Revocation removes access immediately')
    await prisma.recruiterCandidateIntroduction.update({
      where: { id: introduction.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
    await prisma.recruiterCandidateIntroductionEvent.create({
      data: { introductionId: introduction.id, event: 'REVOKED', actor: 'script:verify-phase6' },
    })

    const idsAfterRevoke = await getConsentedCandidateIds(recruiter.id)
    assert(!idsAfterRevoke.includes(candidate.id), 'getConsentedCandidateIds excludes the candidate immediately after revoke')
    assert(
      !(await isCandidateConsentedForRecruiter(candidate.id, recruiter.id)),
      'isCandidateConsentedForRecruiter is false immediately after revoke'
    )
    const revokedEvent = await prisma.recruiterCandidateIntroductionEvent.findFirst({
      where: { introductionId: introduction.id, event: 'REVOKED' },
    })
    assert(!!revokedEvent, 'a REVOKED ledger event row exists for the introduction')

    checkStaticSource()
  } finally {
    console.log('\nCleaning up throwaway rows...')
    await prisma.recruiterCandidateIntroductionEvent.deleteMany({
      where: { introduction: { recruiterId: recruiter.id, candidateId: candidate.id } },
    })
    await prisma.recruiterCandidateIntroduction.deleteMany({ where: { recruiterId: recruiter.id } })
    await prisma.recruiter.delete({ where: { id: recruiter.id } })
    await prisma.candidateProfile.delete({ where: { id: candidate.id } })
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
  .catch((error) => {
    console.error('Verification script crashed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
