// AUTO-EXTRACTED verbatim from the authored report HTML (incoming-report/
// displacement-report-september-2026.html), body only, by scripts/displacement/port-report.mjs. Links already
// point at /reports/*. Charts render into the empty .plot divs via
// public/reports/report-charts.js. Interactive pieces (Logo, newsletter slot,
// PDF gate) are layered on by ReportEnhancements via the ids/classes below.
export const REPORT_BODY_HTML = `<header class="cover">
  <div class="cover-in">
    <div class="cover-top">
      <div class="brand-wrap"><span class="wordmark">NextChapter</span><span class="brand-sub">Research</span></div>
      <div class="eyebrow">Monthly labor market report · Vol. 1, No. 1</div>
    </div>
    <div class="eyebrow">The NextChapter Displacement Report · September 2026</div>
    <h1>Fewer layoffs, longer searches</h1>
    <p class="dek">The white-collar labor market in September 2026: hiring stalled, announced layoffs fell, and long-term unemployment among managers and professionals rose by about a third from a year earlier.</p>
    <div class="cover-stats">
      <div><span class="v">0.75%</span><span class="l">White-collar labor force unemployed 27+ weeks, Jan–Aug 2026 (0.56% in 2025)</span></div>
      <div><span class="v">162</span><span class="l">White-Collar Long-Term Unemployment Index, Aug 2026 (2019 = 100, seasonally adjusted)</span></div>
      <div><span class="v">27.1%</span><span class="l">Share of all unemployed out 27+ weeks, Sep 2026 (23.6% a year ago)</span></div>
      <div><span class="v">+29K</span><span class="l">Jobs added in September; unemployment rate 4.2%</span></div>
    </div>
    <div class="cover-meta"><span>Published October 5, 2026</span><span>Reference period: September 1–30, 2026</span><span>Version 1.72</span><span>Source data available through October 2, 2026 (CPS microdata through August)</span><span>Justin Kulla, Founder and CEO · <a href="mailto:jkulla@launchyournextchapter.com" style="color:inherit">jkulla@launchyournextchapter.com</a></span></div>
    <div class="actions">
      <a class="btn" id="pdf-btn" href="/reports/displacement-report-2026-09.pdf" download="NextChapter-Displacement-Report-September-2026.pdf"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10"/></svg>Full report (PDF, 50 pages)</a>
      <a class="btn ghost" id="brief-btn" href="/reports/displacement-report-2026-09-brief.pdf" download="NextChapter-Displacement-Report-September-2026-Brief.pdf">Brief (PDF, 11 pages)</a>
      <a class="btn ghost" href="#method">Methodology</a>
      <a class="btn ghost" href="/reports/displacement-report-2026-09-data.csv" id="csv-btn" download>Data (CSV)</a>
    </div>
    <p style="margin:0;font-size:.8rem"><a id="pdf-direct" href="/reports/displacement-report-2026-09.pdf" download style="color:var(--muted);text-underline-offset:2px">Media or researcher? Download the PDF directly →</a></p>
    <div class="status" id="dl-status" role="status"></div>
  </div>
</header>

<div class="wrap">
<div class="grid">
<nav class="toc" aria-label="Contents">
  <div class="eyebrow">Contents</div>
  <ol>
    <li><a href="#disclosure"><span class="n">—</span>About this report</a></li>
    <li><a href="#limits"><span class="n">—</span>What this report does not establish</a></li>
    <li><a href="#evidence"><span class="n">—</span>Evidence hierarchy</a></li>
    <li><a href="#summary"><span class="n">—</span>Executive summary</a></li>
    <li><a href="#index"><span class="n">01</span>Long-Term Unemployment Index</a></li>
    <li><a href="#jobs"><span class="n">02</span>Jobs and hiring</a></li>
    <li><a href="#layoffs"><span class="n">03</span>Layoffs and AI attribution</a></li>
    <li><a href="#concentrated"><span class="n">04</span>Long searches by group</a></li>
    <li><a href="#research"><span class="n">05</span>What researchers find</a></li>
    <li><a href="#longterm"><span class="n">06</span>Long-term and age</a></li>
    <li><a href="#older"><span class="n">07</span>Older workers</a></li>
    <li><a href="#applying"><span class="n">08</span>Applying in 2026</a></li>
    <li><a href="#skills"><span class="n">09</span>Skills, careers and colleges</a></li>
    <li><a href="#jobsfuture"><span class="n">10</span>Jobs created and destroyed</a></li>
    <li><a href="#newbiz"><span class="n">11</span>New businesses</a></li>
    <li><a href="#geography"><span class="n">12</span>States</a></li>
    <li><a href="#safetynet"><span class="n">13</span>Safety net and retraining</a></li>
    <li><a href="#context"><span class="n">14</span>New grads and blue-collar</a></li>
    <li><a href="#outlook"><span class="n">15</span>What to watch</a></li>
    <li><a href="#q3"><span class="n">Q3</span>Q3 2026 addendum</a></li>
    <li><a href="#feature-history"><span class="n">—</span>Feature: history of automation</a></li>
    <li><a href="#feature-remote"><span class="n">—</span>Feature: remote work</a></li>
    <li><a href="#feature-rewiring"><span class="n">—</span>Feature: the rewiring constraint</a></li>
    <li><a href="#agenda"><span class="n">—</span>Future research agenda</a></li>
    <li><a href="#faq"><span class="n">—</span>FAQ</a></li>
    <li><a href="#pilot"><span class="n">A</span>Experimental measures</a></li>
    <li><a href="#method"><span class="n">B</span>Methodology</a></li>
    <li><a href="#sources"><span class="n">C</span>Sources</a></li>
    <li><a href="#audit"><span class="n">D</span>Revision audit</a></li>
    <li><a href="#subscribe"><span class="n">—</span>Subscribe</a></li>
    <li><a href="#about"><span class="n">—</span>About NextChapter</a></li>
  </ol>
</nav>

<main>

<section id="disclosure" class="no-break-before" aria-label="About this report">
  <div class="box disclose">
    <div class="eyebrow">About this report and its independence</div>
    <p><strong>Commercial disclosure.</strong> This report is produced by NextChapter, a commercial company that sells career-transition software and services to professionals, employers and workforce programs. No individual-level NextChapter user or customer data are used in the analysis; findings are based on identified public and third-party sources. To keep the analysis separate from that interest:</p>
    <ul>
      <li>All figures come from public sources or from NextChapter calculations on public data, with methods and data files published. No NextChapter customer data is used in any statistic.</li>
      <li>The measures reported each month are fixed in advance (see Appendix B), whether they move up or down.</li>
      <li>Survey-based estimates carry 90% margins of error, and changes are flagged only when they exceed that margin; margins use the Bureau of Labor Statistics' published variance method for the CPS.</li>
      <li>Information about NextChapter's services appears only in the final "About NextChapter" section.</li>
    </ul>
    <p class="note">Author: Justin Kulla, Founder and CEO of NextChapter (jkulla@launchyournextchapter.com); former CTO of Edgenuity and private-equity investor. No outside funding. This edition was not externally peer reviewed; we welcome corrections at the address in Appendix B.</p>
  </div>
</section>

<section id="limits" class="no-break-before" aria-label="What this report does and does not establish">
  <div class="box">
    <div class="eyebrow">What this report does and does not establish</div>
    <p style="margin:6px 0 8px">This report <strong>measures</strong> labor-market conditions for white-collar workers, <strong>describes associations</strong> between them and other trends, and <strong>reports what companies say</strong> about their reasons. It does not establish:</p>
    <ul>
      <li>that AI caused the rise in long-term unemployment among managers and professionals;</li>
      <li>that AI caused any particular layoff, unless the company itself says so, and even then a company's stated reason is not proof of cause;</li>
      <li>that AI will produce mass unemployment, or that productivity gains necessarily reduce employment;</li>
      <li>that higher revenue per employee at large companies reflects AI rather than pricing, interest rates, acquisitions or earlier overhiring;</li>
      <li>that the volume of job applications, or longer searches, are caused by AI.</li>
    </ul>
    <p class="note" style="margin:8px 0 0">Throughout, we distinguish measurement, association, attribution (what a company or survey respondent says) and causality, and we label each figure as source-reported, a NextChapter calculation, a NextChapter estimate or a hypothesis. Concepts we cannot yet measure rigorously are listed in the Future Research Agenda without numbers.</p>
  </div>
</section>
<section id="evidence" class="no-break-before" aria-label="How much weight each source can bear">
  <div class="box">
    <div class="eyebrow">Evidence hierarchy: how much weight each source can bear</div>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Type of evidence</th><th>Examples in this report</th><th>What it can establish</th></tr></thead>
      <tbody>
        <tr><td>1. Government statistics</td><td>BLS jobs report, JOLTS, Census CPS, Displaced Worker Survey</td><td>Observed labor-market conditions, with known sampling error</td></tr>
        <tr><td>2. NextChapter calculations on public data</td><td>Long-Term Unemployment Index, breakdowns by occupation and age, revenue per employee</td><td>Derived indicators; methods, code and margins of error published</td></tr>
        <tr><td>3. Corporate filings</td><td>SEC Form 8-K and 10-K</td><td>What companies formally disclose, not why they act</td></tr>
        <tr><td>4. Peer-reviewed and university research</td><td>Stanford, MIT, Harvard, Oxford, NBER, Brookings</td><td>Patterns and, where the design supports it, causal estimates</td></tr>
        <tr><td>5. Employer announcements and business surveys</td><td>Challenger, Federal Reserve and CFO surveys, NFIB</td><td>What employers say they did or expect to do</td></tr>
        <tr><td>6. Private-platform data</td><td>Greenhouse, Ashby, LinkedIn, Indeed, vendor surveys</td><td>Behavior on one company's platform; not representative; often from firms with a commercial interest</td></tr>
        <tr><td>7. Qualitative observations</td><td>Field notes (Appendix A)</td><td>Hypotheses only</td></tr>
      </tbody>
    </table></div>
    <p class="note" style="margin:0">Throughout the report, labels mark which parts are <span class="lbl m">What we measure</span> (our calculations), <span class="lbl o">What others find</span> (other researchers and data providers) and <span class="lbl i">What this may mean</span> (interpretation).</p>
  </div>
</section>



<section id="summary" class="no-break-before" aria-labelledby="h-sum">
  <div class="chapter-head"><div class="eyebrow">Executive summary</div><h2 id="h-sum">A low-hire, low-fire market that is hardest on people already out of work</h2></div>
  <p class="lead">Most managers and professionals who have jobs are keeping them: announced layoffs are down from 2025 and white-collar unemployment, though up slightly, remains under 3%. But hiring nearly stalled in September, and people who do lose white-collar jobs are staying out much longer. Long-term unemployment among managers and professionals averaged 0.75% of the white-collar labor force in January–August 2026, up from 0.56% a year earlier and 0.47% in 2019. That one-year increase is larger than its 90% margin of error.</p>
  <p>The question running through this report: is the main labor-market consequence of AI for experienced professionals not mass unemployment but a slower, harder transition between jobs, from job loss to a longer search, sometimes a step down, retraining and a change of occupation? Our data can measure the search; they cannot yet say how much of it AI explains.</p>

  <div class="findings">
    <div class="up">
      <h3>What's better</h3>
      <ul>
        <li>Announced layoffs are down 15% from 2025 excluding government (down 39% including the 2025 federal cuts). <a class="src" href="https://www.challengergray.com/blog/job-cuts-fall-in-september-hiring-plans-up-3-over-2025-on-weak-early-seasonal-hiring/">Challenger</a></li>
        <li>Unemployment for college graduates 25 and older is 2.5%, down from 2.8%. <a class="src" href="https://www.bls.gov/news.release/empsit.htm">BLS</a></li>
        <li>There is about one job opening per unemployed person (1.01), up from 0.94 a year ago. <a class="src" href="https://www.bls.gov/news.release/jolts.htm">JOLTS</a></li>
        <li>New jobless claims are low: 197,000 a week, versus 225,000 a year ago. <a class="src" href="https://www.dol.gov/ui/data.pdf">DOL</a></li>
        <li>Job growth this year (+612,000 through September) is ahead of 2025's pace. <a class="src" href="https://fred.stlouisfed.org/series/PAYEMS">FRED</a></li>
        <li>People who change jobs are getting 5.0% raises, versus 3.6% for those who stay. <a class="src" href="https://www.atlantafed.org/chcs/wage-growth-tracker">Atlanta Fed</a></li>
        <li>Business applications are up 11% from a year ago, and AI is making it cheaper to start a company. <a class="src" href="https://www.census.gov/econ/bfs/index.html">Census BFS</a></li>
        <li>Professionals who keep their jobs are not being pushed into involuntary part-time work, second jobs or self-employment: among employed white-collar workers, all three shares are flat or lower than in 2025. The adjustment is happening at the hiring gate, not inside jobs. <a class="src" href="#hidden">Ch. 01</a></li>
          <li>Skilled trades are short of workers, with construction pay up 4.3% over the year. <a class="src" href="https://www.bls.gov/news.release/empsit.t24.htm">BLS B-8</a></li>
      </ul>
    </div>
    <div class="down">
      <h3>What's worse</h3>
      <ul>
        <li>Long-term unemployment among white-collar workers is up about a third from a year ago (beyond margin of error). <a class="src" href="#index">Ch. 01</a></li>
        <li>27.1% of all unemployed people have been looking 27 weeks or more, up from 23.6%. <a class="src" href="https://www.bls.gov/news.release/empsit.htm">BLS</a></li>
        <li>Hiring nearly stalled: +29,000 jobs in September, and July was revised to a loss. With immigration sharply lower, Federal Reserve estimates of the job growth needed to hold unemployment steady have fallen to between under 10,000 and 87,000 a month, so this is slow growth rather than a collapse. <a class="src" href="https://www.bls.gov/news.release/empsit.htm">BLS</a></li>
        <li>Employment of customer service representatives, the occupation built most around scripted conversation, fell about 8% from 2025 (−206,000 ±111,000), consistent with, but not proof of, AI taking over routine service conversations. <a class="src" href="#turing">Feature</a></li>
          <li>Since 2022, essentially all net job growth among adults went to bachelor's-degree holders (+4.5 million), yet their long-term unemployment rate rose more than others' (0.57% to 0.88%, beyond margin of error); this year it rose fastest for master's holders and for degree holders with 25+ years of experience. <a class="src" href="#core">Ch. 06</a></li>
          <li>Student debt is a growing strain for people between jobs: 10.6% of student-loan balances are 90+ days delinquent and 9.3 million federal borrowers are in default, and unemployment deferment ends for new loans from July 2027. <a class="src" href="#debt">Ch. 09</a></li>
          <li>Each job opening yields fewer hires: 0.73 hires per opening in January–August 2026, against 0.82 in 2019 and more than 1.1 in the early 2000s. <a class="src" href="https://www.bls.gov/news.release/jolts.htm">JOLTS</a></li>
        <li>Information (−120,000) and financial activities (−107,000) lost jobs over the year. <a class="src" href="https://www.bls.gov/news.release/empsit.htm">BLS</a></li>
        <li>Among unemployed white-collar workers aged 55–64, 39% have been out 27+ weeks, up from 27% (beyond margin of error). <a class="src" href="#longterm">Ch. 06</a></li>
        <li>About 39% of people on unemployment insurance exhaust their benefits. <a class="src" href="https://oui.doleta.gov/unemploy/data_summary/DataSum.asp">DOL ETA</a></li>
        <li>Only 57% of long-tenured workers aged 55–64 who were displaced in 2023–2025 were re-employed by January 2026, against 73% of those 25–54. <a class="src" href="https://www.bls.gov/news.release/disp.nr0.htm">BLS DWS</a></li>
          <li>The rise in long searches is among U.S.-born professionals: 0.73% of U.S.-born white-collar workers were out 27+ weeks, up from 0.52% (beyond margin of error). The noncitizen share of the white-collar workforce did not grow, so new immigration does not explain the rise. <a class="src" href="#immigration">Ch. 04</a></li>
        <li>Unemployment for recent college graduates is 1.5 points above 2019, narrowing the degree advantage. <a class="src" href="#context">Ch. 14</a></li>
          <li>Public retraining is small and flat: the federal Dislocated Worker program served about 187,000 people in its latest year, and about one in five received training. <a class="src" href="#safetynet">Ch. 13</a></li>
      </ul>
    </div>
  </div>
    <div class="box" style="margin:16px 0 0">
    <div class="eyebrow">Q3 2026 quarterly addendum: highlights</div>
    <ul style="margin:8px 0 0">
      <li><strong>Growth without hiring at large employers.</strong> Across 27 of the largest white-collar employers, revenue rose 40% from fiscal 2022 to the latest fiscal year while combined headcount fell 1% (NextChapter calculation from 10-Ks; nominal, and not evidence that AI replaced workers). <a class="src" href="#q3">Q3</a></li>
      <li><strong>Firms expect growth without headcount.</strong> In the Q3 CFO Survey, the median firm expects 5.0% revenue growth and 1.7% employment growth in 2026. <a class="src" href="https://www.richmondfed.org/research/national_economy/cfo_survey/data_and_results/2026/20260923_data_and_results">CFO Survey</a> AI adoption has run ahead of what firms expected; AI-related layoffs have run well behind.</li>
      <li><strong>AI in restructuring filings (corrected).</strong> 16 of 170 restructuring filings this year (9.4%) cite AI in the restructuring disclosure itself, not 2 as first reported; announced cuts cite AI about 21% of the time. Of the 14 companies, 8 say AI is changing how work is done and 6 say they are cutting to reinvest in AI.</li>
      <li><strong>No sign of AI in underlying productivity yet.</strong> Output per hour rose 2.5% in 2025, but technology-driven productivity, adjusted for how hard existing workers and equipment are being used, grew 0.3% in 2025 and −0.3% over the year to mid-2026. Most of the output-per-hour gain came from output rising while hours barely grew. <a class="src" href="#tfp">Q3</a></li>
      <li><strong>Productivity and long searches do not line up by industry.</strong> Sectors with the fastest productivity growth since 2019 show no larger rise in long searches than others (new annual feature). <a class="src" href="#q3">Q3</a></li>
      <li><strong>Reemployment is not recovery.</strong> Of long-tenured workers displaced in 2023–2025, 66% were reemployed by January 2026, and about half of those earn less than before <a class="src" href="https://www.bls.gov/news.release/disp.nr0.htm">BLS DWS</a>.</li>
      <li><strong>Organizations are being redesigned by specialists.</strong> AI labs, private-equity backers and consultancies launched AI services firms in 2026 to automate client workflows, the stage of adoption most likely to change headcount.</li>
    </ul>
  </div>
  <p class="note">"Beyond margin of error" means the change is larger than its 90% margin of error, calculated with the BLS generalized variance method; every finding in this summary also clears our earlier, more conservative approximation (Appendix B). Unmarked changes from survey microdata may reflect sampling noise.</p>
</section>

<section id="index" aria-labelledby="h-idx">
  <div class="chapter-head"><div class="eyebrow">Chapter 01</div><h2 id="h-idx">The NextChapter White-Collar Long-Term Unemployment Index</h2></div>
  <p class="lead">The index tracks long-term unemployment among managers and professionals: people whose last job was in management, business, financial or professional occupations and who have been unemployed 27 weeks or more, as a share of that labor force. It stood at <strong>162 in August 2026</strong> (2019 = 100), close to its June reading of 170, the highest since 2021.</p>
  <figure class="exhibit chart" id="fig-wci" style="margin:0">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 1</span>
    <span class="ex-title">White-Collar Long-Term Unemployment Index, January 2015 – August 2026 (2019 average = 100)</span>
    <div class="plot"></div>
    <span class="ex-note">Seasonally adjusted, 3-month moving average. Shaded band: 90% margin of error (about ±11% of the index level, BLS variance method). Gap: October 2025, not collected during the federal shutdown. Source: NextChapter calculation from U.S. Census Bureau Current Population Survey microdata.</span>
  </figure>
  <p>Two cautions shape how to read the index. First, single months are noisy: the margin of error on a single month's reading is roughly ±24 points, so August 2026 (162) is not statistically different from August 2025 (128) on its own. The eight-month comparison below is. Second, the 2019 base was the strongest labor market of the past decade. The index ran between 131 and 201 in 2015–2016, so today's level is high relative to the late 2010s, not unprecedented.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 2</span>
    <span class="ex-title">White-collar measures, January–August average</span>
    <div class="tbl"><table>
      <thead><tr><th>Measure</th><th>2026</th><th>2025</th><th>2019</th><th>Change vs 2025</th></tr></thead>
      <tbody>
        <tr><td>Long-term unemployed, % of white-collar labor force</td><td>0.75%</td><td>0.56%</td><td>0.47%</td><td>+0.18 pts* ±0.08 <span class="sig">beyond 90% MOE</span></td></tr>
        <tr><td>White-collar unemployment rate</td><td>2.7%</td><td>2.5%</td><td>2.1%</td><td>+0.18 pts* ±0.15 <span class="sig">beyond 90% MOE</span></td></tr>
        <tr><td>Unemployed white-collar workers out 27+ weeks</td><td>28.1%</td><td>22.8%</td><td>22.8%</td><td>+5.3 pts ±2.4 <span class="sig">beyond 90% MOE</span></td></tr>
        <tr><td>All unemployed workers out 27+ weeks</td><td>25.6%</td><td>22.4%</td><td>20.8%</td><td>+3.2 pts ±1.2 <span class="sig">beyond 90% MOE</span></td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Not seasonally adjusted; January–August averages compare the same months each year. ± = 90% margin of error on the change, BLS generalized variance method (Appendix B). * Changes are computed from unrounded microdata, so they can differ from the difference of the rounded figures shown. White-collar = current or most recent job in management, business and financial, or professional and related occupations (about 73 million people in the labor force). These microdata shares differ from BLS's seasonally adjusted September figure (27.1%) because they cover different months and are not adjusted. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <h3>Does the result depend on seasonal adjustment?</h3>
  <p>No. Whatever adjustment method is used, the index is 53–62% above its 2019 level and about a quarter higher than a year earlier. Our fixed seasonal factors give the highest current reading; the Census Bureau's standard X-13ARIMA-SEATS program gives the lowest.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 3</span>
    <span class="ex-title">Index under four seasonal-adjustment methods (2019 = 100)</span>
    <div class="tbl"><table>
      <thead><tr><th>Method</th><th>Aug 2025</th><th>Jun 2026</th><th>Aug 2026</th><th>Change, Aug 2025 to Aug 2026</th></tr></thead>
      <tbody>
        <tr><td>Fixed monthly factors, 3-month average (published index)</td><td>128</td><td>170</td><td>162</td><td>+26%</td></tr>
        <tr><td>X-13ARIMA-SEATS (Census Bureau), 3-month average</td><td>122</td><td>164</td><td>153</td><td>+26%</td></tr>
        <tr><td>STL decomposition, 3-month average</td><td>125</td><td>156</td><td>158</td><td>+26%</td></tr>
        <tr><td>No adjustment, 12-month moving average</td><td>120</td><td>152</td><td>154</td><td>+28%</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Each series is the white-collar long-term unemployment rate, adjusted as shown, divided by its own 2019 average. X-13 settings and code are in the replication materials. NextChapter calculation from Census CPS microdata.</span>
  </div>
  <h3>Companion measure: people who lost their jobs</h3>
  <p>The index counts everyone long-term unemployed whose last job was white-collar, including people who quit or are returning to work. Limiting it to people who lost a job (laid off, let go or whose temporary job ended) gives a measure closer to the everyday meaning of displacement. It has risen faster than the overall measure: up 76% from 2019, against 59% for all white-collar long-term unemployment. Job losers make up just over half of the white-collar long-term unemployed in both years.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 4</span>
    <span class="ex-title">White-collar job losers unemployed 27+ weeks, % of white-collar labor force, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Measure</th><th>2026</th><th>2025</th><th>2019</th><th>Change vs 2025</th><th>Change vs 2019</th></tr></thead>
      <tbody>
        <tr><td>Job losers out 27+ weeks</td><td>0.40%</td><td>0.31%</td><td>0.23%</td><td>+0.09 pts ±0.06 <span class="sig">beyond 90% MOE</span></td><td>+0.17 pts ±0.06 <span class="sig">beyond 90% MOE</span></td></tr>
        <tr><td>All white-collar long-term unemployed (for comparison)</td><td>0.75%</td><td>0.56%</td><td>0.47%</td><td>+0.18 pts ±0.08 <span class="sig">beyond 90% MOE</span></td><td>+0.28 pts ±0.08 <span class="sig">beyond 90% MOE</span></td></tr>
        <tr><td>Job losers as a share of white-collar long-term unemployed</td><td>54%</td><td>54%</td><td>48%</td><td>—</td><td>—</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Job losers = CPS reason-for-unemployment codes 1–3 (on temporary layoff, permanent or other job loss, temporary job ended). Not seasonally adjusted. 90% margins of error, BLS generalized variance method. This measure identifies people who lost jobs, not why they lost them. NextChapter calculation from Census CPS microdata.</span>
  </div>

  <h3 id="hidden">Beyond unemployment: is displacement hiding inside jobs?</h3>
  <p>Unemployment can miss displacement if workers are pushed from full-time jobs into part-time hours, second jobs or self-employment. We checked the same survey for employed managers and professionals.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 5</span>
    <span class="ex-title">Employed white-collar workers: underemployment and work arrangements, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Measure (share of employed white-collar workers)</th><th>2026</th><th>2025</th><th>2019</th><th>Change vs 2025 (±90% MOE, approximate)</th><th>All workers, 2026 / 2025</th></tr></thead>
      <tbody>
        <tr><td>Part time for economic reasons (want full-time work)</td><td>1.37%</td><td>1.39%</td><td>1.49%</td><td>−0.02 ±0.11</td><td>2.93% / 2.92%</td></tr>
        <tr><td>Holding more than one job</td><td>6.19%</td><td>6.50%</td><td>6.05%</td><td>−0.31 ±0.23 <span class="sig">beyond approx. MOE</span></td><td>5.42% / 5.48%</td></tr>
        <tr><td>Self-employed (incorporated or not), main job</td><td>11.29%</td><td>11.33%</td><td>11.74%</td><td>−0.04 ±0.31</td><td>10.07% / 10.20%</td></tr>
        <tr><td>Average hours actually worked, all jobs (those at work)</td><td>39.6</td><td>39.5</td><td>40.4</td><td>+0.01 hours</td><td>38.3 / 38.2</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">White-collar = management, business, financial and professional occupations (about 71 million employed). Not seasonally adjusted; January–August averages. Part time for economic reasons follows the BLS definition (slack work, business conditions or could find only part-time work). Self-employment and multiple jobs refer to the main job and the reference week. Margins of error are approximate: BLS publishes variance parameters for these characteristics, which we will adopt from the October edition; here we apply the total-unemployment parameters (Appendix B). The CPS cannot identify workers moved from payroll jobs to contract or fractional work for the same employer; the Contingent Worker Supplement (last fielded July 2023) is the only official source, and it is not monthly. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <div class="lbl-row"><span class="lbl m">What we measure</span></div>
  <p>None of the three measures rose. Professionals who keep their jobs are not visibly being pushed into part-time hours, second jobs or self-employment; multiple jobholding fell. Hours are below 2019 but unchanged from last year. On current data, white-collar displacement shows up where this report finds it: in how long people who lose jobs stay out of work.</p>
</section>

<section id="jobs" aria-labelledby="h-jobs">
  <div class="chapter-head"><div class="eyebrow">Chapter 02</div><h2 id="h-jobs">Jobs and hiring</h2></div>
  <p class="lead">Employers added 29,000 jobs in September, below the 84,000 economists expected (per Axios). July was revised to a loss of 10,000 and August to +133,000, a combined downward revision of 60,000. Unemployment ticked up to 4.2% as more people joined the labor force. Over the first nine months of 2026 the economy added 612,000 jobs, versus 232,000 in the same months of 2025 on current data. Weak payroll gains mean less than they used to: with net immigration sharply lower, the labor force is growing slowly, and Federal Reserve estimates of the "breakeven" job growth needed to keep unemployment steady have fallen from about 155,000 a month in 2023–24 to 85,000 in 2025, and for 2026 range from under 10,000 a month (a Federal Reserve Board low-immigration scenario) to 87,000 (St. Louis Fed, using CBO assumptions). September's gain is weak, but not far below breakeven.</p>
  <figure class="exhibit chart" id="fig-payrolls" style="margin:0">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 6</span>
    <span class="ex-title">Monthly change in nonfarm payrolls, 2026 (thousands)</span>
    <div class="plot"></div>
    <span class="ex-note">Seasonally adjusted. Source: BLS Current Employment Statistics via FRED (PAYEMS), as of October 2, 2026; NextChapter calculation of monthly changes.</span>
  </figure>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 7</span>
    <span class="ex-title">Headline labor market indicators</span>
    <div class="tbl"><table>
      <thead><tr><th>Indicator</th><th>Latest</th><th>Prior month</th><th>Year earlier</th></tr></thead>
      <tbody>
        <tr><td>Unemployment rate (U-3), Sep</td><td>4.2%</td><td>4.1%</td><td>4.4%</td></tr>
        <tr><td>Underemployment (U-6), Sep</td><td>7.6%</td><td>7.7%</td><td>8.1%</td></tr>
        <tr><td>Long-term unemployed (27+ weeks), Sep</td><td>1.94M</td><td>1.93M</td><td>1.82M</td></tr>
        <tr><td>Share of unemployed out 27+ weeks, Sep</td><td>27.1%</td><td>27.0%</td><td>23.6%</td></tr>
        <tr><td>Median / average weeks unemployed, Sep</td><td>11.5 / 24.8</td><td>11.4 / 26.3</td><td>10.1 / 24.1</td></tr>
        <tr><td>Unemployment, bachelor's degree+ (25+), Sep</td><td>2.5%</td><td>2.7%</td><td>2.8%</td></tr>
        <tr><td>Unemployment, management, professional &amp; related (NSA), Sep</td><td>2.5%</td><td>—</td><td>2.5%</td></tr>
        <tr><td>Job openings (JOLTS), Aug</td><td>7.08M</td><td>7.34M</td><td>6.92M</td></tr>
        <tr><td>Hires rate / quits rate, Aug</td><td>3.3% / 1.9%</td><td>3.2% / 1.9%</td><td>3.2% / 2.0%</td></tr>
        <tr><td>Layoffs &amp; discharges, Aug</td><td>1.64M</td><td>1.70M</td><td>1.83M</td></tr>
        <tr><td>Openings per unemployed person, Aug</td><td>1.01</td><td>1.06</td><td>0.94</td></tr>
        <tr><td>Initial jobless claims, week of Sep 26</td><td>197K</td><td>198K</td><td>225K</td></tr>
        <tr><td>Wage growth, job switchers / stayers, Aug</td><td>5.0% / 3.6%</td><td>4.4% / —</td><td>—</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Seasonally adjusted unless marked NSA. Openings per unemployed person is a NextChapter calculation from BLS levels. "—" = not shown: the occupation rate is not seasonally adjusted, so it is compared only with the same month a year earlier, and year-earlier wage-tracker values were not included in this edition. Sources: BLS Employment Situation (Oct 2, 2026); BLS JOLTS (Sep 29, 2026); DOL weekly claims (Oct 1, 2026); Federal Reserve Bank of Atlanta Wage Growth Tracker (Sep 10, 2026).</span>
  </div>
  <p>The problem for job seekers is not a wave of firings. Layoffs and discharges are near 1% of jobs. It is a slow market: few people quit, few seats open up, and employed people who switch jobs still win 1.4 points more in raises than those who stay, so displaced candidates compete with employed ones for a thin flow of openings.</p>
<h3>Each job listing now yields fewer hires</h3>
  <p>In the early 2000s employers made more hires each year than they had job openings, about 1.2 to 1.5 hires per opening. By 2019 that had fallen to 0.82, and in January–August 2026 it was 0.73: about seven hires for every ten openings. In professional and business services, the largest white-collar sector, it fell from 0.90 in 2019 to 0.79. Combined with the rise in applications per opening (Chapter 08), each listing now produces fewer hires and takes far more applicants per hire.</p>
  <figure class="exhibit chart" id="fig-hpo" style="margin:0">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 8</span>
    <span class="ex-title">Hires per job opening, 2001–2026 (annual average)</span>
    <div style="display:flex;gap:16px;font-size:.78rem;color:var(--muted);margin:2px 0 4px"><span><span style="display:inline-block;width:14px;height:2px;background:#2563a8;vertical-align:middle;margin-right:6px"></span>All industries</span><span><span style="display:inline-block;width:14px;height:2px;background:#c9711a;vertical-align:middle;margin-right:6px"></span>Professional and business services</span></div><svg viewBox="0 0 640 250" role="img" aria-label="Hires per job opening, 2001 to 2026: about 1.2 to 1.5 in the 2000s, 0.82 in 2019, 0.57 in 2022 and 0.73 in January to August 2026." style="display:block;width:100%;height:auto"><line x1="40" x2="544" y1="207.8" y2="207.8" stroke="#e2e8f0" stroke-width="1"/><text x="34" y="211.8" text-anchor="end" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">0.5</text><line x1="40" x2="544" y1="127.1" y2="127.1" stroke="#e2e8f0" stroke-width="1"/><text x="34" y="131.1" text-anchor="end" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">1.0</text><line x1="40" x2="544" y1="46.3" y2="46.3" stroke="#e2e8f0" stroke-width="1"/><text x="34" y="50.3" text-anchor="end" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">1.5</text><line x1="40" x2="544" y1="127.1" y2="127.1" stroke="#4a5568" stroke-width="1" stroke-dasharray="3 3"/><text x="548" y="131.1" font-size="10" fill="#4a5568" font-family="Inter,system-ui,sans-serif">1 hire per opening</text><text x="40.0" y="242" text-anchor="middle" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2001</text><text x="120.6" y="242" text-anchor="middle" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2005</text><text x="201.3" y="242" text-anchor="middle" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2009</text><text x="281.9" y="242" text-anchor="middle" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2013</text><text x="362.6" y="242" text-anchor="middle" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2017</text><text x="443.2" y="242" text-anchor="middle" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2021</text><text x="523.8" y="242" text-anchor="middle" font-size="11" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2025</text><polyline points="40.0,91.9 60.2,46.8 80.3,74.6 100.5,84.9 120.6,86.9 140.8,100.7 161.0,112.5 181.1,94.9 201.3,38.4 221.4,54.1 241.6,69.9 261.8,96.1 281.9,92.7 302.1,104.9 322.2,137.6 342.4,137.1 362.6,121.1 382.7,141.5 402.9,142.7 423.0,135.8 443.2,179.3 463.4,195.2 483.5,183.0 503.7,167.3 523.8,156.2 544.0,161.5" fill="none" stroke="#c9711a" stroke-width="2" stroke-linejoin="round"/><circle cx="544.0" cy="161.5" r="4" fill="#c9711a" stroke="#fff" stroke-width="2"/><polyline points="40.0,95.1 60.2,61.7 80.3,51.8 100.5,65.0 120.6,79.7 140.8,98.5 161.0,105.4 181.1,88.6 201.3,36.9 221.4,63.4 241.6,85.9 261.8,101.6 281.9,107.2 302.1,122.4 322.2,137.1 342.4,142.1 362.6,144.4 382.7,158.7 402.9,157.0 423.0,134.7 443.2,185.7 463.4,196.1 483.5,186.4 503.7,175.2 523.8,168.9 544.0,171.3" fill="none" stroke="#2563a8" stroke-width="2" stroke-linejoin="round"/><circle cx="544.0" cy="171.3" r="4" fill="#2563a8" stroke="#fff" stroke-width="2"/><text x="552.0" y="183.3" font-size="11" font-weight="600" fill="#0a0a0a" font-family="Inter,system-ui,sans-serif">All: 0.73</text><text x="552.0" y="157.5" font-size="11" fill="#0a0a0a" font-family="Inter,system-ui,sans-serif">PBS: 0.79</text><circle cx="402.9" cy="157.0" r="3.5" fill="#2563a8" stroke="#fff" stroke-width="1.5"/><text x="402.9" y="173.0" text-anchor="middle" font-size="10" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2019: 0.82</text><text x="463.4" y="212.1" text-anchor="middle" font-size="10" fill="#4a5568" font-family="Inter,system-ui,sans-serif">2022: 0.57</text></svg>
    <span class="ex-note">Annual average monthly hires divided by annual average job openings, seasonally adjusted; 2026 = January–August. 2001 begins with January. Openings are counted on the last business day of each month and hires during the month, and some hires fill jobs that were never posted, so this is a ratio of flows, not a matched placement rate. Part of the long decline likely reflects cheaper online posting and listings that are never filled. The 2022 low reflects a market in which employers could not fill openings. Source: BLS JOLTS via FRED (JTSJOL, JTSHIL, JTS540099JOL, JTS540099HIL); NextChapter calculation. Data: hires-per-opening CSV in the replication materials.</span>
  </figure>
  <figure class="exhibit chart" id="fig-industry" style="margin:0">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 9</span>
    <span class="ex-title">Change in jobs by industry, September 2025 to September 2026 (thousands)</span>
    <div class="plot"></div>
    <span class="ex-note">Seasonally adjusted. "Health care" excludes social assistance (health care and social assistance combined: +520K). Professional and business services, the largest white-collar sector, grew. Source: BLS via FRED; NextChapter calculation.</span>
  </figure>
  <p>Information and financial activities are where white-collar jobs are disappearing. Professional and business services grew by 123,000 over the year, though computer systems design lost 32,000. Federal employment is down 327,000 since December 2024.</p>
</section>

<section id="layoffs" aria-labelledby="h-lay">
  <div class="chapter-head"><div class="eyebrow">Chapter 03</div><h2 id="h-lay">Layoffs and the AI attribution gap</h2></div>
  <p class="lead">Employers announced 43,281 job cuts in September, the fewest for a September since 2022, according to Challenger, Gray &amp; Christmas. Year to date, announced cuts total 573,195, down 39% from 2025. Most of that decline reflects the 2025 federal workforce cuts falling away: excluding government, cuts are down 15%. Hiring plans were the lowest for any September since 2011.</p>
  <div class="two">
    <figure class="exhibit chart" id="fig-reasons" style="margin:0">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
      <span class="ex-label">Exhibit 10</span>
      <span class="ex-title">Top stated reasons for announced job cuts, 2026 to date</span>
      <div class="plot"></div>
      <span class="ex-note">Reasons are as stated by employers in announcements. Source: Challenger, Gray &amp; Christmas (Oct 1, 2026).</span>
    </figure>
    <figure class="exhibit chart" id="fig-cutstates" style="margin:0">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
      <span class="ex-label">Exhibit 11</span>
      <span class="ex-title">States with the most announced cuts, 2026 to date</span>
      <div class="plot"></div>
      <span class="ex-note">Source: Challenger, Gray &amp; Christmas (Oct 1, 2026).</span>
    </figure>
  </div>
  <p>Technology accounts for 165,925 announced cuts this year, 29% of the total and up 54% from 2025. Notable September announcements include Uber (about 3,300, citing fewer management layers), Workday (about 500, restructuring) and Microsoft (about 500, Xbox).</p>
  <h3>What companies say about AI versus what they file</h3>
  <p>Employers cited AI as the reason for 120,136 announced cuts this year, about 21% of the total and the most-cited reason, per Challenger. Formal filings cite it less often. We searched every 2026 SEC Form 8-K that references Item 2.05, the item public companies use to report material restructuring costs, and read every AI passage in full.</p>
  <div class="box disclose" id="correction" style="margin:0 0 14px;scroll-margin-top:80px"><p style="margin:0"><strong>Correction (Version 1.4, October 6, 2026).</strong> Versions 1.0 and 1.1 reported that only 2 of 170 restructuring filings referenced AI in the restructuring disclosure itself. That undercounted: our search used the phrase "artificial intelligence" but not the abbreviation "AI," which most companies use. The corrected count is 16 filings from 14 companies. The gap between announcements and filings is real but much smaller than we first reported. Details are in Appendix B.</p></div>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 12</span>
    <span class="ex-title">How often AI is cited: announcements versus formal filings, 2026 to date</span>
    <div class="tbl"><table>
      <thead><tr><th>Source</th><th>Cites AI</th><th>Out of</th><th>Share</th></tr></thead>
      <tbody>
        <tr><td>Challenger: announced job cuts attributed to AI (workers)</td><td>120,136</td><td>573,195</td><td>21%</td></tr>
        <tr><td>SEC 8-K filings referencing Item 2.05 that mention AI, automation or machine learning anywhere (filings)</td><td>24</td><td>170</td><td>14%</td></tr>
        <tr><td>&nbsp;&nbsp;…whose restructuring section itself cites AI as a reason or context for the plan</td><td>16</td><td>170</td><td>9.4%</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;&nbsp;…of which: AI changing how work is done / cutting to reinvest in AI (filings; from 8 / 6 companies)</td><td>10 / 6</td><td>170</td><td>5.9% / 3.5%</td></tr>
        <tr><td>New York WARN notices citing automation, first year (Mar 2025–Mar 2026)</td><td>0</td><td>160+</td><td>0%</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">The units differ: Challenger counts workers in announced cuts; the SEC rows count filings. SEC counts are distinct filings returned by EDGAR full-text search for form 8-K, January 1–September 30, 2026, for "Item 2.05" combined with "artificial intelligence", "AI", "automation", "machine learning" or "generative AI" (run October 6, 2026), every match read and coded (see the Q3 addendum for the full coding). 26 filings matched; 2 were false matches on company names. Item 2.05 covers only material exit costs at public companies, while Challenger counts all announced cuts, so the populations differ. New York figure: Hunton Andrews Kurth (May 18, 2026). NextChapter calculation except where noted.</span>
  </div>
  <p>AI is more prominent in how layoffs are announced (21% of announced cuts) than in formal restructuring filings (about 9% of filings), but both measures show AI as a real part of how companies describe restructuring in 2026. The comparison has three limits. First, the units differ, workers versus filings, so the two percentages are not directly comparable. Second, Form 8-K Item 2.05 requires companies to disclose a restructuring decision and its expected costs, not its reasons, so a filing that is silent about AI does not show AI played no role. Third, Challenger codes the reason employers give publicly, which may reflect how companies want a cut to be understood. Neither source is wrong; they measure different things, and the gap between them is worth tracking.</p>
  <div class="box" style="margin:14px 0 0"><div class="eyebrow">Emerging AI layoff-disclosure rules</div><p style="margin:6px 0 0">California's SB 951, signed September 30, 2026 and effective January 1, 2027, will require Cal-WARN layoff notices to state when a mass layoff is caused "in whole or in substantial part" by AI or other automated technology, including how many jobs, which functions and what kind of technology, and requires the state to publish quarterly summaries (Littler, Oct 2026). New York has asked a similar voluntary question since March 2025. These rules will create the first official data on AI-attributed layoffs. They do not show that any current figure in this report is right or wrong.</p></div>
</section>

<section id="concentrated" aria-labelledby="h-conc">
  <div class="chapter-head"><div class="eyebrow">Chapter 04</div><h2 id="h-conc">Where long searches are concentrated</h2></div>
  <p class="lead">Long searches rose across most occupations, which points to a broad slowdown rather than one sector. Against that backdrop, computer and mathematical occupations stand out: 41% of their unemployed have been out 27 weeks or more, up from 28%, the largest rise of any occupation; increases for business and financial operations and for education also exceed their margins of error.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 13</span>
    <span class="ex-title">Unemployed out 27+ weeks, by occupation of last job, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Occupation</th><th>2026</th><th>2025</th><th>Change (±90% MOE)</th><th>Change minus all-occupation change</th><th>Unemployment rate 2026 / 2025</th><th>Survey respondents 2026</th></tr></thead>
      <tbody>
        <tr><td>Computer &amp; mathematical</td><td>41.0%</td><td>27.5%</td><td>+13.4 ±7.5 <span class="sig">beyond 90% MOE</span></td><td>+10.3</td><td>3.3% / 3.1%</td><td>462 (near small-sample threshold)</td></tr>
        <tr><td>Business &amp; financial operations</td><td>30.5%</td><td>23.1%</td><td>+7.4 ±6.3 <span class="sig">beyond 90% MOE</span></td><td>+4.2</td><td>2.8% / 2.6%</td><td>530</td></tr>
        <tr><td>Management</td><td>30.3%</td><td>26.4%</td><td>+3.9 ±4.9</td><td>+0.7</td><td>2.4% / 2.1% (+0.28*)</td><td>1,029</td></tr>
        <tr><td>Architecture &amp; engineering</td><td>28.2%</td><td>28.1%</td><td>+0.2 ±13.1</td><td>−3.1</td><td>1.9% / 1.6%</td><td>136 (small sample)</td></tr>
        <tr><td>Office &amp; administrative support</td><td>26.4%</td><td>23.7%</td><td>+2.7 ±4.0</td><td>−0.5</td><td>3.9% / 3.8%</td><td>1,277</td></tr>
        <tr><td>Arts, design, entertainment &amp; media</td><td>23.2%</td><td>24.3%</td><td>−1.1 ±7.2</td><td>−4.3</td><td>5.5% / 5.3%</td><td>394</td></tr>
        <tr><td>Healthcare practitioners</td><td>22.6%</td><td>19.4%</td><td>+3.2 ±7.5</td><td>0.0</td><td>1.6% / 1.6%</td><td>335</td></tr>
        <tr><td>Education, training &amp; library</td><td>18.9%</td><td>13.4%</td><td>+5.5 ±4.9 <span class="sig">beyond 90% MOE</span></td><td>+2.3</td><td>3.5% / 3.1%</td><td>695</td></tr>
        <tr><td><strong>All occupations</strong></td><td>25.6%</td><td>22.4%</td><td>+3.2 ±1.8 <span class="sig">beyond 90% MOE</span></td><td>—</td><td>4.4% / 4.3%</td><td>14,192</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Share of unemployed people whose last job was in each occupation who have been unemployed 27 weeks or more. Not seasonally adjusted; January–August of each year pooled. Respondents = unweighted count of unemployed survey respondents across the 8 months (the same people can appear in several months). Of the unemployment-rate changes shown, only management's (+0.28 ±0.27 pts) exceeds its margin of error. * Computed from unrounded microdata; the rounded rates shown differ by 0.3. Occupations with fewer than about 100 unemployed respondents (such as legal) are not reported. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 14</span>
    <span class="ex-title">White-collar workers out 27+ weeks, by industry of last job, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Industry</th><th>2026</th><th>2025</th><th>Change (±90% MOE)</th><th>Unemployment rate 2026 / 2025</th><th>Respondents 2026</th></tr></thead>
      <tbody>
        <tr><td>Information (tech, media, telecom)</td><td>35.4%</td><td>26.3%</td><td>+9.0 ±11.0</td><td>4.9% / 4.6%</td><td>201</td></tr>
        <tr><td>Professional &amp; business services</td><td>31.7%</td><td>24.9%</td><td>+6.8 ±5.2 <span class="sig">beyond 90% MOE</span></td><td>3.2% / 2.9%</td><td>831</td></tr>
        <tr><td>Financial activities</td><td>31.1%</td><td>33.2%</td><td>−2.0 ±9.4</td><td>2.3% / 2.1%</td><td>286</td></tr>
        <tr><td>Manufacturing</td><td>35.5%</td><td>32.1%</td><td>+3.4 ±9.2</td><td>2.7% / 2.5%</td><td>288</td></tr>
        <tr><td>Public administration</td><td>27.7%</td><td>20.1%</td><td>+7.6 ±12.7</td><td>1.8% / 1.6%</td><td>164</td></tr>
        <tr><td>Education &amp; health services</td><td>22.5%</td><td>18.3%</td><td>+4.2 ±3.8 <span class="sig">beyond 90% MOE</span></td><td>2.6% / 2.3%</td><td>1,366</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">White-collar = management, business, financial and professional occupations. Rises in professional and business services and in education and health services exceed their margins of error; the information industry's rise does not at this sample size, though its direction is consistent with BLS payroll losses in information. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>

  <h3 id="immigration">Immigration: does it explain long searches?</h3>
  <p>Immigration fell sharply in 2025–2026, including new H-1B and student visas. Fewer new foreign professionals could ease competition for U.S. job seekers, or push work offshore. We used the survey's citizenship question to test whether immigration explains this year's rise in white-collar long searches.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 15</span>
    <span class="ex-title">White-collar long-term unemployment by nativity, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Group</th><th>Share of white-collar labor force, 2026</th><th>Out 27+ weeks, % of labor force: 2019</th><th>2025</th><th>2026</th><th>Change vs 2025 (±90% MOE)</th><th>Share of unemployed out 27+ weeks, 2026 / 2025</th><th>Respondents 2026</th></tr></thead>
      <tbody>
        <tr><td>U.S.-born</td><td>83.7%</td><td>0.45%</td><td>0.52%</td><td>0.73%</td><td>+0.20* ±0.08 <span class="sig">beyond 90% MOE</span></td><td>27.9% / 21.6%</td><td>3,263</td></tr>
        <tr><td>Naturalized citizens</td><td>10.0%</td><td>0.65%</td><td>0.84%</td><td>0.83%</td><td>0.00 ±0.28</td><td>31.0% / 32.6%</td><td>343</td></tr>
        <tr><td>Noncitizens</td><td>6.3%</td><td>0.51%</td><td>0.70%</td><td>0.89%</td><td>+0.19 ±0.35</td><td>26.6% / 21.8%</td><td>257</td></tr>
        <tr><td><strong>All white-collar</strong></td><td>100%</td><td>0.47%</td><td>0.56%</td><td>0.75%</td><td>+0.18* ±0.08 <span class="sig">beyond 90% MOE</span></td><td>28.1% / 22.8%</td><td>3,863</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">White-collar = management, business, financial and professional occupations. Nativity from the CPS citizenship variable (PRCITSHP): U.S.-born includes those born in U.S. territories or abroad to American parents. Noncitizens include permanent residents and people on temporary visas such as H-1B or student work permits; the survey does not identify visa type. The noncitizen share of the white-collar labor force was 5.7% in 2019, 6.3% in 2025 and 6.3% in 2026. Margins of error use the BLS generalized variance method, which can understate variance for small groups. The Census Bureau's January 2026 population revisions lowered weighted counts of immigrants; rates and shares are comparable across years, counts are not. Survey response among immigrants may also have fallen. * Computed from unrounded microdata. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <div class="lbl-row"><span class="lbl m">What we measure</span></div>
  <p>The rise is concentrated among U.S.-born workers, where it clears the margin of error. Naturalized citizens show no change, the noncitizen change is within its margin, and the noncitizen share of the white-collar labor force did not grow from 2025 to 2026.</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">H-1B and students · USCIS; IIE</span><p>A $100,000 fee on many new H-1B petitions took effect in September 2025 (few employers paid it, and it is being challenged in court), and the first wage-weighted H-1B lottery cut registrations 38.5% in March 2026. New international students fell 17% in fall 2025. Net international migration fell from 2.7 million (year to mid-2024) to a projected 321,000 (year to July 2026, Census).</p></li>
    <li><span class="who">Research on H-1B and U.S. workers</span><p>Findings are mixed: firms that won extra H-1B visas hired fewer other workers (Doran, Gelber and Isen, 2022); a 2004 cap cut did not raise hiring of U.S.-born workers (Mayda and others, 2018); rejected petitions shifted hiring abroad (Glennon); and H-1B-driven STEM growth raised U.S.-born graduates' wages (Peri, Shih and Sparber, 2015).</p></li>
  </ul>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>Immigration is not a plausible main explanation for this year's rise in long searches, and lower immigration has not offset it. Its clearest effect on our data is indirect: with the labor force barely growing, weak monthly payroll numbers are less alarming than they once were (Chapter 02).</p>

  <h3 id="exposure">Do occupations more exposed to AI fare worse?</h3>
  <p>We tested whether occupations where AI can do more of the work show worse labor-market outcomes. For each of 22 occupation groups we used a published measure of AI capability: the share of an occupation's tasks that a large language model could perform at least 50% faster with equivalent quality, rated task by task (Eloundou, Manning, Mishkin and Rock, <em>Science</em>, 2024), weighted by May 2022 employment. We then compared outcomes before ChatGPT's release (January–August 2022, and 2019) with January–August 2026.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 16</span>
    <span class="ex-title">Labor-market outcomes by AI exposure of occupation, January–August</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>AI exposure group</th><th>Out 27+ weeks, % of labor force: 2019</th><th>2022</th><th>2025</th><th>2026</th><th>Change since 2022 (±90% MOE)</th><th>Ages 22–27, % of employed: 2019 / 2022 / 2026</th></tr></thead>
      <tbody>
        <tr><td><strong>High</strong> (45%+ of tasks exposed): management; business and financial; computer and math; architecture and engineering; sciences; legal; arts, design and media; office and administrative support</td><td>0.61%</td><td>0.58%</td><td>0.72%</td><td>0.90%</td><td>+0.32 ±0.10 <span class="sig">beyond 90% MOE</span></td><td>11.1% / 10.4% / 10.1%</td></tr>
        <tr><td><strong>Middle</strong> (25–45%): education; health care practitioners; community and social service; sales</td><td>0.57%</td><td>0.61%</td><td>0.69%</td><td>0.81%</td><td>+0.20 ±0.12 <span class="sig">beyond 90% MOE</span></td><td>12.6% / 11.8% / 12.1%</td></tr>
        <tr><td><strong>Low</strong> (under 25%): health care support; protective service; food preparation; cleaning; personal care; farming; construction; repair; production; transportation</td><td>0.89%</td><td>1.13%</td><td>1.10%</td><td>1.21%</td><td>+0.08 ±0.12</td><td>13.9% / 13.5% / 14.5%</td></tr>
        <tr><td><strong>Gap, high minus low</strong></td><td colspan="4">Since 2022: +0.24 ±0.16 <span class="sig">beyond 90% MOE</span>. Since 2019: −0.04 ±0.15 (no difference)</td><td></td><td>Young share since 2019: high −1.0 pts; low +0.6 pts</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Exposure: employment-weighted average of the GPT-4-rated "β" exposure measure from Eloundou and others (2024) across detailed occupations in each group (BLS OEWS, May 2022 weights; 97% of employment matched). Groups follow the Census detailed occupation recode (22 groups; armed forces excluded); occupation is the current or most recent job, so outcomes include the unemployed. Across the 22 groups, the employment-weighted correlation between exposure and the 2022–2026 change is 0.59 for the long-term unemployment rate, 0.46 for the unemployment rate and −0.53 for the young-worker share of employment; measured from 2019, the correlations are 0.04, 0.04 and −0.60. Employment itself grew faster in more exposed groups (correlation 0.31). Margins use the BLS generalized variance method and treat years as independent; with 22 groups, correlations above about 0.42 are distinguishable from zero under standard assumptions. Not seasonally adjusted. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <div class="lbl-row"><span class="lbl m">What we measure</span></div>
  <p>Two results hold and one does not. First, in occupations where AI can do more of the work, young people make up a shrinking share of employment, whether measured from 2019 or from 2022; in the least-exposed occupations their share rose. Second, since ChatGPT's release, long-term unemployment has risen much more in high-exposure occupations than in low-exposure ones, a gap beyond the margin of error. But measured from 2019 there is no gap: high-exposure occupations did unusually well during 2020–2022 (remote work and a tech hiring boom), so part of the post-2022 rise is a return to normal. These data cannot separate that normalization from an AI effect, and employment in exposed occupations has kept growing.</p>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>The pattern is the one the rest of this report describes: the clearest AI-linked signal is at the entry gate, in fewer young hires, not in falling employment. The long-search gap is consistent with AI but not proof of it. This is a cross-section of 22 broad groups; it is a first test, not a causal estimate, and we will repeat it each quarter with detailed occupations and a second, usage-based exposure measure.</p>

  <h3>What independent research says about AI, functions and seniority</h3>
  <p>Our tables show where long searches are concentrated; they do not show what caused them. Research that tracks AI exposure directly points the same way on two points: early-career workers and some tech occupations are most affected, and most of the effect is on hiring rather than firing.</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Seniority · Stanford Digital Economy Lab (Aug 2026)</span><p>Employment of 22–25-year-olds in the most AI-exposed jobs is 19% below comparable peers, up from 15% a year earlier. Older workers show no comparable gap; declines are concentrated where AI automates tasks rather than assists.</p></li>
    <li><span class="who">Seniority · Revelio Labs (Aug 2026)</span><p>Compared with non-adopters, firms using AI grew senior roles by 32% but junior roles by only 6%.</p></li>
    <li><span class="who">Job postings · Indeed Hiring Lab (Jul 2026)</span><p>Senior postings rose 14.7% over the year to May 2026 while entry-level postings fell 7.5%.</p></li>
    <li><span class="who">Job titles · Stanford; Anthropic</span><p>Software developers and customer service representatives show the clearest early-career employment declines. AI usage data show the heaviest task coverage in data entry, software development, medical transcription and database architecture.</p></li>
    <li><span class="who">Broad effect · Yale Budget Lab; Federal Reserve (Sep 2026)</span><p>The occupational mix is not yet shifting in ways tied to AI. Fed Governor Barr saw "little evidence of significant displacement so far" but "some indications" of fewer entry-level jobs.</p></li>
    <li><span class="who">Middle management · surveys</span><p>41% of employees say their organization cut management layers (Korn Ferry survey, cited by Forbes, May 2026). There are no hard counts yet of manager headcount, so "flattening" remains a trend to watch.</p></li>
  </ul>
</section>

<section id="research" aria-labelledby="h-res">
  <div class="chapter-head"><div class="eyebrow">Chapter 05</div><h2 id="h-res">What leading researchers are finding</h2></div>
  <p class="lead">The best independent research reaches a consistent and fairly narrow conclusion. AI is not yet causing broad job losses across the economy. Its clearest measurable effect so far is fewer young workers being hired into AI-exposed jobs. The open questions are about the future and about transitions: how quickly firms reorganize around AI, and how costly the move to the next job is for the people affected. Each item below is labeled as primary research (the authors' own data) or commentary, and estimates of exposure are kept separate from observed job changes.</p>

  <h3>Observed effects so far</h3>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Stanford Digital Economy Lab · primary research · Aug 12, 2026</span><p>Using ADP payroll records covering 3.5–5 million workers a month, Brynjolfsson, Chandar and Chen find employment of 22–25-year-olds in the most AI-exposed occupations is 19% below where it would be had it kept pace with less-exposed peers. The gap runs through reduced hiring of young workers rather than more separations, and workers 35 and older did not diverge. The authors describe these as descriptive patterns, not causal estimates, and say they "do not see widespread, economy-wide job displacement associated with AI." Their February 2026 follow-up found that part of the timing reflects factors other than AI, including interest rates.</p></li>
    <li><span class="who">Harvard (Hosseini and Lichtinger) · primary research, working paper · Oct 2025</span><p>Across 62 million workers at 285,000 firms, junior employment at firms that adopted generative AI fell 7.7% relative to non-adopters after six quarters, while senior employment did not fall. Again, the mechanism was slower hiring, not layoffs.</p></li>
    <li><span class="who">Brookings and Yale Budget Lab · primary research · Oct 1, 2025</span><p>Molly Kinder and co-authors found the mix of jobs across high-, medium- and low-AI-exposure occupations "remained remarkably steady" in the 33 months after ChatGPT's release, changing only marginally faster than in the early computer and internet eras. They caution that this method can miss damage concentrated in narrow occupations, and that a widening gap between younger and older graduates is consistent with, but not proof of, an AI effect.</p></li>
    <li><span class="who">Oxford (Llanos-Paredes and Frey) · primary research, working paper · 2025</span><p>In one occupation where the technology is mature, translation, each one-point increase in machine-translation use was associated with about 0.7 points slower growth in translator employment, roughly 28,000 translator jobs that would otherwise have been created in 2010–2023.</p></li>
    <li><span class="who">Stanford, MIT and Harvard field studies · primary research</span><p>Within a job, AI helps novices most: customer-support agents gained 14% in productivity on average and 34% for the least experienced (Brynjolfsson, Li and Raymond, <em>QJE</em> 2025). In a Procter &amp; Gamble experiment with 776 professionals, one person working with AI matched the output quality of a two-person team without it (Dell'Acqua, Sadun, Lakhani and others, 2025). Read together with the hiring studies, the tension is clear: AI makes junior workers more productive, yet fewer of them are being hired.</p></li>
  </ul>

  <h3>Exposure, adaptability and who is at risk</h3>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Brookings (Manning, Aguirre, Muro, Methkupally) · primary research · Jan 21, 2026</span><p>Of 37.1 million workers in the most AI-exposed quarter of jobs, 26.5 million (about 70%) have above-median capacity to adapt, based on savings, transferable skills, local job density and age. About 6.1 million workers, 4.2% of the workforce, are both highly exposed and poorly positioned to adapt; 86% of them are women, concentrated in clerical and administrative roles. For most of NextChapter's audience of experienced professionals, the issue is therefore less whether they can transition than how long and how costly the transition is.</p></li>
    <li><span class="who">Opportunity@Work (Byron Auguste) with Brookings · primary research · Apr 2, 2026</span><p>15.6 million workers without four-year degrees ("STARs," Skilled Through Alternative Routes) hold highly AI-exposed jobs, including 11 million in "gateway" jobs that have historically led to better-paid work. Only 51% of the paths from gateway jobs to better-paid jobs avoid high exposure. Opportunity@Work's 2026 State of the Paper Ceiling report says STARs have regained 783,000 good jobs after losing access to 7.4 million in 2000–2020, and that 33 states have dropped degree requirements for many public jobs. These are advocacy-organization figures; partner-network data come from self-selected employers.</p></li>
    <li><span class="who">Harvard Business School and Burning Glass Institute (Joseph Fuller and co-authors) · projection · 2025</span><p>"The Expertise Upheaval" projects that generative AI will change the learning curves of about 50 million U.S. jobs, potentially making many entry-level roles obsolete while opening "mastery" roles to less-experienced workers. These are estimates from skills and job-posting data, not observed job losses.</p></li>
    <li><span class="who">MIT (Autor and Thompson) · primary research · 2025</span><p>Across 303 occupations from 1980 to 2018, automation that removes the expert parts of a job lowers wages but widens access, while automation that removes routine parts raises wages but narrows who can do the job. Which way AI cuts for a given white-collar role is an empirical question, and it is the right question for mid-career workers to ask about their own jobs.</p></li>
  </ul>

  <h3>The economy-wide picture and the policy response</h3>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">MIT (Acemoglu) · peer-reviewed model · 2025</span><p>"The Simple Macroeconomics of AI" estimates AI will raise total factor productivity by no more than about 0.66% over ten years, and by less than 0.53% once harder-to-automate tasks are accounted for. This is a calibrated model, not observed data, and it sits at the cautious end of published estimates.</p></li>
    <li><span class="who">MIT Stone Center on Inequality and Shaping the Future of Work · commentary · 2026</span><p>Acemoglu, Autor and Johnson argue in a Hamilton Project paper (Feb 2026) that AI's labor-market effects depend on design choices, and that "more than six out of 10 workers in 2018 were employed in occupational specialties that did not yet exist in 1940." The center launched in November 2025.</p></li>
    <li><span class="who">Stanford HAI AI Index 2026 · compilation · Apr 2026</span><p>The Index's economy chapter compiles other organizations' data, including that one-third of organizations expect AI to reduce their workforce in the coming year (McKinsey survey) and that measured productivity gains range from 14–15% in customer support to 26% in software.</p></li>
    <li><span class="who">New York FutureWorks Commission · policy · 2026</span><p>Governor Hochul launched the commission on March 19, 2026 to advise on workers' economic security and to build ways to track AI's effect on New York jobs in real time. Its co-chairs are Tom Perez, Thasunda Brown Duckett and Molly Kinder, and recommendations are due by the end of December 2026. Separately, New York's layoff-notice system has asked employers since March 2025 whether automation contributed to layoffs; in its first year, none of more than 160 filers said yes (Hunton Andrews Kurth, May 2026). Whether that reflects reality or under-reporting is unknown.</p></li>
    <li><span class="who">RAISE US · program · launched Jun 25, 2026</span><p>A new bipartisan nonprofit led by Gina Raimondo and Eric Holcomb, with more than $500 million in commitments from AI companies (including OpenAI's foundation, Anthropic, Microsoft and Amazon) and other employers, to pilot retraining, wage insurance for workers who take lower-paying jobs, and career navigation in four states. It has not yet published outcome data. (It is unrelated to New York's RAISE Act, an AI-safety law with no employment provisions.)</p></li>
    <li><span class="who">Markle Foundation · status note</span><p>Markle's skills-based hiring work, the Rework America Alliance, moved to Jobs for the Future in December 2023. We found no 2025–2026 Markle research on AI and jobs; we use Opportunity@Work and Jobs for the Future for current skills-based hiring evidence.</p></li>
    <li><span class="who">MIT Martin Trust Center (Paul Cheek) · book · Aug 2026</span><p>In <em>No One Works Here</em> (Wiley, 2026), Paul Cheek argues that firms will be reorganized around AI decision-making, and that hierarchies built around the limits of human communication become "structural debt." It is an argument, not a measurement, but it describes the organizational redesign that this report's Q3 addendum tracks through company filings and services firms.</p></li>
  </ul>
  <p class="note"><span class="lbl i">What this may mean</span> What this adds up to: the measurable effect of AI today is concentrated at the entry point to white-collar careers and runs through hiring, not layoffs. Our own data show the other end of the problem, longer searches for experienced workers who lose jobs, but cannot attribute that to AI. Higher interest rates, the post-2022 tech correction and federal job cuts are all plausible contributors.</p>
</section>


<section id="longterm" aria-labelledby="h-lt">
  <div class="chapter-head"><div class="eyebrow">Chapter 06</div><h2 id="h-lt">Long-term unemployment and age</h2></div>
  <p class="lead">According to BLS, 1.94 million people had been unemployed 27 weeks or more in September, 27.1% of all unemployed, up from 23.6% a year earlier. Most of them have been out far longer than six months: about two in three have been looking for a year or more.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 17</span>
    <span class="ex-title">How long the long-term unemployed have been looking, January–August average</span>
    <div class="tbl"><table>
      <thead><tr><th>Among people unemployed 27+ weeks</th><th>All 2026</th><th>All 2025</th><th>White-collar 2026</th><th>White-collar 2025</th></tr></thead>
      <tbody>
        <tr><td>Long-term unemployed (thousands, monthly average)</td><td>1,895</td><td>1,644</td><td>546</td><td>412</td></tr>
        <tr><td>Looking 27–51 weeks</td><td>34.6%</td><td>41.4%</td><td>39.4%</td><td>45.9%</td></tr>
        <tr><td>Looking 1–2 years</td><td>40.9%</td><td>33.0%</td><td>35.6%</td><td>33.6%</td></tr>
        <tr><td>Looking 2 years or more</td><td>24.5%</td><td>25.6%</td><td>25.0%</td><td>20.5%</td></tr>
        <tr><td>Looking 1 year or more (total)</td><td>65.4% <span class="sig">rise beyond 90% MOE</span></td><td>58.6%</td><td>60.6% <span class="ns">within MOE</span></td><td>54.1%</td></tr>
        <tr><td>Average weeks looking so far</td><td>64</td><td>63</td><td>64</td><td>59</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Durations are spells in progress: how long people who are still unemployed have been looking so far, not how long it takes to find work. The survey caps reported durations at 119 weeks, so averages understate the longest spells. Not seasonally adjusted. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <h3>Age</h3>
  <p>Age shapes how long searches last more than whether people lose jobs. Among unemployed white-collar workers aged 55–64, 39% have been looking 27 weeks or more, up from 27% a year earlier, a rise larger than its 90% margin of error. Younger white-collar workers have somewhat higher unemployment rates but shorter observed spells so far, while older workers are much more likely to have been unemployed 27 weeks or longer; these tables do not measure how often people lose jobs or how fast they are rehired. Across all workers, unemployment for ages 25–34 rose to 4.8% from 4.3% (beyond margin of error), consistent with research showing fewer entry-level openings.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 18</span>
    <span class="ex-title">White-collar workers by age, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Age</th><th>Unemployment rate 2026 / 2025</th><th>Out 27+ weeks 2026</th><th>2025</th><th>Change (±90% MOE)</th><th>Median weeks so far 2026 / 2025</th></tr></thead>
      <tbody>
        <tr><td>Under 35</td><td>3.3% / 3.0%</td><td>20.5%</td><td>16.6%</td><td>+3.9 ±3.6 <span class="sig">beyond 90% MOE</span></td><td>9 / 8</td></tr>
        <tr><td>35–44</td><td>2.1% / 2.1%</td><td>27.1%</td><td>23.5%</td><td>+3.6 ±5.3</td><td>12 / 9</td></tr>
        <tr><td>45–54</td><td>2.3% / 2.1%</td><td>32.0%</td><td>25.6%</td><td>+6.5 ±5.7 <span class="sig">beyond 90% MOE</span></td><td>13 / 12</td></tr>
        <tr><td>55–64</td><td>2.7% / 2.5%</td><td>39.4%</td><td>26.5%</td><td>+12.9 ±6.3 <span class="sig">beyond 90% MOE</span></td><td>20 / 12</td></tr>
        <tr><td>65+</td><td>3.0% / 2.9%</td><td>32.2%</td><td>33.1%</td><td>−0.8 ±9.0</td><td>10 / 12</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Median weeks are for people still unemployed and cluster at round numbers people report (such as 12 or 26 weeks), so treat medians as indicative. Only the under-35 unemployment-rate change (+0.33 ±0.32 pts) exceeds its margin of error. Not seasonally adjusted. For comparison, BLS's September figures for all occupations, ages 55–64, show an average of 34.9 weeks unemployed and about 31% out 27+ weeks (NSA). Source: NextChapter calculation from Census CPS microdata; BLS.</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Résumé gaps · Socio-Economic Review (2026)</span><p>A meta-analysis of 28 résumé experiments finds gaps under six months do not hurt callbacks; penalties begin around 12 months and are larger for people who appear to have stopped looking.</p></li>
    <li><span class="who">Scarring · Goldman Sachs (Apr 2026)</span><p>Workers displaced by technology search about a month longer and see roughly 10 points less earnings growth over a decade; vocational training within three years of job loss is linked to better outcomes.</p></li>
  </ul>

  <h3 id="core">The degree-holding core: education and experience</h3>
  <p>This report defines white-collar work by occupation (management, business, financial and professional jobs), not by degree; about 70% of that workforce holds a bachelor's degree or more. Because most of the jobs NextChapter's readers seek require a degree, we also track workers aged 22 and older by education, and within degree holders by years of potential experience (age minus years of schooling minus six; the survey does not record actual experience).</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 19</span>
    <span class="ex-title">Bachelor's-degree holders and others, ages 22+: employment and long-term unemployment, January–August</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Group</th><th>Employed, 2026 (millions)</th><th>Employment change since 2022</th><th>Out 27+ weeks, % of labor force: 2019 / 2022 / 2025 / 2026</th><th>Change vs 2025 (±90% MOE)</th><th>Change since 2022 (±90% MOE)</th><th>Share of unemployed out 27+ weeks, 2026</th></tr></thead>
      <tbody>
        <tr><td><strong>No bachelor's degree</strong></td><td>83.7</td><td>0.0%</td><td>0.88 / 1.03 / 1.06 / 1.21</td><td>+0.15 ±0.09 <span class="sig">beyond 90% MOE</span></td><td>+0.18 ±0.10 <span class="sig">beyond 90% MOE</span></td><td>26.9%</td></tr>
        <tr><td><strong>Bachelor's or higher</strong></td><td>68.1</td><td>+7.1% (+4.5 million)</td><td>0.57 / 0.57 / 0.72 / 0.88</td><td>+0.16 ±0.09 <span class="sig">beyond 90% MOE</span></td><td>+0.31 ±0.09 <span class="sig">beyond 90% MOE</span></td><td>29.3%</td></tr>
        <tr><td>&nbsp;&nbsp;Bachelor's only</td><td>42.2</td><td>+5.5%</td><td>0.60 / 0.65 / 0.85 / 0.95</td><td>+0.10 ±0.12</td><td>+0.30 ±0.12 <span class="sig">beyond 90% MOE</span></td><td>28.6%</td></tr>
        <tr><td>&nbsp;&nbsp;Master's</td><td>19.0</td><td>+9.2%</td><td>0.56 / 0.49 / 0.57 / 0.83</td><td>+0.26 ±0.16 <span class="sig">beyond 90% MOE</span></td><td>+0.34 ±0.17 <span class="sig">beyond 90% MOE</span></td><td>29.0%</td></tr>
        <tr><td>&nbsp;&nbsp;Professional or doctoral degree (small sample)</td><td>6.9</td><td>+11.3%</td><td>0.39 / 0.31 / 0.39 / 0.64</td><td>+0.25 ±0.22 <span class="sig">beyond 90% MOE</span></td><td>+0.33 ±0.24 <span class="sig">beyond 90% MOE</span></td><td>41.2% (241 respondents)</td></tr>
        <tr><td colspan="7"><em>Bachelor's or higher, by years of potential experience</em></td></tr>
        <tr><td>&nbsp;&nbsp;0–4 years (new entrants)</td><td>7.1</td><td>+9.5%</td><td>0.75 / 0.77 / 1.08 / 1.26</td><td>+0.18 ±0.33</td><td>+0.50 ±0.34 <span class="sig">beyond 90% MOE</span></td><td>23.7%; unemployment rate 5.3%</td></tr>
        <tr><td>&nbsp;&nbsp;5–14 years</td><td>18.3</td><td>+6.3%</td><td>0.45 / 0.39 / 0.61 / 0.77</td><td>+0.17 ±0.16 <span class="sig">beyond 90% MOE</span></td><td>+0.38 ±0.16 <span class="sig">beyond 90% MOE</span></td><td>27.9%</td></tr>
        <tr><td>&nbsp;&nbsp;15–24 years (mid-career)</td><td>17.3</td><td>+13.3%</td><td>0.39 / 0.51 / 0.60 / 0.65</td><td>+0.05 ±0.16</td><td>+0.14 ±0.17</td><td>26.0%</td></tr>
        <tr><td>&nbsp;&nbsp;25+ years (most experienced)</td><td>25.5</td><td>+3.1%</td><td>0.71 / 0.70 / 0.79 / 1.02</td><td>+0.23 ±0.15 <span class="sig">beyond 90% MOE</span></td><td>+0.32 ±0.16 <span class="sig">beyond 90% MOE</span></td><td>35.1%</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Ages 22 and older, any occupation (including people whose last job was not white-collar). Education from PEEDUCA. Potential experience = age − (16 years of schooling for a bachelor's, 18 for a master's, 20 for professional or doctoral degrees) − 6. Margins use the BLS generalized variance method; year-apart comparisons with 2025 use the BLS change factors and comparisons with 2022 treat the years as independent. The January 2026 population revisions affect employment levels more than rates. Not seasonally adjusted. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <div class="lbl-row"><span class="lbl m">What we measure</span></div>
  <p>Since 2022, essentially all net employment growth among adults 22 and older went to people with a bachelor's degree or more (+4.5 million; employment of those without a degree was flat). Yet long-term unemployment rose more for degree holders than for others, and in the past year it rose fastest for master's holders. By experience the pattern is U-shaped: new entrants and the most experienced degree holders saw the largest rises since 2022, while mid-career workers (15–24 years) saw the smallest and the fastest employment growth. Workers with 25 or more years of experience who are unemployed are the most likely to have been looking six months or more (35%).</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Degree requirements in postings · Indeed Hiring Lab</span><p>19.3% of U.S. job postings required a bachelor's degree or higher in November 2025, against 20.4% in 2019; about half of postings name no education requirement. Indeed changed its method between releases, so the figures are not one continuous series. Lightcast finds degree requirements down about 14% since 2019 in jobs that traditionally required a four-year degree, but more common in postings that require AI skills (Sep 2026).</p></li>
    <li><span class="who">Experience requirements · Indeed; ZipRecruiter</span><p>Postings asking for years of experience fell from about 40% (2022) to 30% (2024), but in tech the share asking for five or more years rose from 37% to 42% (Q2 2022 to Q2 2025). By May 2026, senior postings were up 14.7% over the year and entry-level postings down 7.5%; in software development 69% of postings were senior and under 5% entry-level. 31% of hiring managers say AI has raised experience requirements for their entry-level roles (ZipRecruiter survey, Jun 2026).</p></li>
    <li><span class="who">No official openings data by degree · BLS</span><p>The Labor Department's job-openings survey has no education or experience fields. Occupations whose typical entry requirement is a bachelor's degree or higher hold 30% of employment and are projected to grow faster than average through 2035 (BLS Employment Projections, Sep 2026).</p></li>
  </ul>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>Demand for degree holders is still growing, but the people in the degree-holding core who lose jobs are taking longer to land, especially at the two ends of a career. Employers are asking for more seniority in the jobs they post, which squeezes new graduates, while long-tenured candidates face the longest searches. Mid-career professionals are, for now, the best-positioned group.</p>
</section>

<section id="older" aria-labelledby="h-old">
  <div class="chapter-head"><div class="eyebrow">Chapter 07</div><h2 id="h-old">Older workers</h2></div>
  <p class="lead">Workers 55 and older are less likely to lose a job than younger workers, but when they do, they are much less likely to get back to an equivalent one. Participation for ages 55+ fell to 37.1% in January–August 2026 from 38.1% a year earlier, but almost all of that drop reflects a shift toward older ages within the 55+ population, from aging and from the Census Bureau's January 2026 population revisions. Within each age and sex group, participation was essentially unchanged (see the correction below).</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 20</span>
    <span class="ex-title">Older workers at a glance</span>
    <div class="tbl"><table>
      <thead><tr><th>Measure</th><th>2026</th><th>2025</th><th>2019</th><th>Note</th></tr></thead>
      <tbody>
        <tr><td>Labor force participation, ages 55+</td><td>37.1%</td><td>38.1%</td><td>40.2%</td><td class="l">Jan–Aug, NSA; −1.0 pt ±0.4; holding the 2025 age and sex mix fixed: −0.05 pt</td></tr>
        <tr><td>Labor force participation, ages 65+</td><td>18.6%</td><td>19.0%</td><td>20.0%</td><td class="l">Jan–Aug, NSA; holding the 2025 age and sex mix fixed: −0.06 pt</td></tr>
        <tr><td>Unemployment rate, ages 55+</td><td>3.2%</td><td>3.1%</td><td>2.8%</td><td class="l">Jan–Aug, NSA; BLS SA September: 2.6%</td></tr>
        <tr><td>Unemployed white-collar workers 50+ out 27+ weeks</td><td>37.1%</td><td>29.6%</td><td>28.4%</td><td class="l">+7.6 pts ±4.5 <span class="sig">beyond 90% MOE</span>; 1,412 respondents</td></tr>
        <tr><td>Average weeks unemployed so far, ages 55–64</td><td>34.9</td><td>—</td><td>—</td><td class="l">BLS, September 2026 (NSA); all ages: 25.4</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">NSA = not seasonally adjusted. Participation and white-collar rows: NextChapter calculation from Census CPS microdata, January–August of each year; ± = 90% margin of error on the change, BLS generalized variance method (Appendix B). Changes are computed from unrounded rates, so they can differ by 0.01 from the difference of the rounded figures shown. Other rows: BLS Employment Situation tables A-10 and A-36.</span>
  </div>
  <div class="box disclose" id="correction-2" style="margin:0 0 14px;scroll-margin-top:80px"><p style="margin:0"><strong>Correction (Version 1.6, October 6, 2026).</strong> Earlier versions listed the fall in participation for ages 55+ (38.1% to 37.1%) among the executive summary's main findings, as a sign that more older workers were leaving the labor force. That reading was wrong. We recomputed the 2026 rate holding the 2025 mix of five-year age groups and sex fixed: it is 38.08%, a change of −0.05 points. The drop comes from the 55+ population getting older (more people in their 70s, who rarely work), amplified by the Census Bureau's January 2026 population revisions, which BLS says lowered measured participation for all ages by 0.4 points. The figure has been removed from the executive summary. Participation for ages 55–64 was essentially flat (66.6% in both years).</p></div>
  <h3>What happens after a layoff</h3>
  <p>The Bureau of Labor Statistics' Displaced Worker Survey (January 2026, released August 27, 2026) counted 3.3 million long-tenured workers displaced in 2023–2025. By January 2026, 72.9% of those aged 25–54 were re-employed, against 57.3% of those 55–64 and 38.6% of those 65 and older. Across ages, only about 49% of workers who moved from one full-time job to another were earning as much as before, down from about 62% in the 2024 survey. For an experienced professional, the risk is less the layoff itself than the long road back to comparable pay.</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Age bias · AARP (2026)</span><p>64% of workers 50+ have seen or experienced age discrimination at work and 22% felt pushed out. In AARP/NORC polling through summer 2026, two-thirds of adults 50+ think finding a new job would be hard, and 35% of those name age discrimination as the main barrier.</p></li>
    <li><span class="who">Employers · SHRM (Oct 2025)</span><p>93% of organizations have no formal program to recruit older workers, even though 88% of HR professionals rate older workers' performance as equal to or better than others'.</p></li>
    <li><span class="who">Money pressure · AARP/NORC (2026)</span><p>39% of working adults 50+ say covering basic expenses is their main reason for working, and nearly a third expect to retire later than planned, most often because of living costs.</p></li>
    <li><span class="who">AI use by age · AARP</span><p>30% of adults 50+ use AI, up from 18% a year earlier (AARP, Dec 2025). The most common bias older workers report is the assumption that they lack tech skills (33%).</p></li>
    <li><span class="who">Litigation · Mobley v. Workday</span><p>The nationwide age-discrimination case over AI screening of applicants 40 and older remains in discovery; in June 2026 the court denied most of Workday's motion to dismiss, according to law-firm summaries.</p></li>
  </ul>
  <p class="note"><span class="lbl i">What this may mean</span> Reading the data: the headline fall in 55+ participation is mostly arithmetic, as the 55+ population ages. The stronger signals of strain for older professionals are long-term unemployment (37% of unemployed white-collar workers 50+ have been looking 27 weeks or more) and lower re-employment after a layoff.</p>
</section>

<section id="applying" aria-labelledby="h-app">
  <div class="chapter-head"><div class="eyebrow">Chapter 08</div><h2 id="h-app">Applying in 2026: volume, screening software and AI on both sides</h2></div>
  <p class="lead">Applications per job have roughly doubled since 2022, increasing competition for each opening; separate data from Ashby suggest the chance of moving from application to interview has also fallen. Candidates use AI to apply faster, employers use AI to screen faster, and trust on both sides has fallen.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 21</span>
    <span class="ex-title">The application funnel, by source</span>
    <div class="cells">
      <div class="cell"><span class="lbl">Applications per job, 2025 (Greenhouse, North America)</span><span class="val">244</span><span class="chg">about 115 in 2022</span></div>
      <div class="cell"><span class="lbl">Applications per hire, 2026 (Ashby)</span><span class="val">300+</span><span class="chg">about 3x the 2021 level</span></div>
      <div class="cell"><span class="lbl">Applications per interview, job-tracker users (Huntr, Q1 2026)</span><span class="val">24–48</span><span class="chg">tailored vs. generic résumé</span></div>
      <div class="cell"><span class="lbl">Median time from search start to offer, job-tracker users (Huntr, Q1 2026)</span><span class="val">108 days</span><span class="chg">Huntr Q1 2026 report</span></div>
    </div>
    <span class="ex-note">Greenhouse and Ashby figures come from their customers' hiring systems; Huntr figures come from people who use its job-tracking tool, who skew toward heavy appliers. All three companies sell hiring or job-search software. Applications per interview is a NextChapter calculation from Huntr's interview rates (4.2% tailored, 2.1% generic).</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">How many applications it takes</span><p>Among Huntr users, two-thirds of offers came within 50 applications. Interview rates fall as volume rises: 9.3% per application for people sending 11–20, 2.6% for people sending 100 or more. In that sample, seekers with 20+ years of experience had the highest interview rate (9.2%).</p></li>
    <li><span class="who">Recruiters are overloaded</span><p>Greenhouse's North American data show a paradox: from 2022 to 2025, annual applications per recruiter tripled (1,610 to 4,890) as recruiters per organization fell from 10.4 to 4.6, recruiters made more than twice as many hires a month (2.2 to 4.9), and yet time to fill rose from 43.6 to 59.7 days.</p></li>
    <li><span class="who">AI on both sides</span><p>In Greenhouse's November 2025 survey (U.S. subset: 1,200 job seekers, 665 hiring professionals), 70% of hiring managers said AI leads to faster, better decisions, but only 8% of job seekers called it fair. 41% of U.S. job seekers said they had put hidden instructions in résumés to get past AI filters. Only 21% of recruiters were very confident their AI does not reject qualified candidates.</p></li>
    <li><span class="who">Fake jobs, fake candidates</span><p>69% of job seekers said they had seen fake job postings (Greenhouse). Gartner forecasts that one in four candidate profiles worldwide will be fake by 2028; that is a prediction, not a measurement.</p></li>
    <li><span class="who">Employer adoption · SHRM (Apr 2026)</span><p>39% of organizations use AI in HR, rising to 60% of those with 5,000+ employees; recruiting is the most common use.</p></li>
    <li><span class="who">Law and litigation</span><p>Illinois began regulating AI in hiring decisions on January 1, 2026. California's rules on automated decision systems (October 2025) hold employers responsible for their vendors' tools. Colorado replaced its AI Act with a narrower law effective January 2027. In <i>Mobley v. Workday</i>, a nationwide age-discrimination case over AI screening of applicants 40 and older, about 14,000 people reportedly opted in; the case is in discovery. The EEOC withdrew its AI hiring guidance in January 2025.</p></li>
      <li><span class="who">The AI-vs-AI loop · research</span><p>When language models screen résumés, they favor résumés written by the same model 67–82% of the time; in simulations, candidates using the screener's own model were 23–60% more likely to be shortlisted (Xu, Li and Jiang, University of Maryland, NUS and Ohio State, 2025). On a large freelancing platform, the hiring premium for customized applications disappeared after AI writing tools arrived, so cover letters stopped signaling effort (Galdin and Silbert, Dartmouth and Princeton, 2025). In a 70,000-applicant field experiment at a call-center firm, AI-led interviews raised offers 12% and job starts 18%, with humans making final decisions (Jabarian and Henkel, 2025; the firm sponsored the study).</p></li>
    <li><span class="who">Volume · LinkedIn; Ashby</span><p>LinkedIn reported about 11,000 applications per minute in mid-2025, up 45% from a year earlier. Referrals are about 1% of applications in Ashby's data but reach interview at about 40%, versus about 3% for inbound applicants.</p></li>
    <li><span class="who">A myth to drop</span><p>The widely repeated claim that "75% of résumés are never seen by a human" traces to a 2012 marketing claim by a defunct company with no published method. Surveys suggest automatic rejection before human review is far lower, mostly through knockout questions.</p></li>
  </ul>
</section>

<section id="skills" aria-labelledby="h-skl">
  <div class="chapter-head"><div class="eyebrow">Chapter 09</div><h2 id="h-skl">Skills, career ladders and colleges</h2></div>
  <p class="lead">AI skills now carry a measurable pay premium, and demand for them has spread well beyond tech. Inside companies, career ladders have slowed: promotions and internal moves are down since 2022 on every payroll and HR platform we track. Colleges are adding AI programs at every career stage, from first-year requirements to five-day executive courses, but there is little evidence yet on what they are worth. Public retraining is covered in Chapter 13.</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Pay premium · Lightcast (Jul 2025)</span><p>U.S. postings that list AI skills offer 28% higher pay, about $18,000 a year; 51% are outside IT and computer science. Demand for AI skills grew 66% a year in HR, 50% in marketing and 40% in finance.</p></li>
    <li><span class="who">Pay premium · PwC (Jun 2026, global)</span><p>Workers with AI skills earn a 62% wage premium on average, up from 57%. PwC measures worker wages and Lightcast posted salaries, so the two are not directly comparable.</p></li>
    <li><span class="who">Fastest-growing skill · McKinsey (Nov 2025)</span><p>Demand for "AI fluency" in postings grew almost sevenfold in two years.</p></li>
    <li><span class="who">Rising skills · LinkedIn; WEF</span><p>LinkedIn's 2026 U.S. list of fastest-growing skills (as reported by EdTech Innovation Hub) is led by AI implementation, workflow automation and AI business strategy. The World Economic Forum expects about 39% of core skills to change by 2030.</p></li>
  </ul>
    <h3>The mid-career and senior skills gap</h3>
  <p>The skills gap for experienced professionals is less about technical knowledge than about hands-on use of AI and the training to build it. Employers increasingly screen for it; few are paying to close it.</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Usage by role · Gallup (May 2026)</span><p>Workers whose managers support AI are 1.7 times as likely to use it frequently.</p></li>
    <li><span class="who">Training gap · BCG (Jun 2026, 14 countries)</span><p>88% of workers think they will need major new skills within five years; only 36% say they get enough training.</p></li>
    <li><span class="who">Hiring screens · Patriot Software (Jul 2026, small businesses)</span><p>40% of small employers rejected a candidate in the past year for weak AI skills: 65% of Gen Z employers and 26% of Gen X employers. Experienced candidates are increasingly interviewed by younger managers who expect AI fluency.</p></li>
    <li><span class="who">Entry-level spillover · NACE (2026)</span><p>13.3% of entry-level postings now ask for AI skills, nearly three times the fall 2025 level, a sign of how quickly the expectation is spreading.</p></li>
    <li><span class="who">Who gets trained · WEF; Urban Institute</span><p>Of every 100 workers, 59 will need training by 2030 and 11 are unlikely to receive it (WEF). 92% of workers 50+ want to learn new skills, but only 10% have taken AI training in their field (Urban Institute).</p></li>
    <li><span class="who">Does retraining pay? · Workcred; Chicago Fed</span><p>Older trainees in federal workforce programs mostly choose short credentials, and industry certifications do best, but most still earn less than before their job loss. Earlier research found a year of community college raised older workers' earnings 8–10%. There is little recent rigorous evidence on mid-career AI retraining.</p></li>
  </ul>


  <h3>Career ladders: fewer promotions, fewer internal moves</h3>
  <p>No federal survey measures promotions, so we rely on payroll and HR-software companies, each describing its own customers. Their definitions differ, but they agree on direction: since 2022, fewer people are being promoted, fewer jobs are filled from inside, and manager roles are being thinned. Slower ladders matter for people out of work too: each promotion usually opens a seat below it.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 22</span>
    <span class="ex-title">Career-ladder indicators from private payroll and HR data</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Source (coverage)</th><th>Measure</th><th>Earlier</th><th>Latest</th></tr></thead>
      <tbody>
        <tr><td>Workday (its customers, global)</td><td>Industries where promotions fell, first half of 2025 vs 2024</td><td>—</td><td>10 of 11</td></tr>
        <tr><td>Workday</td><td>Internal hiring, first half of 2025 vs 2024</td><td>—</td><td>−8%; about 30% of June 2025 hires were internal</td></tr>
        <tr><td>Gusto (U.S. small businesses)</td><td>Promotion rate</td><td>14.6% (May 2022 peak); 12–13% in 2019</td><td>10.3% (May 2025)</td></tr>
        <tr><td>Gusto</td><td>Individual contributors per manager</td><td>3–3.5 (2019)</td><td>About 6 (Q3 2024)</td></tr>
        <tr><td>ADP Research (U.S. payroll)</td><td>Promotion rate into management</td><td>7.3% (2022 peak)</td><td>6.5% (2023, the 2019 level)</td></tr>
        <tr><td>Revelio Labs (online profiles)</td><td>Job changes that came with a raise of 10% or more</td><td>About 54% (2022)</td><td>About 41% (2025)</td></tr>
        <tr><td>Revelio Labs</td><td>Middle-management job postings vs April 2022 peak</td><td>—</td><td>−42% (Oct 2025)</td></tr>
        <tr><td>Burning Glass Institute and NYU SPS (1.3 million careers)</td><td>Mid-career professionals (10–15 years in) with 5+ years without a promotion or meaningful raise</td><td>—</td><td>24.2% (20.7% in IT to 30.2% in public administration; Jun 2026)</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Private-platform data. Each source covers its own clients or users, definitions of "promotion" differ, and the figures are not comparable with one another or with federal statistics. The most recent Workday and ADP figures we could verify are from 2025 and 2023. Sources: Workday Global Workforce Report (Sep 9, 2025); Gusto (Jun 20 and Jun 30, 2025); ADP Research (Jul 8, 2024); Revelio Labs (Mar 31, 2026) and Revelio data via HCAmag (Dec 2, 2025); Burning Glass Institute and NYU SPS via CBS News (Jun 1, 2026).</span>
  </div>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>Two channels of advancement have narrowed at once: moving up inside a company and moving out for a big raise. Workers who switch jobs still earn more than those who stay (Chapter 04), but double-digit raises from switching are less common than in 2022. For an experienced professional who loses a job, a market with fewer internal promotions also means fewer vacancies created by promotion chains.</p>

  <h3>Employer training: two surveys, two directions</h3>
  <p>Whether employers are spending more to retrain their workers depends on which survey you read. The two main industry surveys disagree on both spending and hours. The one consistent signal is that AI's share of training is rising from a very small base.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 23</span>
    <span class="ex-title">Corporate learning and development (L&amp;D): spending, hours and AI</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Survey (coverage)</th><th>Spending</th><th>Training hours</th><th>AI</th></tr></thead>
      <tbody>
        <tr><td>Training magazine, 2025 Training Industry Report (U.S. organizations with 100+ employees; surveyed Apr–Jul 2025)</td><td>$874 per learner, up from $774; $102.8 billion in total, up 4.9%</td><td>40 hours per learner, down from 47</td><td>AI is 2% of training hours, up from 0.8%; 37% use AI technology to deliver training, up from 25%</td></tr>
        <tr><td>ATD, 2026 State of the Industry (340 organizations; 2025 data)</td><td>$846 per employee in 2025, down from $1,254 in 2024</td><td>16.7 hours per employee, up from 13.7</td><td>55% of organizations provide practical AI-skills training, 45% technical AI training</td></tr>
        <tr><td>SHRM, 2026 Employee Benefits Survey (5,472 HR professionals; Jan–Mar 2026)</td><td>—</td><td>—</td><td>33% of employers pay for employees' AI tool subscriptions, up 17 points from 2025</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Training magazine reports spending per learner and ATD spending per employee, from different samples; the two should not be combined. We draw no conclusion about the direction of total employer training investment. Sources: Training magazine (Nov 10, 2025); ATD (May 2026); SHRM (Jun 17, 2026).</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Career conversations · LinkedIn (2025)</span><p>Only 15% of workers say their manager helped them build a career plan in the past six months, down 5 points from 2024 (Workplace Learning Report 2025; we found no 2026 edition).</p></li>
    <li><span class="who">Tuition benefits · SHRM; Mercer</span><p>Nearly half of employers offer tuition reimbursement (SHRM, 2025). The 2025 federal tax law made tax-free employer student-loan repayment permanent, with the $5,250 annual limit indexed to inflation after 2026.</p></li>
  </ul>

  <h3>How colleges are responding to AI, by career stage</h3>
  <p>Colleges are adding AI at every stage of a career. Undergraduates face new AI requirements, working professionals have low-cost online master's degrees, MBA programs are making AI compulsory, and executive programs charge up to $18,500 for a week. What is missing is evidence on outcomes: we found no rigorous placement or wage data for graduates of the new AI degrees.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 24</span>
    <span class="ex-title">AI programs at U.S. colleges and universities, by career stage (selected examples)</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Stage</th><th>What is changing</th><th>Examples</th><th>Typical cost and length</th></tr></thead>
      <tbody>
        <tr><td><strong>Undergraduate and entry level</strong></td><td>AI degrees, and AI literacy required of all students</td><td>Institutions awarding federally coded AI bachelor's degrees rose from 4 in 2020 to 23 in 2025 (CRA). Purdue requires an "AI working competency" of every undergraduate entering from fall 2026; Ohio State (Class of 2029 onward) and SUNY (fall 2026 entrants) build AI into general education. Carnegie Mellon launched the first U.S. AI bachelor's in 2018; Miami Dade College offers Florida's first, at a community college.</td><td>Within a four-year degree</td></tr>
        <tr><td><strong>Mid-career</strong></td><td>Online master's degrees and certificates for working professionals</td><td>UT Austin online M.S. in AI (about $10,000 in total; 700 students in its first class); Georgia Tech online M.S. in computer science (under $7,000); CU Boulder M.S. in AI on Coursera ($15,750, no application); Johns Hopkins online M.S. in AI ($5,620 a course, 10 courses). UChicago announced a nine-month, in-person M.S. in Applied AI on September 17, 2026.</td><td>About $7,000–$56,000; one to three years part time</td></tr>
        <tr><td><strong>MBA</strong></td><td>AI courses made compulsory; AI majors</td><td>Harvard Business School requires "Data Science and AI for Leaders"; Wharton offers an MBA major in AI for Business (from fall 2025); Kellogg's MBAi; Chicago Booth's applied-AI concentration; MIT Sloan AI courses. Half of prospective business-school students expect AI in the curriculum, up from 17% in 2022 (GMAC).</td><td>Within a degree</td></tr>
        <tr><td><strong>Executive education</strong></td><td>Short, high-priced courses for senior leaders</td><td>MIT Sloan online AI strategy course ($3,850, six weeks); a five-day, in-person MIT course ($12,900, per Bloomberg); Stanford GSB six-day AI program ($18,500).</td><td>$3,850–$18,500; days to weeks</td></tr>
        <tr><td><strong>Professional degrees</strong></td><td>AI added to law, medicine, accounting and nursing training</td><td>Case Western requires every first-year law student to earn a legal-AI certification; Suffolk Law requires a generative-AI track. U.S. and Canadian medical schools teaching AI rose from 53% (2023) to 77% (2024) (AAMC). The AICPA is studying early-career CPA skills in a profession "increasingly shaped by AI." Florida Atlantic pairs a nursing B.S. with an AI M.S. Engineering accreditor ABET has AI/ML program criteria in final review for fall 2027.</td><td>Within a degree</td></tr>
        <tr><td><strong>Alumni and lifelong learning</strong></td><td>Free AI courses for graduates</td><td>Indiana University's GenAI 101 for 805,000+ alumni; Purdue's 50 free alumni courses (more in the alumni table below).</td><td>Free</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Selected examples, not a census. Counts of AI programs depend on the definition: 23 institutions award federally coded AI bachelor's degrees (CRA, 2025 data), 62 colleges have standalone AI majors (CRA, Apr 2026), and a Stanford-led survey counts more than 350 undergraduate AI programs of all kinds, including minors and certificates (May 2026). Cost range for mid-career programs is total tuition for the programs listed. Sources: CRA (Apr 28, 2026); university and program pages; Boston Globe (Jun 8, 2026); GMAC (Apr 2026); AAMC; Bloomberg (May 19, 2026); CSAB (Jul 27, 2026).</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Students are moving from computer science to AI · NSC; CRA; MIT</span><p>Computer science enrollment fell in fall 2025 at every award level, by 3.6% to 14.0% (National Student Clearinghouse), and new computer science bachelor's enrollments fell 12.9% (CRA Taulbee Survey). AI majors are growing: MIT's AI and Decision Making major went from 37 students in 2022 to 372 in 2025.</p></li>
    <li><span class="who">AI companies on campus</span><p>The California State University system gave ChatGPT Edu to more than 460,000 students (OpenAI, 2025). Anthropic's Claude for Education runs at Northeastern, the London School of Economics and Syracuse. Google committed $1 billion over three years to AI education at U.S. colleges and nonprofits; Microsoft's Elevate program, $4 billion over five years.</p></li>
    <li><span class="who">Older learners · edX (Nov 2025)</span><p>72% of Gen X and Baby Boomer adults without formal AI education say free courses would most motivate them to learn. We found no federal data on enrollment in AI programs by age.</p></li>
    <li><span class="who">Does it pay off? · Oxford Internet Institute (Jan 2026)</span><p>In a hiring experiment with about 1,700 recruiters in the U.S., U.K. and Germany, listing AI skills raised the chance of an interview invitation by about 8–15 percentage points and partly offset disadvantages of age and education. The study measures interview invitations, not jobs or pay.</p></li>
    <li><span class="who">Skeptics</span><p>"Is it glitz or is it substance?" asked Andrew Armacost, president of the University of North Dakota (Boston Globe, Jun 2026). The Burning Glass Institute calls AI credentials "a wild, wild west." Employers rank strategic thinking and problem-solving above AI literacy in MBA hires (GMAC), and an unverified industry index finds 42% of 60 business schools require no AI coursework.</p></li>
  </ul>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>For an experienced professional, the most accessible options are also the cheapest: free alumni courses and online master's degrees under about $16,000. The most expensive option, executive education, has the least outcome evidence. Until colleges publish placement and earnings data for AI programs, the safest reading is that an AI credential helps get an interview, not that it gets a job.</p>


  <h3 id="debt">The cost side of the degree: price, completion, payback and debt</h3>
  <p>If the bachelor's degree is the entry ticket to most of the jobs this report tracks, its cost, the odds of finishing and the debt it leaves matter, especially for someone who is out of work.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 25</span>
    <span class="ex-title">Higher education: price, completion, payback and student debt (latest available)</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Measure</th><th>Latest</th><th>Source (date)</th></tr></thead>
      <tbody>
        <tr><td><strong>Price</strong>, published tuition and fees, 2025–26</td><td>Public four-year in-state $11,950 ($25,850 with housing and food); out-of-state $31,880; private nonprofit $45,000 ($60,920). Net of grants: about $2,300 public in-state and $16,910 private. Over ten years, published tuition fell 7% after inflation at public in-state schools and rose 2% at private ones</td><td>College Board (Nov 2025)</td></tr>
        <tr><td>Professional school</td><td>Medical school median four-year cost of attendance $286,454 (public) and $390,848 (private); median medical-school debt $212,341, with 71% of graduates borrowing</td><td>AAMC (class of 2024)</td></tr>
        <tr><td><strong>Completion</strong>, six-year rate for students starting in fall 2019</td><td>61.1% (67.1% for full-time starters; 34.1% for part-time). 37.6 million Americans under 65 have some college but no credential, up 2.2%</td><td>National Student Clearinghouse (Dec 2025; Jun 2025)</td></tr>
        <tr><td><strong>Payback</strong>, earnings premium</td><td>Median bachelor's earnings about $80,000 vs. $47,000 for high school graduates (+68%); rate of return about 12.5%, stable for three decades</td><td>New York Fed (Apr 2025)</td></tr>
        <tr><td>Programs that do not pay off</td><td>About 23% of bachelor's programs, about 43% of master's programs and 39% of MBA programs have negative lifetime return on investment</td><td>FREOPP (May 2024)</td></tr>
        <tr><td>Years to recoup net cost</td><td>Public four-year: 75% of students within 5 years, 94% within 10. Private nonprofit: 47% and 80%</td><td>Third Way (Sep 2023)</td></tr>
        <tr><td><strong>Debt</strong> at graduation</td><td>Bachelor's: 47% borrow, average $29,560 (down from $35,600 a decade earlier, after inflation). Master's: 53% borrow, median $38,566. Professional and doctoral: 78% borrow, average $150,290</td><td>College Board (2023–24 graduates); NCES NPSAS (2019–20)</td></tr>
        <tr><td>Total outstanding</td><td>$1.65 trillion (all lenders, Q2 2026); federal portfolio $1.7 trillion owed by 42.3 million borrowers</td><td>New York Fed (Aug 2026); Federal Student Aid (Sep 2026)</td></tr>
        <tr><td>Repayment trouble</td><td>10.6% of balances 90+ days delinquent (Q2 2026). 9.3 million federal borrowers in default, about 14% of dollars; 2.6 million new defaults in Q1 2026 alone</td><td>New York Fed; Federal Student Aid; Liberty Street Economics (May 2026)</td></tr>
        <tr><td><strong>Share of the wallet</strong></td><td>16% of adults hold student loans. Of borrowers required to pay, 41% recently had trouble paying; fewer than half of borrowers earning under $50,000 paid in full, versus 92% of those earning $100,000+. Each $10,000 of balance cut household spending by about $630 a year after payments restarted in 2023</td><td>Federal Reserve SHED (May 2026); Federal Reserve note (Sep 2025)</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Figures are the latest each source publishes; several predate 2026. Return-on-investment estimates depend on field, institution and whether students finish. Graduate tuition is not published nationally after 2021–22.</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Debt and unemployment · data gap</span><p>No public data source reports student debt or delinquency by employment status or by how long someone has been unemployed. The Federal Reserve's household survey splits payment trouble by income only. We therefore cannot say how much debt the long-term unemployed carry; we can say that payment trouble is concentrated among lower earners, which is where long searches push people.</p></li>
    <li><span class="who">What happens to payments when you lose a job</span><p>Federal borrowers can currently defer payments for unemployment (generally up to three years, with interest still building on unsubsidized loans). For loans made on or after July 1, 2027, unemployment and economic-hardship deferment are eliminated and forbearance is capped at 9 months in any 24; a borrower with no income on the new Repayment Assistance Plan still owes $10 a month. The Education Department paused wage garnishment and Treasury offsets for defaulted loans in January 2026, and no restart had been announced by September 30.</p></li>
    <li><span class="who">Graduate borrowing caps · July 1, 2026</span><p>Grad PLUS loans ended for new borrowers. Graduate students can now borrow $20,500 a year ($100,000 total) and professional students $50,000 a year ($200,000 total); Parent PLUS is capped at $20,000 a year per child. The new Repayment Assistance Plan opened July 1, 2026, and the SAVE plan ended, with 7.5 million enrollees told to choose a new plan. For mid-career professionals considering a master's to change fields, these caps mean more out-of-pocket or private borrowing.</p></li>
  </ul>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>For most graduates a bachelor's degree still pays, but the margin depends on finishing, on the program and on not being out of work long. A long search hits degree holders twice: lost earnings and loan payments that continue unless a deferment is in place, and the deferment safety net is narrowing for new loans from 2027.</p>

  <h3>Alumni programs</h3>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 26</span>
    <span class="ex-title">Selected university programs for alumni, 2025–2026</span>
    <div class="tbl"><table>
      <thead><tr><th>School</th><th class="l">What alumni get</th><th>Since</th></tr></thead>
      <tbody>
        <tr><td>Purdue</td><td class="l">50 free online courses, including Google Career Certificates and AI courses</td><td>Feb 2026</td></tr>
        <tr><td>University of Michigan</td><td class="l">Free Google Career Certificates and 300+ free courses for about 700,000 alumni</td><td>Jan 2026</td></tr>
        <tr><td>Indiana University</td><td class="l">Free "GenAI 101" course for 805,000+ alumni</td><td>Oct 2025</td></tr>
        <tr><td>NYU</td><td class="l">Free Google AI Professional Certificate for all alumni (as reported by Forbes)</td><td>Jun 2026</td></tr>
        <tr><td>Penn State</td><td class="l">Free job-search series for alumni facing a layoff or career pivot</td><td>May 2026</td></tr>
        <tr><td>Cornell</td><td class="l">30% off eCornell certificates; alumni career relaunch program</td><td>2026</td></tr>
        <tr><td>Northeastern</td><td class="l">25% tuition scholarship for alumni on online graduate certificates, including AI</td><td>2026</td></tr>
        <tr><td>Stanford GSB, HBS, Duke Fuqua</td><td class="l">Free alumni career coaching: lifetime (Stanford GSB), six sessions a year (HBS), up to four a year (Fuqua)</td><td>Ongoing</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Not a complete list. We found no national survey measuring how many colleges offer lifelong career services to alumni. Sources: university pages and releases; Forbes (Jun 9, 2026).</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Alumni view · NACM (2024)</span><p>In a survey of 9,000+ alumni at 34 institutions, 49% rated their school highly on career preparation and 23% on its ongoing investment in their careers.</p></li>
    <li><span class="who">Adult learners</span><p>First-time college students aged 25+ fell 15.5% from fall 2024 to fall 2025, as reported by Inside Higher Ed.</p></li>
    
    
    
    
  </ul>
</section>

<section id="jobsfuture" aria-labelledby="h-jf">
  <div class="chapter-head"><div class="eyebrow">Chapter 10</div><h2 id="h-jf">Jobs being created and destroyed</h2></div>
  <p class="lead">AI is reshaping which jobs grow, not yet how many there are. Postings that mention AI doubled in a year, to 6.7% of all U.S. postings, while the government's new ten-year projections expect declines concentrated in clerical, customer-service and routine programming work.</p>
  <div class="two">
    <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
      <span class="ex-label">Exhibit 27</span>
      <span class="ex-title">Fastest-growing occupations, projected 2025–35</span>
      <div class="tbl"><table>
        <thead><tr><th>Occupation</th><th>Growth</th></tr></thead>
        <tbody>
          <tr><td>Nurse practitioners</td><td>+41.0%</td></tr>
          <tr><td>Solar photovoltaic installers</td><td>+36.5%</td></tr>
          <tr><td>Data scientists</td><td>+34.6%</td></tr>
          <tr><td>Wind turbine technicians</td><td>+29.5%</td></tr>
          <tr><td>Computer and information research scientists</td><td>+21.8%</td></tr>
          <tr><td>Information security analysts</td><td>+21.0%</td></tr>
        </tbody></table></div>
    </div>
    <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
      <span class="ex-label">Exhibit 28</span>
      <span class="ex-title">Fastest-declining occupations, projected 2025–35</span>
      <div class="tbl"><table>
        <thead><tr><th>Occupation</th><th>Change</th></tr></thead>
        <tbody>
          <tr><td>Word processors and typists</td><td class="neg">−34.4%</td></tr>
          <tr><td>Telephone operators</td><td class="neg">−27.6%</td></tr>
          <tr><td>Switchboard operators</td><td class="neg">−26.0%</td></tr>
          <tr><td>Data entry keyers</td><td class="neg">−25.5%</td></tr>
          <tr><td>Telemarketers</td><td class="neg">−21.4%</td></tr>
          <tr><td>Order clerks</td><td class="neg">−17.5%</td></tr>
        </tbody></table></div>
    </div>
  </div>
  <p class="note">Source: BLS Employment Projections 2025–35 (August 27, 2026). Total employment is projected to grow 3.5%, to 176.2 million. BLS expects AI-powered automation to reduce office and administrative support employment by 4.0% (−752,100 jobs) and cites AI in projected losses in sales.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 29</span>
    <span class="ex-title">Where BLS explicitly cites AI in its occupational outlook</span>
    <div class="tbl"><table>
      <thead><tr><th>Occupation</th><th>2025 jobs</th><th>Projected change, 2025–35</th><th class="l">What BLS says</th></tr></thead>
      <tbody>
        <tr><td>Software developers and QA testers</td><td>1,905,400</td><td>+10%</td><td class="l">AI is a source of demand</td></tr>
        <tr><td>Computer programmers</td><td>110,800</td><td class="neg">−7%</td><td class="l">AI used to automate repetitive programming tasks</td></tr>
        <tr><td>Customer service representatives</td><td>2,666,000</td><td class="neg">−5%</td><td class="l">Self-service and automated systems</td></tr>
        <tr><td>Paralegals and legal assistants</td><td>404,900</td><td>0%</td><td class="l">AI "may reduce demand"</td></tr>
        <tr><td>Writers and authors</td><td>140,300</td><td>0%</td><td class="l">AI writing tools "projected to dampen demand"</td></tr>
        <tr><td>Interpreters and translators</td><td>73,900</td><td>+2%</td><td class="l">AI raises efficiency but cannot fully automate the work</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Source: BLS Occupational Outlook Handbook, 2025–35 projections. BLS's separate July 2026 analysis of the prior projections named customer service representatives, claims adjusters, legal secretaries, procurement clerks and credit authorizers as occupations where AI adoption is expected to dampen demand.</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">AI demand · Indeed Hiring Lab</span><p>Postings that mention AI reached 6.74% of U.S. postings on August 31, 2026, up from 3.44% a year earlier and 1.70% in 2019 (NextChapter calculation from Indeed's published tracker data).</p></li>
    <li><span class="who">Rising roles · LinkedIn (Jan 2026)</span><p>AI engineers and AI consultants top LinkedIn's 2026 U.S. Jobs on the Rise; data annotators (#4), independent consultants (#7) and founders (#9) also made the list, as reported by Allwork.Space.</p></li>
    <li><span class="who">Programmers vs. developers</span><p>BLS projects computer programmers to shrink while software developers grow: the work of writing routine code is being automated, while designing and integrating systems is not. Fortune, citing a Washington Post analysis of BLS survey data, reports programmer employment at its lowest since 1980.</p></li>
    <li><span class="who">Skill demands · PwC (Jun 2026, global)</span><p>AI-specialist roles are growing 69% a year against 9% for all jobs, and entry-level roles in AI-exposed fields are 7 times more likely to ask for senior-level skills.</p></li>
    <li><span class="who">Global view · WEF (2025)</span><p>Employers expect 170 million jobs created and 92 million displaced worldwide by 2030; cashiers, administrative assistants and graphic designers are among the fastest-declining roles.</p></li>
  </ul>
</section>

<section id="newbiz" aria-labelledby="h-nb">
  <div class="chapter-head"><div class="eyebrow">Chapter 11</div><h2 id="h-nb">New businesses, self-employment and AI</h2></div>
  <p class="lead">Americans are filing to start businesses at near-record rates, and AI is making it cheaper to launch one. But the share of workers who are self-employed has not risen, so the boom in filings has not yet become a broad shift of displaced workers into running their own firms.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 30</span>
    <span class="ex-title">Business starts and self-employment</span>
    <div class="tbl"><table>
      <thead><tr><th>Measure</th><th>Latest</th><th>Year earlier</th><th>2019</th></tr></thead>
      <tbody>
        <tr><td>Business applications, August (seasonally adjusted)</td><td>531,728</td><td>477,409 (+11.4%)</td><td>292,063</td></tr>
        <tr><td>High-propensity applications (likely to hire), August</td><td>145,387</td><td>+1.9%</td><td>+31% since 2019</td></tr>
        <tr><td>Self-employed share of employed workers, Jan–Aug (NSA)</td><td>10.1%</td><td>10.2%</td><td>9.9%</td></tr>
        <tr><td>&nbsp;&nbsp;White-collar workers</td><td>11.3%</td><td>11.3%</td><td>11.7%</td></tr>
        <tr><td>&nbsp;&nbsp;Workers 55 and older</td><td>16.2%</td><td>16.6%</td><td>16.4%</td></tr>
        <tr><td>New entrepreneurs per month, % of adults (Kauffman)</td><td>0.36% (2025)</td><td>0.33% (2024)</td><td>0.31%</td></tr>
        <tr><td>Share of new entrepreneurs coming from unemployment (Kauffman)</td><td>16.7% (2025)</td><td>—</td><td>13.1%</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Business applications: Census Bureau Business Formation Statistics via FRED; percent changes are NextChapter calculations. Self-employment: NextChapter calculation from Census CPS microdata (incorporated and unincorporated self-employed). Kauffman Indicators of Entrepreneurship, 2025 national report (May 2026); the unemployment share is 100% minus Kauffman's reported 83.3% "opportunity" share.</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">AI lowers the cost of starting · Gusto (May 2026)</span><p>60% of founders who started businesses in 2025 used AI to launch, up from 21% in 2023. Financial stability (51%) now outranks autonomy (46%) as the main reason for starting.</p></li>
    <li><span class="who">Smaller founding teams · Carta; Stripe</span><p>Solo founders were 36.3% of new startups in the first half of 2025, up from 23.7% in 2019 (Carta). 42% of companies formed through Stripe Atlas in 2025 were AI-focused, and 20% had a paying customer within 30 days.</p></li>
    <li><span class="who">Business AI adoption · Census Bureau</span><p>Between 17% and 20% of businesses reported using AI from December 2025 to May 2026, but under 20% of firms with four or fewer employees, against 37% of firms with 250 or more.</p></li>
    <li><span class="who">Independent work · MBO Partners (2025)</span><p>72.9 million Americans did independent work, 27.6 million of them full time, and 74% of independents used generative AI.</p></li>
    <li><span class="who">Funding · SBA</span><p>The SBA's 7(a) and 504 programs lent a record $44.8 billion in fiscal 2025, including $5.6 billion to startups.</p></li>
  </ul>
  <p class="note">For displaced professionals: consulting, fractional and founder roles are growing options, and AI tools lower the cost of trying one. The data so far show more people filing to start businesses, not more people earning a living from self-employment, so a bridge business works best alongside a search, not as an assumed replacement for salary. No rigorous 2025–2026 study yet tracks how many laid-off professionals start businesses.</p>
</section>

<section id="geography" aria-labelledby="h-geo">
  <div class="chapter-head"><div class="eyebrow">Chapter 12</div><h2 id="h-geo">States: where jobs grew most and least</h2></div>
  <p class="lead">Over the year to August 2026, job growth was fastest in South Carolina, New Mexico and Louisiana (+1.6% each), and Texas added the most jobs (+159,400). The District of Columbia was the only place with a statistically significant decline (−27,000, −3.6%), driven by government job losses.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 31</span>
    <span class="ex-title">Payroll job change by state, August 2025 to August 2026</span>
    <div class="two">
      <div class="tbl"><table>
        <thead><tr><th>Fastest growth</th><th>Jobs</th><th>%</th></tr></thead>
        <tbody>
          <tr><td>South Carolina*</td><td>+38,600</td><td>+1.6%</td></tr>
          <tr><td>New Mexico*</td><td>+14,500</td><td>+1.6%</td></tr>
          <tr><td>Louisiana*</td><td>+32,100</td><td>+1.6%</td></tr>
          <tr><td>Minnesota*</td><td>+43,900</td><td>+1.5%</td></tr>
          <tr><td>North Carolina*</td><td>+65,600</td><td>+1.3%</td></tr>
          <tr><td>Texas*</td><td>+159,400</td><td>+1.1%</td></tr>
        </tbody></table></div>
      <div class="tbl"><table>
        <thead><tr><th>Weakest</th><th>Jobs</th><th>%</th></tr></thead>
        <tbody>
          <tr><td>District of Columbia*</td><td class="neg">−27,000</td><td class="neg">−3.6%</td></tr>
          <tr><td>Montana</td><td class="neg">−5,000</td><td class="neg">−0.9%</td></tr>
          <tr><td>Virginia</td><td class="neg">−37,700</td><td class="neg">−0.9%</td></tr>
          <tr><td>Oregon</td><td class="neg">−16,100</td><td class="neg">−0.8%</td></tr>
          <tr><td>Indiana</td><td class="neg">−16,100</td><td class="neg">−0.5%</td></tr>
          <tr><td>New Jersey</td><td class="neg">−9,900</td><td class="neg">−0.2%</td></tr>
        </tbody></table></div>
    </div>
    <span class="ex-note">* Statistically significant change according to BLS. Seasonally adjusted. Percent changes are NextChapter calculations from BLS levels. Source: BLS State Employment and Unemployment, August 2026 (Sep 18, 2026).</span>
  </div>
  <p>For white-collar work the split is sharp. Professional and business services jobs grew about 3% in Texas and North Carolina but fell in Virginia (−1.8%), DC (−2.7%), California and Massachusetts. Financial-activities jobs fell in California, Washington, Massachusetts, Virginia and Maryland. Unemployment rates are highest in DC (5.7%), California, Connecticut and Oregon (5.1% each) and Michigan (5.0%), and lowest in South Dakota (2.0%) and North Dakota (2.2%). Connecticut (+1.0 point) and Oklahoma (+0.9) had the largest over-the-year increases; New Jersey (−1.2) and Ohio (−1.1, a record low of 3.3%) improved most.</p>
</section>

<section id="safetynet" aria-labelledby="h-sn">
  <div class="chapter-head"><div class="eyebrow">Chapter 13</div><h2 id="h-sn">The safety net, policy and public retraining</h2></div>
  <p class="lead">In the 12 months to August 2026, 39.3% of unemployment insurance claimants exhausted their benefits. Claimants drew benefits for 15.8 weeks on average, at $493 a week. These are completed benefit spells; the 24.8-week average in Exhibit 7 is for searches still in progress, so the two measure different things. Together they suggest many long-term job seekers are past the end of their benefits.</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Uneven access</span><p>State recipiency rates ranged from 8% to 55% of the unemployed in 2025 (Minneapolis Fed). Florida and North Carolina cap benefits at 12 weeks. Virginia raised its maximum weekly benefit to $478 and Iowa to $790 in July 2026.</p></li>
    <li><span class="who">Severance</span><p>Some states delay or offset benefits during paid severance; executives should check their state's rules before filing.</p></li>
    <li><span class="who">Paid family leave</span><p>Delaware and Minnesota began paying benefits January 1, 2026, and Maine on May 1; Minnesota received about 100,000 applications in six months. Maryland's start is delayed to 2028. Returnship programs continue at large employers, but we found no reliable 2026 count.</p></li>
    <li><span class="who">AI layoff disclosure</span><p>California's SB 951 takes effect January 1, 2027. A federal bill, the AI-Related Job Impacts Clarity Act, would require large employers to report AI-related layoffs to the Labor Department.</p></li>
  </ul>

  <h3>Public retraining: what WIOA offers a laid-off professional</h3>
  <p>The main federal retraining program for laid-off workers is the Dislocated Worker program under the Workforce Innovation and Opportunity Act (WIOA). It is small relative to white-collar job loss, its funding is flat, only about one participant in five receives training, and its typical outcomes are pitched at middle-wage jobs.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 32</span>
    <span class="ex-title">The WIOA Dislocated Worker program: funding and results</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Measure</th><th>Value</th></tr></thead>
      <tbody>
        <tr><td>Appropriation, fiscal 2026 (program year starting July 2026)</td><td>$1.396 billion, including the national reserve; essentially unchanged from 2025. Adult program $876 million; Youth $948 million</td></tr>
        <tr><td>Participants served, program year 2024 (July 2024–June 2025)</td><td>187,108</td></tr>
        <tr><td>Participants who received training</td><td>37,119 (about 20%)</td></tr>
        <tr><td>Training spending per trainee</td><td>$7,285</td></tr>
        <tr><td>Employed in the second / fourth quarter after leaving</td><td>69.0% / 70.5%</td></tr>
        <tr><td>Median earnings in the second quarter after leaving</td><td>$9,897 a quarter (about $39,600 a year)</td></tr>
        <tr><td>Earned a credential</td><td>75.1%</td></tr>
        <tr><td><em>For scale:</em> white-collar workers unemployed 27+ weeks, January–August 2026 average</td><td><em>About 546,000 (NextChapter, CPS)</em></td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Program year 2024 is the latest national data. Training share is trainees divided by participants served, and annual earnings are the quarterly median times four (our calculations). The scale row compares sizes only; not every long-term unemployed worker is eligible for, or would use, WIOA. Sources: DOL Employment and Training Administration, PY2024 WIOA National Performance Summary (Nov 2025); Federal Register WIOA allotments notice (Apr 2026).</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Funding outlook</span><p>The fiscal 2026 spending law (Feb 3, 2026) held WIOA formula grants flat, and a stopgap signed September 2 (H.R. 6500) extends those levels through December 11, 2026. The President's fiscal 2027 budget again proposes folding 12 programs into a $3.4 billion "Make America Skilled Again" block grant. The House fiscal 2027 Labor-HHS bill, approved in committee in June, would cut WIOA's main formula grants by about 62%, eliminating the Youth program and nearly eliminating Adult while leaving Dislocated Worker largely intact. A reauthorization bill, H.R. 8210 (A Stronger Workforce for America Act), passed committee 19–14 in April.</p></li>
    <li><span class="who">AI-specific guidance · Labor Department</span><p>Guidance issued in August 2025 (TEGL 03-25) lets states spend WIOA funds on AI literacy and training, and the department published an AI Literacy Framework in February 2026. In June 2026, TEGL 15-25 offered about $50 million in Rapid Reskill Employment Recovery National Dislocated Worker Grants, which name "the broad and accelerating economic transformation driven by AI" as the qualifying event; it points grantees toward manufacturing, aerospace, energy, construction and semiconductors more than office work. We found no award announcements by September 30.</p></li>
    <li><span class="who">Workforce Pell</span><p>Short-term Pell grants for 8–15-week programs began July 1, 2026, and bachelor's degree holders can qualify. By September 28, 21 programs in six states had federal approval (Opportunity Data), mainly in trades and health care such as EMT and medical-assistant training, not white-collar retraining.</p></li>
    <li><span class="who">Trade Adjustment Assistance</span><p>The federal program for workers displaced by trade has accepted no new petitions since its authority lapsed on July 1, 2022. No federal program is designed for workers displaced by technology.</p></li>
    <li><span class="who">Does training work? · Mathematica (2019); sector studies</span><p>The national evaluation of WIOA's predecessor found staff assistance raised earnings by about $7,100 over 30 months; the effect of training was inconclusive. Sector programs built with employers (Year Up, Per Scholas, Project QUEST) show large, lasting gains, but mainly for young and low-income adults. We found no rigorous evaluation of retraining for displaced managers and professionals.</p></li>
    <li><span class="who">Review of trials · Anthropic (Aug 2026)</span><p>A review of 56 U.S. randomized trials finds training raises employment 2–3 points and earnings about $1,000 a year, at roughly $13,000 per participant; sector programs built with employers do several times better.</p></li>
    <li><span class="who">State partnerships · California (Jul 2026)</span><p>"AI-Ready California" offers free AI-literacy micro-credentials through San Diego State, including to unemployment-insurance claimants, and the state now tracks jobless claims in AI-exposed occupations monthly.</p></li>
  </ul>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>The public system is built for reemployment in middle-wage jobs. A laid-off manager earning six figures will find little in a program whose typical participant earns about $40,000 a year after leaving and where training averages about $7,300. For experienced professionals, the gap is filled, if at all, by severance, employer-paid outplacement, alumni programs and self-funded courses.</p>
</section>

<section id="context" aria-labelledby="h-ctx">
  <div class="chapter-head"><div class="eyebrow">Chapter 14</div><h2 id="h-ctx">New graduates and blue-collar work</h2></div>
  <p class="lead">The two groups outside the white-collar core are moving in opposite directions. New college graduates face the weakest entry-level market in years, and their unemployment advantage over peers without degrees has narrowed. Skilled trades are short of workers, wages are rising faster than average, and AI exposure is low.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 33</span>
    <span class="ex-title">Young adults and blue-collar workers, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Group</th><th>Unemployment 2026</th><th>2025</th><th>2019</th><th>Out 27+ weeks 2026</th><th>2025</th></tr></thead>
      <tbody>
        <tr><td>Ages 22–27, bachelor's degree or higher</td><td>5.5%</td><td>5.3%</td><td>3.9%</td><td>25.5%</td><td>21.8%</td></tr>
        <tr><td>Ages 22–27, high school diploma only</td><td>7.7%</td><td>7.7%</td><td>7.0%</td><td>27.3%</td><td>21.9%</td></tr>
        <tr><td>Blue-collar (construction, installation and repair, production, transportation)</td><td>5.0%</td><td>5.1%</td><td>4.4%</td><td>22.6%</td><td>19.4%</td></tr>
        <tr><td>White-collar, for comparison</td><td>2.7%</td><td>2.5%</td><td>2.1%</td><td>28.1%</td><td>22.8%</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">NextChapter calculation from Census CPS microdata, not seasonally adjusted. Recent-graduate unemployment is higher than in 2019 by more than its margin of error (+1.5 pts ±0.7); changes from 2025 are within the margin of error. Unemployed white-collar workers are more likely than blue-collar workers, beyond the margin of error, to be out 27+ weeks (28.1% vs. 22.6%). Blue-collar = last job in major occupation groups 7–10.</span>
  </div>
  <h3>New college graduates</h3>
  <p>The degree still pays, but less of a cushion than it used to. Young graduates' unemployment rate is 1.5 points above 2019 while young high-school graduates' rose 0.8 points, so the gap between them has narrowed from 3.0 to 2.2 points. The Cleveland Fed finds young graduates' job-finding rates have fallen to roughly match high-school graduates', the narrowest gap since the late 1970s (as reported by Fox Business).</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Official data · NY Fed; BLS</span><p>Recent graduates aged 22–27 had 5.6% unemployment and 42% underemployment in Q2 2026. Unemployment for all 20–24-year-olds fell to 8.0% in September from 9.2% a year earlier (BLS, seasonally adjusted).</p></li>
    <li><span class="who">By major · NY Fed (2024 data)</span><p>Computer engineering (7.8%) and computer science (7.0%) are among the five majors with the highest unemployment, yet they still have low underemployment and median early-career pay near $87,000–$90,000. Criminal justice and performing arts graduates are most often underemployed (66% and 64%). Figures as reported by Research.com.</p></li>
    <li><span class="who">Hiring and pay · NACE (2026)</span><p>Employers planned to hire 5.6% more class-of-2026 graduates and 45% rated the market "fair." Projected starting salaries: computer science $81,535 (+6.9%), engineering $81,198, business $68,873.</p></li>
    <li><span class="who">Entry-level squeeze · Stanford; Anthropic; PwC</span><p>Employment of 22–25-year-olds in the most AI-exposed jobs is about 19% below less-exposed peers (Stanford, Aug 2026). Job starts in AI-exposed occupations for that age group fell about 14% after ChatGPT launched (Anthropic). Entry-level roles in AI-exposed fields are 7 times more likely to ask for senior-level skills (PwC).</p></li>
    <li><span class="who">AI readiness · Handshake; NACE; ZipRecruiter</span><p>85% of 2026 seniors use AI, but only 28% say their programs meaningfully built it in, while 13.3% of entry-level postings already ask for AI skills (NACE). Fewer than 30% of 2026 graduates received substantial AI training (ZipRecruiter survey). 62% of seniors are pessimistic about the market, up from 46% two years ago (Handshake).</p></li>
    <li><span class="who">What helps · ZipRecruiter; Strada</span><p>82% of 2026 graduates with work experience found jobs, against 41% without. Graduates whose first job requires a degree are 3.5 times as likely to be in a college-level job ten years later (Strada), which is why the first job matters so much.</p></li>
  </ul>
  <h3>Blue-collar and skilled trades</h3>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 34</span>
    <span class="ex-title">Blue-collar employment and pay, September 2025 to September 2026</span>
    <div class="tbl"><table>
      <thead><tr><th>Sector</th><th>Jobs, Sep 2026</th><th>Change over year</th><th>Hourly pay, production and nonsupervisory</th><th>Pay change</th></tr></thead>
      <tbody>
        <tr><td>Construction</td><td>8.36M</td><td>+109K (+1.3%)</td><td>$39.20</td><td>+4.3%</td></tr>
        <tr><td>&nbsp;&nbsp;Specialty trade contractors</td><td>5.28M</td><td>+56K</td><td>—</td><td>—</td></tr>
        <tr><td>Manufacturing</td><td>12.65M</td><td>+40K (+72K since Dec)</td><td>$30.21</td><td>+3.4%</td></tr>
        <tr><td>Transportation and warehousing</td><td>6.61M</td><td>−0.1%</td><td>$31.50</td><td>+4.3%</td></tr>
        <tr><td>All private industries</td><td>—</td><td>—</td><td>$32.60</td><td>+3.3%</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Seasonally adjusted; September 2026 preliminary. Source: BLS Employment Situation tables B-1 and B-8; pay changes are NextChapter calculations from BLS levels.</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Shortages · ABC; HBI</span><p>Construction needs about 349,000 new workers in 2026 and 456,000 in 2027, mostly to replace retirees; about one in five electricians is over 55 (Associated Builders and Contractors, Jan 2026). The skilled-labor shortage costs homebuilding about $10.8 billion a year (Home Builders Institute).</p></li>
    <li><span class="who">Data centers · BLS; IBEW/NECA</span><p>BLS projects electricians to grow 9% over 2025–35, with about 72,700 openings a year, citing AI and data centers. Electrical work is 45–70% of the cost of building a data center, and union apprenticeship applications rose from about 70,000 to 120,000 between 2022 and 2024 (Fortune, citing IBEW and NECA).</p></li>
    <li><span class="who">Training pipeline · DOL; National Student Clearinghouse</span><p>Registered apprentices number about 700,000, the first year-over-year dip in a decade (Bloomberg Law, citing DOL data). Enrollment at vocational-focused community colleges rose 2.8% in spring 2026, and undergraduate certificate programs grew fastest (+10.2%) while computer science enrollment fell.</p></li>
    <li><span class="who">Automation · IFR (Jun 2026)</span><p>U.S. industrial robot installations rose 11% to 38,000 in 2025, led by food and non-manufacturing industries rather than autos.</p></li>
    <li><span class="who">AI exposure · Anthropic (Mar 2026)</span><p>Construction, installation and repair, and transportation occupations show the lowest observed AI exposure; about 30% of workers have none.</p></li>
  </ul>
  <p class="note"><span class="lbl i">What this may mean</span> What it means for professionals: trades are not a realistic pivot for most experienced office workers, but the contrast explains why headline job numbers look steadier than white-collar workers feel. Adjacent roles do exist where office skills meet the building boom: project management, estimating, procurement, safety and operations in construction, energy and data-center firms.</p>
</section>

<section id="outlook" aria-labelledby="h-out">
  <div class="chapter-head"><div class="eyebrow">Chapter 15</div><h2 id="h-out">What to watch and release calendar</h2></div>
  <p>The BLS jobs report is released at 8:30 a.m. Eastern, usually on the first Friday of the month. This report publishes within two business days after it; the White-Collar Index is updated when the Census Bureau posts that month's microdata, usually one to two weeks later.</p>
  <div class="watch">
    <div><span class="d">Nov 3</span><span>JOLTS for September: whether openings keep sliding toward one per unemployed person.</span></div>
    <div><span class="d">Early Nov</span><span>Challenger job cuts for October, including AI-attributed cuts.</span></div>
    <div><span class="d">Nov 6</span><span>BLS jobs report for October. Watch long-term unemployment and the information and finance sectors.</span></div>
    <div><span class="d">Mid-Oct / Nov</span><span>Census microdata for September and October; White-Collar Index updates.</span></div>
    <div><span class="d">Dec 4</span><span>BLS jobs report for November.</span></div>
    <div><span class="d">Dec 11</span><span>Federal stopgap funding expires, with FY2027 workforce cuts proposed.</span></div>
    <div><span class="d">Jan 1, 2027</span><span>California's AI layoff-disclosure law takes effect; Colorado's AI law follows.</span></div>
  </div>

  <h3>Use-case watch: from AI deployments to jobs</h3>
  <p>Company announcements about AI are easy to find; their effect on jobs is not. Each month we pair a few well-documented deployments with a public jobs series for the affected industry, so readers can see whether employment moves the way the announcements imply. Company claims are not measurements, and a jobs series cannot separate AI from other causes. We list failures and reversals alongside successes.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 35</span>
    <span class="ex-title">Use-case watch: announced AI deployments and the jobs series we track</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Industry or function</th><th>What was deployed or claimed</th><th>Independent evidence</th><th>Jobs series (thousands): Aug 2026 / Aug 2025 / Aug 2019</th><th>Other explanations</th></tr></thead>
      <tbody>
        <tr><td><strong>Film and TV production</strong></td><td>Netflix bought InterPositive, Ben Affleck's AI post-production company, on March 5, 2026 (terms not disclosed). Its tools train on a production's own footage for relighting, color, effects and background replacement rather than generating scenes from prompts. Netflix said generative AI made one visual effect on <em>El Eternauta</em> ten times faster; Lionsgate partnered with Runway in 2024.</td><td>Reports in 2025 said Lionsgate's custom Runway model stalled because the catalog was too small. 2026 writers' and actors' contracts (ratified April and June) keep limits on AI.</td><td>Motion picture and sound recording: 328.7 / 349.0 / 433.1 (−5.8% in a year; −24% since 2019)</td><td>Strikes in 2023, streaming budget cuts, production moving abroad; Los Angeles shoot days fell 16% in 2025.</td></tr>
        <tr><td><strong>Customer service</strong></td><td>Klarna said its AI assistant did the work of 700 agents (Feb 2024); Salesforce cut support staff from about 9,000 to 5,000, citing AI agents (Sep 2025).</td><td>None independent. Klarna later resumed hiring people so customers can always reach a human (May 2025).</td><td>Business support services, including call centers: 622.4 / 643.5 / 873.1 (−3.3%)</td><td>Offshoring and self-service; Klarna's staff are mostly outside the U.S.</td></tr>
        <tr><td><strong>Software development</strong></td><td>Microsoft says 20–30% of its code is written by AI (Apr 2025); Google's CEO said 75% of new code is AI-generated and approved by engineers, up from 50% in fall 2025 (Apr 2026). Neither company defines the measure.</td><td>A randomized trial found experienced developers 19% slower with AI tools, though they believed they were faster (METR, Jul 2025). Payroll data show lower employment of 22–25-year-olds in AI-exposed jobs (Stanford, Aug 2025).</td><td>Computer systems design: 2,359.8 / 2,394.0 / 2,216.4 (−1.4%)</td><td>Correction after 2021–22 over-hiring, interest rates, tax treatment of software salaries.</td></tr>
        <tr><td><strong>Legal</strong></td><td>Harvey raised $550 million at a $15.5 billion valuation (Sep 9, 2026) and says most of the largest U.S. law firms use it.</td><td>Stanford researchers found legal AI tools gave wrong answers on 1 in 6 or more test queries (2024). No employment evidence.</td><td>Legal services: 1,247.0 / 1,224.7 / 1,152.6 (+1.8%)</td><td>Litigation and regulatory demand.</td></tr>
        <tr><td><strong>Bank operations</strong></td><td>JPMorgan projected AI could cut operations headcount about 10% (May 2025).</td><td>A forecast, not a result.</td><td>Credit intermediation: 2,526.5 / 2,564.5 / 2,652.8 (−1.5%)</td><td>Branch closures and earlier automation.</td></tr>
        <tr><td><strong>Accounting</strong></td><td>Firms report AI in audit and tax preparation; no quantified claim we could verify.</td><td>None.</td><td>Accounting and bookkeeping services: 1,122.5 / 1,127.1 / 1,019.6 (−0.4%)</td><td>Fewer accounting graduates; offshoring.</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Jobs series are BLS Current Employment Statistics, seasonally adjusted, August of each year (as revised in the October 2 release): CES5051200001, CES6056140001, CES6054150001, CES6054110001, CES5552200001, CES6054120001 (via FRED). Industry series include many jobs unaffected by the named deployments. Sources: Variety (Mar 2026); The Decoder (Jul 2025); TheWrap (2024–2026); WGA and SAG-AFTRA (2026); FilmLA via CBS (Jan 2026); Fortune (Feb 2024); Bloomberg via Entrepreneur (May 2025); The Register (Sep 2025); TechCrunch (Apr 2025); Semafor (Apr 24, 2026); METR (Jul 2025); Stanford SIEPR (Aug 2025); Harvey (Sep 2026); Stanford HAI (May 2024); JPMorgan investor day via Entrepreneur (May 2025).</span>
  </div>

  <h3>Frontier signals: language and expectations</h3>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">"Super Intelligence" in federal usage · Sep 29, 2026</span><p>Executive Order 14434 directs federal agencies to use "Super Intelligence" (SI) in place of "Artificial Intelligence" in their own documents. For now SI carries the same legal definition as AI (15 U.S.C. 9401(3)), and the President's science adviser has 60 days to propose a statutory definition. The order has no employment provisions. A voluntary "White House Accord on Super Intelligence" signed the same day by leaders of major AI companies commits them to safety controls and audits. This report continues to use "AI," the term in its data sources, and notes the federal terminology where relevant. The renaming is a change of terminology; it does not mean federal agencies have found that current systems are smarter than humans, which is what AI labs usually mean by "superintelligence."</p></li>
    <li><span class="who">Recursive self-improvement (RSI)</span><p>RSI refers to AI systems that design and develop their own successors. Anthropic reported that, as of May 2026, more than 80% of the code merged into its codebase was written by its own model, and has called for the option to slow or pause frontier development if needed; OpenAI was reported in September 2026 to have reached its goal of an automated AI "research intern." METR estimates the length of tasks AI can complete has been doubling roughly every six to seven months, but cautions that this does not mean tasks of that length can be delegated reliably. Skeptics, including Princeton's Sayash Kapoor, find AI agents still weak at original research. We include RSI not as a forecast but because it is the main argument for why AI's labor-market effects could accelerate faster than past technologies'.</p></li>
  </ul>
  <div class="watch">
    <div><span class="d">Oct 29–30</span><span>Q3 GDP (Oct 29) and Employment Cost Index (Oct 30), for the Q3 addendum.</span></div>
    <div><span class="d">Nov 5</span><span>Q3 productivity and labor share.</span></div>
    <div><span class="d">Late Nov</span><span>Proposed federal statutory definition of "Super Intelligence" due under EO 14434.</span></div>
    <div><span class="d">End of Dec</span><span>New York FutureWorks Commission recommendations due.</span></div>
  </div>
</section>

<section id="q3" aria-labelledby="h-q3">
  <div class="chapter-head"><div class="eyebrow">Q3 2026 quarterly addendum</div><h2 id="h-q3">The quarter in review: what firms expected, what they did, and how they are reorganizing</h2></div>
  <p class="lead">The September edition of each quarter (March, June, September, December) carries a quarterly addendum. It uses data that only make sense over a full quarter or a year, such as company filings, business surveys and corporate results, and it asks a question the monthly figures cannot answer: are firms changing how they are organized, and is that showing up in hiring? Figures here are labeled as source-reported or as NextChapter calculations. Several Q3 government releases (GDP, the Employment Cost Index and productivity) come out in late October and early November and will be added in the next edition.</p>

  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 36</span>
    <span class="ex-title">Q3 2026 scorecard</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Measure</th><th>Q3 2026 (latest)</th><th>Comparison</th><th>Type</th></tr></thead>
      <tbody>
        <tr><td>Announced job cuts (Challenger)</td><td>129,591</td><td>226,242 in Q2 2026; 202,118 in Q3 2025</td><td>Source-reported; Q3 2025 summed by NextChapter from monthly reports</td></tr>
        <tr><td>…of which AI cited as the reason</td><td>18,393 (14%)</td><td>120,136 (21%) year to date</td><td>Summed by NextChapter from monthly reports</td></tr>
        <tr><td>SEC 8-K filings referencing Item 2.05 (restructuring)</td><td>60</td><td>53 in Q1; 57 in Q2</td><td>NextChapter count, EDGAR</td></tr>
        <tr><td>…whose restructuring section cites AI</td><td>3 (5%)</td><td>4 in Q1 (8%); 9 in Q2 (16%)</td><td>NextChapter hand-coded</td></tr>
        <tr><td>Hires rate, information industry (JOLTS, August)</td><td>1.6%</td><td>2.4% a year earlier</td><td>Source-reported</td></tr>
        <tr><td>Hires rate, professional and business services (JOLTS, August)</td><td>4.2%</td><td>4.6% a year earlier</td><td>Source-reported</td></tr>
        <tr><td>Long-term unemployed, all workers (September)</td><td>1.9 million; 27.1% of unemployed</td><td>23.6% a year earlier</td><td>Source-reported (BLS)</td></tr>
        <tr><td>Nonfarm business productivity (Q2, latest)</td><td>+1.4% annualized; +2.2% over the year</td><td>Q3 release: Nov 5</td><td>Source-reported (BLS)</td></tr>
        <tr><td>Labor share of nonfarm business output (Q2, latest)</td><td>52.8%</td><td>Lowest in the series, which begins in 1947</td><td>Source-reported (BLS)</td></tr>
        <tr><td>Wages and salaries, 12-month change (ECI, Q2, latest)</td><td>3.2% civilian; 3.7% management, professional and related</td><td>Q3 release: Oct 30</td><td>Source-reported (BLS)</td></tr>
        <tr><td>Real GDP growth (Q2, third estimate)</td><td>2.2% annualized</td><td>Q3 advance estimate: Oct 29</td><td>Source-reported (BEA)</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Challenger monthly totals: July 2026 AI-attributed cuts 10,970, August 3,462, September 3,961. Q3 2025 cuts: July 62,075, August 85,979, September 54,064. The SEC rows use the corrected AI search described in Chapter 03. Sources: Challenger, Gray &amp; Christmas; BLS JOLTS (Sep 29, 2026), Employment Situation (Oct 2, 2026), Productivity and Costs (Sep 3, 2026) and Employment Cost Index (Jul 31, 2026); BEA (Sep 30, 2026); SEC EDGAR.</span>
  </div>
  <p>The quarter combined fewer announced layoffs with very little hiring. AI's share of stated layoff reasons fell in Q3 (14%, against 21% for the year), and so did the share of formal restructuring filings citing AI. One quarter is too short to call that a trend. The productivity and labor-share figures are economy-wide and say nothing on their own about AI, but they are the measures to watch if AI begins to raise output faster than employment.</p>

  <h3>What firms expected versus what happened</h3>
  <p>Business surveys let us compare what firms said they would do with what they later did. Four patterns stand out. Firms expect sales to grow three to four times faster than employment. Small firms keep saying they plan to hire, but their actual employment is shrinking. AI adoption has run ahead of expectations. AI-related layoffs have run well behind them.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 37</span>
    <span class="ex-title">Expectations versus outcomes, from business surveys</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Survey</th><th>What firms expected</th><th>What happened, or latest reading</th></tr></thead>
      <tbody>
        <tr><td>New York Fed regional surveys, service firms</td><td>2025: 13% expected AI-related layoffs in the next six months; nearly a quarter of firms planning to use AI expected to hire fewer workers; 44% expected to be using AI</td><td>Aug 2026: 4% reported AI-related layoffs; 15% reduced hiring because of AI (all service firms); 61% used AI</td></tr>
        <tr><td>Census Business Trends and Outlook Survey</td><td>Dec 2025: 20–23% of firms expected to be using AI within six months</td><td>May 2026: 19.8% reported using AI in the past two weeks</td></tr>
        <tr><td>Richmond Fed</td><td>Jun 2024: 45% expected to have implemented AI automation by 2026 (16% had)</td><td>Dec 2025: expectations "largely met or exceeded"; 56% use AI, and AI users were no more likely to cut headcount</td></tr>
        <tr><td>NFIB small-business survey</td><td>Net 9% to 20% of owners planned to add jobs in each month of 2026</td><td>Net change in actual employment was negative for six straight months, reaching −7% in August</td></tr>
        <tr><td>Atlanta Fed Survey of Business Uncertainty (Sep 2026)</td><td>Next 12 months: sales +5.6%, employment +1.4%</td><td>Realized growth: published only in the survey's data files; to be added</td></tr>
        <tr><td>CFO Survey, Duke/Richmond/Atlanta Feds (Q3 2026)</td><td>2026 medians: revenue +5.0%, employment +1.7% (unchanged for three quarters); 2027: revenue +5.0%, employment +1.4%</td><td>Q4 2025: CFOs said AI was "not expected to have much effect on the number of employees" in 2026</td></tr>
        <tr><td>Dallas Fed Texas Business Outlook (May 2026)</td><td>Next few years: 25.7% of firms using or planning to use AI expect it to reduce their need for workers</td><td>So far, among firms using AI: 10.4% say AI has reduced their need for workers; 76.4% no impact</td></tr>
        <tr><td>Conference Board CEO Confidence (Q3 2026)</td><td>34% plan to expand their workforce, 28% to reduce it, 37% no change</td><td>—</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Survey populations, questions and timing differ, so rows are not comparable with each other. The New York Fed 2025 hiring expectation covers only firms planning to use AI, while the 2026 reading covers all service firms; the 2025 expectations referred to the following six months, and the 2026 readings came a year later. Dallas Fed shares are NextChapter sums of published response categories. The Census AI question was broadened in November 2025, so earlier readings are not directly comparable. Sources: Federal Reserve Bank of New York, <em>Liberty Street Economics</em> (Sep 2025 and Sep 1, 2026); Census Bureau (May 26, 2026); Federal Reserve Bank of Richmond (Feb 5, 2026); NFIB Small Business Economic Trends (Aug 2026); Federal Reserve Bank of Atlanta (Sep 30, 2026); The CFO Survey (Sep 23, 2026; Q4 2025); Federal Reserve Bank of Dallas (May 2026); The Conference Board (Aug 6, 2026).</span>
  </div>
  <p>The pattern fits a cautious, low-hire market more than a wave of AI substitution: firms expect to grow without adding much headcount, and only a small minority report that AI has reduced their need for workers so far. A larger minority expect it to in the next few years. That gap between expectation and outcome is exactly what this section will track each quarter.</p>

  <h3>What company filings say about AI and restructuring</h3>
  <p>We read every 2026 Form 8-K that references Item 2.05, the item public companies use to report material restructuring costs, and coded each AI mention by what role AI plays, following the evidence levels in Appendix B. A mention in a risk factor is not evidence that AI caused a layoff; a company's statement that its plan is designed around AI is a company's stated rationale (evidence Level 1), not proof of effect.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 38</span>
    <span class="ex-title">How AI appears in 2026 restructuring filings (Form 8-K, Item 2.05), January–September</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Category</th><th>Filings</th><th>Companies</th><th>Examples (as stated in filings)</th></tr></thead>
      <tbody>
        <tr><td><strong>Operational, AI in the restructuring section itself:</strong> AI is changing how work is done</td><td>10</td><td>8</td><td>Cloudflare ("agentic AI-first operating model"); Freshworks ("increase leverage of AI and automation across the business"); Elastic ("working in an age of AI automation"); Groupon ("AI-native company"); Pegasystems ("AI-first delivery model"); Coinbase ("the AI era"); Angi ("AI-driven efficiency improvements"); Vertex ("a more AI-enabled company")</td></tr>
        <tr><td><strong>Operational, AI in the restructuring section itself:</strong> cutting costs to reinvest in AI</td><td>6</td><td>6</td><td>Cisco, Pinterest ("reallocating resources to AI-focused roles"), Atlassian, Zscaler, Sprout Social, SentinelOne</td></tr>
        <tr><td><strong>Operational, elsewhere in the same filing</strong></td><td>2</td><td>2</td><td>Dow ("utilizing AI and automation" to raise productivity, Item 8.01); Simmons First ("technology and automation", not AI specifically)</td></tr>
        <tr><td><strong>Risk or forward-looking language only</strong></td><td>6</td><td>6</td><td>Block and Snap (risks related to AI's benefits to employees or an "AI transformation"); Intuit, Rapid7 and Manhattan Associates (AI in products); IAC (AI as a competitive threat)</td></tr>
        <tr><td><strong>False matches</strong> (company names only)</td><td>2</td><td>2</td><td>BioAtla (an investee named "Inversagen AI"); C3.ai</td></tr>
        <tr><td><strong>No AI or automation mention</strong></td><td>144</td><td>125</td><td>—</td></tr>
        <tr><td><strong>Total</strong></td><td>170</td><td>149</td><td></td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Cloudflare and Freshworks each filed two 8-Ks covering the same plan, so the first row counts 10 filings from 8 companies. Together the two "in the restructuring section" rows cover 16 filings from 14 companies (9.4% of filings and of companies). Method: EDGAR full-text search for form 8-K, January 1–September 30, 2026, query "Item 2.05" combined separately with "artificial intelligence", "AI", "automation", "machine learning" and "generative AI"; every match read in full and coded by one analyst (single coder; no second-coder reliability check yet). Company counts are distinct filer IDs; "no mention" companies are approximate because some companies filed several 8-Ks. NextChapter calculation.</span>
  </div>
  <p>Two things stand out. First, when companies do cite AI in a restructuring filing, they split between AI changing how work is done (8 companies) and cutting elsewhere to fund AI (6 companies). The second is a reallocation story, not a substitution story. Second, nine in ten restructuring filings say nothing about AI. Filings are required to disclose the decision and its costs, not its reasons, so silence does not show that AI played no part.</p>

  <h3>Revenue per employee at large white-collar employers</h3>
  <p>Can large companies grow without adding staff? We compiled revenue and year-end headcount from the annual reports (10-Ks) of the 30 largest U.S.-listed companies by revenue in white-collar-intensive industries (software and internet, banking, insurance and managed care, financial services and professional services), comparing each company's most recent fiscal year with the year three years earlier. Twenty-seven reported comparable headcount in both years.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 39</span>
    <span class="ex-title">Revenue grew 40% while headcount fell 1%: 27 large white-collar employers, fiscal 2022 to fiscal 2025</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Measure (27 companies combined)</th><th>Fiscal 2022</th><th>Latest fiscal year</th><th>Change</th></tr></thead>
      <tbody>
        <tr><td>Revenue (nominal)</td><td>$2.33 trillion</td><td>$3.27 trillion</td><td>+40%</td></tr>
        <tr><td>Employees</td><td>3.01 million</td><td>2.98 million</td><td>−1%</td></tr>
        <tr><td>Revenue per employee</td><td>$774K</td><td>$1.10 million</td><td>+42%</td></tr>
        <tr><td>Companies whose headcount fell</td><td colspan="2">14 of 27</td><td></td></tr>
        <tr><td>Median company: revenue / headcount / revenue per employee</td><td colspan="2">+35% / 0% / +31%</td><td></td></tr>
        <tr><td>Excluding 6 companies with major acquisitions or divestitures (†)</td><td colspan="2">Revenue +40%, headcount −2%</td><td></td></tr>
      </tbody>
    </table></div>
    <div class="tbl" style="margin-top:10px"><table class="num">
      <thead><tr><th>Company</th><th>Revenue change</th><th>Headcount change</th><th>Revenue per employee, base year</th><th>Latest</th><th>Change</th></tr></thead>
      <tbody><tr><td>Meta Platforms</td><td>+72%</td><td>-9%</td><td>$1,348K</td><td>$2,548K</td><td>+89%</td></tr><tr><td>Block</td><td>+38%</td><td>-18%</td><td>$1,411K</td><td>$2,370K</td><td>+68%</td></tr><tr><td>Microsoft</td><td>+67%</td><td>+1%</td><td>$897K</td><td>$1,488K</td><td>+66%</td></tr><tr><td>Centene</td><td>+35%</td><td>-18%</td><td>$1,945K</td><td>$3,188K</td><td>+64%</td></tr><tr><td>Cigna Group †</td><td>+52%</td><td>-5%</td><td>$2,532K</td><td>$4,061K</td><td>+60%</td></tr><tr><td>Oracle</td><td>+35%</td><td>-14%</td><td>$305K</td><td>$478K</td><td>+57%</td></tr><tr><td>Alphabet</td><td>+42%</td><td>+0%</td><td>$1,487K</td><td>$2,111K</td><td>+42%</td></tr><tr><td>UnitedHealth Group</td><td>+38%</td><td>-3%</td><td>$810K</td><td>$1,148K</td><td>+42%</td></tr><tr><td>Humana</td><td>+40%</td><td>-0%</td><td>$1,384K</td><td>$1,933K</td><td>+40%</td></tr><tr><td>Progressive</td><td>+77%</td><td>+27%</td><td>$900K</td><td>$1,252K</td><td>+39%</td></tr><tr><td>American Express</td><td>+37%</td><td>-1%</td><td>$684K</td><td>$940K</td><td>+38%</td></tr><tr><td>U.S. Bancorp †</td><td>+18%</td><td>-12%</td><td>$311K</td><td>$418K</td><td>+35%</td></tr><tr><td>Allstate</td><td>+32%</td><td>-2%</td><td>$952K</td><td>$1,277K</td><td>+34%</td></tr><tr><td>JPMorgan Chase</td><td>+42%</td><td>+8%</td><td>$438K</td><td>$573K</td><td>+31%</td></tr><tr><td>Wells Fargo</td><td>+13%</td><td>-14%</td><td>$312K</td><td>$408K</td><td>+31%</td></tr><tr><td>Morgan Stanley</td><td>+32%</td><td>+1%</td><td>$655K</td><td>$851K</td><td>+30%</td></tr><tr><td>Travelers</td><td>+32%</td><td>+5%</td><td>$1,135K</td><td>$1,436K</td><td>+27%</td></tr><tr><td>Salesforce</td><td>+32%</td><td>+5%</td><td>$395K</td><td>$498K</td><td>+26%</td></tr><tr><td>Hartford</td><td>+27%</td><td>+2%</td><td>$1,189K</td><td>$1,478K</td><td>+24%</td></tr><tr><td>Bank of America</td><td>+19%</td><td>-2%</td><td>$438K</td><td>$531K</td><td>+21%</td></tr><tr><td>Citigroup</td><td>+13%</td><td>-6%</td><td>$314K</td><td>$377K</td><td>+20%</td></tr><tr><td>Marsh McLennan †</td><td>+30%</td><td>+12%</td><td>$244K</td><td>$284K</td><td>+17%</td></tr><tr><td>Capital One †</td><td>+56%</td><td>+36%</td><td>$612K</td><td>$700K</td><td>+14%</td></tr><tr><td>Molina Healthcare</td><td>+42%</td><td>+27%</td><td>$2,131K</td><td>$2,391K</td><td>+12%</td></tr><tr><td>MetLife</td><td>+12%</td><td>+2%</td><td>$1,528K</td><td>$1,676K</td><td>+10%</td></tr><tr><td>AIG †</td><td>-11%</td><td>-15%</td><td>$1,154K</td><td>$1,217K</td><td>+5%</td></tr><tr><td>Chubb †</td><td>+38%</td><td>+32%</td><td>$1,268K</td><td>$1,320K</td><td>+4%</td></tr></tbody>
    </table></div>
    <span class="ex-note"><strong>This is a selected large-company sample, not a representative estimate of the U.S. economy;</strong> company selection and acquisitions or divestitures can materially change the comparison. Nominal dollars; consumer prices rose roughly 10% over the period. Latest fiscal year is calendar 2025 for most companies (Microsoft: year ended June 2026; Oracle: May 2026; Salesforce: January 2026), compared with the fiscal year three years earlier. Revenue is the total revenue reported in XBRL financial data (for banks, revenue net of interest expense); headcount is the year-end total in each 10-K's human-capital section, often rounded ("approximately"). Sample: the 30 largest companies by revenue in SIC codes 6000–6411 and 7370–7379 and 8700–8748, excluding Berkshire Hathaway, government-sponsored enterprises, subsidiaries that file separately and asset managers; Elevance Health, Prudential Financial and Goldman Sachs were dropped because their 10-Ks did not state comparable total headcount. † Major acquisition or divestiture: Capital One (Discover, 2025), Chubb (Cigna's Asia business, 2022), Marsh McLennan (McGriff, 2024), AIG (Corebridge, 2024), U.S. Bancorp (Union Bank, Dec 2022), Cigna (Medicare business sale, 2025). Source: SEC EDGAR 10-K filings and XBRL company facts; NextChapter calculation.</span>
  </div>
  <p>The pattern is striking, but it is not evidence that AI replaced workers. Under the evidence levels in Appendix B, this is at most Level 2 for any company that also attributes gains to AI. Higher interest rates lifted bank revenues; health insurers raised premiums; Meta, Alphabet and Oracle were correcting pandemic-era overhiring; and acquisitions change both lines. What it does show is that the largest white-collar employers are generating far more revenue per worker than three years ago without adding people, which is consistent with the low hiring rates in Chapter 02 and the "growth without hiring" expectations above. We will update this sample annually and add operating income per employee and payroll as a share of revenue where companies disclose them.</p>


  <h3 id="tfp">Is AI showing up in productivity? Total factor productivity</h3>
  <p>Output per hour can rise for three reasons: more equipment per worker (capital deepening), a more skilled workforce, or genuinely better ways of producing, which economists measure as total factor productivity (TFP). Only the last reflects new technology such as AI. The San Francisco Fed publishes a quarterly TFP series that also adjusts for how intensively existing workers and equipment are being used (Fernald, 2014).</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 40</span>
    <span class="ex-title">Where output-per-hour growth came from, U.S. business sector (annual % change)</span>
    <div class="tbl"><table>
      <thead><tr><th>Period</th><th>Output per hour</th><th>Capital deepening</th><th>Labor quality</th><th>TFP</th><th>TFP adjusted for utilization</th><th>Hours worked</th><th>Capital services</th></tr></thead>
      <tbody>
        <tr><td>2004–2019 average</td><td>1.48</td><td colspan="2">—</td><td>0.49</td><td>0.49</td><td>—</td><td>—</td></tr>
        <tr><td>2019</td><td>2.06</td><td>0.81</td><td>0.16</td><td>1.09</td><td>2.66</td><td>0.91</td><td>3.04</td></tr>
        <tr><td>2023</td><td>1.37</td><td>0.79</td><td>0.08</td><td>0.49</td><td>1.50</td><td>0.91</td><td>2.88</td></tr>
        <tr><td>2024</td><td>2.98</td><td>1.12</td><td>0.28</td><td>1.58</td><td>1.75</td><td>0.04</td><td>2.81</td></tr>
        <tr><td>2025</td><td>2.48</td><td>1.05</td><td>0.46</td><td>0.97</td><td>0.31</td><td>0.16</td><td>2.77</td></tr>
        <tr><td>Four quarters to 2026 Q2</td><td>2.16</td><td colspan="2">—</td><td>1.17</td><td>−0.34</td><td>—</td><td>—</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Business sector, log growth rates in percent. Contributions: capital deepening = capital share × (capital services growth − hours growth); labor quality = labor share × labor-composition growth; the three contributions sum to output-per-hour growth, within rounding. TFP adjusted for utilization removes estimated changes in how intensively capital and labor are used (Basu, Fernald and Kimball method); quarterly values are noisy and revised. Source: Federal Reserve Bank of San Francisco, quarterly TFP series (updated September 3, 2026; data through 2026 Q2); NextChapter calculation of contributions from the same file.</span>
  </div>
  <div class="lbl-row"><span class="lbl m">What we measure</span></div>
  <p>Underlying productivity shows no AI boost yet. TFP adjusted for utilization grew 0.3% in 2025 and −0.3% over the four quarters to mid-2026, after a pickup to 1.5–1.75% in 2023–24 that has since faded. Output per hour is still strong (2.5% in 2025), but the main reason is that output kept rising while hours worked barely grew (0.2% in 2025), which raises equipment per hour. Capital services themselves are not growing faster than before the AI investment boom (2.8% in 2025 versus 3.0% in 2019). This is the economy-wide version of the "growth without hiring" pattern among the large employers above.</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Apollo (Torsten Slok) · commentary · Oct 5, 2026 (published after the reference period)</span><p>Apollo's chief economist reaches the same headline conclusion from the same San Francisco Fed series: utilization-adjusted TFP is slightly below zero with no acceleration, while output per hour runs near 2.5%, which he calls "the signature of capital deepening, not of a technology shock"; the AI productivity payoff "remains a forecast rather than an observation." Our check of the underlying data agrees on the headline, with two qualifications: utilization-adjusted TFP did accelerate in 2023–24 before fading, and the capital-deepening contribution reflects weak hours growth more than faster growth in capital services. We include this commentary because it interprets data from the reference period.</p></li>
    <li><span class="who">History</span><p>Electricity and information technology each took a decade or more to show up in aggregate productivity (David, 1990; Brynjolfsson, Rock and Syverson, 2021). A flat reading now is consistent with both "AI is overhyped" and "the payoff is still coming."</p></li>
  </ul>

  <h3>Illustrative scenario: productivity gains and the cost of long searches</h3>
  <div class="box" style="margin:0">
    <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
    <p style="margin:6px 0 0"><strong>An illustrative scenario, not a finding.</strong> It compares economy-wide productivity growth, which has many causes, with one labor-market cost. As the TFP analysis above shows, almost none of the recent gain in output per hour reflects faster underlying technological progress, so the AI-attributable share of the gain may be close to zero. The two are not causally linked, and neither side is attributed to AI. Output per hour in the nonfarm business sector rose 2.2% in the year to Q2 2026 (BLS). On roughly $25 trillion of nonfarm business output, that is on the order of $550 billion a year of additional output. On the other side, about 135,000 more white-collar workers were unemployed 27 weeks or more in January–August 2026 than a year earlier (about 240,000 more than in 2019). At roughly $200,000 of output per employed worker, the output they are not producing is on the order of $25–50 billion a year; counting all unemployment above its January–August 2019 rate, about $175 billion.</p>
    <p style="margin:6px 0 0">In aggregate the economy comes out well ahead: the productivity gain is roughly 10–20 times the output lost to additional white-collar long-term unemployment. But the two are distributed very differently. The gain is spread across about 160 million workers and their employers, and the share of nonfarm business output paid to labor is at its lowest on record (52.8%), suggesting more of it is going to capital than to pay. The loss is concentrated on a few hundred thousand people, each forgoing a year's output while out of work, and, based on past research, 1.4–2.8 years of earnings over the following two decades (Davis and von Wachter, 2011). The net is positive for the economy and sharply negative for people in transition.</p>
    <p class="note" style="margin:6px 0 0">Assumptions: nonfarm business output approximated as about 77% of nominal GDP ($32.6 trillion annualized, Q2 2026, BEA); output per worker approximated as GDP per employed person; unemployed workers assumed as productive as the average employed worker, which likely overstates the loss. We cannot attribute the productivity gain to AI, or the additional long-term unemployment to the same cause. NextChapter estimate; see "Who captures the gains" in the Future Research Agenda.</p>
  </div>
  <h3>The labor-market services economy</h3>
  <div class="box disclose" style="margin:0 0 14px"><p style="margin:0"><strong>Conflict of interest.</strong> NextChapter sells career-transition services, so it has a direct commercial interest in this question. We report only third-party data, include figures that cut against a "growing market" story, and draw no conclusion about NextChapter's own market.</p></div>
  <p>The question: as job searches get longer and screening becomes automated, are workers and employers spending more on help navigating the labor market, such as recruiting, staffing, executive search, outplacement, coaching and job-search tools? The evidence says total spending is not rising, but its mix is shifting.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 41</span>
    <span class="ex-title">Labor-market services: employment, revenue and company results</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Measure</th><th>Latest</th><th>Change</th></tr></thead>
      <tbody>
        <tr><td>Employment services jobs (NAICS 5613), Sep 2026</td><td>3.18 million</td><td>+0.8% over the year</td></tr>
        <tr><td>&nbsp;&nbsp;Temporary help services</td><td>2.49 million</td><td>+0.6% over the year; still well below the 2022 peak</td></tr>
        <tr><td>Employment services revenue (Census Quarterly Services Survey), Q2 2026</td><td>$107.0 billion</td><td>+1.3% over the year; −20.9% versus Q2 2022 (nominal)</td></tr>
        <tr><td>Korn Ferry fee revenue, quarter ended Jul 31, 2026</td><td>$756.5 million</td><td>+7%; executive search +10%</td></tr>
        <tr><td>Robert Half revenue, Q2 2026</td><td>$1.34 billion</td><td>−2%; permanent placement +2.5%</td></tr>
        <tr><td>Adecco Group, LHH (includes outplacement), Q2 2026</td><td>—</td><td>Flat; Q1 cited "strong growth in Career Transition"</td></tr>
        <tr><td>LinkedIn revenue, Apr–Jun 2026</td><td>—</td><td>+12%</td></tr>
        <tr><td>Recruit Holdings HR technology (Indeed, Glassdoor), Apr–Jun 2026</td><td>$2.85 billion</td><td>+20.9% in dollars; U.S. growth driven by higher revenue per job posting</td></tr>
        <tr><td>Upwork revenue, Q2 2026</td><td>$191.7 million</td><td>−2%</td></tr>
        <tr><td>Fiverr revenue, Q2 2026</td><td>$97.8 million</td><td>−10%; active buyers −21.9%</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Sources: BLS Employment Situation table B-1 (Oct 2, 2026); Census Quarterly Services Survey via FRED (series REV5613TAXABL144QNSA); company earnings releases and SEC exhibits for the periods shown. Heidrick &amp; Struggles was taken private in December 2025 and no longer reports publicly.</span>
  </div>
  <p>Staffing remains in a cyclical slump, and freelance marketplaces are shrinking, possibly because AI substitutes for some gig work. Growth is in executive search, permanent placement and paid job-board pricing. Application volume is the clearest sign of a navigation problem: Ashby, a recruiting-software company, reports applications per hire have roughly tripled since 2021 to more than 300 (vendor data). Two cautions apply. Most evidence on outplacement and coaching demand comes from the vendors themselves, and LinkedIn reports that applications per applicant fell 24% over the year to March 2026. We found no independent data on the size of the outplacement or career-coaching markets.</p>

  <h3>Remaking the organization: forward-deployed engineers and AI services firms</h3>
  <p>A new kind of company is being built specifically to redesign other companies' workflows around AI. This matters for white-collar workers because it moves AI from tools individuals choose to use toward the organization-wide redesign described in Appendix B's adoption stages, which is the stage most likely to change headcount.</p>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">AI labs' services ventures · 2026</span><p>Anthropic, Blackstone, Hellman &amp; Friedman and Goldman Sachs, with other investors, formed an enterprise AI services company (announced May 4, 2026; named Ode with Anthropic in July) that places engineers inside client companies. OpenAI formed a deployment company backed by TPG and other investors, with McKinsey, Bain and Capgemini as consulting partners, and acquired the London consultancy Tomoro. The engineers in these roles are called "forward-deployed engineers"; Fortune reported postings for the title rose more than tenfold in January–August 2026 from a year earlier.</p></li>
    <li><span class="who">AI roll-ups of services firms · 2025–2026</span><p>Thrive Holdings, backed by Thrive Capital with an OpenAI stake, has acquired more than 50 accounting firms and about 20 IT services firms (as reported by The Next Web) and automates their work with AI; it raised $2 billion in August 2026. Long Lake, backed by General Catalyst, has made about 40 acquisitions and agreed in May 2026 to buy Amex Global Business Travel. These models target exactly the back-office and professional-services work that employs many white-collar workers.</p></li>
    <li><span class="who">Consultancies · 2025–2026</span><p>Accenture took an $865 million restructuring charge in September 2025; CEO Julie Sweet said the firm was "exiting people so we can get more of the skills in we need." It had about 814,000 people at the end of its fiscal year on August 31, 2026. Bloomberg reported McKinsey plans to cut about 10% of non-client-facing roles. PwC cut 5,600 staff in the year to June 2025 and dropped its pledge to add 100,000 people. Deloitte U.S. replaced its analyst-to-manager titles with new job families in June 2026. Consulting pyramids, traditionally built on large junior cohorts, are the clearest test of the junior-compression hypothesis in the Future Research Agenda.</p></li>
  </ul>


  <h3>Annual feature: industry productivity versus long job searches</h3>
  <p>If AI-driven productivity gains were pushing white-collar workers into long searches, the industries with the fastest productivity growth might show the largest rise in long searches. We compare BLS total factor productivity growth by sector for 2019–2024, the latest available, with our measure of long searches among unemployed white-collar workers by the industry of their last job.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 42</span>
    <span class="ex-title">Productivity growth and long searches by industry</span>
    <div class="tbl"><table>
      <thead><tr><th>Industry (CPS group)</th><th>BLS sectors (NAICS)</th><th>Productivity growth, 2019–24 (% a year)</th><th>Output growth, 2019–24 (% a year)</th><th>White-collar unemployed out 27+ weeks, 2019</th><th>2026</th><th>Change (±90% MOE)</th></tr></thead>
      <tbody>
        <tr><td>Information</td><td>51</td><td>1.8</td><td>6.0</td><td>25.8%</td><td>35.4%</td><td>+9.6 ±13.5</td></tr>
        <tr><td>Professional &amp; business services</td><td>54 / 55 / 56</td><td>2.5 / 3.0 / 0.9</td><td>5.2 / 5.0 / 1.6</td><td>26.9%</td><td>31.7%</td><td>+4.8 ±6.2</td></tr>
        <tr><td>Financial activities</td><td>52 / 53</td><td>−0.4 / 1.3</td><td>2.4 / 3.9</td><td>30.4%</td><td>31.1%</td><td>+0.8 ±10.6</td></tr>
        <tr><td>Manufacturing</td><td>31–33</td><td>−0.1</td><td>−0.8</td><td>27.0%</td><td>35.5%</td><td>+8.5 ±11.2</td></tr>
        <tr><td>Education &amp; health services</td><td>61 / 62</td><td>0.1 / 0.7</td><td>2.8 / 3.8</td><td>17.0%</td><td>22.5%</td><td>+5.5 ±4.1 <span class="sig">beyond 90% MOE</span></td></tr>
        <tr><td><strong>All white-collar</strong></td><td>—</td><td>—</td><td>—</td><td>22.5%</td><td>28.1%</td><td>+5.6 ±2.7 <span class="sig">beyond 90% MOE</span></td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Productivity is BLS total factor productivity: output growth not explained by growth in capital, labor and purchased inputs. Sector codes: 54 professional and technical services, 55 management of companies, 56 administrative and waste services, 52 finance and insurance, 53 real estate, 61 educational services, 62 health care and social assistance. Long-search share: unemployed white-collar workers whose last job was in the industry and who have been looking 27 weeks or more, January–August, not seasonally adjusted; 2019 and 2026 treated as independent samples. CPS classifies by the worker's last job and BLS by establishment, so the match is approximate. Sources: BLS, Total Factor Productivity for Major Industries, 2024 (Dec 19, 2025; data revised Mar 19, 2026), Table 3 as accessed Oct 6, 2026; NextChapter calculation from Census CPS microdata.</span>
  </div>
  <div class="lbl-row"><span class="lbl m">What we measure</span></div>
  <p>There is no clear pattern. The sectors with the fastest productivity growth (management of companies, professional and technical services, information) show rises in long searches, but none is larger than its margin of error. The only industry with a rise beyond the margin, education and health services, had productivity growth near zero. Newer detail for 2025 points in different directions within single sectors: software publishers raised labor productivity 12.9% while cutting hours 0.7%, and commercial banking 3.2% while cutting hours 0.3%, but engineering services fell 0.2%. Productivity rose in 15 of 30 service industries BLS covers (Aug 26, 2026) and in 42 states and the District of Columbia (May 28, 2026).</p>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>At the level of whole sectors, productivity growth and long searches are not yet moving together. That is not evidence against an AI effect: five-year sector averages are too coarse to detect effects concentrated in particular occupations, firms or the most recent year, and long searches depend on hiring across every industry, not only the one a worker left. We will repeat this comparison each third quarter, adding 2025 sector data and a state-level comparison.</p>

  <h3>Reemployment after job loss: the biennial check</h3>
  <p>The BLS Displaced Worker Survey, run every two years in January, measures what happens after a layoff. Of 3.3 million long-tenured workers displaced in 2023–2025, 66.1% were reemployed by January 2026 and about 49% of those earned as much as or more than before, so roughly half took a pay cut. After the 2009–2011 layoffs, only 56% were reemployed and about a third took cuts of 20% or more. Today's displaced workers are faring better than after the Great Recession, but reemployment is not recovery: half of those who found work earn less than they did. Reemployment rates for workers 55–64 are lower (see Chapter 07).</p>
</section>

<section id="feature-history" aria-labelledby="h-fh">
  <div class="chapter-head"><div class="eyebrow">Feature</div><h2 id="h-fh">From factory automation to AI: what history says about job transitions</h2></div>
  <p class="lead">Every major wave of automation has eventually created more work than it destroyed. Every wave has also imposed large, long-lasting costs on the specific workers and places whose tasks lost value. History is a guide to the shape of an adjustment, not a forecast of AI's effects.</p>
  <h3>New work does appear, but not for the same people</h3>
  <p>About 60% of U.S. employment in 2018 was in job titles that did not exist in 1940 (Autor, Chin, Salomons and Seegmiller, <em>Quarterly Journal of Economics</em>, 2024). The same research finds that the job-destroying effect of automation was more than twice as strong after 1980 as in 1940–1980, while new work increasingly appeared in high-paid professional and low-paid service jobs rather than in the middle. Earlier waves of computerization hollowed out routine clerical and production work and polarized employment toward the top and bottom (Autor, Levy and Murnane, 2003; Goos, Manning and Salomons, 2014).</p>
  <h3>The costs of displacement are large and long-lasting</h3>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Earnings after a mass layoff</span><p>Long-tenured workers lose about 25% of annual earnings for many years after a mass layoff (Jacobson, LaLonde and Sullivan, 1993). Over 20 years, the loss averages 1.4 years of prior earnings when the layoff happens while unemployment is under 6%, and 2.8 years when it is above 8% (Davis and von Wachter, 2011). When you lose a job matters almost as much as whether you lose it.</p></li>
    <li><span class="who">Industrial robots</span><p>Each additional robot per thousand workers reduced the local employment-to-population ratio by about 0.2 points and wages by about 0.42% in 1990–2007 (Acemoglu and Restrepo, <em>Journal of Political Economy</em>, 2020).</p></li>
    <li><span class="who">The China trade shock</span><p>Import competition cost an estimated 2.0–2.4 million U.S. jobs in 1999–2011, including spillovers (Acemoglu, Autor, Dorn, Hanson and Price, 2016). Most of the adjustment in hard-hit areas came through people leaving work rather than moving away, and the damage persisted long after the shock (Autor, Dorn and Hanson, 2021).</p></li>
    <li><span class="who">Engels' pause</span><p>During Britain's early industrial revolution, output per worker rose 46% in 1780–1840 while real wages rose 12%. Wages caught up only in the following decades (Allen, 2009). Carl Benedikt Frey's <em>The Technology Trap</em> (2019) argues that such lags are the norm when technology replaces rather than complements workers.</p></li>
    <li><span class="who">Bank tellers</span><p>ATMs cut tellers per branch from 20 to 13 in 1988–2004, but banks opened 43% more branches, so teller jobs held up (Bessen). Two decades later, mobile banking did what ATMs did not: BLS now projects teller employment to fall 13% by 2035. The same technology can complement a job for years before substituting for it.</p></li>
  </ul>
  <h3>Predictions have often been wrong in both directions</h3>
  <p>Frey and Osborne's 2013 estimate that "about 47 per cent of total US employment is at risk" of computerization was widely read as a forecast of job loss, which the authors did not intend. Task-based estimates put the share closer to 9% (OECD, 2016), and the predicted wave did not arrive in the following decade. Exposure estimates for AI today, such as MIT's "Iceberg Index" finding 11.7% of U.S. wage value technically exposed, measure what AI could do, not what employers will do. Those are different questions.</p>
  <p class="note"><span class="lbl i">What this may mean</span> Lesson for this report: the history most relevant to white-collar workers today is not whether total employment survives (it has every time) but the duration and cost of transitions for the people whose tasks lose value. That is what our long-term unemployment measures track.</p>
</section>

<section id="feature-remote" aria-labelledby="h-fr">
  <div class="chapter-head"><div class="eyebrow">Feature</div><h2 id="h-fr">Remote work and the portability problem</h2></div>
  <p class="lead">Remote work solves geography but not occupational transition. It has leveled off at about a fifth of all workers and a third of managers and professionals. Fully remote jobs are scarce and draw a heavily outsized share of applicants, and the evidence suggests they are also more exposed to hiring abroad. Each of these links is a hypothesis to test, not an established cause of longer searches.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 43</span>
    <span class="ex-title">Remote work, 2026</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Measure</th><th>Latest</th><th>Source</th></tr></thead>
      <tbody>
        <tr><td>Workers who teleworked, Sep 2026</td><td>21.9% (10.7% all hours, 11.2% some)</td><td>BLS CPS, table A-42</td></tr>
        <tr><td>Management and professional workers who teleworked</td><td>35.4%</td><td>BLS CPS</td></tr>
        <tr><td>Management, business and financial workers who teleworked</td><td>42.9%</td><td>BLS CPS</td></tr>
        <tr><td>Share of paid workdays from home, Jul 2026</td><td>About 26%</td><td>WFH Research (Barrero, Bloom, Davis)</td></tr>
        <tr><td>Full-time employees fully remote / hybrid / on site</td><td>12% / 26% / 62%</td><td>WFH Research</td></tr>
        <tr><td>Remote jobs: share of LinkedIn postings vs. share of applications, Mar 2026</td><td>9% of postings, 37% of applications</td><td>LinkedIn Economic Graph</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Sources as listed; BLS overall telework rate ranged 21.5%–23.0% over the past year. LinkedIn figures cover LinkedIn postings only.</span>
  </div>
  <div class="lbl-row"><span class="lbl o">What others find</span></div>
  <ul class="items">
    <li><span class="who">Competition for remote roles</span><p>When 9% of postings draw 37% of applications, a remote search is a far more crowded search. That is consistent with, but does not prove, longer searches for professionals who restrict themselves to remote work.</p></li>
    <li><span class="who">Offshoring of remote-friendly work · Revelio Labs</span><p>From 2019 to 2024, U.S. firms' overseas headcount grew 32% against 16.7% at home, and roles suited to remote work grew 42% faster abroad, while roles that are not remote-friendly grew at similar rates in both. This is vendor analysis of online profiles, not official data. Richard Baldwin's "globotics" thesis predicts exactly this combination of remote work and overseas "telemigrants."</p></li>
    <li><span class="who">Return-to-office mandates</span><p>The Flex Index found 34% of U.S. companies required full-time office attendance in Q3 2025, with required office days up 12% since early 2024 but actual attendance up only 1–3%.</p></li>
  </ul>
  <p class="note"><span class="lbl i">What this may mean</span> What we can and cannot say: remote work widens the pool of competitors for each remote job, at home and abroad. We have no evidence yet linking remote work to longer white-collar unemployment spells. The CPS telework questions make that testable in future editions.</p>
</section>


<section id="feature-rewiring" aria-labelledby="h-rw">
  <div class="chapter-head"><div class="eyebrow">Feature</div><h2 id="h-rw">The rewiring constraint: why AI capability is outrunning organizational change</h2></div>
  <p class="lead">This report's central finding is fewer layoffs, longer searches. Announced layoffs are down, AI appears in only 9% of formal restructuring filings, and professionals who keep their jobs are not being pushed into part-time or contract work. Yet professionals who lose jobs stay out far longer, and each job opening yields fewer hires than in 2019 or the early 2000s. One way to read that combination is that three clocks are running at different speeds. This is a framework for reading the data, not a finding, and it builds on older ideas: Paul David's account of the electric dynamo, Erik Brynjolfsson's "productivity J-curve" and Agrawal, Gans and Goldfarb's "between times."</p>
  <h3>Three speeds</h3>
  <p><strong>Capability</strong> is moving fastest on the measures we have. METR estimates that the length of software task frontier models can complete half the time has doubled every four to seven months, from about 5 minutes for GPT-4 in 2023 to at least 16 hours in spring 2026; METR itself calls estimates above 16 hours unreliable, and the length models complete 80% of the time is only one to three hours. On OpenAI's GDPval, a test of well-specified professional tasks in 44 occupations, the share of tasks where models matched or beat experts rose from under half at its September 2025 launch to about 85% by April 2026, as reported by OpenAI. These are vendor-run, self-contained tasks, not jobs.</p>
  <p><strong>Organizational rewiring</strong> is slower. About 18–20% of U.S. firms report using AI in any business function, and roughly 95% of those report no change in headcount attributable to it (Census Business Trends and Outlook Survey, late 2025 to early 2026). Workers report more use than firms: 39% used generative AI for work in the previous week, and AI saved about 2.2% of all hours worked in the second quarter of 2026, up from 1.6% in late 2024 (St. Louis Fed Real-Time Population Survey). Use is spreading faster than redesign. Aggregate data agree: total factor productivity adjusted for utilization, the closest measure of technology-driven productivity, was −0.3% over the year to mid-2026 (San Francisco Fed).</p>
  <p><strong>The labor market</strong> is adjusting on a third timescale, and mostly through hiring rather than firing. Employment of 22–25-year-olds in the most AI-exposed jobs is 19% below comparable peers (Stanford Digital Economy Lab, August 2026). The Richmond Fed finds AI-related structural change "an important but not dominant factor" in the decline in job-finding since mid-2023. Our own data add longer searches for white-collar workers who lose jobs and no sign yet of displacement hidden inside jobs.</p>
  <h3>Task versus system</h3>
  <p>The constraint is that an AI system can perform a task without an organization being able to remove the human role around it. Roles bundle tasks with exception handling, accountability, legal responsibility, escalation, relationships and coordination, and they sit on data and legacy systems that were not built for AI. The relevant question is not whether AI can do the task, but whether the organization can redesign the whole workflow around it without losing value. History suggests that takes time: factory electrification passed half of U.S. horsepower around 1920 but raised productivity only after plants were redesigned, decades after the first power stations (David, 1990), and computers paid off mainly at firms that also reorganized work (Bresnahan, Brynjolfsson and Hitt, 2002). AI is delivered as software and may move faster; no study has yet estimated the lag from demonstrated capability to measurable job effects.</p>
  <h3 id="turing">A postulate: the conversational threshold</h3>
  <p>In a 2025 test, judges who chatted for five minutes with a person and with GPT-4.5 picked the AI as the human 73% of the time; the model was prompted to adopt a humanlike persona (Jones and Bergen, UC San Diego). We put forward a hypothesis, not a finding: once machines pass this kind of conversational test, the first jobs to change are those whose core output is routine, remote conversation, such as customer service by chat and phone, ahead of other office work. If the hypothesis is right, those occupations should show shrinking employment, fewer young entrants and longer searches first, while conversation-heavy jobs that require physical presence should not.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl m">What we measure</span></div>
    <span class="ex-label">Exhibit 44</span>
    <span class="ex-title">A first test: customer service representatives versus receptionists, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Measure</th><th>2019</th><th>2022</th><th>2025</th><th>2026</th><th>Change vs 2025</th></tr></thead>
      <tbody>
        <tr><td>Customer service representatives employed (thousands)</td><td>2,562</td><td>2,700</td><td>2,653</td><td>2,447</td><td>−206 ±111 (−7.8%) <span class="sig">beyond 90% MOE</span></td></tr>
        <tr><td>Unemployment rate</td><td>4.1%</td><td>5.2%</td><td>4.3%</td><td>5.0%</td><td>+0.7 pts</td></tr>
        <tr><td>Unemployed out 27+ weeks (share; small sample)</td><td>21.2%</td><td>16.6%</td><td>19.8%</td><td>22.5%</td><td>+2.7 pts (244 respondents)</td></tr>
        <tr><td>Ages 22–27, % of employed</td><td>18.0%</td><td>15.8%</td><td>15.8%</td><td>15.3%</td><td>−0.5 pts</td></tr>
        <tr><td>Receptionists employed (thousands), in-person comparison</td><td>1,326</td><td>1,182</td><td>1,235</td><td>1,275</td><td>+40 (+3.2%)</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Census occupation codes 5240 (customer service representatives) and 5400 (receptionists and information clerks); occupation of current or most recent job. Employment margin of error uses the BLS labor-force variance parameters and may be understated for a single detailed occupation. AI exposure (Eloundou and others): customer service representatives 57% of tasks (GPT-4 rating) and 70% (human rating). Other evidence: BLS projects customer service employment to fall 5% from 2025 to 2035; call-center and business-support payroll employment fell 3.3% over the year to August 2026; offshoring and self-service also reduce these jobs. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <p>The first evidence fits the postulate but does not prove it: employment of customer service representatives fell about 8% in a year, beyond the margin of error, and young workers' share kept edging down, while receptionists, whose work is conversational but in person, held steady. Offshoring, self-service and the slow economy also cut these jobs, and Gartner's surveys show most service leaders are keeping, and expanding, human roles for complex cases. We will track this monthly; the postulate is wrong if remote-conversation occupations do not diverge from comparable in-person ones over the next year.</p>
  <h3>Customer service: where the human role persists</h3>
  <p>Customer service shows the constraint clearly. In Gartner's survey of 321 service leaders (published April 2026), 85% were expanding human agents' responsibilities, even as 31% had made or planned AI-driven frontline layoffs and 63% were shrinking headcount through attrition. In a separate Gartner survey, 87% of customers said a company using generative AI for service must also offer a human agent. Klarna is the best-known case. In February 2024 it said its AI assistant handled two-thirds of customer chats, the work of about 700 agents; its November 2025 investor presentation shows company headcount falling from about 5,500 in 2022 to about 2,900, largely through a hiring freeze and attrition. In May 2025 its chief executive said cost had been "a too predominant evaluation factor" and that the result was "lower quality," and the company began piloting on-demand human agents. The case shows that automating a task is not the same as redesigning a service system. It does not show that humans "won," and there is no independent measure of Klarna's service quality.</p>
  <h3>Direction, not only speed</h3>
  <p>Daron Acemoglu, David Autor and Simon Johnson argue that the effect on workers depends on what kind of AI firms build and buy. In "Building Pro-Worker Artificial Intelligence" (NBER, February 2026) they distinguish labor-augmenting, capital-augmenting, automating, expertise-leveling and new-task-creating technologies, and write that "only the last category is unambiguously pro-worker." Acemoglu's own macroeconomic estimate is cautious, about 0.7% higher total factor productivity over ten years; other economists estimate gains roughly ten times larger per year (Aghion and Bunel, 2024). The rewiring view is compatible with both camps: the disagreement is about how fast, and in which direction, organizations rebuild work around AI.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 45</span>
    <span class="ex-title">The three-speed framework against the evidence</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Proposition</th><th>Evidence</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>AI capability on measured tasks is rising quickly</td><td>METR time horizons; GDPval; OSWorld scores above the human baseline (vendor-reported, 2026)</td><td>Supported, with benchmark caveats (contamination, vendor reporting, self-contained tasks)</td></tr>
        <tr><td>Organizational adoption lags capability</td><td>About 18–20% of firms use AI; 39% of workers used it last week; 2.2% of hours saved</td><td>Consistent but unproven: adoption measures disagree and capability has no common unit</td></tr>
        <tr><td>AI shows up in aggregate productivity</td><td>Utilization-adjusted TFP −0.3% over the four quarters to 2026 Q2; output per hour up mainly because hours barely grew (Q3 addendum)</td><td>Not observed so far</td></tr>
        <tr><td>AI-attributable headcount change is still rare</td><td>About 95% of AI-using firms report no headcount change; AI in 9% of restructuring filings</td><td>Supported</td></tr>
        <tr><td>The labor market adjusts through hiring, not layoffs</td><td>Young workers in exposed jobs (Stanford); job-finding (Richmond Fed); white-collar long searches (Chapter 01)</td><td>Supported for young workers in exposed jobs; consistent but unproven for experienced professionals</td></tr>
        <tr><td>Displacement is hiding inside jobs</td><td>No rise in involuntary part-time, multiple jobs or self-employment among white-collar workers</td><td>Not observed so far (Chapter 01)</td></tr>
        <tr><td>Occupations more exposed to AI fare worse</td><td>Since 2022, long-term unemployment rose more in high-exposure occupations (beyond MOE); since 2019, no difference; young-worker share falls with exposure on both baselines (Chapter 04)</td><td>Consistent but unproven; strongest for young workers</td></tr>
        <tr><td>Remote-conversation jobs change first (conversational threshold)</td><td>Customer service employment −7.8% in a year (beyond MOE); in-person receptionists steady</td><td>Postulate; first evidence consistent</td></tr>
        <tr><td>There is a measurable lag from capability to job effects</td><td>No study estimates one</td><td>Not currently measurable</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Sources: METR (Jan–May 2026); OpenAI GDPval (Sep 2025–Apr 2026); Census BTOS (2026); St. Louis Fed (Aug 27, 2026); Stanford Digital Economy Lab (Aug 12, 2026); Richmond Fed Economic Brief 26-27 (Aug 2026); NextChapter calculations.</span>
  </div>
  <div class="lbl-row"><span class="lbl i">What this may mean</span></div>
  <p>How to read current data in this light: low counts of AI-attributed layoffs do not mean AI has no labor-market effect, and fast benchmark gains do not mean job losses are imminent. If the framework is right, effects show up first where rewiring is cheapest: positions that are not refilled, junior hiring, standardized workflows, and firms that grow without adding staff. They show up last in layoff announcements. The indicators to watch are hiring rates, search durations, hours and output per worker, not headlines about AI capability.</p>
</section>

<section id="agenda" aria-labelledby="h-ag">
  <div class="chapter-head"><div class="eyebrow">Future research agenda</div><h2 id="h-ag">Measures we are developing, and what each needs before we publish a number</h2></div>
  <p class="lead">Some of the most important questions about AI and white-collar work cannot yet be measured rigorously. Rather than estimate them to make the report feel complete, we list them here with the data and validation each requires. No number appears for any of these measures until it meets its publication threshold.</p>
  <div class="exhibit">
    <div class="lbl-row"><span class="lbl o">What others find</span></div>
    <span class="ex-label">Exhibit 46</span>
    <span class="ex-title">Research-agenda measures (no values published)</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Measure</th><th>Definition and why it matters</th><th>Data and method</th><th>Current limitation</th><th>Publication threshold</th></tr></thead>
      <tbody>
        <tr><td><strong>Operational AI Disclosure Index</strong></td><td>Share of public companies whose filings explicitly connect AI to internal productivity, headcount, hiring or organizational design (category C in our coding), as opposed to AI products (A) or risk language (B). Tracks whether AI is becoming an operating matter, not just a product or risk.</td><td>10-K, 10-Q and 8-K full text from EDGAR; keyword retrieval, then classification; quarterly.</td><td>Our Q3 coding covers only 8-K Item 2.05 filings and one coder. A classifier for all filings would produce false positives (company names, product descriptions).</td><td>Random samples of positive and negative classifications hand-coded by two coders; precision and recall reported; coding protocol published.</td></tr>
        <tr><td><strong>Junior career compression</strong></td><td>Whether AI reduces junior execution work while preserving senior judgment work, narrowing the path into professions.</td><td>CPS by age and occupation; job postings by seniority (Indeed, LinkedIn, Lightcast); payroll data (ADP via published research); consulting and accounting firm graduate intake.</td><td>Posting seniority is coded inconsistently across vendors; CPS cannot observe seniority directly; firm intake is self-reported.</td><td>A consistent seniority classification applied to at least two independent posting sources, with 2019 baseline.</td></tr>
        <tr><td><strong>Quiet attrition</strong></td><td>Whether workforce reductions happen through not backfilling departures and hiring freezes rather than layoffs. If so, layoff counts understate adjustment.</td><td>JOLTS hires versus separations by industry; company headcount changes from 10-Ks set against announced layoffs; NY Fed and Dallas Fed survey questions on reduced hiring.</td><td>No source links a specific unfilled position to AI. Company headcount changes mix acquisitions, divestitures and outsourcing.</td><td>Company-level panel reconciling 10-K headcount change, announced layoffs and M&amp;A for a fixed sample over at least eight quarters.</td></tr>
        <tr><td><strong>AI token and spending data</strong></td><td>Enterprise AI consumption (tokens processed, spending per employee) as a measure of adoption intensity, distinct from whether a firm "uses AI."</td><td>Model-provider disclosures; cloud-provider segment reporting; Census and Fed surveys on AI spending; company filings.</td><td>No comprehensive, public, national dataset of enterprise token use exists. Token prices have fallen sharply, so quantity, price and spending move differently.</td><td>A public, repeatable source covering a defined population of firms, with price and quantity reported separately.</td></tr>
        <tr><td><strong>Where the hours go</strong></td><td>When AI saves worker time, whether it goes to more output (augmentation), fewer hours, higher expectations, fewer workers, or much more output with fewer workers (organizational leverage).</td><td>CPS and BLS hours by occupation; BLS productivity by industry; time-use studies; firm experiments with measured output.</td><td>Hours data are not linked to AI use; experimental studies cover single firms and tasks.</td><td>Matched data on AI use and hours or output for a population of firms or workers, beyond single-firm experiments.</td></tr>
        <tr><td><strong>Who captures the gains</strong></td><td>How productivity gains are split among workers, consumers, shareholders and firms, set against transition costs for displaced workers.</td><td>BLS labor share and productivity; ECI and earnings by occupation; corporate margins from filings; Displaced Worker Survey earnings losses.</td><td>Economy-wide labor share moves for many reasons (pricing power, capital intensity, sector mix); attributing a share of it to AI is not currently possible.</td><td>Industry- or firm-level evidence linking measured AI deployment to wages, prices and margins.</td></tr>
        <tr><td><strong>White-collar trade-down rate</strong></td><td>Share of white-collar workers who return to work in a lower occupation group, part-time for economic reasons, or contingent work. Reemployment is not the same as recovery.</td><td>CPS month-to-month matched records (unemployed in one month, employed later); Displaced Worker Survey (biennial).</td><td>Matching CPS records requires validated linking and attrition adjustments, which we have not yet built.</td><td>Validated CPS matching with published attrition rates and margins of error; target: the October or November 2026 edition.</td></tr>
        <tr><td><strong>Management-layer compression</strong></td><td>Whether firms are removing management layers (several 2026 layoffs cited "fewer layers") faster than the management occupation shrinks.</td><td>Company announcements and filings; CPS employment in management occupations; BLS projections.</td><td>Layers are rarely disclosed; occupation counts do not measure layers.</td><td>A repeatable disclosure-based measure validated against a firm sample.</td></tr>
      <tr><td><strong>Productivity per AI token</strong></td><td>Output gained per unit of AI computing consumed, tracked over time, to show whether AI spending is turning into measurable work output.</td><td>Firm disclosures of AI consumption or spending matched to output, revenue or hours; model-provider usage reports; BLS productivity.</td><td>No public firm-level data on token use; token prices have fallen steeply, so tokens, prices and spending move differently; attributing output to AI use within a firm is unsolved.</td><td>A repeatable panel of firms reporting both AI consumption and an output measure for at least four quarters.</td></tr><tr><td><strong>Productivity by function, seniority and place</strong></td><td>Whether AI's productivity gains concentrate in particular functions (software, customer support, finance), seniority levels or regions, and whether job losses follow the same pattern.</td><td>BLS detailed-industry and state productivity; field experiments; occupation-level output proxies; CPS long searches by occupation and state.</td><td>BLS measures productivity by industry and state, not by occupation or seniority; experiments cover single firms and tasks.</td><td>An occupation- or function-level output measure validated against at least two sources. A state comparison using BLS state productivity is planned for the next Q3 addendum.</td></tr><tr><td><strong>AI work compression</strong></td><td>Human work hours AI makes unnecessary, as a share of hours worked; shows labor-saving pressure before it appears as job cuts.</td><td>St. Louis Fed Real-Time Population Survey (share of all hours saved: 2.2% in Q2 2026); Census household survey; firm time-use studies.</td><td>Self-reported; no official statistic; saved time may go to more output, new tasks or more work rather than fewer hours.</td><td>A repeated official or peer-reviewed series with a stable question, plus evidence on where saved hours go.</td></tr><tr><td><strong>Capability-to-labor lag</strong></td><td>How long after AI demonstrates a capability measurable labor effects appear in the matching occupations.</td><td>METR, GDPval and OSWorld by task family, mapped to occupations; CPS and payroll outcomes by occupation.</td><td>Benchmarks change, saturate and are contaminated; no common capability unit; no study estimates a lag.</td><td>A documented mapping from benchmark tasks to occupations and at least two years of matched outcomes. A first cross-sectional test using task-level exposure appears in Chapter 04 (Version 1.71).</td></tr><tr><td><strong>Payroll-to-contract shifts</strong></td><td>Workers moved from payroll jobs to contract, fractional or platform work, which unemployment does not count.</td><td>CPS Contingent Worker Supplement (2023; next fielding expected 2026); IRS information returns; firm disclosures.</td><td>No monthly official measure; private surveys conflict with BLS levels.</td><td>A repeatable official source, or a validated private panel benchmarked to the BLS supplement.</td></tr><tr><td><strong>Hiring-funnel congestion</strong></td><td>Applications, screen, interview and offer rates per opening, and the share of screening done by software.</td><td>Applicant-tracking vendors (Greenhouse, Ashby), job-tracker users (Huntr), LinkedIn.</td><td>Vendor data from self-selected customers; inconsistent definitions; no public time series.</td><td>A data partnership with consistent definitions and at least 24 months of history.</td></tr></tbody>
    </table></div>
    <span class="ex-note">Revenue per employee, listed in earlier drafts of this agenda, is now a production measure (Q3 addendum) for a defined company sample, with the caveats stated there.</span>
  </div>
  <h3>Framework: four stages of AI adoption (a hypothesis, not a finding)</h3>
  <p>We organize this agenda around a hypothesis: AI's effect on jobs may depend less on whether workers use AI and more on whether companies redesign work around it. Stage 1, individual augmentation: AI helps a worker do the job. Stage 2, task substitution: AI performs part of the job. Stage 3, workflow automation: AI performs an entire workflow. Stage 4, organizational redesign: the company changes its structure. Most survey evidence today describes stages 1 and 2. The forward-deployed engineering firms and AI roll-ups described in the Q3 addendum are explicitly selling stages 3 and 4.</p>
</section>


<section id="faq" aria-labelledby="h-faq">
  <div class="chapter-head"><div class="eyebrow">Frequently asked questions</div><h2 id="h-faq">FAQ</h2></div>
  <div>
    <details><summary>What is the NextChapter White-Collar Long-Term Unemployment Index?</summary><p>A monthly measure of long-term unemployment among managers and professionals: people whose last job was in management, business, financial or professional occupations and who have been unemployed 27 weeks or more, as a share of that labor force. It is seasonally adjusted, averaged over three months and set to 2019 = 100, calculated by NextChapter from Census CPS microdata. It was 162 in August 2026.</p></details>
    <details><summary>What was the U.S. unemployment rate in September 2026?</summary><p>4.2%, up from 4.1% in August and down from 4.4% in September 2025, according to BLS. Employers added 29,000 jobs.</p></details>
    <details><summary>How many people are long-term unemployed?</summary><p>1.94 million people had been unemployed 27 weeks or more in September 2026, 27.1% of all unemployed, up from 23.6% a year earlier. About two in three of them have been looking for a year or more.</p></details>
    <details><summary>How many layoffs have been blamed on AI in 2026?</summary><p>Employers attributed 120,136 announced job cuts to AI from January through September 2026, about 21% of announced cuts (Challenger, Gray &amp; Christmas). AI appears less often in formal filings: 16 of 170 SEC restructuring filings (9.4%) cite AI in the restructuring disclosure itself (corrected in Version 1.4 from 2).</p></details>
    <details><summary>Is AI causing higher unemployment?</summary><p>Most 2026 research, including from the Yale Budget Lab and the Federal Reserve, finds no broad AI effect on unemployment yet. Stanford and others find reduced hiring of young workers in highly AI-exposed jobs.</p></details>
    <details><summary>How many applications does it take to get a job in 2026?</summary><p>Employers received about 244 applications per job in 2025 (Greenhouse) and more than 300 per hire in 2026 (Ashby). Among users of the Huntr job tracker, two-thirds of offers came within 50 applications, and it took roughly 24–48 applications per interview.</p></details>
    <details><summary>Is immigration causing long-term unemployment among professionals?</summary><p>Not on our data. From January–August 2025 to the same months of 2026, long-term unemployment among U.S.-born white-collar workers rose from 0.52% to 0.73% of their labor force, beyond the margin of error, while the noncitizen share of the white-collar workforce stayed at 6.3%. H-1B registrations fell 38.5% in 2026 and overall immigration fell sharply, which mainly lowers the job growth needed to keep unemployment steady (Chapter 04).</p></details>
    <details><summary>When is the next BLS jobs report?</summary><p>The October 2026 report comes out Friday, November 6, 2026 at 8:30 a.m. Eastern, and the November report on Friday, December 4.</p></details>
  </div>
</section>

<section id="pilot" class="appendix" aria-labelledby="h-pil">
  <div class="chapter-head"><div class="eyebrow">Appendix A</div><h2 id="h-pil">Experimental measures</h2></div>
  <p>These measures are new, small or qualitative. They are not used in the executive summary or the headline findings until they meet the standards in Appendix B.</p>
  <h3>Senior openings tracker (pilot)</h3>
  <p>NextChapter collects director-level and above job postings from retained search firms, venture and private-equity portfolio job boards, industry associations and employer career sites. We compare only the 17 sources collected in both August and September 2026.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit A1</span>
    <span class="ex-title">New senior postings, same 17 sources, August vs. September 2026</span>
    <div class="tbl"><table>
      <thead><tr><th>Postings</th><th>August</th><th>September</th><th>Change</th></tr></thead>
      <tbody>
        <tr><td>All director-and-above</td><td>358</td><td>288</td><td>−20%</td></tr>
        <tr><td>VP, head-of, C-suite and board</td><td>192</td><td>153</td><td>−20%</td></tr>
        <tr><td>Director, principal and chief of staff</td><td>166</td><td>135</td><td>−19%</td></tr>
        <tr><td>Listed as remote</td><td>40 (11.2%)</td><td>13 (4.5%)</td><td>—</td></tr>
        <tr><td>Data and AI leadership</td><td>14</td><td>21</td><td>+7 postings</td></tr>
        <tr><td>Marketing leadership</td><td>40</td><td>15</td><td>−25 postings</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Public job postings only; no NextChapter user data. Sources are a small, non-random set, and part of the August-to-September change is likely seasonal. Year-over-year comparisons will begin once a full year of data exists.</span>
  </div>
  <h3>Field notes (qualitative)</h3>
  <p>These are impressions from conversations with senior professionals who use NextChapter. They are not statistics, the group is small and not representative, and NextChapter has a commercial relationship with these users. Several people we speak with left jobs voluntarily rather than being laid off; career returners frequently raise how to explain a gap; and the barriers people name most often are perceived age bias, applications that receive no response, and AI skills.</p>
</section>

<section id="method" class="appendix" aria-labelledby="h-meth">
  <div class="chapter-head"><div class="eyebrow">Appendix B</div><h2 id="h-meth">Methodology, standards and revisions</h2></div>
  <h3>Definitions</h3>
  <ul class="items">
    <li><span class="who">White-collar</span><p>People whose current or most recent job is in Census major occupation group 1 (management, business and financial) or 2 (professional and related): variable PRMJOCC1 = 1 or 2. Unemployed people with no prior job have no occupation and are excluded.</p></li>
    <li><span class="who">Labor force, unemployed</span><p>Labor force = PEMLR 1–4; unemployed = PEMLR 3–4 (on layoff or looking). Estimates use the composite weight PWCMPWGT, the weight BLS uses for labor-force estimates.</p></li>
    <li><span class="who">Long-term</span><p>Unemployed 27 weeks or more (PRUNEDUR ≥ 27). Durations are spells in progress, top-coded at 119 weeks.</p></li>
    <li><span class="who">Index</span><p>White-collar long-term unemployed as a share of the white-collar labor force, seasonally adjusted, 3-month moving average, divided by its 2019 average and multiplied by 100. October 2025 was not collected; averages spanning it use the available months.</p></li>
  </ul>
  <h3>Seasonal adjustment</h3>
  <p>The index is seasonally adjusted with monthly factors equal to each calendar month's average ratio to its year's mean, estimated over 2015–2019 and 2022–2025 (pandemic years 2020–2021 excluded) and normalized to average 1.0 (Jan 1.104, Feb 1.059, Mar 0.998, Apr 0.949, May 0.907, Jun 0.926, Jul 1.039, Aug 1.075, Sep 1.057, Oct 0.995, Nov 0.965, Dec 0.926). Factors are re-estimated once a year. This is simpler than the X-13ARIMA-SEATS method BLS uses, so each edition also reports the index under X-13, STL and an unadjusted 12-month average (Exhibit 3); conclusions do not depend on the method. All other microdata comparisons use the same months in each year (January–August) and are not seasonally adjusted.</p>
  <h3>Margins of error</h3>
  <p>From Version 1.4, margins of error use the method the Bureau of Labor Statistics publishes for users of Current Population Survey estimates: generalized variance functions with the parameters in BLS's "Parameters and factors for calculating standard errors for estimates from the CPS" (methods document dated July 2026). For a level x, se = √((α + βN)(x − x²/N)), where N is the civilian noninstitutional population 16 and over; for a percentage p with base y, se = √(((α + βy)/y)·p(100 − p)). We use the published parameters for unemployed persons (overall and by major occupation group, tables PF-1 and PF-13), unemployed 27 weeks and over and their percentage of the unemployed (PF-12), and the civilian labor force (PF-1). BLS publishes factors for three- and twelve-month averages and their changes; for our eight-month (January–August) averages we interpolate linearly between those factors, and for year-apart changes we apply the published ratio of the change-in-yearly-average factor to the yearly-average factor. Comparisons with 2019 treat the periods as independent. Subgroup rates use the standard error of the numerator divided by the subgroup labor force, because BLS publishes rate parameters only for large groups. Margins are 1.645 standard errors (90% confidence). Duration bands and medians (Exhibits 14 and 15) keep our earlier approximation because BLS publishes no parameters for them. Census does not release replicate weights for the public-use monthly files, so generalized variance functions are the recommended public method; they can understate variance for small groups, which is one reason we suppress groups with fewer than about 100 unemployed respondents and mark those under 400 as small.</p>
  <h3>Measures reported every month</h3>
  <p>To avoid reporting only the cells that moved, each edition reports this fixed list regardless of direction: the White-Collar Index; labor force participation for ages 55+ and 65+; long-term shares for white-collar workers 50+; recent-graduate (22–27, bachelor's+) and young high-school-graduate unemployment; blue-collar unemployment and long-term share; self-employment shares (all, white-collar, 55+); Census business applications; white-collar unemployment and long-term rates and shares; long-term duration bands for all and white-collar workers; long-term shares by occupation (Exhibit 13 groups), by white-collar industry (Exhibit 14 groups) and by white-collar age group; BLS headline indicators (Exhibit 7); JOLTS; Challenger cuts and AI attributions; the SEC Item 2.05 comparison; state payroll leaders and laggards; and unemployment-insurance exhaustion.</p>
  <h3>Other NextChapter calculations</h3>
  <p>This edition covers September 1–30, 2026. It uses releases that describe that period even when published in the first days of October (the September jobs report, Challenger's September report, weekly jobless claims), and excludes events and data released about later dates. Census microdata run through August, the latest available at publication; the Q3 addendum covers July–September. Year-to-date and over-the-year payroll changes are calculated from FRED levels as of October 2, 2026, and will change with revisions. Openings per unemployed person divides JOLTS openings by CPS unemployment. State percent changes use BLS levels. The SEC comparison counts distinct filings returned by EDGAR full-text search; see "SEC filing search and coding" below.</p>
  <h3>Index name</h3>
  <p>From Version 1.4 the index is called the <strong>White-Collar Long-Term Unemployment Index</strong> (formerly the White-Collar Displacement Index). The measure is unchanged. We renamed it because it counts everyone long-term unemployed whose last job was white-collar, including people who quit or are re-entering the labor force, and because it identifies long-term unemployment, not its cause. It should not be read as an estimate of AI-driven displacement. A companion measure limited to people who lost a job (excluding quits and re-entrants) is reported in Chapter 01.</p>
  <h3>How the variance method changed the results</h3>
  <p>Until Version 1.3 we used a conservative rule of thumb (design effect 2.0; eight pooled months counted as 3.2 independent months). The BLS method gives margins about two-thirds as wide. The table compares them for key estimates. Every finding in the executive summary clears both; several smaller changes clear only the BLS-method margin and are flagged in the tables on that basis.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit 47</span>
    <span class="ex-title">90% margins of error: earlier approximation versus BLS variance method</span>
    <div class="tbl"><table>
      <thead><tr><th>Estimate (January–August, 2026 vs 2025)</th><th>Change</th><th>Earlier approximation</th><th>BLS method</th><th>Clears margin?</th></tr></thead>
      <tbody>
        <tr><td>White-collar long-term unemployment rate</td><td>+0.18 pts</td><td>±0.11</td><td>±0.08</td><td>Both</td></tr>
        <tr><td>White-collar unemployment rate</td><td>+0.18 pts</td><td>±0.21</td><td>±0.15</td><td>BLS method only</td></tr>
        <tr><td>White-collar unemployed out 27+ weeks</td><td>+5.3 pts</td><td>±3.6</td><td>±2.4</td><td>Both</td></tr>
        <tr><td>Computer and mathematical, out 27+ weeks</td><td>+13.4 pts</td><td>±11.6</td><td>±7.5</td><td>Both</td></tr>
        <tr><td>Business and financial operations, out 27+ weeks</td><td>+7.4 pts</td><td>±9.7</td><td>±6.3</td><td>BLS method only</td></tr>
        <tr><td>White-collar ages 55–64, out 27+ weeks</td><td>+12.9 pts</td><td>±9.2</td><td>±6.3</td><td>Both</td></tr>
        <tr><td>White-collar ages 50+, out 27+ weeks</td><td>+7.6 pts</td><td>±6.5</td><td>±4.5</td><td>Both</td></tr>
        <tr><td>Labor force participation, ages 55+</td><td>−1.0 pt</td><td>±0.5</td><td>±0.4</td><td>Both; age and sex composition explains almost all of it (Chapter 07)</td></tr>
        <tr><td>Unemployment, ages 22–27 with a bachelor's degree, vs 2019</td><td>+1.5 pts</td><td>±0.9</td><td>±0.7</td><td>Both</td></tr>
        <tr><td>Information industry (white-collar), out 27+ weeks</td><td>+9.0 pts</td><td>±17.2</td><td>±11.0</td><td>Neither</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">NextChapter calculation from Census CPS public-use microdata (January–August 2025 and 2026; 2019 for the graduate row) using BLS parameters and factors. Computation scripts are in the replication materials.</span>
  </div>
  <h3>Seasonal adjustment: robustness</h3>
  <p>The headline comparison (0.75% vs 0.56%) compares the same months of each year without seasonal adjustment, so it does not depend on any adjustment method. The monthly index does. We recomputed it three other ways: with the Census Bureau's X-13ARIMA-SEATS program (log transform, automatic model, level shifts for April 2020 and July 2021; October 2025 interpolated for estimation and then dropped), with STL decomposition, and as an unadjusted 12-month moving average. Results are in Chapter 01 (Exhibit 3). X-13 diagnostics flag possible residual seasonality, a common issue in short series disrupted by the pandemic, which is why we show all four.</p>
  <h3>Sample sizes, small cells and nonresponse</h3>
  <p>Every occupation and age table shows the unweighted number of unemployed respondents. Cells with fewer than 100 unemployed respondents are suppressed; cells with fewer than 400 are marked as small and should be read as indicative only (for example, architecture and engineering, 136 respondents). CPS response rates have fallen substantially over the past decade; if people who are unemployed for a long time respond at different rates than others, estimates could be biased in ways weights do not fully correct. We have not measured this bias.</p>
  <h3>Occupation codes and historical comparability</h3>
  <p>CPS occupation codes changed in 2003, 2011 and 2020 (the last adopting the 2018 Census occupation classification). The index starts in 2015 and spans the 2020 change; the major groups used here were largely, but not entirely, preserved, and we treat January 2020 as a potential break. A planned extension back to 2003 will document each break and will be shortened rather than spliced if comparability cannot be shown. The 2019 baseline is a relatively normal pre-pandemic benchmark, not a historical minimum or equilibrium.</p>
  <h3>Evidence standards</h3>
  <ul class="items">
    <li><span class="who">Number labels</span><p>Source-reported (a figure published by the source); NextChapter calculation (computed by us from identified data, method stated); NextChapter estimate (involves an assumption or model); hypothesis (a claim we are testing, with no number).</p></li>
    <li><span class="who">Company AI evidence levels</span><p>Level 1: management says AI will raise productivity or cut costs. Level 2: the statement plus an operating metric moving in the expected direction. Level 3: sufficient evidence that AI contributed to a measured change. We never treat Level 1 as Level 3, and nothing in this edition reaches Level 3.</p></li>
    <li><span class="who">Source hierarchy</span><p>Tier 1: BLS, Census, DOL, SEC, Federal Reserve, BEA, NBER and peer-reviewed or university research. Tier 2: transparent industry data (Challenger, Indeed, LinkedIn, ADP via published research, staffing firms, recruiting-software vendors). Tier 3: media, used to find primary sources and cited directly only when no primary source is available.</p></li>
    <li><span class="who">Alternative explanations</span><p>For any finding that might be read as an AI effect, we consider post-pandemic overhiring, the technology-sector correction, interest rates and the cost of capital, weaker venture funding, federal job cuts, outsourcing and offshoring, and remote work, and ask which observations are specifically consistent with AI rather than equally consistent with these.</p></li>
  </ul>
  <h3>SEC filing search and coding (corrected in Version 1.4)</h3>
  <p>We use EDGAR full-text search for form 8-K, January 1–September 30, 2026, query "Item 2.05" (170 filings from 149 companies), and the same query combined separately with "artificial intelligence", "AI", "automation", "machine learning" and "generative AI". We read every match in full and code each by the role AI plays: operational in the restructuring section (AI changing work, or cutting to reinvest in AI), operational elsewhere in the filing, risk or forward-looking language only, or false match. Versions 1.0 and 1.1 omitted the "AI" query and therefore reported 2 rather than 16 filings citing AI in the restructuring section. Coding was done by one analyst; a second-coder reliability check is planned before the Operational AI Disclosure Index is published.</p>
  <h3>Revenue per employee</h3>
  <p>Sample, sources and exclusions are stated in the note to the revenue-per-employee exhibit in the Q3 addendum. Headcounts are taken from each 10-K's human-capital section, read and verified by hand; revenue is from XBRL company facts for the same fiscal-year end. The sample will be fixed for future comparisons and updated annually.</p>
  <h3>Replication materials and review</h3>
  <p>Replication materials are published at <a href="https://launchyournextchapter.com/reports/replication">launchyournextchapter.com/reports/replication</a>, which links to the public code repository. They include the Python scripts that pull and process Census CPS microdata, build the index and breakdowns, and compute margins of error; the BLS variance parameters used; the X-13 specification and seasonal-adjustment comparison; the SEC search queries and hand-coding sheet; the revenue-per-employee sample; derived data files; a variable dictionary; and a changelog. Census microdata are public and are not redistributed; the scripts download them directly. Results can be reproduced without contacting NextChapter. This edition has not been externally reviewed; when an outside methodological review takes place, we will name the reviewer and state its scope and date here.</p>
  <h3>Edition-to-edition change record (standing requirement from October 2026)</h3>
  <p>Beginning with the October 2026 edition, every report will include a "What changed this edition" table listing, for each material change, its type (section added or removed, data source, measurement, methodology, revision, interpretation), the previous and current treatment, the reason and the effect on historical results. Each edition uses the calendar month (first through last day) as its reference period and states separately its publication date and the date through which source data were available. When a method changes, we show old method, new method, reason and effect; if the change alters prior-period results we publish the revised historical series and mark the break, and if it does not, we say so. A fuller change log is kept in the public replication materials. This September edition is the first and is not retrofitted; its version log below records changes made since first publication.</p>
  <h3>Revisions and corrections</h3>
  <p>Government data are revised. Each edition reflects data available on its "data through" date. Errors are corrected in the online edition with a dated note below, and the data files are updated to match. Send corrections to Justin Kulla, Founder and CEO, at jkulla@launchyournextchapter.com.</p>
  <div class="exhibit">
    <span class="ex-label">Version log</span>
    <div class="tbl"><table>
      <thead><tr><th>Version</th><th>Date</th><th class="l">Change</th></tr></thead>
      <tbody><tr><td>1.72</td><td>Oct 7, 2026</td><td class="l"><strong>Addition:</strong> a total factor productivity (TFP) analysis in the Q3 addendum using the San Francisco Fed quarterly series, decomposing output-per-hour growth into capital deepening, labor quality and TFP, with utilization-adjusted TFP; a check of Apollo chief economist Torsten Slok's October 5, 2026 note (labeled as published after the reference period); a caveat added to the illustrative productivity scenario; one scorecard row and one executive-summary highlight. No previously published figures changed.</td></tr><tr><td>1.71</td><td>Oct 6, 2026</td><td class="l"><strong>Additions:</strong> a test of AI exposure against labor-market outcomes across 22 occupation groups (Chapter 04), using the task-level exposure measure of Eloundou and others (2024) weighted by May 2022 employment, with results against both 2019 and 2022 baselines; a stated postulate, the conversational threshold, with a first test comparing customer service representatives and receptionists (feature); outcomes for workers 22+ by education (no degree, bachelor's, master's, professional or doctoral) and by years of potential experience, with posting-requirement evidence (Chapter 06); a section on the price of higher education, completion, payback, student debt and the 2026 federal loan changes, including the data gap on debt among the unemployed (Chapter 09); two scorecard rows; two executive-summary bullets. No previously published figures changed.</td></tr><tr><td>1.7</td><td>Oct 6, 2026</td><td class="l"><strong>Additions:</strong> a feature on the rewiring constraint (AI capability, organizational change and labor-market adjustment as three speeds, tested against the evidence); a "beyond unemployment" check of involuntary part-time work, multiple jobholding, self-employment and hours among employed white-collar workers (Chapter 01; approximate margins of error, stated); research on AI on both sides of hiring (Chapter 08); four Future Research Agenda measures; the edition-to-edition change-record standard and a "data available through" date on the cover (Appendix B). No previously published figures changed.</td></tr><tr><td>1.6</td><td>Oct 6, 2026</td><td class="l"><strong>Correction and additions:</strong> the fall in participation for ages 55+ (38.1% to 37.1%) is removed from the executive summary; holding the 2025 age and sex mix fixed, the change is −0.05 points, so the drop reflects an aging 55+ population and the January 2026 population revisions, not more older workers leaving the labor force (Chapter 07). Added white-collar long-term unemployment by nativity and an immigration section (H-1B fee and lottery, international students, net migration, research) in Chapter 04; "breakeven" job-growth context for payroll figures; a monthly use-case watch pairing AI deployments with industry jobs series (Chapter 15); and an FAQ entry. No other previously published figures changed.</td></tr><tr><td>1.5</td><td>Oct 6, 2026</td><td class="l"><strong>Additions:</strong> career-ladder indicators (promotions, internal hiring, management layers) and employer training spending in Chapter 09; a review of college and university AI programs by career stage (undergraduate, mid-career, MBA, executive education, professional degrees, alumni); a public-retraining section in Chapter 13 covering WIOA funding and results, AI-related Labor Department guidance, Workforce Pell and Trade Adjustment Assistance; an annual Q3 feature comparing industry productivity with long searches; two Future Research Agenda measures (productivity per AI token; productivity by function, seniority and place). Public-retraining items previously in Chapter 09 moved to Chapter 13. No previously published figures changed.</td></tr><tr><td>1.4</td><td>Oct 6, 2026</td><td class="l"><strong>Methods upgrade:</strong> margins of error recomputed with the BLS generalized variance method (published CPS parameters) instead of our earlier approximation; flags updated accordingly (more changes now clear the margin; all executive-summary findings clear both methods). Added seasonal-adjustment robustness checks (X-13ARIMA-SEATS, STL and a 12-month average), a job-losers-only companion measure, a hires-per-opening series (2001–2026), an illustrative net-productivity ledger in the Q3 addendum, an evidence hierarchy, section labels separating our measurements from others' findings and interpretation, source links for headline figures, and published replication materials. No point estimates changed. Reference period stated as September 1–30, 2026; three items describing dates after September 30 removed (a Gallup survey release, a TrueUp running total and an October company figure restated as of August 31).</td></tr><tr><td>1.3</td><td>Oct 6, 2026</td><td class="l"><strong>Corrections:</strong> Greenhouse figures corrected (annual applications per recruiter 1,610 in 2022 to 4,890 in 2025, not 146 to 746; time to fill 59.7 days, not 57); data CSV index values aligned with the index file (161.6 and 128.2). Significance language made provisional ("beyond our approximate 90% margin of error") pending replicate-weight variance estimates; two sentences reworded so they do not claim more than the data show; table notes clarified; print layout of Exhibit 13 fixed.</td></tr><tr><td>1.2</td><td>Oct 6, 2026</td><td class="l"><strong>Correction:</strong> SEC restructuring filings citing AI in the restructuring section revised from 2 to 16 (search had omitted the abbreviation "AI"); Exhibit 12 and Chapter 03 text revised. Index renamed (measure unchanged). Added the Q3 2026 quarterly addendum (scorecard, expectations versus outcomes, SEC coding, revenue per employee, labor-market services, organizational redesign, reemployment), a chapter on independent research, two features, the Future Research Agenda, the "does not establish" box, expanded methodology and Appendix D (revision audit). No other previously published figures changed.</td></tr><tr><td>1.1</td><td>Oct 6, 2026</td><td class="l">Added chapters on older workers, jobs created and destroyed, and new businesses; expanded new graduates and blue-collar coverage and the mid-career skills gap; added contact details. No previously published figures changed.</td></tr><tr><td>1.0</td><td>Oct 5, 2026</td><td class="l">First publication.</td></tr></tbody>
    </table></div>
  </div>
  <div class="box cite">
    <div class="eyebrow">How to cite</div>
    <code id="cite-text">Kulla, J. (2026, October 5). NextChapter Displacement Report: September 2026 (Version 1.72). NextChapter. https://launchyournextchapter.com/reports/displacement-report-september-2026</code>
    <button class="btn2 no-print" type="button" id="copy-cite">Copy citation</button>
    <p class="note">Data: <a href="/reports/displacement-report-2026-09-data.csv">report figures (CSV)</a> · <a href="/reports/wc-index.csv">White-Collar Index history, 2015–2026 (CSV)</a> · <a href="/reports/sec-item205-ai-coding-2026.csv">SEC restructuring filings coded for AI (CSV)</a> · <a href="/reports/displacement-report-2026-q3-revenue-per-employee.csv">revenue per employee sample (CSV)</a>. Charts and data may be republished with attribution under CC BY 4.0. Index code is available on request.</p>
  </div>
</section>

<section id="sources" class="appendix" aria-labelledby="h-src">
  <div class="chapter-head"><div class="eyebrow">Appendix C</div><h2 id="h-src">Sources</h2></div>
  <ol class="sources">
    <li>U.S. Bureau of Labor Statistics (BLS), The Employment Situation — September 2026 (Oct 2, 2026), tables A-1, A-4, A-10–A-13, B-1.</li>
    <li>BLS, Job Openings and Labor Turnover Survey — August 2026 (Sep 29, 2026).</li>
    <li>BLS, State Employment and Unemployment — August 2026 (Sep 18, 2026).</li>
    <li>BLS, Duration of unemployment by age (cpseea36), September 2026.</li>
    <li>U.S. Census Bureau, Current Population Survey basic monthly public-use microdata, Jan 2015–Aug 2026, via the Census Data API.</li>
    <li>Federal Reserve Bank of St. Louis, FRED: PAYEMS, UNRATE, USINFO, USFIRE, USPBS, CES9091000001, IHLIDXUS.</li>
    <li>U.S. Department of Labor, Unemployment Insurance Weekly Claims (Oct 1, 2026) and UI Data Dashboard.</li>
    <li>Federal Reserve Bank of Atlanta, Wage Growth Tracker (Sep 10, 2026).</li>
    <li>Federal Reserve Bank of New York, The Labor Market for Recent College Graduates (Q2 2026).</li>
    <li>Federal Reserve Bank of Minneapolis, unemployment insurance criteria (Mar 19, 2026).</li>
    <li>Axios, September jobs report coverage (Oct 2, 2026) — consensus estimate.</li>
    <li>Challenger, Gray &amp; Christmas, Job Cuts Report — September 2026 (Oct 1, 2026).</li>
    
    <li>SEC EDGAR full-text search, Form 8-K, Jan 1–Sep 30, 2026 (accessed Oct 5, 2026).</li>
    <li>Hunton Andrews Kurth, New York WARN AI disclosure (May 18, 2026); Bloomberg Law and Fisher Phillips on California SB 951 (Sep 30–Oct 1, 2026).</li>
    <li>Brynjolfsson, Chandar &amp; Chen, "Canaries in the Coal Mine?" update, Stanford Digital Economy Lab (Aug 12, 2026).</li>
    <li>Revelio Labs, AI Labor Market Tracker (Aug 2026); Indeed Hiring Lab, "The Labor Market Is Tilting Toward Seniority" (Jul 23, 2026).</li>
    <li>Anthropic Economic Index (Jan 15 and Mar 24, 2026); Yale Budget Lab AI tracker (Sep 15, 2026).</li>
    <li>Federal Reserve Board, remarks by Governors Cook (Sep 28, 2026) and Barr (Sep 29, 2026).</li>
    <li>Forbes, on organizational flattening (May 21, 2026), citing Korn Ferry.</li>
    <li>AARP, 2026 Age Bias Survey (Mar 2, 2026); Center for Retirement Research at Boston College (Jun 30, 2026).</li>
    <li>D'hert, Baert &amp; Lippens, Socio-Economic Review (2026); Goldman Sachs Research (Apr 6, 2026).</li>
    <li>Greenhouse, Benchmark Report, North America (Mar 2026) and AI in Hiring Report (Nov 19, 2025).</li>
    <li>Ashby, Talent Trends (May 7, 2026); Huntr, Job Search Trends Q1 2026.</li>
    <li>Gartner, candidate survey (Jul 31, 2025); SHRM, AI in HR (Apr 8, 2026).</li>
    <li>Seyfarth, Duane Morris and Forbes on Illinois HB 3773, California automated-decision regulations, Colorado SB 26-189 and Mobley v. Workday (2025–2026); National Law Review on EEOC guidance (2025).</li>
    <li>Lightcast, "Beyond the Buzz" (Jul 2025); PwC, 2026 Global AI Jobs Barometer (Jun 15, 2026); McKinsey Global Institute (Nov 25, 2025); LinkedIn Skills on the Rise 2026 via EdTech Innovation Hub; World Economic Forum, Future of Jobs 2025.</li>
    <li>Purdue (Feb 24, 2026), University of Michigan (Jan 29, 2026), Indiana University (Oct 2025), Penn State (May 28, 2026), Cornell, Northeastern, Stanford GSB, HBS and Duke Fuqua alumni pages; Forbes on NYU (Jun 9, 2026).</li>
    <li>National Alumni Career Mobility annual report (Lightcast, 2024); Inside Higher Ed (May 6, 2026).</li>
    <li>U.S. Department of Education, Workforce Pell final rule (May 19, 2026); DOL TEGL 15-25 (Jun 25, 2026).</li>
    <li>NYEC on H.R. 8210 (May 2026); National Skills Coalition and NAWB on FY2027 appropriations (Jun 2026).</li>
    <li>Roodman &amp; Massenkoff, "Reviewing the evidence on worker retraining programs," Anthropic (Aug 12, 2026).</li>
    <li>California Labor &amp; Workforce Development Agency (Jul 14 and Jul 24, 2026).</li>
    <li>Bipartisan Policy Center (Jul 2026) and KEYC (Jul 7, 2026) on paid family leave.</li>
    <li>NACE, Job Outlook 2026 Spring Update (Apr 2026); NBER Working Paper w35796 (Sep 2026).</li>
    <li>BLS, Schedule of Releases for the Employment Situation.</li>
    <li>BLS, Displaced Worker Survey, January 2026 (Aug 27, 2026); BLS Employment Projections 2025–35 (Aug 27, 2026) and Occupational Outlook Handbook; BLS TED on AI and employment (Jul 16, 2026); BLS tables A-13, A-36, B-1, B-8.</li>
    <li>U.S. Census Bureau, Business Formation Statistics (via FRED, Aug 2026) and Business Trends and Outlook Survey (May 26, 2026).</li>
    <li>Kauffman Indicators of Entrepreneurship, 2025 national report (May 2026); Gusto New Business Formation Report (May 14, 2026); Carta Solo Founders Report (2025); Stripe Atlas 2025 review; MBO Partners State of Independence (2025); SBA FY2025 lending.</li>
    <li>Indeed Hiring Lab AI tracker (GitHub, through Aug 31, 2026); LinkedIn Jobs on the Rise 2026 via Allwork.Space; PwC 2026 AI Jobs Barometer; WEF Future of Jobs 2025; Fortune on programmer employment.</li>
    <li>Federal Reserve Bank of New York, recent college graduates (Q2 2026) and by-major data via Research.com (Sep 23, 2026); NACE Job Outlook 2026 and salary survey (Feb 2026); Handshake class of 2026 reports; ZipRecruiter 2026 graduate survey; Strada, Talent Disrupted (2024); Cleveland Fed via Fox Business; Anthropic (Mar 5, 2026).</li>
    <li>Associated Builders and Contractors (Jan 15, 2026); Home Builders Institute (Jul 2026); BLS Occupational Outlook for electricians; Fortune (Mar 2, 2026); Bloomberg Law on apprenticeships (Mar 23, 2026); National Student Clearinghouse (Jun 4, 2026); International Federation of Robotics (Jun 18, 2026).</li>
    <li>AARP Age Bias Survey (2026) and AARP/NORC retirement surveys (2026); AARP tech trends (Dec 2025); SHRM (Oct 29, 2025); Gallup (May and Feb 2026); BCG AI at Work (Jun 2026); ATD State of the Industry (2025); Patriot Software (Jul 2026); Urban Institute (Jan 2026); Workcred/GWU (2021); Chicago Fed (2003); law-firm summaries of Mobley v. Workday (2026).</li>
      <li>BLS, Total Factor Productivity for Major Industries — 2024 (Dec 19, 2025), Table 3; Productivity and Costs by Industry: Selected Service-Providing Industries — 2025 (Aug 26, 2026); Labor Productivity by State — 2025 (May 28, 2026).</li>
    <li>U.S. Department of Labor, ETA: PY2024 WIOA National Performance Summary (Nov 2025); WIOA PY2026 allotments, Federal Register (Apr 2026); FY2027 Budget in Brief; TEGL 03-25 (Aug 26, 2025) and TEGL 15-25 (Jun 25, 2026); Trade Adjustment Assistance program page. NAWB policy alerts on H.R. 8210 and FY2027 appropriations (2026); White House, H.R. 6500 (Sep 2, 2026); CRS Insight IN12715 (Jul 20, 2026); Opportunity Data Workforce Pell tracker (Sep 28, 2026); Mathematica WIA Gold Standard Evaluation (2019); Holzer, Brookings (2022).</li>
    <li>Workday Global Workforce Report (Sep 9, 2025); Gusto promotions and managerial flattening (Jun 2025); ADP Research (Jul 8, 2024); Revelio Labs (Feb 17 and Mar 31, 2026); Burning Glass Institute and NYU SPS via CBS News (Jun 1, 2026); LinkedIn Workplace Learning Report 2025; Training magazine 2025 Training Industry Report (Nov 10, 2025); ATD 2026 State of the Industry (May 2026); SHRM 2026 Employee Benefits Survey (Jun 17, 2026); Mercer (Aug 12, 2025).</li>
    <li>Computing Research Association, Tracking the Rise of AI Academic Programs (Apr 28, 2026) and Taulbee Survey 2025; National Student Clearinghouse; Stanford-led Mapping AI Programs in the U.S. (May 2026); Boston Globe (Jun 8, 2026); Purdue (Aug 19, 2026), Ohio State, SUNY, Carnegie Mellon, MIT, Miami Dade College, UT Austin, Georgia Tech, Johns Hopkins, CU Boulder and UChicago (Sep 17, 2026) program pages; Harvard Business School, Wharton, Kellogg, Chicago Booth, MIT Sloan; GMAC Prospective Students Survey 2026; Poets &amp; Quants (Aug 12, 2026); MIT Sloan and Stanford GSB executive-education pages; Bloomberg (May 19, 2026); Case Western, Suffolk Law; AAMC; AICPA; Florida Atlantic University; CSAB (Jul 27, 2026); Indiana University; OpenAI, Anthropic, Google and Microsoft education announcements; edX (Nov 2025); Coursera Job Skills Report 2026; Oxford Internet Institute, arXiv 2601.13286 (Jan 2026); GovTech (May 19, 2026).</li>
      <li>Immigration: Presidential Proclamations on H-1B fees (Sep 19, 2025; Sep 18, 2026); USCIS H-1B registration data via Fragomen (2026) and USCIS FY2023 H-1B characteristics report; IEEE Spectrum (Sep 12, 2026); DHS proposed fee rule, Federal Register (Aug 25, 2026); Ogletree on litigation and the duration-of-status rule (2026); IIE Fall 2025 Snapshot via Inside Higher Ed (Nov 17, 2025); The PIE News (Aug 21, 2026); Census Vintage 2025 estimates (Jan 27, 2026); CBO Demographic Outlook (Jan 2026); Federal Reserve Board FEDS Note (Apr 2, 2026); Federal Reserve Bank of St. Louis (Mar 24 and Aug 4, 2026); Federal Reserve Bank of Dallas (Mar 31, 2026); BLS, January 2026 population control effects (Apr 10, 2026); Doran, Gelber and Isen (JPE 2022); Mayda and others (2018); Glennon (Management Science); Peri, Shih and Sparber (2015); Penn Wharton Budget Model (Aug 3, 2026).</li>
    <li>Use-case watch: BLS Current Employment Statistics via FRED (CES5051200001, CES6056140001, CES6054150001, CES6054110001, CES5552200001, CES6054120001); Variety (Mar 2026); The Decoder (Jul 2025); TheWrap (2024–2026); WGA (Apr 24, 2026); SAG-AFTRA (Jun 4, 2026); FilmLA via CBS News (Jan 16, 2026); Fortune (Feb 28, 2024); Entrepreneur (May 2025); The Register (Sep 2, 2025); TechCrunch (Apr 29, 2025); Semafor (Apr 24, 2026); METR (Jul 10, 2025); Stanford SIEPR (Aug 2025); Harvey (Sep 9, 2026); Stanford HAI (May 2024).</li>
      <li>Rewiring and capability: METR, time-horizon measurements (Jan 29 and May 8, 2026); OpenAI, GDPval (Sep 25, 2025) and model announcements (Dec 2025–Apr 2026); OSWorld (Xie and others, 2024) and vendor reports (2026); Jones and Bergen, arXiv 2503.23674 (2025); Census Business Trends and Outlook Survey (May 26, 2026) and CES-WP-26-25; Federal Reserve Bank of St. Louis, FRED Blog (Aug 27, 2026); Stanford Digital Economy Lab (Aug 12, 2026); Borovičková and Macaluso, Richmond Fed Economic Brief 26-27 (Aug 2026); David, AER (1990); Bresnahan, Brynjolfsson and Hitt, QJE (2002); Brynjolfsson, Rock and Syverson, AEJ: Macro (2021); Agrawal, Gans and Goldfarb, Power and Prediction (2022); Acemoglu, Autor and Johnson, NBER w34854 (Feb 2026); Acemoglu, Economic Policy (2025); Aghion and Bunel (2024); Gartner (Apr 28 and Aug 4, 2026); OpenAI and Klarna (Feb 2024); Fortune/Bloomberg (May 9, 2025); Klarna Form 6-K (Nov 18, 2025).</li>
    <li>Hiring: Xu, Li and Jiang, arXiv 2509.00462 (2025); Galdin and Silbert, "Making Talk Cheap" (2025); Jabarian and Henkel, "Voice AI in Firms" (SSRN, 2025); LinkedIn data via New York Times (Jun 21, 2025); Ashby (2024–2026).</li>
      <li>Exposure test: Eloundou, Manning, Mishkin and Rock, "GPTs are GPTs," Science 384 (2024), occupation-level data (github.com/openai/GPTs-are-GPTs); BLS Occupational Employment and Wage Statistics, May 2022; Jones and Bergen, "Large Language Models Pass the Turing Test," arXiv 2503.23674 (2025); BLS Employment Projections 2025–35 (Aug 27, 2026).</li>
      <li>Education and experience: Indeed Hiring Lab (Feb 27, 2024; May 23, 2024; Jul 30, 2025; Jan 28, 2026; Jul 23, 2026); Lightcast (Sep 9, 2026); ZipRecruiter AI Employer Report 2026 (Jul 29, 2026); Burning Glass Institute and Harvard Business School, Skills-Based Hiring (Feb 2024); BLS Employment Projections, education and training by occupation (Sep 8, 2026).</li>
      <li>Higher education and debt: College Board, Trends in College Pricing and Student Aid 2025 (Nov 6, 2025); AAMC (class of 2024); National Student Clearinghouse, Completing College (Dec 4, 2025) and Some College, No Credential (Jun 2025); Federal Reserve Bank of New York, Liberty Street Economics (Apr 16, 2025; May 12, 2026) and Household Debt and Credit Report Q2 2026 (Aug 11, 2026); FREOPP, Does College Pay Off? (May 2024); Third Way (Sep 28, 2023); NCES NPSAS 2019–20 via ACE; Federal Student Aid portfolio data (Sep 22, 2026); Federal Reserve, Economic Well-Being of U.S. Households in 2025 (May 13, 2026); Federal Reserve FEDS Note (Sep 5, 2025); U.S. Department of Education (Mar 27, 2026); One Big Beautiful Bill Act, Pub. L. 119-21 (Jul 4, 2025).</li>
      <li>Productivity: Federal Reserve Bank of San Francisco, "A Quarterly, Utilization-Adjusted Series on Total Factor Productivity" (Fernald, 2014; data updated Sep 3, 2026, through 2026 Q2); Basu, Fernald and Kimball, AER (2006); Torsten Slok, "No Signs of AI in the Productivity Data," Apollo Daily Spark (Oct 5, 2026; after the reference period).</li>
  </ol>
</section>

<section id="audit" class="appendix" aria-labelledby="h-aud">
  <div class="chapter-head"><div class="eyebrow">Appendix D</div><h2 id="h-aud">Revision audit, Version 1.72</h2></div>
  <p>This appendix records what changed in this revision, which claims were weakened or kept and why, and what remains to be done. Status labels: <strong>completed</strong>; <strong>partial</strong>; <strong>needs external validation</strong>; <strong>future research</strong>.</p>
  <div class="exhibit">
    <span class="ex-label">Audit table</span>
    <div class="tbl"><table class="txt">
      <thead><tr><th>Item</th><th class="l">What was done</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>1. Revised report</td><td class="l">Added the "does not establish" box, framing question, Q3 addendum, research chapter, two features and Future Research Agenda; corrected Chapter 03; renamed the index.</td><td>Completed</td></tr>
        <tr><td>2. Methodological changes</td><td class="l">Version 1.4: margins of error use the BLS generalized variance method; seasonal-adjustment robustness checks added; job-losers-only measure added. Earlier: SEC search now includes the abbreviation "AI" and codes each match by role; variance formula, small-cell rule, occupation-code breaks, evidence levels and source hierarchy documented. Replicate weights are not published for public-use monthly files, so the BLS method is the recommended public alternative.</td><td>Completed</td></tr>
        <tr><td>3. New datasets and sources</td><td class="l">Version 1.72: San Francisco Fed quarterly TFP series (Fernald); Apollo Daily Spark (Oct 5, 2026). Version 1.71: CPS education (PEEDUCA); Indeed Hiring Lab, Lightcast and ZipRecruiter posting-requirement data; BLS Employment Projections education categories; Eloundou and others (2024) occupation exposure data; BLS OEWS May 2022 national employment; CPS detailed occupation codes; Jones and Bergen (2025). Version 1.7: CPS work-status, multiple-jobholding, class-of-worker and hours variables; METR, GDPval and OSWorld benchmark reports; Census BTOS and St. Louis Fed Real-Time Population Survey AI-use and time-savings data; Gartner customer-service surveys; Klarna SEC filings; Richmond Fed Economic Brief 26-27; hiring research (Xu, Li and Jiang; Galdin and Silbert; Jabarian and Henkel). Version 1.6: CPS citizenship variable (PRCITSHP) and age-sex cells for standardization; USCIS H-1B registration data; IIE, Census and CBO migration estimates; Federal Reserve breakeven estimates; BLS industry employment series for the use-case watch. Version 1.5: BLS total factor productivity for major industries and service-industry productivity; DOL ETA WIOA performance data and allotments; Workday, Gusto, ADP, Revelio Labs and Burning Glass Institute career data; Training magazine, ATD and SHRM training surveys; CRA, National Student Clearinghouse, GMAC, AAMC and university program data. Earlier: 10-K headcount and XBRL revenue (27 companies); Census Quarterly Services Survey; BLS Displaced Worker Survey (Jan 2026); Atlanta Fed, CFO Survey, NFIB, NY Fed, Dallas Fed, Richmond Fed, Census BTOS and Conference Board business surveys; BLS telework data; company results for labor-market services firms; research from Stanford, Harvard, MIT, Oxford, Brookings, Yale Budget Lab and Opportunity@Work.</td><td>Completed</td></tr>
        <tr><td>4. Claims weakened</td><td class="l">Version 1.6: the 55+ participation decline removed from the summary after age and sex standardization showed it was compositional. Earlier: The AI attribution gap: "2 of 170 filings" corrected to 16 (9.4%), and the text now says filings are not required to state reasons and that the two sources use different units. Index renamed so it does not imply cause. Revenue per employee explicitly not attributed to AI.</td><td>Completed</td></tr>
        <tr><td>5. Claims that remain strong</td><td class="l">Long-term unemployment among white-collar workers rose from 2025 by more than the margin of error under both the BLS variance method and our earlier approximation (0.75% vs 0.56%; ±0.08 pts BLS method, ±0.11 earlier); long-term shares rose beyond the margin of error for computer and math workers and for white-collar workers 55–64; AI is cited more often in announcements than in formal filings; large white-collar employers grew revenue far faster than headcount. These rest on public data with stated margins and methods.</td><td>Completed</td></tr>
        <tr><td>6. Methodology appendix</td><td class="l">Appendix B documents the variance method, parameters, interpolation, seasonal-adjustment checks and replication materials.</td><td>Completed</td></tr>
        <tr><td>7. Replication package</td><td class="l">Planned structure: /cps (extraction, index, breakdowns, seasonal factors), /sec (EDGAR queries, coding sheet, revenue-per-employee sample), /figures, README with extraction dates and variable definitions, derived data files. Published with Version 1.4 via launchyournextchapter.com/reports/replication.</td><td>Completed</td></tr>
        <tr><td>8. Remaining weaknesses</td><td class="l">Variance factors for eight-month averages interpolated; generalized variance functions can understate variance for small groups; single-coder SEC coding; occupation-code break in 2020; CPS nonresponse not assessed; revenue-per-employee sample limited to companies disclosing headcount; several business-survey readings taken from secondary summaries.</td><td>Needs external validation</td></tr>
        <tr><td>9. Data points needing manual verification</td><td class="l">NFIB plans-versus-actual series (read from PDF); ECI figure for management, professional and related occupations; labor share record (BLS release text); Census BTOS readings after May 2026; Fortune's forward-deployed-engineer posting growth; Thrive Holdings acquisition counts (press reports); Dallas Fed shares summed from published categories. Version 1.5: executive-education prices from press reports (Bloomberg); 5W business-school index (methodology unverified); Workforce Pell approval counts from a third-party tracker.</td><td>Partial</td></tr>
        <tr><td>10. Recurring dashboard</td><td class="l">Proposed dimensions, each kept separate: business outlook, AI adoption, AI investment, productivity, revenue per employee, hiring, AI-attributed restructuring, white-collar long-term unemployment, career ladder, job quality and reemployment. Monthly items are in Chapter 15; quarterly items in the Q3 addendum.</td><td>Partial</td></tr>
      </tbody>
    </table></div>
  </div>
</section>


<section id="subscribe" aria-labelledby="h-sub">
  <div class="newsbox">
    <div class="eyebrow">Get the next edition</div>
    <h2 id="h-sub" style="font-size:1.4rem">The Displacement Report, in your inbox every month</h2>
    <p>New data on white-collar job loss, the White-Collar Long-Term Unemployment Index and what it means for experienced professionals, the week the jobs report comes out. Free; unsubscribe any time.</p>
    <div id="newsletter-slot"><a class="btn" href="https://launchyournextchapter.com/reports#subscribe">Subscribe at launchyournextchapter.com</a></div>
  </div>
</section>

<section id="about" aria-labelledby="h-about">
  <div class="about">
    <div class="eyebrow">About NextChapter</div>
    <h2 id="h-about" style="font-size:1.4rem">About the publisher</h2>
    <p>NextChapter is a career-transition platform for senior professionals and executives, and offers programs for employers, universities and public workforce agencies. This section is the only part of the report that describes NextChapter's services. Learn more at <a href="https://launchyournextchapter.com">launchyournextchapter.com</a>.</p>
    <p class="note">Contact: Justin Kulla, Founder and CEO · jkulla@launchyournextchapter.com</p>
  </div>
</section>

</main>
</div>
<footer>
  <span>© 2026 NextChapter. The NextChapter Displacement Report is published monthly. Data and charts: CC BY 4.0.</span>
  <span>This report summarizes public data for general information. It is not legal, financial or career advice.</span>
</footer>
</div>`
