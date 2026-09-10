import Link from 'next/link'
import { Logo } from '@/components/Logo'

const MESSAGES: Record<string, { title: string; body: React.ReactNode }> = {
  still_searching: {
    title: 'Good luck this week.',
    body: 'Thanks for letting us know — keep going. Your dashboard has your latest action plan whenever you’re ready.',
  },
  taking_a_break: {
    title: "Got it — take the time you need.",
    body: "We'll ease off for now and check back in later. Your account and progress stay exactly as they are.",
  },
  got_an_offer: {
    title: 'Congratulations! 🎉',
    body: (
      <>
        That&apos;s great news. Head to{' '}
        <Link href="/dashboard/got-hired" className="underline underline-offset-4">
          Got An Offer
        </Link>{' '}
        on your dashboard to log it — you may also qualify for the $500 Hired Bounty.
      </>
    ),
  },
  invalid: {
    title: 'This link isn’t valid',
    body: 'Double check the link from your email, or just head to your dashboard directly.',
  },
}

export default async function CheckInThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ answer?: string; status?: string }>
}) {
  const { answer, status } = await searchParams
  const key = status === 'invalid' ? 'invalid' : (answer ?? 'invalid')
  const message = MESSAGES[key] ?? MESSAGES.invalid

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="mb-8">
        <Logo className="text-2xl" />
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">{message.title}</h1>
      <p className="mt-2 text-muted-foreground">{message.body}</p>
      <Link href="/dashboard" className="mt-6 text-sm font-medium text-primary underline underline-offset-4">
        Go to my dashboard →
      </Link>
    </div>
  )
}
