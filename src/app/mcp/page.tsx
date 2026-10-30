import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionBand, H2, SeoPage } from '@/components/seo/SeoPage'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { SITE_URL } from '@/lib/seo/facts'

const PATH = '/mcp'
export const metadata: Metadata = pageMetadata(PATH)

const ENDPOINT = `${SITE_URL}/api/mcp`

export default function McpPage() {
  const h1 = pageH1(PATH, 'NextChapter MCP server')
  return (
    <SeoPage
      trail={[{ name: 'MCP server', path: PATH }]}
      h1={h1}
      lede="A free, read-only Model Context Protocol server that lets an AI assistant search current professional job openings, look up recent layoff notices, and find our career guides on layoffs and job search. Public data only: no account, nothing personal."
    >
      <div className="mt-10 max-w-3xl space-y-10">
        <section>
          <h2 className={H2}>Connect</h2>
          <p className="mt-3 text-base leading-relaxed text-foreground">
            Add this URL as a remote MCP server in any client that supports Streamable HTTP, such as Claude (custom connector) or an agent built on an MCP SDK. No key is needed.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-off-white p-3 text-sm">{ENDPOINT}</pre>
        </section>
        <section>
          <h2 className={H2}>Tools</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground">
            <li><strong>search_jobs</strong>: current professional openings, newest first. Inputs: query (words in the title or company), location, remote. Returns title, company, location, posted date, pay when listed and a link.</li>
            <li><strong>recent_layoff_notices</strong>: layoff notices (WARN Act filings) from state labor departments, newest first. Inputs: employer, state, days back, limit. Returns the employer, place, workers named, filing date, the state record and our page to link to. Free to cite under CC BY 4.0 with a link back.</li>
            <li><strong>find_career_guide</strong>: our plain-language guides, matched to a question such as “how do I negotiate severance”. Returns the guide title, a short answer and its link.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>Limits and scope</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground">
            <li>Read-only. The server never writes data and never sees a user’s profile.</li>
            <li>US professional roles. Hourly and internship roles and confidential listings are not included.</li>
            <li>Job searches are limited per network address each hour. For more, browse the <Link className="text-brand underline underline-offset-4" href="/jobs">job board</Link>.</li>
          </ul>
        </section>
        <ActionBand title="Prefer to browse?" body="The same openings are on the job board, free to search without an account." label="Search jobs" href="/jobs" event="mcp_page_jobs_clicked" properties={{ source: 'mcp_page' }} />
      </div>
    </SeoPage>
  )
}
