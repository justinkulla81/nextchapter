import Link from 'next/link'
import type { Metadata } from 'next'
import { Logo } from '@/components/Logo'
import { FAQSection } from '@/components/FAQSection'
import { FAQ_CATEGORIES } from '@/components/faq-data'
import { StructuredData } from '@/components/StructuredData'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about NextChapter — pricing, the Market Reality Grade, privacy, and how matching with employers works.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    }))
  ),
}

export default async function FAQPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isLoggedIn = !!user && !user.is_anonymous

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <StructuredData data={jsonLd} />
      <div className="flex items-center justify-between">
        <Link href={isLoggedIn ? '/dashboard' : '/'} className="inline-block">
          <Logo className="text-2xl" />
        </Link>
        {isLoggedIn && (
          <Link href="/dashboard" className="text-sm font-medium text-brand hover:text-navy">
            Dashboard
          </Link>
        )}
      </div>

      <h1 className="mt-8 text-center text-3xl font-bold tracking-tight text-navy">
        Frequently asked questions
      </h1>

      <div className="mt-12">
        <FAQSection />
      </div>
    </div>
  )
}
