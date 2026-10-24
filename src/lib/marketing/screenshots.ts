import type { PortalVisual } from '@/components/marketing/PortalMarketingPage'
import manifest from './screenshots.generated.json'

// The partner pages' screenshots. public/marketing/<name>.webp and the sizes in screenshots.generated.json are written by
// scripts/marketing/render-screenshots.mjs from the sample-data previews under src/app/dev-preview. Every one of them is
// sample data (invented people, companies and counts), and the page says so next to each image.

type ShotName = keyof typeof manifest

/** A page visual: the rendered preview plus its alt text, title and the one-sentence reason it is shown. */
export function shot(name: ShotName, copy: { title: string; alt: string; why: string }): PortalVisual {
  const m = manifest[name]
  return { src: m.src, width: m.width, height: m.height, ...copy }
}
