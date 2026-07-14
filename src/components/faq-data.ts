export interface FAQItem {
  question: string
  answer: string
}

export interface FAQCategory {
  category: string
  items: FAQItem[]
}

export const FAQ_CATEGORIES: FAQCategory[] = [
  {
    category: 'The basics',
    items: [
      {
        question: 'Is NextChapter really free for me?',
        answer:
          "Yes — completely, and always. Building your profile, taking the assessment, and getting your Hireability Grade and action plan cost you nothing. We never charge candidates a cent. Employers pay a flat monthly subscription to use the platform, and that's the only way we make money.",
      },
      {
        question: "Then what's the catch? How do you actually make money?",
        answer:
          "No catch. Employers pay a flat $200/month to use NextChapter — no fees per hire, no upcharges. That flat model is deliberate: because employers aren't paying more to reach you, there's no incentive to sell your attention or your data. You're the reason the platform exists, not the product being sold.",
      },
      {
        question: 'Who is NextChapter for?',
        answer:
          "Anyone getting back into work or moving into a new chapter — career changers, people returning after a layoff or caregiving, relocators, recent graduates, and anyone whose resume doesn't tell the whole story. If you've ever felt filtered out before a human ever saw you, this is built for you.",
      },
    ],
  },
  {
    category: 'The Hireability Grade & assessment',
    items: [
      {
        question: 'What is the Hireability Grade?',
        answer:
          "It's two letter grades, A through F — not one number. Market Reality is how ready you are to land your next role today, based on how you actually work, not just what's on your resume. Search Execution is how effectively you're running your own search, and starts blank until you begin your first weekly action plan. After you finish the assessment, you get your Market Reality grade plus a personalized action plan; Search Execution fills in as you take action. It's meant to be useful to you first, not just a number for employers.",
      },
      {
        question: 'How is the Grade calculated?',
        answer:
          "Market Reality combines your experience and goals with a work-style assessment built on 9 cross-validated dimensions — things like how fast you move, how you handle ambiguity, how you communicate, and how you lead — measured in a way that's hard to game by just picking the “best-sounding” answer. Search Execution is separate: it tracks the real steps you take each week, like outreach, references, and interviews, not a quiz score.",
      },
      {
        question: 'How long does the assessment take?',
        answer:
          'About 8–10 minutes, in five short steps: Resume, Your Why, Your Situation, Experience, and Goals. It’s designed to feel like reflection, not a test — most people find the "Your Why" part genuinely clarifying. (There\'s also an optional Work Style Assessment you can take anytime from your dashboard — it\'s not required to get your Grade.)',
      },
      {
        question: 'Can I save my progress and finish later?',
        answer:
          'Yes — your progress saves automatically as you go, so you can step away and pick up exactly where you left off, on any device.',
      },
      {
        question: 'Do I have to upload a resume?',
        answer:
          "Yes, for now — it's how we auto-fill most of your profile (name, contact info, experience) so you're not retyping everything by hand.",
      },
      {
        question: 'What if I have an employment gap or a non-traditional background?',
        answer:
          "That's exactly who this is built for. Traditional systems penalize gaps and anything that doesn't fit a template — NextChapter is designed to surface how you work and what you bring, so a gap is context, not a red flag.",
      },
      {
        question: 'Can I retake the assessment or improve my Grade?',
        answer:
          'You don’t retake the quiz itself — instead, your Search Execution grade updates automatically as you take real steps: adding references and work samples, confirming your details, logging networking activity, landing an interview. The more of your action plan you complete, the more it reflects it. Your Market Reality grade can shift too, as you round out your profile with more experience, references, and work samples.',
      },
    ],
  },
  {
    category: 'Your privacy & your data',
    items: [
      {
        question: 'What data do you collect, and what do you do with it?',
        answer:
          "You share your work history, goals, and assessment responses to build your profile and Grade. We use Claude (Anthropic's AI) to help analyze your resume and generate feedback, and we store your data securely to power your results and, based on your privacy setting, show your profile to employers on the platform.",
      },
      {
        question: 'Do you sell my data or share it with third parties?',
        answer:
          "No — we don't sell your personal data or share it with advertisers or data brokers. Your resume is processed by Claude (Anthropic) solely to generate your analysis and feedback. The only “sharing” that happens is showing your profile to employers on NextChapter, and only based on the privacy setting you choose.",
      },
      {
        question: 'Who can see my profile and my Grade?',
        answer:
          'Nobody, by default. New profiles start fully Locked — invisible everywhere — while you build them out. Once you’re ready, you choose your visibility: Public (full name and history), Semi-Public (first name + last initial), Private (fully anonymized), or Stealth (visible only to companies you’ve pre-approved). You’re always in control.',
      },
      {
        question: 'Will my current employer find me on here?',
        answer:
          "Not unless you want them to. Use Stealth mode to stay invisible to everyone except companies you've explicitly pre-approved, or stay Locked while you explore.",
      },
      {
        question: 'How do I delete my account and my data?',
        answer:
          'Go to Dashboard → Privacy and click "Delete my account" in the Danger Zone. It deletes your profile, resume, references, work samples, and reports immediately — no waiting on support.',
      },
    ],
  },
  {
    category: 'After you get your Grade',
    items: [
      {
        question: 'What happens once I finish?',
        answer:
          "You get your Market Reality grade and a personalized action plan immediately — your Search Execution grade fills in as you start taking action each week. From there, your profile becomes visible to employers according to the privacy setting you've chosen — you don't have to fire off dozens of applications into the void.",
      },
      {
        question: 'How does matching with employers work?',
        answer:
          "Employers see profiles based on your work style, experience, and verification — not just resume keywords. What won't change is that you control your visibility the whole time.",
      },
      {
        question: 'Do I have to be actively job-hunting to use it?',
        answer:
          'No. Even if you’re just testing the waters, your Hireability Grade and action plan are worth having — and you control how visible you are to employers the whole time.',
      },
      {
        question: 'What does it cost me if I get hired through NextChapter?',
        answer: 'Nothing. Ever. There are no success fees or hidden charges to candidates at any stage.',
      },
    ],
  },
  {
    category: 'Getting help',
    items: [
      {
        question: "I have a question that isn't answered here. How do I reach you?",
        answer: 'Email support@launchyournextchapter.com — a real person will get back to you.',
      },
    ],
  },
]
