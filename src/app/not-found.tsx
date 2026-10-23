import { AutoNotFound } from '@/components/not-found/AutoNotFound'

// Every unknown address, on the main site and the portal hosts. Static on purpose (see AutoNotFound):
// no headers() or cookies() here, or cached pages that call notFound() return 500s.
export default function NotFound() {
  return <AutoNotFound />
}
