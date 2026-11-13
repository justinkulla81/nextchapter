import { pageSeo } from '@/lib/seo/keywords'
import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /recruiters: search firms, agencies and in-house recruiters. Facts here follow the code, not the earlier page:
//  - references: the Dossier target is three (src/lib/scoring/dossier-targets.ts); each search row shows how many are on
//    file and how many are open to a hiring-manager call, so the page states no fixed count of its own.
//  - ATS export: src/lib/recruiter/ats-export.ts builds a structured file in each system's field names for Greenhouse,
//    Lever and Bullhorn. It is not a live connection and not one click into the ATS, and the page says so.
// Free for now (owner decision 2026-10-24).
// Rewritten 2026-11-14 around the recruiter pilot (docs/recruiter-pilot-plan.md): the free branded résumé page and CRM lead; candidate search
// and packets follow. Not claimed here until it is on: the Monday digest (TALENT_DIGEST_ENABLED).

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
    ...pageSeo('/recruiters'),
    path: '/recruiters',
    image: { src: search.src, width: search.width, height: search.height, alt: search.alt },
  },
  content: {
    analyticsKey: 'recruiters',
    path: '/recruiters',
    eyebrow: 'Recruiters',
    headline: 'A free résumé page and candidate CRM for your firm, in your logo',
    subhead:
      'Candidates send their résumé to your page. You sort them, track each one, and see where they stand when they choose to share it, so you never have to chase anyone.',
    primary: { label: 'Get access', href: '/recruiters/signup' },
    primaryNote: 'Search firms, agencies and in-house recruiters. The workspace is free for now.',
    loginHref: PORTALS.recruiters.loginHref,
    proof: {
      kind: 'sample',
      heading: 'What a recruiter sees',
      intro: 'These are screens from the recruiter workspace. Hartley Search and the candidates are invented.',
    },
    visuals: [pipeline, search, packet],
    steps: [
      {
        title: 'Put your page on your site',
        body: 'Create your account and add your logo and colors. Your “Submit your resume” page goes live at launchyournextchapter.com/in/ and your firm name once NextChapter has verified your firm, usually within one business day. Link it from your website and your rejection emails, or forward résumés to your firm’s address.',
      },
      {
        title: 'Sort, route and track',
        body: 'Each résumé is read and tagged Fit, In your niche or Outside current focus against your specialties and open searches, then routed to the right recruiter. Give each person a stage, a note and a next-step date; every stage change is logged with a date. A reply drafted in your name goes out after you approve it.',
      },
      {
        title: 'See where they stand',
        body: 'Candidates who open their free NextChapter profile get a search plan. They can share their search status and where they land with your firm, and it shows on their page in your workspace. You do not have to ask.',
      },
    ],
    plansFor: ['recruiters'],
    plansIntro: 'The recruiter workspace is free for now.',
    faq: [
      {
        q: 'What is the résumé intake page?',
        a: 'A “Submit your resume” page in your firm’s logo, colors and font that you link from your own website. You set focus areas for the firm and for each recruiter so new résumés go to the right person, and signed webhooks can send each new résumé to your ATS, CRM or Zapier.',
      },
      {
        q: 'What does the candidate get?',
        a: 'A confirmation that your firm has their résumé, and a link to a free NextChapter profile with a search plan. They choose what to share with your firm.',
      },
      {
        q: 'What can I see about a candidate?',
        a: 'Their résumé and the details read from it. If they choose to share it, their search status (searching, interviewing, landed) and, once they have started, their new employer, title and start date. They can change what they share at any time, and you see nothing they have not shared.',
      },
      {
        q: 'What can I track myself?',
        a: 'A stage (New, Talking, Presented to a client, Placed, Not a fit), a note and a next-step date for each candidate, with a dated log of stage changes. Your firm sees these. The candidate does not.',
      },
      {
        q: 'Does it connect to our ATS?',
        a: 'Signed webhooks can send each new résumé to your ATS, CRM or Zapier. For Greenhouse, Lever and Bullhorn you can also download an export file that uses each system’s own field names, then import it into your own ATS. It is not a live two-way connection.',
      },
      {
        q: 'Can I also search for candidates?',
        a: 'Yes. You can search candidates who chose to be found and ask for an introduction, and each candidate decides on your request. A submission packet in your firm’s logo is built from the candidate’s Dossier, with the references on file.',
      },
    ],
    finalCta: {
      title: 'Get access to the recruiter workspace',
      intro: 'Create an account and put your résumé page on your site. Questions before you start: send us a message.',
      action: { label: 'Get access', href: '/recruiters/signup' },
      form: { audience: 'COACH_RECRUITER', source: 'recruiters', heading: 'Questions before you sign up' },
    },
    jsonLd: {
      serviceName: 'Free résumé page and candidate CRM for recruiters',
      serviceType: 'Recruiting workspace',
      audienceType: 'Recruiters and search firms',
      description:
        'A branded résumé page for your firm, a free candidate CRM with stages, notes and next steps, and candidate status shared by choice.',
      trail: [
        { name: 'For organizations', path: '/for-organizations' },
        { name: 'Recruiters', path: '/recruiters' },
      ],
    },
  },
}
