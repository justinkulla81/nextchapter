import { Unbounded, Archivo, JetBrains_Mono } from 'next/font/google'

// Scoped to /crucible only, not the root layout — this route deliberately
// runs a completely different visual system from the rest of the site (see
// the Crucible build spec §6), so its fonts are loaded here rather than
// added to every page's <html> class the way Inter/Source Serif 4 are.
// /crucible/test onward switches back to the main NC system (Inter/Source
// Serif 4, already loaded globally) via the .crucible-landing scoping class
// only being applied on the landing page itself.
const unbounded = Unbounded({ variable: '--font-unbounded', subsets: ['latin'], weight: ['500', '700', '900'] })
const archivo = Archivo({ variable: '--font-archivo', subsets: ['latin'] })
const jetbrainsMono = JetBrains_Mono({ variable: '--font-jetbrains-mono', subsets: ['latin'] })

export default function CrucibleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${unbounded.variable} ${archivo.variable} ${jetbrainsMono.variable} flex flex-1 flex-col`}>
      {children}
    </div>
  )
}
