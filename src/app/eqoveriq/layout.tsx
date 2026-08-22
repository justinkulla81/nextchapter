import { Fraunces, Manrope, IBM_Plex_Mono } from 'next/font/google'

// Scoped to /eqoveriq only, not the root layout — same technical pattern
// as CrucibleLayout (src/app/noexperience/layout.tsx): this product runs
// its own visual system, so its fonts are loaded here rather than added to
// every page's <html> class the way Inter/Source Serif 4 are. Typeface
// choices are deliberately different from NEN's (Unbounded/Archivo/
// JetBrains Mono, tuned for a high-energy teaser challenge) — Fraunces
// gives EQoverIQ's headlines gravitas rather than neon, Manrope is a clean
// professional body/UI sans, and Plex Mono is reserved for small technical
// labels only (e.g. interest-area tags), matching Mercor/Micro1's
// understated, credibility-first tone rather than NEN's high-energy one.
const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], weight: ['500', '600'] })
const manrope = Manrope({ variable: '--font-manrope', subsets: ['latin'] })
const plexMono = IBM_Plex_Mono({ variable: '--font-plex-mono', subsets: ['latin'], weight: ['400', '500'] })

export default function EqOverIqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable} flex flex-1 flex-col font-[family-name:var(--font-manrope)]`}>
      {children}
    </div>
  )
}
