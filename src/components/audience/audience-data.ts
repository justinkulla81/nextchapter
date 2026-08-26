export interface WaitlistField {
  name: string
  label: string
  type: 'text' | 'email' | 'select' | 'textarea'
  required: boolean
  options?: string[]
}

export interface AudiencePoint {
  lead: string
  body: string
}

export interface AudienceTab {
  id: string
  audience: string
  eyebrow: string
  headline: string
  subhead: string
  // Optional: a pain-point/credibility block rendered above `points` — used
  // for hiring audiences (cost of a bad hire, broken ATS screening) and for
  // academic/nonprofit audiences (the research case for our dataset).
  insightSection?: { heading: string; items: AudiencePoint[] }
  points: AudiencePoint[]
  // Optional: when a real signup flow exists (currently just Hiring Manager
  // P0), render a direct-signup CTA above the waitlist form instead of
  // making everyone wait on the waitlist for access that already works.
  directSignupHref?: string
  directSignupLabel?: string
  // Optional explicit login destination for audiences with a real portal
  // but no self-serve signup (e.g. outplacement, which is sales-led) —
  // without this, the header's "Log in" link only appears when
  // directSignupHref is set, which silently hides it for anyone who
  // already has an account.
  loginHref?: string
  contrastLabel: string
  contrastBody: string
  formHeading: string
  formSubtext: string
  fields: WaitlistField[]
  successMessage: string
}

export const AUDIENCE_TABS: AudienceTab[] = [
  {
    // Renamed from 'employers' — that label already belongs to the
    // outplacement pitch at /employers (a different product: helping a
    // company's departing employees relaunch, not helping a company hire).
    // This tab is the Talent portal (post a role, hire NextChapter
    // candidates directly) — see /hire/page.tsx.
    id: 'talent',
    audience: 'Talent',
    eyebrow: 'For Hiring Teams',
    headline: 'Hire for how people actually work — verified, not self-declared.',
    subhead:
      'Every candidate on NextChapter completes a structured How They Work Best assessment and gathers verified references before you ever see their profile — so you\'re evaluating demonstrated fit and work ethic, not a résumé\'s best guess at itself.',
    insightSection: {
      heading: 'What a bad hire actually costs you',
      items: [
        {
          lead: 'A bad hire costs far more than the salary.',
          body: 'The U.S. Department of Labor estimates the price of a bad hiring decision at roughly 30% of that employee\'s first-year earnings once you count ramp time, lost productivity, and backfilling the role.',
        },
        {
          lead: 'Your own ATS is filtering out your best candidates.',
          body: 'Harvard Business School\'s "Hidden Workers" research found the large majority of employers unknowingly screen out qualified people through automated keyword matching — not because they lack the skills, but because the system never saw the signal.',
        },
        {
          lead: 'Résumés are a marketing document, not a verification.',
          body: 'Hiring managers routinely catch embellishment on resumes and in interviews. A polished bullet list tells you what someone wants you to believe — it was never designed to tell you how they actually work.',
        },
        {
          lead: 'Motivation and work ethic are the signal ATS systems can\'t see.',
          body: 'The candidates most likely to succeed and stay are the ones who are genuinely motivated, coachable, and verified by people who\'ve actually worked with them — exactly what our references and How They Work Best data surface, and what a keyword filter never will.',
        },
      ],
    },
    points: [
      {
        lead: 'See the person, the way an executive recruiter would.',
        body: "Our 9-dimension How They Work Best assessment, cross-checked against verified references, shows how someone collaborates, decides, and handles ambiguity — the fit signal a résumé can't give you.",
      },
      {
        lead: 'One flat price, no per-hire tax.',
        body: "A predictable monthly subscription. Hire one person or ten — you're never penalized for succeeding.",
      },
      {
        lead: 'Engaged candidates who want to work.',
        body: 'People come here for honest feedback and a real plan, not to spray applications. You reach candidates who show up motivated and ready to talk.',
      },
    ],
    directSignupHref: '/talent/signup',
    directSignupLabel: 'Post a role free — no waitlist',
    contrastLabel: 'What you see vs. what you don\'t:',
    contrastBody:
      "you get verified references, demonstrated work ethic, real work samples, and a How They Work Best profile — the same caliber of signal an executive recruiter would hand you. You never see a candidate's private Grade, their goals, or their compensation expectations. That's theirs, not a filter for you to game.",
    formHeading: 'Questions before you sign up?',
    formSubtext: "Tell us about your team and we'll follow up.",
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'workEmail', label: 'Work email', type: 'email', required: true },
      { name: 'company', label: 'Company', type: 'text', required: true },
      {
        name: 'companySize',
        label: 'Company size',
        type: 'select',
        required: true,
        options: ['1–10', '11–50', '51–200', '201–1,000', '1,000+'],
      },
      { name: 'rolesHiring', label: "Roles you're hiring for", type: 'text', required: false },
    ],
    successMessage: "Thanks — we'll follow up. Or use the link above to post a role right now.",
  },
  {
    id: 'recruiters',
    audience: 'Recruiter',
    eyebrow: 'For Recruiters',
    headline: 'Candidates who arrive with their references already done.',
    subhead:
      'Every NextChapter candidate comes with five structured references, two validated assessments, and a Dossier you can put in front of a client under your own brand.',
    directSignupHref: '/recruiters/signup',
    directSignupLabel: 'Get access — no waitlist',
    insightSection: {
      heading: 'The compression claim, which is safe to make',
      items: [
        {
          lead: 'References normally get collected at offer stage.',
          body: 'Ours are done before you ever meet the candidate — three structured references, scored consistently, sitting in the Dossier from day one.',
        },
        {
          lead: 'Some are already willing to take a hiring-manager call.',
          body: 'At reference completion we ask directly. Surfaced in the Dossier as "3 of 3 references available for hiring manager calls" — a real timeline advantage, not a promise.',
        },
        {
          lead: 'Consented candidates only.',
          body: 'Never a scraped or browsable database — you see candidates who opted in and are Dossier-complete candidates are ranked higher and visually badged.',
        },
      ],
    },
    points: [
      {
        lead: 'A branded submission packet, generated from the Dossier.',
        body: 'Under your own logo, ready to put in front of a client — not a screenshot you have to reformat.',
      },
      {
        lead: 'One-click export.',
        body: 'Into Greenhouse, Lever, or Bullhorn — the Dossier and designated resume version travel with the candidate.',
      },
      {
        lead: 'A real feedback loop.',
        body: 'Reviewed, screened, submitted, interviewed, placed, or passed with reason — logged, not lost in an inbox.',
      },
    ],
    contrastLabel: 'What you never see:',
    contrastBody:
      "the Market Reality Grade, component grades, detections, badges, application history, or any other candidate — recruiter access is per-introduction, consented, and revocable.",
    formHeading: 'Questions before you request access?',
    formSubtext: "Tell us about your firm and we'll follow up.",
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'workEmail', label: 'Work email', type: 'email', required: true },
      { name: 'firm', label: 'Firm', type: 'text', required: true },
      {
        name: 'searchType',
        label: 'Retained, contingent, or in-house',
        type: 'select',
        required: false,
        options: ['Retained', 'Contingent', 'In-house', 'Mixed'],
      },
      { name: 'atsInUse', label: 'ATS in use', type: 'text', required: false },
      { name: 'referredBy', label: 'Who referred you? (optional)', type: 'text', required: false },
    ],
    successMessage: "Thanks — we'll follow up. Or use the link above to request access right now.",
  },
  {
    id: 'outplacement',
    audience: 'Outplacement',
    eyebrow: 'For Outplacement & HR',
    loginHref: '/employer/login',
    headline: 'Offboarding that actually relaunches careers — not a login to a stale course library.',
    subhead:
      'Give departing employees a personalized action plan, an honest assessment of where they stand, and direct matching to hiring employers. Protect your brand by treating people like people on the way out.',
    insightSection: {
      heading: 'Why traditional outplacement underdelivers',
      items: [
        {
          lead: 'A portal license isn\'t a relaunch.',
          body: 'Legacy outplacement gives people a login and a video library. Engagement — and outcomes — collapse within weeks. Your leadership and board notice.',
        },
        {
          lead: 'How you exit people is retention insurance.',
          body: 'The employees who remain are watching how you treat the ones who leave. A dignified, effective transition protects the employer brand that keeps your best people from job-hunting themselves.',
        },
        {
          lead: 'A bad rehire elsewhere still reflects on your process.',
          body: 'The U.S. Department of Labor estimates a bad hire costs roughly 30% of first-year earnings — the same dynamic that makes a real, verified relaunch (not a passive resource library) worth measuring.',
        },
      ],
    },
    points: [
      {
        lead: 'A relaunch, not a PDF.',
        body: 'Each person gets a concrete plan and gets matched to real openings — measurable momentum in days, not a self-serve portal they never open.',
      },
      {
        lead: 'Protect your employer brand.',
        body: 'How you treat people leaving is what stays online. A dignified, effective transition is retention insurance for the team that remains.',
      },
      {
        lead: 'Outcomes you can report.',
        body: 'Track engagement, progress, and placements — the data your leadership and board want, not vague "coaching hours delivered."',
      },
    ],
    contrastLabel: 'vs. legacy outplacement (LHH, RiseSmart, Careerminds):',
    contrastBody:
      "candidate-first by design, faster to real interviews, and priced to scale to your whole affected workforce — not just executives.",
    formHeading: 'Talk to us about outplacement',
    formSubtext: 'Join the waitlist for employer transition packages and pilot programs.',
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'workEmail', label: 'Work email', type: 'email', required: true },
      { name: 'organization', label: 'Organization', type: 'text', required: true },
      {
        name: 'employeesAffected',
        label: 'Approx. employees affected',
        type: 'select',
        required: false,
        options: ['Under 25', '25–100', '100–500', '500+', 'Not sure yet'],
      },
    ],
    successMessage: "Thanks — you're on the list. We'll be in touch about transition packages and pilots.",
  },
  {
    id: 'government',
    audience: 'Government & Workforce',
    eyebrow: 'For Government & Workforce Agencies',
    headline: 'Give the people you serve a faster, more human path back to work.',
    subhead:
      'NextChapter is built for exactly the members your programs support — unemployment claimants, dislocated workers, career changers, and non-traditional backgrounds. Every jobseeker gets it free, with a personalized plan and real employer matches — and you get the placement data your programs report on.',
    points: [
      {
        lead: 'Real help for your members.',
        body: 'Every participant gets a free Current Market Reality, a personalized action plan, and direct matches to hiring employers — practical next steps, not a portal they log into once and abandon.',
      },
      {
        lead: 'Built for the people programs usually leave behind.',
        body: 'Gaps, layoffs, and career pivots are context here, not disqualifiers — so your hardest-to-place members get surfaced to employers instead of filtered out.',
      },
      {
        lead: 'Outcomes you can report.',
        // [OWNER TO CONFIRM: which specific WIOA performance metrics we map to.]
        body: 'Track readiness, engagement, and placements — the entered-employment and retention data your performance measures depend on.',
      },
    ],
    contrastLabel: 'vs. legacy case-management & job banks:',
    // [OWNER TO CONFIRM: procurement, data-security, and eligibility requirements.]
    contrastBody:
      'a modern, member-first experience with built-in assessment and real employer demand — and free to every jobseeker, aligned with your public mission.',
    formHeading: 'Partner with us',
    formSubtext: 'Join the waitlist for agency pilots and workforce partnerships.',
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'workEmail', label: 'Work email', type: 'email', required: true },
      { name: 'agencyOrOrganization', label: 'Agency or organization', type: 'text', required: true },
      { name: 'stateRegion', label: 'State / region', type: 'text', required: true },
      { name: 'program', label: 'Program (e.g. WIOA, Wagner-Peyser)', type: 'text', required: false },
    ],
    successMessage: 'Thank you. Our partnerships team will follow up about pilots in your region.',
  },
  {
    id: 'nonprofits',
    audience: 'Nonprofit & Academia',
    eyebrow: 'For Nonprofits & Academia',
    headline: 'Partner on the mission — and help fund the research behind fairer hiring.',
    subhead:
      'Whether you serve jobseekers, fund workforce solutions, or research the labor market, NextChapter offers a candidate-first platform and a consented, structured dataset connecting self-reported How They Work Best data, reference-verified behavior, and real placement outcomes.',
    insightSection: {
      heading: 'A research asset worth funding',
      items: [
        {
          lead: 'The rigor of an AI safety lab, applied to hiring.',
          body: 'Just as leading AI labs invest heavily in understanding their own models before deploying them, we believe understanding what actually predicts a successful job placement deserves the same rigor — not another resume-parsing dataset.',
        },
        {
          lead: 'The kind of question Harvard and MIT are already asking.',
          body: 'Institutions studying how AI is reshaping the labor market — who gets seen, who gets filtered out, who gets hired — are exactly the audience this dataset is built for: consented, structured, and connected to verified outcomes, not just resumes.',
        },
        {
          lead: 'A dataset that doesn\'t exist elsewhere.',
          body: 'Most hiring data stops at the resume or the interview. Ours connects a candidate\'s self-reported How They Work Best answers, what their references independently verified, and what actually happened next — a foundation for research on hiring equity, ATS bias, and what really predicts success.',
        },
      ],
    },
    points: [
      {
        lead: 'Serve your constituents at no cost to them.',
        body: 'Bring your community an honest assessment of where they stand, a personalized action plan, and real employer matches — extending your programs without adding fees.',
      },
      {
        lead: 'A research asset, ethically sourced.',
        // [OWNER TO CONFIRM: data-access terms, defined per partnership and IRB.]
        body: 'Consent-based, structured data on How They Work Best dimensions and outcomes — a foundation for studies on hiring equity, gaps, and mobility.',
      },
      {
        lead: 'Grants, pilots, and co-design.',
        body: 'We collaborate on funding proposals, pilot programs, and joint research that advance shared goals for fairer hiring.',
      },
    ],
    contrastLabel: 'Why partner with us:',
    contrastBody:
      "most platforms treat candidates as inventory. We're candidate-first and consent-first — which makes us a credible partner for mission-driven work and rigorous research alike.",
    formHeading: 'Start a conversation',
    formSubtext: 'Join the waitlist for partnerships, funding, and research collaboration.',
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'organizationOrInstitution', label: 'Organization or institution', type: 'text', required: true },
      {
        name: 'interestedIn',
        label: "I'm interested in",
        type: 'select',
        required: true,
        options: [
          'Partnership / serving our community',
          'Funding & grants',
          'Research & data access',
          'Something else',
        ],
      },
      {
        name: 'whatInMind',
        label: 'A line about what you have in mind',
        type: 'textarea',
        required: false,
      },
    ],
    successMessage: "Thank you. We'll reach out to explore how we can work together.",
  },
  {
    id: 'coaches',
    audience: 'Coach',
    eyebrow: 'For Coaches',
    headline: 'Stop rebuilding context before every session.',
    subhead:
      "Every client's search, scored and current — targeting, motivation, networking, applications, skills, narrative, interview practice — with a generated brief waiting before you dial in.",
    points: [
      {
        lead: 'Clients arrive pre-diagnosed.',
        body: 'You spend the hour coaching, not intake — a roster sorted by who actually needs you, not alphabetically.',
      },
      {
        lead: 'A pre-session brief, generated from real activity.',
        body: 'Not a form your client filled out — an actual read on where they stand before you say hello.',
      },
      {
        lead: 'Action items land in the client\'s plan, not an email that dies.',
        body: 'Set an action in session and it shows up on their Search Action Plan, tracked.',
      },
      {
        lead: 'Your own outcome data — nobody has ever given you this.',
        body: 'A performance dashboard for your own coaching, not just your client\'s progress.',
      },
    ],
    directSignupHref: '/support/coach/signup',
    directSignupLabel: 'Set up your account — free',
    contrastLabel: 'What this is, and what it isn\'t:',
    contrastBody:
      "a real coaching workspace with structured session notes across seven tracked dimensions, not a replacement for the relationship — you're still the coach, this just means you stop rebuilding context from zero every time.",
    formHeading: 'Questions before you sign up?',
    formSubtext: "Tell us a bit about your practice and we'll follow up.",
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'workEmail', label: 'Work email', type: 'email', required: true },
      { name: 'practiceName', label: 'Practice or firm name', type: 'text', required: false },
      { name: 'coachingFocus', label: 'What kind of coaching do you do?', type: 'text', required: false },
      { name: 'referredBy', label: 'Who referred you? (optional)', type: 'text', required: false },
    ],
    successMessage: "Thanks — we'll follow up. Or just use the link above to get started right now.",
  },
  {
    id: 'hiring',
    audience: 'Hiring Manager',
    eyebrow: 'For Hiring Managers',
    headline: 'Interview better, not longer.',
    subhead:
      'Every candidate arrives with evidence already gathered — so your panel can probe what nobody has answered yet.',
    points: [
      {
        lead: 'A generated interview guide, built from what the Dossier doesn\'t cover.',
        body: 'Not generic questions — the specific gaps nobody has answered yet for this candidate.',
      },
      {
        lead: 'Panel coordination.',
        body: 'Each interviewer gets a different competency assigned, so four people don\'t ask the same question.',
      },
      {
        lead: 'Structured scorecards, comparable across interviewers.',
        body: 'Tied to the same five competencies the Dossier scores — an actual comparison, not four unrelated impressions.',
      },
      {
        lead: 'Reference questions worth asking, given what\'s already known.',
        body: 'Skip the ones the Dossier already answered — go straight to what matters.',
      },
    ],
    directSignupHref: '/hiring/signup',
    directSignupLabel: 'Request access — no waitlist',
    contrastLabel: 'The conflict rule:',
    contrastBody:
      "you can't see candidates for your own reqs when a conflict is flagged — same current employer, a declared relationship, or the same household.",
    formHeading: 'Questions before you sign up?',
    formSubtext: "Tell us about your team and we'll follow up.",
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'workEmail', label: 'Work email', type: 'email', required: true },
      { name: 'companyName', label: 'Company', type: 'text', required: true },
      { name: 'referredBy', label: 'Who referred you? (optional)', type: 'text', required: false },
    ],
    successMessage: "Thanks — we'll follow up. Or use the link above to request access right now.",
  },
]
