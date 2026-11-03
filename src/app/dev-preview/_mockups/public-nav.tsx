import { SiteNavMega } from '@/components/marketing/SiteNavMega'
import { SiteFooterColumns } from '@/components/marketing/SiteFooterColumns'

// Preview of the public site's new header and footer (replaces SiteNav in PublicSiteChrome.tsx). The page below the
// header is a stand-in for any public page; nothing here is live data.

export function PublicNavPreview() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white">
        <SiteNavMega />
      </header>
      <main className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-navy">Any public page sits here</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Open a menu in the header above to see the groups, or shrink the window to see the phone menu.</p>
      </main>
      <footer className="bg-navy pt-12 text-white">
        <SiteFooterColumns tone="dark" />
        <p className="border-t border-white/10 px-6 py-6 text-center text-sm text-light-blue">© NextChapter · Privacy Policy · Terms of Service · Security</p>
      </footer>
    </div>
  )
}
