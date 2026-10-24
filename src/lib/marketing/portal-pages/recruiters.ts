import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /recruiters: search firms, agencies and in-house recruiters. Facts here follow the code, not the earlier page:
//  - references: the Dossier target is three (src/lib/scoring/dossier-targets.ts); each search row shows how many are on
//    file and how many are open to a hiring-manager call, so the page states no fixed count of its own.
//  - ATS export: src/lib/recruiter/ats-export.ts builds a structured file in each system's field names for Greenhouse,
//    Lever and Bullhorn. It is not a live connection and not one click into the ATS, and the page says so.
// Free for now (owner decision 2026-10-24).

const search = shot('recruiter-search', {
  title: 'Candidate search',
  alt: 'A recruiter candidate search with filters, matching candidates, the number of references on file and how many are open to a call, and a button to ask for an introduction.',
  why: 'Each row shows how much evidence is on file, so you can pick who to ask for an introduction, and each candidate decides.',
})
const packet = shot('recruiter-submission-packet', {
  title: 'Submission packet and export',
  alt: 'A submission packet in a firm’s logo with positioning, strengths and what references said, beside export file buttons and a list of what is never in the packet.',
  why: 'The packet is built from a fixed list of fields taken from the candidate’s Dossier, so nothing else can reach it, and the export file uses each system’s own field names.',
})
const pipeline = shot('recruiter-pipeline', {
  title: 'Feedback and placement',
  alt: 'A list of submissions moving through reviewed, screened, submitted, interviewed and placed, with a pass reason and the days since the last update.',
  why: 'Every change is logged with a date, and the days since the last change show which candidates are going quiet.',
})

export const RECRUITERS: PortalPageDef = {
  seo: {
    title: 'Candidate search and submission packets for recruiters',
    description:
      'Search candidates who chose to be found, ask for an introduction, and submit a packet in your firm’s logo built from the candidate’s Dossier. The recruiter workspace is free for now.',
    path: '/recruiters',
    image: { src: search.src, width: search.width, height: search.height, alt: search.alt },
  },
  content: {
    analyticsKey: 'recruiters',
    path: '/recruiters',
    eyebrow: 'Recruiters',
    headline: 'Search candidates who chose to be found, and submit them in your logo',
    subhead:
      'Ask for an introduction and each candidate decides. A submission packet in your firm’s logo is built from the candidate’s Dossier, with the references already on file.',
    primary: { label: 'Get access', href: '/recruiters/signup' },
    primaryNote: 'Search firms, agencies and in-house recruiters. The workspace is free for now.',
    loginHref: PORTALS.recruiters.loginHref,
    proof: {
      kind: 'sample',
      heading: 'What a recruiter sees',
      intro: 'This is candidate search as a recruiter opens it. Hartley Search and the candidates are invented.',
    },
    visuals: [search, packet, pipeline],
    steps: [
      {
        title: 'Get access',
        body: 'Create your recruiter account and add your firm’s logo and colors, which go on the packets and on your résumé intake page.',
      },
      {
        title: 'Search and ask for an introduction',
        body: 'Filter by function, level, remote preference and location. You see candidates who chose to be found, and each candidate decides on your request.',
      },
      {
        title: 'Submit and track',
        body: 'Download the packet as a PDF in your logo, or an export file for your own ATS. Move each candidate through the stages or pass with a reason.',
      },
    ],
    plansFor: ['recruiters'],
    plansIntro: 'The recruiter workspace is free for now.',
    faq: [
      {
        q: 'Which candidates can I see?',
        a: 'Candidates who chose to be found. You ask for an introduction and each candidate decides. A packet is built for a candidate who agreed to be introduced to you.',
      },
      {
        q: 'What is in a submission packet?',
        a: 'Positioning, strengths, what references said, and how many references are on file and open to a hiring-manager call, built from the candidate’s Dossier in your firm’s logo. It is built from a fixed list of fields, and it never includes the Market Reality Assessment or grades, detections or badges, application history, or any other candidate.',
      },
      {
        q: 'How do references show in search?',
        a: 'Each row shows how many references are on file and how many of them are open to a hiring-manager call.',
      },
      {
        q: 'Does it connect to our ATS?',
        a: 'Not as a live connection. For Greenhouse, Lever and Bullhorn you download an export file that uses each system’s own field names, then import it or paste it into your own ATS. Which of the three appear is set for each firm.',
      },
      {
        q: 'What is the résumé intake page?',
        a: 'A “Submit your resume” page in your firm’s logo, colors and font that you link from your own website. You set focus areas for the firm and for each recruiter so new résumés go to the right person, and signed webhooks can send each new résumé to your ATS, CRM or Zapier.',
      },
      {
        q: 'What stages can I track?',
        a: 'Reviewed, screened, submitted, interviewed and placed, or passed with a reason. Every change is logged with a date.',
      },
    ],
    finalCta: {
      title: 'Get access to the recruiter workspace',
      intro: 'Create an account and start a search. Questions before you start: send us a message.',
      action: { label: 'Get access', href: '/recruiters/signup' },
      form: { audience: 'COACH_RECRUITER', source: 'recruiters', heading: 'Questions before you sign up' },
    },
    jsonLd: {
      serviceName: 'Candidate search and submission packets for recruiters',
      serviceType: 'Recruiting workspace',
      audienceType: 'Recruiters and search firms',
      description:
        'Search candidates who chose to be found, ask for an introduction, and submit a packet in your firm’s logo built from the candidate’s Dossier.',
      trail: [
        { name: 'For organizations', path: '/for-organizations' },
        { name: 'Recruiters', path: '/recruiters' },
      ],
    },
  },
}
