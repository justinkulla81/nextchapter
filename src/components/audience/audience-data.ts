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
  contrastLabel: string
  contrastBody: string
  formHeading: string
  formSubtext: string
  fields: WaitlistField[]
  successMessage: string
}

export const AUDIENCE_TABS: AudienceTab[] = [
  {
    id: 'employers',
    audience: 'Employer',
    eyebrow: 'For Employers',
    headline: 'Hire for how people actually work — verified, not self-declared.',
    subhead:
      'Every candidate on NextChapter completes a structured work-style assessment and gathers verified references before you ever see their profile — so you\'re evaluating demonstrated fit and work ethic, not a résumé\'s best guess at itself.',
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
          body: 'The candidates most likely to succeed and stay are the ones who are genuinely motivated, coachable, and verified by people who\'ve actually worked with them — exactly what our references and work-style data surface, and what a keyword filter never will.',
        },
      ],
    },
    points: [
      {
        lead: 'See the person, the way an executive recruiter would.',
        body: "Our 9-dimension work-style assessment, cross-checked against verified references, shows how someone collaborates, decides, and handles ambiguity — the fit signal a résumé can't give you.",
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
      "you get verified references, demonstrated work ethic, real work samples, and a work-style profile — the same caliber of signal an executive recruiter would hand you. You never see a candidate's private Grade, their goals, or their compensation expectations. That's theirs, not a filter for you to game.",
    formHeading: 'Join the employer waitlist',
    formSubtext: "Be first to post roles and search verified profiles when we open to your region.",
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
    successMessage: "You're on the list. We'll email you the moment employer access opens in your area.",
  },
  {
    id: 'recruiters',
    audience: 'Recruiter',
    eyebrow: 'For Recruiters & Agencies',
    headline: 'Source candidates the ATS keyword filters bury — verified, not just parsed.',
    subhead:
      'Search verified candidates by how they work, not just what they typed. Career changers, returners, and non-traditional backgrounds are surfaced, not screened out, so you fill roles other tools miss and place candidates who actually stay.',
    directSignupHref: '/recruiters/signup',
    directSignupLabel: 'Get your free calibration tool — no waitlist',
    insightSection: {
      heading: 'Why your best submissions are getting rejected',
      items: [
        {
          lead: 'Most rejections aren\'t about skill.',
          body: 'Harvard Business School\'s "Hidden Workers" research found the large majority of employers unknowingly filter out qualified candidates through automated screening — the exact submissions you know are strong.',
        },
        {
          lead: 'A bad placement is expensive for everyone.',
          body: 'The U.S. Department of Labor puts the cost of a bad hire at roughly 30% of first-year earnings — a number that shows up as clawbacks, damaged client trust, and time you don\'t get back.',
        },
        {
          lead: 'Cold outreach to passive profiles has a ceiling.',
          body: 'Every candidate here opted in and completed a real work-style assessment — you\'re not guessing from a static profile, you\'re working from verified signal on how someone actually operates.',
        },
      ],
    },
    points: [
      {
        lead: 'Opted-in, assessment-backed talent.',
        body: 'Every profile is verified and enriched with work-style data, so your shortlist is built on fit — not guesswork from a keyword match.',
      },
      {
        lead: 'Reach hidden gems.',
        body: "The candidates ATS filters reject for gaps or pivots are exactly the ones you'll find here — and they're actively engaged.",
      },
      {
        lead: 'Human response rates.',
        body: 'People on NextChapter expect real conversation and feedback, so your outreach lands instead of vanishing into an inbox.',
      },
    ],
    contrastLabel: 'vs. $10K+/yr seat licenses:',
    contrastBody:
      'transparent, affordable pricing and a pool that opted in to hear from you — instead of cold-messaging passive profiles who never reply.',
    formHeading: 'Join the recruiter waitlist',
    formSubtext: 'Get early sourcing access and founding-recruiter pricing when we launch search.',
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'workEmail', label: 'Work email', type: 'email', required: true },
      { name: 'agencyOrCompany', label: 'Agency or company', type: 'text', required: true },
      { name: 'recruitFor', label: 'What do you recruit for?', type: 'text', required: false },
    ],
    successMessage: "You're on the list. We'll reach out with early sourcing access as we roll out.",
  },
  {
    id: 'outplacement',
    audience: 'Outplacement',
    eyebrow: 'For Outplacement & HR',
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
        body: 'Every participant gets a free Market Reality Grade and Search Action Grade, a personalized action plan, and direct matches to hiring employers — practical next steps, not a portal they log into once and abandon.',
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
      'Whether you serve jobseekers, fund workforce solutions, or research the labor market, NextChapter offers a candidate-first platform and a consented, structured dataset connecting self-reported work style, reference-verified behavior, and real placement outcomes.',
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
          body: 'Most hiring data stops at the resume or the interview. Ours connects a candidate\'s self-reported work style, what their references independently verified, and what actually happened next — a foundation for research on hiring equity, ATS bias, and what really predicts success.',
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
        body: 'Consent-based, structured data on work-style dimensions and outcomes — a foundation for studies on hiring equity, gaps, and mobility.',
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
    id: 'for-coaches',
    audience: 'Coach',
    eyebrow: 'For Coaches',
    headline: 'Bring your existing clients onto NextChapter — free, in under a minute.',
    subhead:
      "You already know your clients' situations better than any assessment could. NextChapter gives them a free Market Reality Grade and Search Action Grade, a personalized action plan, and daily accountability between your sessions — while you keep the human relationship you already have.",
    points: [
      {
        lead: 'A force-multiplier, not a replacement.',
        body: "Your clients get structured daily/weekly accountability from Victoria, NextChapter's free AI coach, so your own sessions go further — you're not the only structure they have between calls.",
      },
      {
        lead: 'Set up in under a minute.',
        body: 'No procurement, no contract. Sign up, get your personal invite link, and send it to the clients you already work with today.',
      },
      {
        lead: 'A simple client view.',
        body: "See each client's week, grade trend, and last check-in at a glance — enough context to walk into every session already informed.",
      },
    ],
    directSignupHref: '/support/coach/signup',
    directSignupLabel: 'Get my invite link — free',
    contrastLabel: 'What this is, and what it isn\'t:',
    contrastBody:
      "this is a lightweight companion to your coaching practice, not a replacement for it — no session notes, no case management, just a free tool your clients can use every day between the sessions you already run.",
    formHeading: 'Questions before you sign up?',
    formSubtext: "Tell us a bit about your practice and we'll follow up.",
    fields: [
      { name: 'fullName', label: 'Full name', type: 'text', required: true },
      { name: 'workEmail', label: 'Work email', type: 'email', required: true },
      { name: 'practiceName', label: 'Practice or firm name', type: 'text', required: false },
      { name: 'coachingFocus', label: 'What kind of coaching do you do?', type: 'text', required: false },
    ],
    successMessage: "Thanks — we'll follow up. Or just use the link above to get started right now.",
  },
]
