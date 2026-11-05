import { ogPoster, POSTER_SIZE } from '@/lib/seo/og-poster'

export const alt = 'NextChapter layoff tracker'
export const size = POSTER_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

/** The share card for the layoffs hub, which the BLS release posts and the pinned intro link to. */
export default function Image() {
  return ogPoster({ seed: 'layoffs-hub', kicker: 'Layoff tracker', big: 'Layoffs', unit: 'notices, as filed', title: 'Who is laying off workers, and where' })
}
