import { notFound } from 'next/navigation'
import { mockupFor } from '../_mockups/registry'

export default async function MockupPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const m = mockupFor(slug.join('/'))
  if (!m) notFound()
  return <m.Component />
}
