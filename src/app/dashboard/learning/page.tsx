import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

export default function LearningPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Learning &amp; Training</h1>
        <p className="mt-1 text-muted-foreground">
          Curated resources for closing a real skills gap — not a link dump. Pair this with your Gap
          Analysis in{' '}
          <Link href="/dashboard/hireability-report" className="text-primary underline underline-offset-4">
            My Report
          </Link>{' '}
          to pick what actually matters for your target role.
        </p>
      </div>

      {CATEGORIES.map((category) => (
        <div key={category.title} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{category.title}</h2>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {category.resources.map((resource) => (
              <Card key={resource.name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4"
                    >
                      {resource.name}
                    </a>
                    <span
                      className={
                        resource.free
                          ? 'shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success'
                          : 'shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                      }
                    >
                      {resource.free ? 'Free' : 'Paid'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{resource.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
