import type { SubmissionPacketData } from './submission-packet'
import type { EXPORT_DESTINATIONS } from '@/lib/constants/recruiter-export-destinations'

export type AtsDestination = (typeof EXPORT_DESTINATIONS)[number]

// Recruiter portal §A6.2 — "one-click export to Greenhouse/Lever/Bullhorn."
//
// HONEST SCOPE NOTE: this is a structured export FILE shaped to match each
// platform's publicly documented candidate-creation field names, not a live
// API push. A real push needs this recruiter's own ATS API credentials
// (Greenhouse Harvest API key, Lever Postings API key, or a Bullhorn OAuth
// client) scoped to their own account — NextChapter doesn't hold any of
// those, and per this build's "never fabricate missing infrastructure"
// rule, this does not pretend to submit anywhere. The recruiter downloads
// this file and completes the submission in their own ATS UI (most of
// which accept a JSON/CSV import or a copy-paste of these fields into the
// "Add Candidate" form) — same allowlisted source (SubmissionPacketData) as
// the branded PDF packet, so the two never disagree about what's included.
export function buildAtsExportPayload(destination: AtsDestination, data: SubmissionPacketData): Record<string, unknown> {
  const [firstName, ...rest] = data.candidateName.split(' ')
  const lastName = rest.join(' ') || ''

  const meta = {
    _export: {
      source: 'NextChapter for Recruiters',
      destination,
      generatedAt: data.generatedAt.toISOString(),
      note: 'Structured export for manual completion in your own ATS — not a live API push. See src/lib/recruiter/ats-export.ts.',
    },
  }

  switch (destination) {
    // Shaped after the Greenhouse Harvest API's "Add Candidate" request
    // body (POST /v1/candidates): first_name/last_name/company/title at
    // the top level, application-level fields nested under `applications`.
    case 'greenhouse':
      return {
        ...meta,
        first_name: firstName,
        last_name: lastName,
        company: data.firmName ?? undefined,
        title: data.candidateTargetTitle ?? undefined,
        location: data.candidateLocation ?? undefined,
        applications: [
          {
            source: { public_name: 'NextChapter' },
            referrer: { type: 'recruiter', text: `${data.recruiterName} (${data.recruiterEmail})` },
            notes: data.positioningStatement ?? undefined,
          },
        ],
        custom_fields: {
          nextchapter_strengths: data.categoryStrengths.map((s) => `${s.label}: ${s.text}`),
          nextchapter_references_available_for_hm_call: `${data.hiringManagerCallAvailableCount} of ${data.referenceCount}`,
        },
      }

    // Shaped after Lever's Postings API "Create a contact/opportunity"
    // shape: name/headline/location at top level, sources/tags as arrays.
    case 'lever':
      return {
        ...meta,
        name: data.candidateName,
        headline: data.candidateTargetTitle ?? undefined,
        location: data.candidateLocation ?? undefined,
        sources: ['NextChapter'],
        tags: data.categoryStrengths.map((s) => s.label),
        origin: 'sourced',
        summary: data.positioningStatement ?? undefined,
        owner: data.recruiterEmail,
      }

    // Shaped after Bullhorn's REST API Candidate entity: firstName/
    // lastName/occupation/address, with a free-text comments field for
    // narrative content Bullhorn has no dedicated column for.
    case 'bullhorn':
      return {
        ...meta,
        firstName,
        lastName,
        occupation: data.candidateTargetTitle ?? undefined,
        address: data.candidateLocation ? { city: data.candidateLocation } : undefined,
        comments: [
          data.positioningStatement,
          ...data.categoryStrengths.map((s) => `${s.label}: ${s.text}`),
          data.referenceCount > 0
            ? `References available for hiring manager calls: ${data.hiringManagerCallAvailableCount} of ${data.referenceCount}`
            : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
        source: 'NextChapter',
      }
  }
}
