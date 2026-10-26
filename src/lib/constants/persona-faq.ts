// Two or three plain questions per /start page, so each situational page answers the searches behind it. Shown as a
// "Common questions" section and sent as FAQPage JSON-LD. Keep answers short and general.

export const PERSONA_FAQ: Record<string, { q: string; a: string }[]> = {
  'laid-off': [
    { q: 'What should I do first after being laid off?', a: 'File for unemployment right away, note your COBRA deadline, read any severance agreement before signing, and lock in references while the relationships are warm. Then build a weekly search plan.' },
    { q: 'How do I find companies that are laying off?', a: 'The layoff tracker lists WARN notices filed with state labor departments, by state and employer, with a page for each.' },
    { q: 'Is NextChapter free if I was laid off?', a: 'Yes. The Market Reality Assessment, the weekly plan and the AI career coach are free for job seekers.' },
  ],
  'thinking-about-a-move': [
    { q: 'How do I look for a job without my employer knowing?', a: 'Nothing about using NextChapter is visible to your employer, your team or your network unless you choose to share it.' },
    { q: 'How do I know what I am worth in the market?', a: 'The Market Reality Assessment shows how the market reads your background and what comparable roles pay, based on live job postings.' },
  ],
  'managing-my-career': [
    { q: 'How do I prepare for a performance review or a raise conversation?', a: 'Collect the results you delivered, check what the market pays for your role, and write down the case in a page you can bring.' },
    { q: 'How do I make my job more secure in a downturn?', a: 'Keep your skills current, keep your results documented and keep your network warm, so a layoff is a detour instead of a stop.' },
  ],
  resigned: [
    { q: 'What should I do right after quitting without another job?', a: 'Set a weekly search plan, check your health coverage options and start outreach to your network before you start applying widely.' },
    { q: 'Can I get unemployment if I quit?', a: 'Usually not, but rules differ by state and by reason for leaving. Check your state’s page.' },
  ],
  returning: [
    { q: 'How do I explain a gap on my resume?', a: 'Say what you did in it in one line, such as caregiving, study, consulting or a project, and move on to your results.' },
    { q: 'Where do I start after a long break?', a: 'Update your story, reconnect with former colleagues and apply to roles that fit what you can do now.' },
  ],
  'searching-too-long': [
    { q: 'Why is my job search taking so long?', a: 'The usual causes are a resume that does not match the roles, too few conversations with people at the employers and applying without a referral. Fix one at a time.' },
    { q: 'How long does a typical white-collar job search take?', a: 'It varies by level and month. The long-search index tracks it.' },
  ],
  promotion: [
    { q: 'How do I ask for a promotion?', a: 'Bring evidence of results at the next level, what the market pays for it and a specific request, and schedule a conversation for it.' },
    { q: 'Should I look outside for a promotion?', a: 'Checking the market first tells you whether the next level is available where you are or elsewhere.' },
  ],
  'career-change': [
    { q: 'How do I change careers at mid-career?', a: 'Find the roles where your existing skills are most of the job, close the one or two real gaps, and prove it with results and references. A career pivot plan walks through it.' },
    { q: 'How do I know which new field fits?', a: 'Career exploration starts from what you did well and what the market pays, then tests the best options.' },
  ],
  'new-grad': [
    { q: 'How do I start a job search with no experience?', a: 'Pick two target roles, build a short list of employers, and reach out to alumni and people in those roles instead of only applying.' },
    { q: 'How many applications should a new grad send?', a: 'Fewer, better targeted ones, each paired with outreach to a person.' },
  ],
  'next-act': [
    { q: 'How do I move into board or consulting work?', a: 'Define the problems you solve, package them as a short offer and tell your network exactly who you want to meet.' },
  ],
  'taking-a-break': [
    { q: 'How do I take a career break without hurting my career?', a: 'Keep your profile and a few key relationships active, document your results before you leave and plan how you will return.' },
  ],
  'happy-with-fractional-work': [
    { q: 'How do I keep a fractional or consulting practice full?', a: 'Keep a pipeline: regular outreach, clear results to point to, and references that clients can call.' },
  ],
  'building-something': [
    { q: 'Can I start a business while keeping my job?', a: 'Often, subject to your employment agreement. Keep your job search ready as an option while you test the idea.' },
  ],
}
