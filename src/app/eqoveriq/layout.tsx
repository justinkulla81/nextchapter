import localFont from 'next/font/local'

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
// Self-hosted (fontsource), not next/font/google: a Google Fonts hiccup at build time was failing production deploys.
const fraunces = localFont({ src: '../../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2', variable: '--font-fraunces', weight: '100 900', display: 'swap' })
const manrope = localFont({ src: '../../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2', variable: '--font-manrope', weight: '200 800', display: 'swap' })
const plexMono = localFont({
  src: [
    { path: '../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', weight: '400' },
    { path: '../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', weight: '500' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
})

export default function EqOverIqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable} flex flex-1 flex-col font-[family-name:var(--font-manrope)]`}>
      {children}
    </div>
  )
}
