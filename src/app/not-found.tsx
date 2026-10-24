import { NotFoundView } from '@/components/not-found/NotFoundView'

// Every unknown address, on the main site and the portal hosts. This must stay static: reading headers or the
// session here turns every ISR page that calls notFound() (/jobs/<id>, /layoffs/company/<slug>) into a 500.
// Signed-in members get their own wording from app/dashboard/not-found.tsx.
export default function NotFound() {
  return <NotFoundView audience="public" homeHref="/" homeLabel="Go to the home page" reportHref="https://launchyournextchapter.com/contact" />
}
