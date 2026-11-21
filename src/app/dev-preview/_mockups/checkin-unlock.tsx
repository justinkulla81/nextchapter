import { UnlockView } from '@/components/higher-ed/CheckInAnswerForm'
import type { Unlocks } from '@/lib/higher-ed/checkin-unlocks'

// The college check-in's third step (src/app/i/[slug]/checkin/[id]): what the answer unlocked, and what the college
// sees. W&J sample data: an alum who answered "I'm looking to change jobs or fields", a whole new field, teaching.
const CHANGING: Unlocks = {
  headline: 'Washington & Jefferson College has your back. Here’s what’s yours now.',
  primary: { label: 'Get your plan and résumé grade', href: '#' },
  cards: [
    { key: 'program:mat', title: 'Master of Arts in Teaching (MAT)', detail: '$21,000', href: '#', office: 'Graduate and Continuing Studies' },
    { key: 'career_pivots', title: 'Career pivot paths', detail: 'Where people with your background moved next, the skills each move takes, and alumni who made it.', href: '#', office: 'Center for Career Advising and Networking' },
    { key: 'career_services', title: 'Career services', detail: 'A counselor, early-career check-ins and appointments, through five years after graduation.', href: '#', office: 'Center for Career Advising and Networking' },
    { key: 'alumni_network', title: 'Alumni network', detail: 'Mentors who’ll take a call, warm introductions, and jobs at companies where alumni work.', href: '#', office: 'Office of Alumni Engagement' },
  ],
  sees: [
    { office: 'Center for Career Advising and Networking', what: 'An advisor will follow up with you.' },
    { office: 'Graduate and Continuing Studies', what: 'Sees the field you want, so its programs can reach you.' },
    { office: 'Office of Development', what: 'No donation asks while you search.' },
  ],
}

export function CheckInUnlock() {
  return (
    <div className="min-h-screen bg-background" style={{ ['--primary' as string]: '#A4343A', ['--primary-foreground' as string]: '#ffffff' }}>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
        <p className="font-semibold">W&amp;J NextChapter</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dana, has anything changed?</h1>
        <UnlockView unlocks={CHANGING} college="Washington & Jefferson College" slug="washjeff" answer="looking" />
        <p className="text-xs text-muted-foreground">Only Washington &amp; Jefferson College sees your answer.</p>
      </main>
    </div>
  )
}
