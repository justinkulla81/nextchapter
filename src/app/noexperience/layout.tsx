import localFont from 'next/font/local'

// Scoped to /noexperience only, not the root layout — this route deliberately
// runs a completely different visual system from the rest of the site (see
// the Crucible build spec §6), so its fonts are loaded here rather than
// added to every page's <html> class the way Inter/Source Serif 4 are.
// /noexperience/test onward switches back to the main NC system (Inter/Source
// Serif 4, already loaded globally) via the .crucible-landing scoping class
// only being applied on the landing page itself.
const unbounded = localFont({ src: '../../../node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2', variable: '--font-unbounded', weight: '200 900', display: 'swap' })
const archivo = localFont({ src: '../../../node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', variable: '--font-archivo', weight: '100 900', display: 'swap' })
const jetbrainsMono = localFont({ src: '../../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', variable: '--font-jetbrains-mono', weight: '100 800', display: 'swap' })

export default function CrucibleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${unbounded.variable} ${archivo.variable} ${jetbrainsMono.variable} flex flex-1 flex-col`}>
      {children}
    </div>
  )
}
