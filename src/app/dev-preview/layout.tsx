import { notFound } from 'next/navigation'

// Pages being redesigned are built under here first, with sample data. Never reachable in production.
export default function DevPreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return children
}
