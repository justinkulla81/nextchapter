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
      lede="A free, read-only Model Context Protocol server that lets an AI assistant search current professional job openings with AI exposure and employer layoff signals, score a résumé, look up recent layoff notices, unemployment benefits by state, programs for laid-off workers and AI exposure by job title, and find our career guides on layoffs and job search. Public data only: no account, nothing personal."
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
            <li><strong>search_jobs</strong>: call when someone wants job openings. Current professional openings from our own deduplicated board, newest first; no hourly or internship roles and no login. Inputs: query, location, remote, level (entry, early, mid, senior, manager, director, vp). Returns title, company, location, posted date, annual pay when listed, level, how much of that occupation’s work AI is already used for, the employer’s layoff notices in the last 12 months, our page and the employer’s own apply link.</li>
            <li><strong>score_resume</strong>: call when someone shares or asks about a résumé. Scores plain résumé text out of 100 with fixed rules (no AI, same text, same score) and returns pass, partial or fail for eleven checks with the exact fix for each. The assistant does the rewriting. The text is scored once and not stored.</li>
            <li><strong>recent_layoff_notices</strong>: layoff notices (WARN Act filings) from state labor departments, newest first. Inputs: employer, state, days back, limit. Returns the employer, place, workers named, filing date, the state record and our page to link to. Free to cite under CC BY 4.0 with a link back.</li>
            <li><strong>unemployment_benefits_by_state</strong>: unemployment insurance basics for a state. Input: state. Returns the agency and where to file, maximum and minimum weekly benefit, maximum weeks, waiting week, how severance and pay in lieu of notice are treated, and the work-search rule, each with its official source and the date it was checked.</li>
            <li><strong>laid_off_benefits_and_programs</strong>: verified programs for a laid-off professional: health-coverage and cost relief, relocation money, retraining and tuition funds, tax credits and free courses. Inputs: state, goal (support, move, retrain, tax, learn), limit. Returns the amount, who is eligible, status, the official page and the date it was last checked.</li>
            <li><strong>ai_exposure_for_job_title</strong>: how much of a job’s work AI is already used for, matched from a job title, from the Anthropic Economic Index. Input: title. Returns the matched occupation, exposure share and band, median pay, growth, yearly openings, related jobs that pay more or are less exposed, and a link to the full <Link className="text-brand underline underline-offset-4" href="/tools/ai-job-check">AI job check</Link>.</li>
            <li><strong>find_career_guide</strong>: our plain-language guides, matched to a question such as “how do I negotiate severance”. Returns the guide title, a short answer and its link.</li>
          </ul>
        </section>
        <section>
          <h2 className={H2}>Limits and scope</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground">
            <li>Read-only. The server never writes data and never sees a user’s profile.</li>
            <li>US professional roles. Hourly and internship roles and confidential listings are not included.</li>
            <li>Job searches, résumé scores and AI exposure lookups are limited per network address each hour. For more, browse the <Link className="text-brand underline underline-offset-4" href="/jobs">job board</Link>.</li>
          </ul>
        </section>
        <ActionBand title="Prefer to browse?" body="The same openings are on the job board, free to search without an account." label="Search jobs" href="/jobs" event="mcp_page_jobs_clicked" properties={{ source: 'mcp_page' }} />
      </div>
    </SeoPage>
  )
}
