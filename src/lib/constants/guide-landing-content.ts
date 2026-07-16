export interface GuideFaqItem {
  question: string
  answer: string
}

export interface GuideLandingContent {
  /** Must match Guide.slug in src/lib/constants/guides.ts */
  slug: string
  title: string
  metaDescription: string
  /** 1-3 paragraphs, ~150-250 words total — must stand alone as a real answer. */
  excerpt: string[]
  /** What the full guide covers, beyond the excerpt. */
  outline: string[]
  /** 3-5 public Q&As. */
  faq: GuideFaqItem[]
  lastUpdated: string
}

export const GUIDE_LANDING_CONTENT: GuideLandingContent[] = [
  {
    slug: 'unemployed',
    title: "You're unemployed now. What actually works.",
    metaDescription:
      'Evidence-based guidance for experienced professionals navigating unemployment — what to do in week one, and what actually moves a search forward through month three.',
    excerpt: [
      "The instinct after a layoff or resignation is to start applying immediately, everywhere. That's usually the wrong first move. The first week matters more for stabilizing than for applying: filing for unemployment insurance on day one (not weeks later, since most states only pay from your filing date forward), making COBRA/ACA decisions on a real deadline, and getting your references locked in while the relationship is still warm.",
      "Most job searches fail quietly in the middle, not the start — candidates apply hard for two weeks, get discouraged by silence, and drift into passive scrolling. The professionals who land roles faster tend to split their time deliberately: roughly a third on applications, a third on direct outreach to people who can actually open a door, and a third on staying visible (LinkedIn activity, informational conversations) so opportunities find them too. Applications alone, without a network layer, is the single most common reason a strong candidate's search stalls past month two.",
    ],
    outline: [
      'A concrete week-one checklist (unemployment filing, COBRA/ACA deadline, first outreach)',
      'How to structure your time across applications, outreach, and visibility',
      'What "resume gap" actually means to a hiring manager, and how to frame it',
      'Warning signs your search has quietly gone passive',
      'A month-by-month view of what changes as a search extends',
    ],
    faq: [
      {
        question: 'What should I do in the first 48 hours after losing a job?',
        answer:
          'File for unemployment insurance immediately — most states pay from your filing date, not your last day worked. Also note your COBRA election deadline (60 days) and, if you have one, review your severance agreement\'s consideration period before signing anything.',
      },
      {
        question: 'How many hours a day should a job search actually take?',
        answer:
          "There's no universal number, but a search that's only applications, all day, tends to burn candidates out and produce diminishing returns. Splitting time across applications, direct outreach, and staying visible generally outperforms applications alone.",
      },
      {
        question: 'How do I explain a gap in interviews?',
        answer:
          'Briefly, factually, and without over-apologizing. State what happened in one sentence, then pivot immediately to what you did with the time and what you\'re looking for next.',
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: '72-hours',
    title: 'You just got here. Start here.',
    metaDescription:
      'The first 72 hours after a layoff — what to do, in what order, before the shock wears off and the deadlines start.',
    excerpt: [
      "The first 72 hours after a layoff are disorienting, and that's exactly when several real deadlines start their clock — which makes this the worst possible moment to be operating on instinct instead of a checklist. Before anything else: confirm your last paycheck date and any accrued PTO payout, get a personal copy of your severance agreement and note its review/revocation windows, and export your own contacts and work samples while you still have system access.",
      "After the logistics, the next 72 hours are about not going quiet. Tell a small circle of people — not a mass LinkedIn post yet, just the 10-15 people who'd actually help — that you're in transition and what you're looking for next. Waiting until you \"have it together\" to tell anyone is the single most common early mistake; the people most likely to help you land your next role are the ones who hear from you now, not three months from now.",
    ],
    outline: [
      'Hour-by-hour priorities for day one',
      'What to secure before you lose system access',
      'How and when to tell your network (and who to tell first)',
      'Severance and paperwork deadlines that start immediately',
      'What to deliberately NOT do in the first 72 hours',
    ],
    faq: [
      {
        question: "What's the very first thing I should do after a layoff?",
        answer:
          'Before anything emotional or strategic: secure your own data (contacts, work samples, performance reviews) while you still have access, and note your severance review/revocation deadlines.',
      },
      {
        question: 'Should I post on LinkedIn immediately?',
        answer:
          "Not necessarily immediately, but don't wait long either. Telling a small, trusted circle first is usually more productive than a public post in the first 72 hours — the public post can come once you have a clearer next-step framing.",
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'pre-exit',
    title: 'Before you leave. What to do while you still can.',
    metaDescription:
      'Whether you\'re planning a departure or bracing for one — the window to secure references, your own data, and clarity on what you can and can\'t take is now, not after your last day.',
    excerpt: [
      "Most people treat their last day as a finish line. It's actually a deadline — the access you have today, to your files, your contacts, your performance data, your references, disappears the moment you're out, and a few hours of preparation now protects years of work. The single highest-leverage thing to do before you go: ask for references while the relationship is active and the work is recent, not months later when you actually need them and the ask feels transactional.",
      "There's also a real, specific line between what's yours to keep and what isn't. Your own contacts, your own performance reviews, and your own written work are generally yours. Proprietary company data, client lists you didn't personally build, and source code are not — and \"if unsure, don't take it\" is the right default, since the liability is real and your accomplishments and relationships are enough on their own. Beyond that: know your non-compete and IP-assignment terms before you're negotiating a competing offer, not after.",
    ],
    outline: [
      'Exporting your own contacts and work samples before you lose access',
      'Securing 5 references while the relationship is warm',
      'What you can and cannot legally take with you',
      'Non-compete, IP assignment, and severance terms to read before signing',
      'How to leave in a way that protects your reputation for years, not months',
    ],
    faq: [
      {
        question: 'Can I take my contacts with me when I leave a job?',
        answer:
          "Generally yes — the relationships you built are yours. What you can't take is company-owned data about those relationships, like a CRM record or a client list you didn't personally build.",
      },
      {
        question: 'When should I ask for a reference — before or after I leave?',
        answer:
          'Before. The best time to ask is while the relationship is active and the work is recent — asking months later, after you need it for a job search, reads as transactional and the specifics have often faded for both of you.',
      },
      {
        question: "What shouldn't I take when I leave a job?",
        answer:
          "Proprietary company data, client lists you didn't personally build, source code, financial models, and confidential documents. If you're unsure whether something counts, the safe default is to leave it — the liability isn't worth it.",
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'cobra-aca',
    title: 'COBRA & marketplace coverage.',
    metaDescription:
      'How to keep or replace your health insurance after leaving a job — COBRA vs. ACA Marketplace, the real deadlines, and how to actually compare the cost.',
    excerpt: [
      "You have 60 days after losing employer coverage to elect COBRA — but waiting the full 60 days creates a retroactive coverage gap that can complicate billing if you need care in the meantime, so the real decision window is closer to 30 days. COBRA keeps your exact same plan and network, at full premium (your former employer's contribution disappears, plus typically a 2% administrative fee) — usually more expensive than what you were paying, but with zero disruption to your doctors or prescriptions.",
      "The ACA Marketplace is the other option, and it's often — not always — cheaper, especially if your income drops enough to qualify for a subsidy. The tradeoff is a different network, so if you have an ongoing prescription or a specialist you don't want to lose, check that provider's Marketplace-plan coverage before switching. The right call depends on your specific premium math and whether continuity of care outweighs cost for you right now — there's no universal right answer, only the one that fits your situation.",
    ],
    outline: [
      'The COBRA election deadline and why the effective decision window is shorter than 60 days',
      'How to calculate real COBRA cost (premium + admin fee)',
      'When ACA Marketplace coverage is usually cheaper, and when it isn\'t',
      'Checking your providers/prescriptions against a new network before switching',
      'Other benefits deadlines that hit at the same time (FSA, vesting, expense reports)',
    ],
    faq: [
      {
        question: 'How long do I have to elect COBRA?',
        answer:
          "You have 60 days after losing employer coverage, but deciding within 30 days is smarter — waiting the full 60 creates a retroactive coverage gap that can complicate billing if you need care before you've officially elected.",
      },
      {
        question: 'Is COBRA or the ACA Marketplace cheaper?',
        answer:
          "It depends on your income and plan — ACA Marketplace is often cheaper, especially with a subsidy, but COBRA keeps your exact same plan and network with zero disruption. Compare both before deciding, and check your specific providers against the Marketplace plan's network first.",
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'bridge-income',
    title: 'Bridge income options.',
    metaDescription:
      'Ways to bring in income while you search for your next role, without derailing the search itself — fractional work, interim roles, and how to weigh the tradeoffs.',
    excerpt: [
      "Taking on income-generating work during a search is often framed as a distraction from finding a full-time role. In practice, the opposite is usually true: a well-chosen fractional or interim engagement keeps you sharp, keeps your resume current instead of showing a growing gap, and often becomes a source of the next full-time offer itself, since interim work regularly converts once a company sees the fit. The key word is well-chosen — bridge work should be scoped tightly enough (hours per week, defined end date) that it doesn't consume the time you need for your actual search.",
      "The options span a real range: fractional leadership roles (part-time executive-level work across one or more companies), interim placements (full-time but explicitly temporary), consulting engagements scoped to a specific project, and lower-commitment gig work that simply bridges income without much resume relevance at all. Which one makes sense depends on how much search-time you can protect, how much income pressure you're under, and whether the work itself is worth having on a resume — not every bridge option needs to advance your story, but the best ones do both at once.",
    ],
    outline: [
      'The real difference between fractional, interim, and consulting work',
      'How much time to protect for your actual search when taking bridge work',
      'How interim/fractional roles often convert into full-time offers',
      'How to talk about bridge work in interviews without it reading as a detour',
      'When bridge income is the right call, and when it isn\'t',
    ],
    faq: [
      {
        question: "Will taking a fractional or interim role hurt my full-time search?",
        answer:
          "Not if it's scoped tightly. A fractional or interim role that respects a defined number of hours per week, with a clear end date, generally strengthens a search rather than derailing it — it keeps your resume current and sometimes converts to the full-time offer itself.",
      },
      {
        question: 'How do I explain fractional or interim work on my resume?',
        answer:
          'As a standard role, described by what you accomplished — not qualified as "fractional" or "interim" in the title, which can read as less-than to a reader skimming quickly. The substance of the work is what matters.',
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'gatekeeper',
    title: 'Getting through the gatekeeper.',
    metaDescription:
      'How recruiters, ATS resume screeners, and hiring managers actually work — and what it takes to get from an application in a queue to an actual interview.',
    excerpt: [
      "Most job applications never reach a human. Applicant Tracking Systems (ATS) parse resumes into structured fields and rank or filter candidates before a recruiter ever opens the file — which means a resume formatted for a human reader (creative layouts, tables, headers in the wrong place) can get misread or dropped entirely by the software reading it first. The practical fix isn't to write worse, more robotic bullets — it's to make sure the parsed version of your resume actually contains the specific keywords and job-title language the posting uses, in plain, standard formatting the software can reliably extract.",
      "Once a resume clears the ATS, the recruiter screen is a different filter entirely — usually 15-20 minutes, screening for basic fit and a handful of disqualifiers, not a deep evaluation. The candidates who get through consistently do two things: they mirror the language of the actual job posting (not a generic version of their background), and they lead with the most relevant accomplishment for that specific role in the first line a recruiter reads, rather than making them dig for it.",
    ],
    outline: [
      'How ATS parsing actually works, and what breaks it',
      'Formatting a resume that both a human and a screener can read correctly',
      'What a recruiter is actually screening for in the first 15-20 minutes',
      'Mirroring job-posting language without sounding like a keyword-stuffed resume',
      'What separates a resume that gets a callback from one that doesn\'t',
    ],
    faq: [
      {
        question: 'Does keyword-stuffing a resume actually work against ATS?',
        answer:
          "It can backfire — some systems flag unnaturally dense keyword repetition, and a human reviewer who does see it will notice too. The better move is genuinely mirroring the posting's specific language in real, readable bullets, not padding a list.",
      },
      {
        question: 'Why do fancy resume templates sometimes get rejected automatically?',
        answer:
          'Tables, text boxes, columns, and headers/footers can all get misread or dropped by ATS parsing, scrambling your actual work history into an unreadable format the system then ranks poorly. Simple, standard formatting parses more reliably.',
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'offer-letter',
    title: 'You have an offer. Now read it correctly.',
    metaDescription:
      'Total comp breakdown, negotiation scripts, and the red flags to catch before you sign — everything an offer letter isn\'t telling you outright.',
    excerpt: [
      "An offer letter's headline salary number is rarely the full picture. Total compensation includes base, bonus target (and whether it's guaranteed in year one or fully discretionary), equity (and its actual vesting schedule, not just the headline grant size), and benefits — and two offers with the same base salary can differ by tens of thousands of dollars once all of that is priced in. Before responding to any offer, build out the full number, not just the one printed at the top.",
      "Negotiation is also more normal, and more low-risk, than it feels in the moment — most employers expect a counter and have room to move, particularly on start date, sign-on bonus, and PTO, even when base salary is genuinely fixed. The failure mode isn't asking; it's asking vaguely (\"is there any flexibility?\") instead of asking specifically (a number, tied to a reason). And before signing anything: read the full agreement for a non-compete, arbitration clause, or IP assignment language that's broader than you expected — these are far easier to negotiate before you sign than after.",
    ],
    outline: [
      'How to build the real total-compensation number from an offer letter',
      'What\'s usually negotiable, even when base salary is fixed',
      'A specific script for countering, rather than a vague ask',
      'Red flags to read for in the fine print before signing',
      'How to compare two offers that look similar on the surface',
    ],
    faq: [
      {
        question: 'Is it safe to negotiate a job offer?',
        answer:
          "In almost all cases, yes — most employers expect it and have already built in room to move. The offer being rescinded over a reasonable, professional counter is rare and usually a red flag about the company itself if it happens.",
      },
      {
        question: 'What should I look for in an offer letter besides salary?',
        answer:
          'Bonus structure (guaranteed vs. discretionary), the actual equity vesting schedule, start date flexibility, and any non-compete or arbitration language — all of which matter as much as the printed salary number.',
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'narrative-workshop',
    title: 'Build your core story.',
    metaDescription:
      'A workshop for building the one story you tell about your career — the version that works consistently across resumes, interviews, and networking conversations.',
    excerpt: [
      "Most professionals have a dozen different, slightly inconsistent versions of their own career story, told differently depending on who's asking. That inconsistency is quietly costly — a hiring manager who hears one framing from your resume, a different one in the interview, and a third in a reference call reads it as a lack of self-awareness, even when every individual fact is true. A core narrative is the single, tight version of your story — what you've done, why you're moving, and what you're looking for next — built once and reused everywhere, so every touchpoint reinforces the same picture instead of competing with it.",
      "Building one starts with naming the actual throughline in your career, not a generic summary of your resume. What's the pattern across your roles — the kind of problem you keep getting pulled into, the kind of environment you do your best work in? That throughline, stated in two or three sentences, becomes the spine for your resume summary, your LinkedIn headline, your interview opening answer, and how you introduce yourself in a networking conversation — the same story, sized differently for each format.",
    ],
    outline: [
      'Finding the real throughline in your career, not a generic summary',
      'Turning that throughline into a 2-3 sentence core narrative',
      'Adapting the same narrative for a resume, LinkedIn, and an interview answer',
      'Handling a pivot or a gap within the narrative honestly, without over-explaining',
      'Why consistency across touchpoints matters more than any single answer being perfect',
    ],
    faq: [
      {
        question: 'What is a "core narrative" in a job search?',
        answer:
          'The single, consistent version of your career story — what you\'ve done, why you\'re moving, and what you want next — built once and reused across your resume, LinkedIn, and interviews, instead of improvised differently each time.',
      },
      {
        question: 'How do I find my career "throughline"?',
        answer:
          "Look for the pattern across roles, not the job titles themselves — the kind of problem you keep getting pulled into, or the environment where your work has consistently gone well. That pattern is usually more honest and more compelling than a generic summary.",
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'network-activation',
    title: 'Activate your network.',
    metaDescription:
      'How to turn your existing contacts into real conversations — without it feeling like you\'re only reaching out when you need something.',
    excerpt: [
      "Most job searches under-use the network the person already has, not because they don't know anyone, but because reaching out feels transactional — like the relationship only matters now that there's a favor attached. The reframe that actually helps: activating your network isn't asking for a job, it's asking for a conversation, information, or an introduction — three things that are far lower-stakes to ask for and, in practice, more likely to lead somewhere real than a direct \"do you know of any openings.\"",
      "The other common mistake is going broad and generic — a mass message to 200 connections gets a low response rate and reads as impersonal to everyone who gets it. A short list of 15-25 people, contacted individually with a specific, personalized reason for reaching out to each one, consistently outperforms a wide blast. Starting with the warmest relationships first — people who'd genuinely be glad to hear from you regardless of the ask — also builds momentum and confidence before moving to colder outreach.",
    ],
    outline: [
      'Why asking for a conversation beats asking for a job',
      'Building a short, prioritized list instead of a mass blast',
      'Starting with warm relationships before colder outreach',
      'What to actually say in a first message (and what to avoid)',
      'Following up without feeling like you\'re nagging',
    ],
    faq: [
      {
        question: 'Is it awkward to reach out to old contacts about a job search?',
        answer:
          "It feels that way in advance more than it actually plays out — most people are glad to hear from a former colleague and willing to help in a small way. Framing the ask as a conversation or a piece of advice, not a direct job ask, lowers the awkwardness on both sides.",
      },
      {
        question: 'How many people should I reach out to?',
        answer:
          'A focused list of 15-25 people, contacted individually with a specific reason for each one, generally works better than a mass message to your entire network — quality and personalization outperform volume here.',
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'ask-for-help',
    title: 'Before you start outreach, read this.',
    metaDescription:
      'Why asking for help works, and how to do it without it feeling awkward — the reframe that makes outreach easier before you send a single message.',
    excerpt: [
      "Asking for help during a job search triggers a specific kind of discomfort — a fear of being a burden, of seeming desperate, or of admitting something isn't going well. That discomfort is almost always more intense in your own head than it registers to the person you're asking. Most people, when someone they know reasonably well reaches out during a transition, feel genuinely glad to be thought of and willing to help in whatever small way they can — the awkwardness is rarely mutual, even when it feels that way before you hit send.",
      "The other thing worth naming honestly: asking for help is not optional in a real search — it's one of the highest-leverage things you can do, and avoiding it because it feels uncomfortable is a common, quiet reason searches stall. The people most likely to help aren't strangers with job openings; they're people who already know your work and are one specific, well-framed ask away from making an introduction or passing your name along. Making the ask specific — not \"let me know if you hear of anything,\" but a named role, company, or type of introduction — makes it easier for them to actually help, not just sympathize.",
    ],
    outline: [
      'Why asking for help feels worse than it actually is for the other person',
      'The difference between a vague ask and one people can actually act on',
      'How to ask without over-apologizing or minimizing your own situation',
      'What to say when someone can\'t help — keeping the relationship warm regardless',
      'Why avoiding outreach is one of the most common ways searches stall',
    ],
    faq: [
      {
        question: 'Why does asking for help feel so uncomfortable during a job search?',
        answer:
          "It taps into a fear of seeming desperate or admitting things aren't going well — a very natural reaction, but one that's usually more intense in your own head than it registers to the person you're asking, who is often genuinely glad to help.",
      },
      {
        question: 'What makes an ask easy for someone to actually act on?',
        answer:
          'Specificity. "Let me know if you hear of anything" is easy to forget; naming a role, company, or type of introduction gives the other person something concrete they can actually do.',
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'network-scripts',
    title: 'The networking script book.',
    metaDescription:
      'Scripts for every kind of outreach — cold, warm, and everything between — so you\'re never starting a message from a blank page.',
    excerpt: [
      "The hardest part of networking outreach is usually the first line, not the ask itself — staring at a blank message to someone you haven't spoken to in three years, unsure how to open without it feeling stiff or overly familiar. Having a small set of real, adaptable scripts removes that friction: an opener that's specific to your actual shared history with that person, a clear and low-pressure reason for reaching out, and a close that makes it easy for them to respond in thirty seconds if they're busy.",
      "The right script also depends on the relationship's warmth. A close former colleague can get a short, casual, direct message. Someone you met once at a conference needs a warmer reintroduction before any ask. A cold connection — someone you don't know at all but want to reach — needs the most context and the lowest-pressure ask of the three, since you haven't yet earned the benefit of the doubt a warmer relationship gives you.",
    ],
    outline: [
      'Scripts calibrated to relationship warmth: hot, warm, and cold outreach',
      'How to open a message to someone you haven\'t spoken to in years',
      'Making the ask easy to say yes to in under a minute of their time',
      'Following up once, without it reading as pressure',
      'Adapting a script so it doesn\'t read as copy-pasted',
    ],
    faq: [
      {
        question: 'What should I say to someone I haven\'t talked to in years?',
        answer:
          "Open with something specific and genuine — a real memory of working together, or a reason you thought of them specifically — before getting to why you're reaching out. A generic \"hope you're well\" opener is the one part of a script most worth personalizing.",
      },
      {
        question: 'Is it okay to reach out to someone I don\'t know well at all?',
        answer:
          'Yes, with the right framing — more context about who you are and why you\'re reaching out, and a lower-pressure ask than you\'d make of a close contact, since you haven\'t yet built the relationship that makes a bigger ask comfortable.',
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'interview-prep',
    title: 'Interview prep guide.',
    metaDescription:
      'How to prepare for interviews at every stage, from the phone screen through the final round — what actually changes as you move through the process.',
    excerpt: [
      "Interview stages test genuinely different things, and preparing the same way for all of them is a common mistake. A phone screen is mostly a basic-fit and disqualifier filter — the recruiter is checking comp range, location, and a handful of must-haves, not evaluating your deepest technical expertise. A hiring-manager round goes deeper into whether you can actually do the job. A panel or final round is often testing team fit and how you handle real-time pushback, not just your prepared answers.",
      "The single highest-leverage prep move at any stage is building 3-4 specific stories, in a structured format (situation, action, result), that you can adapt to multiple question types — rather than trying to have a perfectly memorized answer for every possible question. Interviewers remember specific numbers and specific outcomes far more than they remember polished but generic language, so the stories worth preparing are the ones with a real, quantifiable result attached.",
    ],
    outline: [
      'What each interview stage is actually testing for',
      'Building 3-4 adaptable stories instead of memorizing every possible answer',
      'Structuring an answer so it lands with a specific result, not just effort',
      'Questions to ask the interviewer that actually reveal useful information',
      'What to do differently preparing for a final round vs. a phone screen',
    ],
    faq: [
      {
        question: 'How many stories do I need to prepare for interviews?',
        answer:
          "Usually 3-4 well-developed ones, each adaptable to a few different question types, works better than trying to have a distinct memorized answer for every possible question — which reads as rehearsed rather than genuine.",
      },
      {
        question: 'What\'s different about a final-round interview?',
        answer:
          'Final rounds more often test team fit and how you handle real-time pushback or a follow-up you didn\'t prepare for, rather than confirming facts already established earlier in the process.',
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'post-interview',
    title: "You have an interview. Here's how to follow up.",
    metaDescription:
      'What to do in the 24-48 hours after an interview — the thank-you note that actually stands out, and how to handle the wait afterward.',
    excerpt: [
      "A generic thank-you email — \"thank you for taking the time to speak with me\" — is easy to write and easy to forget just as fast. A note that actually stands out references something specific from the conversation: a project the interviewer mentioned, a challenge they described the team is working through, a detail that proves you were genuinely listening rather than sending a template. Sending it within 24 hours, while the conversation is still fresh for both of you, matters more than making it long or elaborate.",
      "After the note, the harder part is the wait — and most candidates handle it badly, either going silent and passive or following up so frequently it reads as anxious. One well-timed follow-up, roughly a week after the stated timeline passes with no update, is appropriate and expected. Beyond that, the better use of the waiting period is continuing your search actively rather than pausing it to wait on one outcome — a strong process elsewhere is also the best leverage if you do get a competing offer to negotiate with.",
    ],
    outline: [
      'What makes a thank-you note specific instead of generic',
      'The 24-48 hour window and why it matters',
      'How to follow up once without seeming anxious',
      'What to do with the rest of your search while you wait',
      'How to handle silence past the stated timeline',
    ],
    faq: [
      {
        question: 'How soon should I send a thank-you note after an interview?',
        answer:
          'Within 24 hours, while the conversation is still fresh — the specificity of the note matters more than how long it is, and that specificity fades quickly if you wait too long to write it.',
      },
      {
        question: 'Should I keep applying elsewhere while waiting to hear back?',
        answer:
          "Yes — pausing your search to wait on one outcome is a common mistake. Continuing to search also gives you real leverage if you do end up with a competing offer to negotiate a timeline or an offer against.",
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'thought-leadership',
    title: 'Build a public presence.',
    metaDescription:
      'How to write and share thought leadership content that actually gets noticed — without it feeling like self-promotion.',
    excerpt: [
      "The instinct to avoid posting publicly during a job search — \"who am I to have opinions about this\" — is common and usually backwards. A public presence doesn't need to be a bold, contrarian take to work; it needs to be specific and genuinely useful, drawing on something you actually know well from direct experience. A short, concrete post about a real problem you solved reads as far more credible than a generic industry-trends commentary, and it's also easier to write, since you're not inventing an opinion, just describing something real.",
      "Consistency matters more than any single post going viral. A modest, steady cadence — even once every couple of weeks — builds a visible track record over a few months that a single high-effort post can't replicate, and it's what a hiring manager or recruiter actually sees when they look you up before a call. The goal isn't influence for its own sake; it's making sure that when someone searches your name mid-process, what they find reinforces the story you're already telling them directly.",
    ],
    outline: [
      'Why specific, experience-based posts outperform generic commentary',
      'Building a sustainable, modest posting cadence instead of one big push',
      'What to write about when you don\'t think you have anything novel to say',
      'How a public presence supports, rather than replaces, direct outreach',
      'What a hiring manager actually sees when they look you up',
    ],
    faq: [
      {
        question: 'What should I post about if I don\'t have a bold opinion to share?',
        answer:
          'A specific, concrete story about a real problem you solved is more credible and easier to write than an invented industry hot take — direct experience reads as more genuine than commentary.',
      },
      {
        question: 'How often should I post to build a public presence?',
        answer:
          "A modest, consistent cadence — even every couple of weeks — builds a more credible track record over a few months than a single viral attempt, which is also far less reliable to plan around.",
      },
    ],
    lastUpdated: '2026-07-01',
  },
  {
    slug: 'first-90-days',
    title: 'Your first 90 days.',
    metaDescription:
      'How to start strong in a new role — what to prioritize in the first month, and the mistakes that quietly cost people in their first quarter.',
    excerpt: [
      "The most common mistake in a new role's first 90 days is trying to prove value too fast — proposing changes before understanding why things are the way they are. The first 30 days are better spent listening: understanding how decisions actually get made, who the informal (not just organizational-chart) influencers are, and what's already been tried before you arrived. Contributing real, visible value matters, but it should follow genuine understanding, not precede it.",
      "By day 60-90, the priorities shift toward building a track record of small, real wins and establishing the working relationships that will matter for the next two years, not just the first quarter. The single highest-leverage habit in this window: proactively communicating progress to your manager before they have to ask — a new hire who over-communicates in the first 90 days builds trust far faster than one who does excellent work silently and waits to be noticed.",
    ],
    outline: [
      'Why the first 30 days should prioritize listening over contributing',
      'Identifying informal influence, not just the org chart',
      'Building small, real wins by day 60-90',
      'Proactive communication as the highest-leverage habit early on',
      'Common first-quarter mistakes and how to avoid them',
    ],
    faq: [
      {
        question: 'Should I try to make changes right away in a new role?',
        answer:
          "Generally, no — proposing changes before understanding why things are the way they are is one of the most common first-90-days mistakes. Listening and understanding should come first, contribution second.",
      },
      {
        question: 'What builds trust fastest with a new manager?',
        answer:
          "Proactively communicating progress before you're asked. A new hire who over-communicates in the first 90 days generally builds trust faster than one who does strong work but waits to be noticed.",
      },
    ],
    lastUpdated: '2026-07-01',
  },
]
