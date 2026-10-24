import type { ReactNode } from 'react'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ShowMore } from '@/components/candidate/ShowMore'
import { Callout } from '@/components/candidate/Callout'

export const APPLY_HELPER_ZIP = '/downloads/nextchapter-apply-helper.zip'

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-border p-5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{n}</span>
      <div className="space-y-2 text-base text-ink">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </li>
  )
}

// The Apply Helper install page. `connect` is the "get my connect code" control: the real one on the dashboard
// page, a sample in the dev preview.
export function ApplyHelperPage({ connect }: { connect: ReactNode }) {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Fill in job applications in seconds"
        intro="A free Chrome add-on that types your name, contact details, current job and résumé into Greenhouse, Ashby and Lever application forms. You check everything and press Submit yourself, and it saves each application to My jobs."
        action={<ActionLink href={APPLY_HELPER_ZIP} kind="primary" event="apply_helper_download_clicked">Download the helper</ActionLink>}
      />

      <ol className="space-y-4">
        <Step n={1} title="Add it to Chrome">
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Download the file above. Open it so you have a folder called <b>nextchapter-apply-helper</b> (double-click the zip).</li>
            <li>In Chrome, type <b>chrome://extensions</b> in the address bar.</li>
            <li>Turn on <b>Developer mode</b> (top right), click <b>Load unpacked</b>, and choose that folder.</li>
            <li>Click the puzzle-piece icon in Chrome and pin <b>NextChapter Apply Helper</b>.</li>
          </ol>
        </Step>
        <Step n={2} title="Sign in to it">
          <p className="text-muted-foreground">The helper needs a code that proves it is you. Get one here, open the helper from the puzzle-piece icon, paste the code and click Connect. The code works for 30 days; come back for a new one after that.</p>
          {connect}
        </Step>
        <Step n={3} title="Use it on an application">
          <p className="text-muted-foreground">Open an application on Greenhouse, Ashby or Lever. A small box appears in the bottom corner. Click <b>Fill from my profile</b>, then read every answer, fill in the rest yourself and press Submit. When the employer shows its confirmation, the job is added to My jobs as applied.</p>
        </Step>
      </ol>

      <ShowMore page="apply_helper" label="Turning it off, what it can't do, and the Chrome Web Store">
        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-ink">Turn it off</h2>
          <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">
            <li><b>Pause it:</b> open the helper from the puzzle-piece icon and untick &ldquo;Helper is on&rdquo;. The box stops appearing.</li>
            <li><b>Sign out of it:</b> click &ldquo;Disconnect this browser&rdquo; in the same place. It forgets your code.</li>
            <li><b>Remove it:</b> go to chrome://extensions and click Remove.</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-ink">What it can&apos;t do</h2>
          <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">
            <li>It works on Greenhouse, Ashby and Lever pages only. Workday, iCIMS, Taleo, LinkedIn Easy Apply and company-built forms are not supported.</li>
            <li>It never presses Submit and never writes answers for you. Essay questions, salary, work authorization and diversity questions are left blank on purpose.</li>
            <li>Dropdown fields where you pick from a list (country, and location on some forms) are left for you to pick.</li>
            <li>It fills only what your profile has. If a field is empty on NextChapter, it stays empty on the form.</li>
            <li>Forms change. If a field is missed, type it yourself; the rest still works.</li>
            <li>Chrome only for now (Edge and Brave also load it the same way).</li>
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-ink">When it is in the Chrome Web Store</h2>
          <Callout>Today you load it from the downloaded folder because the Chrome Web Store listing is not live yet. Once it is, the steps become one click on Add to Chrome: no download, no Developer mode, and Chrome updates it for you. The connect code step stays the same.</Callout>
        </section>
      </ShowMore>
    </div>
  )
}
