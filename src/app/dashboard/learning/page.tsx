import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { LearningResourceBrowser } from '@/components/dashboard/LearningResourceBrowser'
import { LearningBadgeForm } from '@/components/dashboard/LearningBadgeForm'
import { LearningBadgeList } from '@/components/dashboard/LearningBadgeList'

interface Resource {
  name: string
  description: string
  url: string
  free: boolean
}

interface ResourceCategory {
  title: string
  description: string
  resources: Resource[]
}

const CATEGORIES: ResourceCategory[] = [
  {
    title: 'Job search fundamentals',
    description: 'Sharpen the skills that move a search forward, not just a resume.',
    resources: [
      {
        name: 'The Muse — Career Advice',
        description: 'Practical, well-written guidance on resumes, interviews, and negotiation.',
        url: 'https://www.themuse.com/advice',
        free: true,
      },
      {
        name: 'Big Interview',
        description: 'Structured interview practice with recorded mock interviews and feedback.',
        url: 'https://biginterview.com',
        free: false,
      },
      {
        name: 'CareerOneStop Interactive Interview Prep',
        description: "A U.S. Department of Labor-funded tool for practicing common interview questions.",
        url: 'https://www.careeronestop.org/JobSearch/Interview/interview-practice.aspx',
        free: true,
      },
    ],
  },
  {
    title: 'In-demand technical certifications',
    description:
      'Widely recognized certificates that can meaningfully move your Experience Match and Presentation dimensions.',
    resources: [
      {
        name: 'Google Career Certificates',
        description: 'IT Support, Data Analytics, Project Management, UX Design, and more — no degree required.',
        url: 'https://grow.google/certificates/',
        free: false,
      },
      {
        name: 'Project Management Institute (PMP/CAPM)',
        description: 'The standard project-management credentials recognized across industries.',
        url: 'https://www.pmi.org/certifications',
        free: false,
      },
      {
        name: 'HubSpot Academy',
        description: 'Free certifications in marketing, sales, and CRM tools employers actually use.',
        url: 'https://academy.hubspot.com',
        free: true,
      },
      {
        name: 'AWS Cloud Practitioner',
        description: 'An accessible entry point into cloud/IT roles, recognized across the industry.',
        url: 'https://aws.amazon.com/certification/certified-cloud-practitioner/',
        free: false,
      },
    ],
  },
  {
    title: 'Broad skill-building platforms',
    description: 'General-purpose learning platforms worth having in your back pocket.',
    resources: [
      {
        name: 'Coursera',
        description: 'University- and company-backed courses; many offer free audit access.',
        url: 'https://www.coursera.org',
        free: true,
      },
      {
        name: 'LinkedIn Learning',
        description: 'Bite-sized professional-skills courses that also strengthen your LinkedIn presence.',
        url: 'https://www.linkedin.com/learning/',
        free: false,
      },
      {
        name: 'edX',
        description: 'Free courses from universities like Harvard and MIT; pay only if you want a certificate.',
        url: 'https://www.edx.org',
        free: true,
      },
    ],
  },
  {
    title: 'AI training',
    description:
      'Working AI fluency is fast becoming table stakes across functions — these are the courses employers actually recognize.',
    resources: [
      {
        name: 'Google AI Essentials',
        description: 'A practical, no-code introduction to using generative AI tools productively at work.',
        url: 'https://grow.google/ai-essentials/',
        free: false,
      },
      {
        name: 'Anthropic Academy',
        description: "Anthropic's own courses on working with Claude and building with LLMs, from prompting to real applications.",
        url: 'https://www.anthropic.com/learn',
        free: true,
      },
      {
        name: 'OpenAI Academy',
        description: "OpenAI's free courses and guides on using and building with its models.",
        url: 'https://academy.openai.com',
        free: true,
      },
      {
        name: 'DeepLearning.AI (Andrew Ng)',
        description: 'Short, well-regarded courses on generative AI and prompt engineering, several free.',
        url: 'https://www.deeplearning.ai/short-courses/',
        free: true,
      },
      {
        name: 'Stanford Online — AI Programs',
        description: "Stanford's professional and continuing-studies programs in AI and machine learning.",
        url: 'https://online.stanford.edu/programs/artificial-intelligence-professional-program',
        free: false,
      },
      {
        name: 'MIT xPRO — Artificial Intelligence',
        description: "MIT's professional-education program covering practical AI and machine learning foundations.",
        url: 'https://xpro.mit.edu/programs/program-v1:MITxPRO+ARTIF+copy_0',
        free: false,
      },
      {
        name: 'edX — AI & Machine Learning',
        description: 'Free-to-audit AI and ML courses from MIT, Harvard, and other universities.',
        url: 'https://www.edx.org/learn/artificial-intelligence',
        free: true,
      },
    ],
  },
  {
    title: 'Funded training (WIOA & public workforce system)',
    description:
      'If you qualify, these programs pay for real credentials — see the Benefits page for eligibility basics.',
    resources: [
      {
        name: 'CareerOneStop Training Finder',
        description: 'Search WIOA-eligible training programs by field and location.',
        url: 'https://www.careeronestop.org/Toolkit/Training/find-training.aspx',
        free: true,
      },
      {
        name: 'American Job Center Finder',
        description: 'Find your local workforce center to apply for WIOA-funded training in person.',
        url: 'https://www.careeronestop.org/LocalHelp/AmericanJobCenters/american-job-centers.aspx',
        free: true,
      },
    ],
  },
]

export default async function LearningPage() {
  const profile = await getDashboardData()
  const badges = await prisma.learningBadge.findMany({
    where: { candidateId: profile.id },
    orderBy: { completedAt: 'desc' },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learning &amp; Training</h1>
        <p className="mt-1 text-muted-foreground">
          Curated resources for closing a real skills gap — not a link dump. Pair this with your Gap
          Analysis in{' '}
          <Link href="/dashboard/hireability-report" className="text-primary underline underline-offset-4">
            Hireability Report
          </Link>{' '}
          to pick what actually matters for your target role.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">What you&apos;ve completed</h2>
        <p className="text-sm text-muted-foreground">
          Log courses, certifications, or projects you&apos;ve finished — this shows up on your
          Recruiter Report as real, targeted effort, not a generic list.
        </p>
        <LearningBadgeList badges={badges} />
        <LearningBadgeForm />
      </div>

      <LearningResourceBrowser categories={CATEGORIES} />
    </div>
  )
}
