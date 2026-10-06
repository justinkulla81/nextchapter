// AUTO-EXTRACTED verbatim from the authored report HTML (incoming-report/
// displacement-report-september-2026.html), body only. Links already point at
// /reports/*. Charts render into the empty .plot divs via public/reports/
// report-charts.js; every word, table and note here is in the server HTML.
// To revise next month, copy this folder and edit the numbers in place.
export const REPORT_BODY_HTML = `<header class="cover">
  <div class="cover-in">
    <div class="cover-top">
      <div class="brand" style="font-family:var(--body);text-transform:none;letter-spacing:0;font-size:1.05rem;font-weight:600;color:var(--navy)">Next<b>Chapter</b> <span style="font-weight:400;color:var(--muted)">Research</span></div>
      <div class="eyebrow">Monthly labor market report · Vol. 1, No. 1</div>
    </div>
    <div class="eyebrow">The NextChapter Displacement Report · September 2026</div>
    <h1>Fewer layoffs, longer searches</h1>
    <p class="dek">The white-collar labor market in September 2026: hiring stalled, announced layoffs fell, and long-term unemployment among managers and professionals rose by about a third from a year earlier.</p>
    <div class="cover-stats">
      <div><span class="v">0.75%</span><span class="l">White-collar labor force unemployed 27+ weeks, Jan–Aug 2026 (0.56% in 2025)</span></div>
      <div><span class="v">162</span><span class="l">White-Collar Displacement Index, Aug 2026 (2019 = 100, seasonally adjusted)</span></div>
      <div><span class="v">27.1%</span><span class="l">Share of all unemployed out 27+ weeks, Sep 2026 (23.6% a year ago)</span></div>
      <div><span class="v">+29K</span><span class="l">Jobs added in September; unemployment rate 4.2%</span></div>
    </div>
    <div class="cover-meta"><span>Published October 5, 2026</span><span>Data through October 2, 2026</span><span>Version 1.0</span><span>Author: Justin Kulla</span></div>
    <div class="actions">
      <a class="btn" id="pdf-btn" href="/reports/displacement-report-2026-09.pdf" download="NextChapter-Displacement-Report-September-2026.pdf"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10"/></svg>Download PDF</a>
      <a class="btn ghost" href="#method">Methodology</a>
      <a class="btn ghost" href="/reports/displacement-report-2026-09-data.csv" id="csv-btn" download>Data (CSV)</a>
    </div>
    <div class="status" id="dl-status" role="status"></div>
  </div>
</header>

<div class="wrap">
<div class="grid">
<nav class="toc" aria-label="Contents">
  <div class="eyebrow">Contents</div>
  <ol>
    <li><a href="#disclosure"><span class="n">—</span>About this report</a></li>
    <li><a href="#summary"><span class="n">—</span>Executive summary</a></li>
    <li><a href="#index"><span class="n">01</span>White-Collar Index</a></li>
    <li><a href="#jobs"><span class="n">02</span>Jobs and hiring</a></li>
    <li><a href="#layoffs"><span class="n">03</span>Layoffs and AI attribution</a></li>
    <li><a href="#concentrated"><span class="n">04</span>Long searches by group</a></li>
    <li><a href="#longterm"><span class="n">05</span>Long-term and age</a></li>
    <li><a href="#applying"><span class="n">06</span>Applying in 2026</a></li>
    <li><a href="#skills"><span class="n">07</span>Skills and retraining</a></li>
    <li><a href="#geography"><span class="n">08</span>States</a></li>
    <li><a href="#safetynet"><span class="n">09</span>Safety net and policy</a></li>
    <li><a href="#context"><span class="n">10</span>New grads and blue-collar</a></li>
    <li><a href="#outlook"><span class="n">11</span>What to watch</a></li>
    <li><a href="#faq"><span class="n">—</span>FAQ</a></li>
    <li><a href="#pilot"><span class="n">A</span>Experimental measures</a></li>
    <li><a href="#method"><span class="n">B</span>Methodology</a></li>
    <li><a href="#sources"><span class="n">C</span>Sources</a></li>
    <li><a href="#about"><span class="n">—</span>About NextChapter</a></li>
  </ol>
</nav>

<main>

<section id="disclosure" class="no-break-before" aria-label="About this report">
  <div class="box disclose">
    <div class="eyebrow">About this report and its independence</div>
    <p>The NextChapter Displacement Report is published monthly by NextChapter, a company that sells career-transition software and services to professionals, employers and workforce programs. NextChapter therefore has a commercial interest in this subject. To keep the analysis separate from that interest:</p>
    <ul>
      <li>All figures come from public sources or from NextChapter calculations on public data, with methods and data files published. No NextChapter customer data is used in any statistic.</li>
      <li>The measures reported each month are fixed in advance (see Appendix B), whether they move up or down.</li>
      <li>Survey-based estimates carry 90% margins of error, and changes are marked as statistically significant only when they clear that bar.</li>
      <li>Information about NextChapter's services appears only in the final "About NextChapter" section.</li>
    </ul>
    <p class="note">Author: Justin Kulla, founder of NextChapter; former CTO of Edgenuity and private-equity investor. No outside funding. This edition was not externally peer reviewed; we welcome corrections at the address in Appendix B.</p>
  </div>
</section>

<section id="summary" class="no-break-before" aria-labelledby="h-sum">
  <div class="chapter-head"><div class="eyebrow">Executive summary</div><h2 id="h-sum">A low-hire, low-fire market that is hardest on people already out of work</h2></div>
  <p class="lead">Most managers and professionals who have jobs are keeping them: announced layoffs are down from 2025 and white-collar unemployment is little changed at under 3%. But hiring nearly stalled in September, and people who do lose white-collar jobs are staying out much longer. Long-term unemployment among managers and professionals averaged 0.75% of the white-collar labor force in January–August 2026, up from 0.56% a year earlier and 0.47% in 2019. That one-year increase is statistically significant.</p>
  <div class="findings">
    <div class="up">
      <h3>What's better</h3>
      <ul>
        <li>Announced layoffs are down 15% from 2025 excluding government (down 39% including the 2025 federal cuts).</li>
        <li>Unemployment for college graduates 25 and older is 2.5%, down from 2.8%.</li>
        <li>There is about one job opening per unemployed person (1.01), up from 0.94 a year ago.</li>
        <li>New jobless claims are low: 197,000 a week, versus 225,000 a year ago.</li>
        <li>Job growth this year (+612,000 through September) is ahead of 2025's pace.</li>
        <li>People who change jobs are getting 5.0% raises, versus 3.6% for those who stay.</li>
      </ul>
    </div>
    <div class="down">
      <h3>What's worse</h3>
      <ul>
        <li>Long-term unemployment among white-collar workers is up about a third from a year ago (significant).</li>
        <li>27.1% of all unemployed people have been looking 27 weeks or more, up from 23.6%.</li>
        <li>Hiring nearly stalled: +29,000 jobs in September, and July was revised to a loss.</li>
        <li>Information (−120,000) and financial activities (−107,000) lost jobs over the year.</li>
        <li>Among unemployed white-collar workers aged 55–64, 39% have been out 27+ weeks, up from 27% (significant).</li>
        <li>About 39% of people on unemployment insurance exhaust their benefits.</li>
      </ul>
    </div>
  </div>
  <p class="note">"Significant" means the change is larger than its 90% margin of error. Unmarked changes from survey microdata may reflect sampling noise. See Appendix B.</p>
</section>

<section id="index" aria-labelledby="h-idx">
  <div class="chapter-head"><div class="eyebrow">Chapter 01</div><h2 id="h-idx">The NextChapter White-Collar Displacement Index</h2></div>
  <p class="lead">The index tracks long-term unemployment among managers and professionals: people whose last job was in management, business, financial or professional occupations and who have been unemployed 27 weeks or more, as a share of that labor force. It stood at <strong>162 in August 2026</strong> (2019 = 100), close to its June reading of 170, the highest since 2021.</p>
  <figure class="exhibit chart" id="fig-wci" style="margin:0">
    <span class="ex-label">Exhibit 1</span>
    <span class="ex-title">White-Collar Displacement Index, January 2015 – August 2026 (2019 average = 100)</span>
    <div class="plot"></div>
    <span class="ex-note">Seasonally adjusted, 3-month moving average. Shaded band: approximate 90% margin of error (about ±16% of the index level). Gap: October 2025, not collected during the federal shutdown. Source: NextChapter calculation from U.S. Census Bureau Current Population Survey microdata.</span>
  </figure>
  <p>Two cautions shape how to read the index. First, single months are noisy: the margin of error on a monthly reading is roughly ±26 points, so August 2026 (162) is not statistically different from August 2025 (128) on its own. The eight-month comparison below is. Second, the 2019 base was the strongest labor market of the past decade. The index ran between 131 and 201 in 2015–2016, so today's level is high relative to the late 2010s, not unprecedented.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit 2</span>
    <span class="ex-title">White-collar measures, January–August average</span>
    <div class="tbl"><table>
      <thead><tr><th>Measure</th><th>2026</th><th>2025</th><th>2019</th><th>Change vs 2025</th></tr></thead>
      <tbody>
        <tr><td>Long-term unemployed, % of white-collar labor force</td><td>0.75%</td><td>0.56%</td><td>0.47%</td><td>+0.18 pts ±0.11 <span class="sig">significant</span></td></tr>
        <tr><td>White-collar unemployment rate</td><td>2.7%</td><td>2.5%</td><td>2.1%</td><td>+0.18 pts ±0.21 <span class="ns">not significant</span></td></tr>
        <tr><td>Unemployed white-collar workers out 27+ weeks</td><td>28.1%</td><td>22.8%</td><td>22.8%</td><td>+5.3 pts ±3.6 <span class="sig">significant</span></td></tr>
        <tr><td>All unemployed workers out 27+ weeks</td><td>25.6%</td><td>22.4%</td><td>20.8%</td><td>+3.2 pts ±1.8 <span class="sig">significant</span></td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Not seasonally adjusted; January–August averages compare the same months each year. ± = approximate 90% margin of error on the change. White-collar = current or most recent job in management, business and financial, or professional and related occupations (about 73 million people in the labor force). These microdata shares differ from BLS's seasonally adjusted September figure (27.1%) because they cover different months and are not adjusted. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
</section>

<section id="jobs" aria-labelledby="h-jobs">
  <div class="chapter-head"><div class="eyebrow">Chapter 02</div><h2 id="h-jobs">Jobs and hiring</h2></div>
  <p class="lead">Employers added 29,000 jobs in September, below the 84,000 economists expected (per Axios). July was revised to a loss of 10,000 and August to +133,000, a combined downward revision of 60,000. Unemployment ticked up to 4.2% as more people joined the labor force. Over the first nine months of 2026 the economy added 612,000 jobs, versus 232,000 in the same months of 2025 on current data.</p>
  <figure class="exhibit chart" id="fig-payrolls" style="margin:0">
    <span class="ex-label">Exhibit 3</span>
    <span class="ex-title">Monthly change in nonfarm payrolls, 2026 (thousands)</span>
    <div class="plot"></div>
    <span class="ex-note">Seasonally adjusted. Source: BLS Current Employment Statistics via FRED (PAYEMS), as of October 2, 2026; NextChapter calculation of monthly changes.</span>
  </figure>
  <div class="exhibit">
    <span class="ex-label">Exhibit 4</span>
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
    <span class="ex-note">Seasonally adjusted unless marked NSA. Openings per unemployed person is a NextChapter calculation from BLS levels. Sources: BLS Employment Situation (Oct 2, 2026); BLS JOLTS (Sep 29, 2026); DOL weekly claims (Oct 1, 2026); Federal Reserve Bank of Atlanta Wage Growth Tracker (Sep 10, 2026).</span>
  </div>
  <p>The problem for job seekers is not a wave of firings. Layoffs and discharges are near 1% of jobs. It is a slow market: few people quit, few seats open up, and employed people who switch jobs still win 1.4 points more in raises than those who stay, so displaced candidates compete with employed ones for a thin flow of openings.</p>
  <figure class="exhibit chart" id="fig-industry" style="margin:0">
    <span class="ex-label">Exhibit 5</span>
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
      <span class="ex-label">Exhibit 6</span>
      <span class="ex-title">Top stated reasons for announced job cuts, 2026 to date</span>
      <div class="plot"></div>
      <span class="ex-note">Reasons are as stated by employers in announcements. Source: Challenger, Gray &amp; Christmas (Oct 1, 2026).</span>
    </figure>
    <figure class="exhibit chart" id="fig-cutstates" style="margin:0">
      <span class="ex-label">Exhibit 7</span>
      <span class="ex-title">States with the most announced cuts, 2026 to date</span>
      <div class="plot"></div>
      <span class="ex-note">Source: Challenger, Gray &amp; Christmas (Oct 1, 2026).</span>
    </figure>
  </div>
  <p>Technology accounts for 165,925 announced cuts this year, 29% of the total and up 54% from 2025. TrueUp counts 190,933 people affected by tech layoffs in 2026 so far, against 245,953 in all of 2025. Notable September announcements include Uber (about 3,300, citing fewer management layers), Workday (about 500, restructuring) and Microsoft (about 500, Xbox).</p>
  <h3>What companies say about AI versus what they file</h3>
  <p>Employers cited AI as the reason for 120,136 announced cuts this year, about 21% of the total and the most-cited reason, per Challenger. Formal filings rarely say the same. We searched every 2026 SEC Form 8-K that references Item 2.05, the item public companies use to report material restructuring costs, and read the AI passages in each match.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit 8</span>
    <span class="ex-title">How often AI is cited: announcements versus legal filings, 2026 to date</span>
    <div class="tbl"><table>
      <thead><tr><th>Source</th><th>Cites AI</th><th>Out of</th><th>Share</th></tr></thead>
      <tbody>
        <tr><td>Challenger: announced job cuts attributed to AI (workers)</td><td>120,136</td><td>573,195</td><td>21%</td></tr>
        <tr><td>SEC 8-K filings referencing Item 2.05 that mention "artificial intelligence" anywhere (filings)</td><td>8</td><td>170</td><td>4.7%</td></tr>
        <tr><td>&nbsp;&nbsp;…that mention AI, automation or machine learning anywhere</td><td>14</td><td>170</td><td>8.2%</td></tr>
        <tr><td>&nbsp;&nbsp;…whose restructuring disclosure itself references AI</td><td>2</td><td>170</td><td>1.2%</td></tr>
        <tr><td>New York WARN notices with the AI box checked, first year (Mar 2025–Mar 2026)</td><td>0</td><td>160+</td><td>0%</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">SEC counts are distinct filings (accession numbers) returned by EDGAR full-text search for form 8-K, January 1–September 30, 2026, query "Item 2.05" with and without "artificial intelligence", "automation" and "machine learning" (run October 5, 2026). The 8 "artificial intelligence" matches come from 7 companies (Cloudflare filed an amendment); 6 mention AI only in risk-factor or forward-looking language. The two restructuring disclosures that reference AI are Cloudflare ("an agentic AI-first operating model") and Cisco (reinvesting in growth areas including AI). The 6 additional "automation"/"machine learning" matches were not hand-reviewed. Item 2.05 covers only material exit costs at public companies, while Challenger counts all announced cuts, so the populations differ. New York figure: Hunton Andrews Kurth (May 18, 2026).</span>
  </div>
  <p>The gap shows that AI is far more prominent in how layoffs are announced than in how they are formally disclosed. It does not show why. Possible explanations include companies describing cuts differently for different audiences, AI being one factor among several, and legal caution about attributing job losses to a cause. California's SB 951, effective January 1, 2027, will require layoff notices to say when cuts are caused "in substantial part" by AI or automation, which should make this comparison sharper.</p>
</section>

<section id="concentrated" aria-labelledby="h-conc">
  <div class="chapter-head"><div class="eyebrow">Chapter 04</div><h2 id="h-conc">Where long searches are concentrated</h2></div>
  <p class="lead">Long searches rose across most occupations, which points to a broad slowdown rather than one sector. Against that backdrop, computer and mathematical occupations stand out: 41% of their unemployed have been out 27 weeks or more, up from 28%, the only occupation where the rise is statistically significant.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit 9</span>
    <span class="ex-title">Unemployed out 27+ weeks, by occupation of last job, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Occupation</th><th>2026</th><th>2025</th><th>Change (±90% MOE)</th><th>Change minus all-occupation change</th><th>Unemployment rate 2026 / 2025</th><th>Survey respondents 2026</th></tr></thead>
      <tbody>
        <tr><td>Computer &amp; mathematical</td><td>41.0%</td><td>27.5%</td><td>+13.5 ±11.6 <span class="sig">significant</span></td><td>+10.3</td><td>3.3% / 3.1%</td><td>462</td></tr>
        <tr><td>Business &amp; financial operations</td><td>30.5%</td><td>23.1%</td><td>+7.4 ±9.7</td><td>+4.2</td><td>2.8% / 2.6%</td><td>530</td></tr>
        <tr><td>Management</td><td>30.3%</td><td>26.4%</td><td>+3.9 ±7.3</td><td>+0.7</td><td>2.4% / 2.1%</td><td>1,029</td></tr>
        <tr><td>Architecture &amp; engineering</td><td>28.2%</td><td>28.1%</td><td>+0.1 ±20.5</td><td>−3.1</td><td>1.9% / 1.6%</td><td>136</td></tr>
        <tr><td>Office &amp; administrative support</td><td>26.4%</td><td>23.7%</td><td>+2.7 ±6.3</td><td>−0.5</td><td>3.9% / 3.8%</td><td>1,277</td></tr>
        <tr><td>Arts, design, entertainment &amp; media</td><td>23.2%</td><td>24.3%</td><td>−1.1 ±11.2</td><td>−4.3</td><td>5.5% / 5.3%</td><td>394</td></tr>
        <tr><td>Healthcare practitioners</td><td>22.6%</td><td>19.4%</td><td>+3.2 ±11.5</td><td>0.0</td><td>1.6% / 1.6%</td><td>335</td></tr>
        <tr><td>Education, training &amp; library</td><td>18.9%</td><td>13.4%</td><td>+5.5 ±7.2</td><td>+2.3</td><td>3.5% / 3.1%</td><td>695</td></tr>
        <tr><td><strong>All occupations</strong></td><td>25.6%</td><td>22.4%</td><td>+3.2 ±1.8 <span class="sig">significant</span></td><td>—</td><td>4.4% / 4.3%</td><td>14,192</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Share of unemployed people whose last job was in each occupation who have been unemployed 27 weeks or more. Not seasonally adjusted; January–August of each year pooled. Respondents = unweighted count of unemployed survey respondents across the 8 months (the same people can appear in several months). None of the unemployment-rate changes shown is statistically significant. Occupations with fewer than about 100 unemployed respondents (such as legal) are not reported. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <div class="exhibit">
    <span class="ex-label">Exhibit 10</span>
    <span class="ex-title">White-collar workers out 27+ weeks, by industry of last job, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Industry</th><th>2026</th><th>2025</th><th>Change (±90% MOE)</th><th>Unemployment rate 2026 / 2025</th><th>Respondents 2026</th></tr></thead>
      <tbody>
        <tr><td>Information (tech, media, telecom)</td><td>35.4%</td><td>26.3%</td><td>+9.1 ±17.2</td><td>4.9% / 4.6%</td><td>201</td></tr>
        <tr><td>Professional &amp; business services</td><td>31.7%</td><td>24.9%</td><td>+6.8 ±8.1</td><td>3.2% / 2.9%</td><td>831</td></tr>
        <tr><td>Financial activities</td><td>31.1%</td><td>33.2%</td><td>−2.1 ±14.4</td><td>2.3% / 2.1%</td><td>286</td></tr>
        <tr><td>Manufacturing</td><td>35.5%</td><td>32.1%</td><td>+3.4 ±14.5</td><td>2.7% / 2.5%</td><td>288</td></tr>
        <tr><td>Public administration</td><td>27.7%</td><td>20.1%</td><td>+7.6 ±17.1</td><td>1.8% / 1.6%</td><td>164</td></tr>
        <tr><td>Education &amp; health services</td><td>22.5%</td><td>18.3%</td><td>+4.2 ±5.7</td><td>2.6% / 2.3%</td><td>1,366</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">White-collar = management, business, financial and professional occupations. No industry change is statistically significant at this sample size; the direction is consistent with BLS payroll losses in information. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <h3>What independent research says about AI, functions and seniority</h3>
  <p>Our tables show where long searches are concentrated; they do not show what caused them. Research that tracks AI exposure directly points the same way on two points: early-career workers and some tech occupations are most affected, and most of the effect is on hiring rather than firing.</p>
  <ul class="items">
    <li><span class="who">Seniority · Stanford Digital Economy Lab (Aug 2026)</span><p>Employment of 22–25-year-olds in the most AI-exposed jobs is 19% below comparable peers, up from 15% a year earlier. Older workers show no comparable gap; declines are concentrated where AI automates tasks rather than assists.</p></li>
    <li><span class="who">Seniority · Revelio Labs (Aug 2026)</span><p>Compared with non-adopters, firms using AI grew senior roles by 32% but junior roles by only 6%.</p></li>
    <li><span class="who">Job postings · Indeed Hiring Lab (Jul 2026)</span><p>Senior postings rose 14.7% over the year to May 2026 while entry-level postings fell 7.5%.</p></li>
    <li><span class="who">Job titles · Stanford; Anthropic</span><p>Software developers and customer service representatives show the clearest early-career employment declines. AI usage data show the heaviest task coverage in data entry, software development, medical transcription and database architecture.</p></li>
    <li><span class="who">Broad effect · Yale Budget Lab; Federal Reserve (Sep 2026)</span><p>The occupational mix is not yet shifting in ways tied to AI. Fed Governor Barr saw "little evidence of significant displacement so far" but "some indications" of fewer entry-level jobs.</p></li>
    <li><span class="who">Middle management · surveys</span><p>41% of employees say their organization cut management layers (Korn Ferry survey, cited by Forbes, May 2026). There are no hard counts yet of manager headcount, so "flattening" remains a trend to watch.</p></li>
  </ul>
</section>

<section id="longterm" aria-labelledby="h-lt">
  <div class="chapter-head"><div class="eyebrow">Chapter 05</div><h2 id="h-lt">Long-term unemployment and age</h2></div>
  <p class="lead">According to BLS, 1.94 million people had been unemployed 27 weeks or more in September, 27.1% of all unemployed, up from 23.6% a year earlier. Most of them have been out far longer than six months: about two in three have been looking for a year or more.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit 11</span>
    <span class="ex-title">How long the long-term unemployed have been looking, January–August average</span>
    <div class="tbl"><table>
      <thead><tr><th>Among people unemployed 27+ weeks</th><th>All 2026</th><th>All 2025</th><th>White-collar 2026</th><th>White-collar 2025</th></tr></thead>
      <tbody>
        <tr><td>Long-term unemployed (thousands, monthly average)</td><td>1,895</td><td>1,644</td><td>546</td><td>412</td></tr>
        <tr><td>Looking 27–51 weeks</td><td>34.6%</td><td>41.4%</td><td>39.4%</td><td>45.9%</td></tr>
        <tr><td>Looking 1–2 years</td><td>40.9%</td><td>33.0%</td><td>35.6%</td><td>33.6%</td></tr>
        <tr><td>Looking 2 years or more</td><td>24.5%</td><td>25.6%</td><td>25.0%</td><td>20.5%</td></tr>
        <tr><td>Looking 1 year or more (total)</td><td>65.4% <span class="sig">significant rise</span></td><td>58.6%</td><td>60.6% <span class="ns">not significant</span></td><td>54.1%</td></tr>
        <tr><td>Average weeks looking so far</td><td>64</td><td>63</td><td>64</td><td>59</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Durations are spells in progress: how long people who are still unemployed have been looking so far, not how long it takes to find work. The survey caps reported durations at 119 weeks, so averages understate the longest spells. Not seasonally adjusted. Source: NextChapter calculation from Census CPS microdata.</span>
  </div>
  <h3>Age</h3>
  <p>Age shapes how long searches last more than whether people lose jobs. Among unemployed white-collar workers aged 55–64, 39% have been looking 27 weeks or more, up from 27% a year earlier, a statistically significant rise. Younger professionals lose jobs somewhat more often but find work faster. Across all workers, unemployment for ages 25–34 rose to 4.8% from 4.3% (significant), consistent with research showing fewer entry-level openings.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit 12</span>
    <span class="ex-title">White-collar workers by age, January–August</span>
    <div class="tbl"><table>
      <thead><tr><th>Age</th><th>Unemployment rate 2026 / 2025</th><th>Out 27+ weeks 2026</th><th>2025</th><th>Change (±90% MOE)</th><th>Median weeks so far 2026 / 2025</th></tr></thead>
      <tbody>
        <tr><td>Under 35</td><td>3.3% / 3.0%</td><td>20.5%</td><td>16.6%</td><td>+3.9 ±5.7</td><td>9 / 8</td></tr>
        <tr><td>35–44</td><td>2.1% / 2.1%</td><td>27.1%</td><td>23.5%</td><td>+3.6 ±7.9</td><td>12 / 9</td></tr>
        <tr><td>45–54</td><td>2.3% / 2.1%</td><td>32.0%</td><td>25.6%</td><td>+6.4 ±8.6</td><td>13 / 12</td></tr>
        <tr><td>55–64</td><td>2.7% / 2.5%</td><td>39.4%</td><td>26.5%</td><td>+12.9 ±9.2 <span class="sig">significant</span></td><td>20 / 12</td></tr>
        <tr><td>65+</td><td>3.0% / 2.9%</td><td>32.2%</td><td>33.1%</td><td>−0.9 ±12.5</td><td>10 / 12</td></tr>
      </tbody>
    </table></div>
    <span class="ex-note">Median weeks are for people still unemployed and cluster at round numbers people report (such as 12 or 26 weeks), so treat medians as indicative. No unemployment-rate change by age is significant. Not seasonally adjusted. For comparison, BLS's September figures for all occupations, ages 55–64, show an average of 34.9 weeks unemployed and about 31% out 27+ weeks (NSA). Source: NextChapter calculation from Census CPS microdata; BLS.</span>
  </div>
  <ul class="items">
    <li><span class="who">Bias · AARP (Mar 2026)</span><p>64% of workers 50+ have seen or experienced age discrimination at work; 22% felt pushed out. The most common bias is the assumption that older workers lack tech skills (33%).</p></li>
    <li><span class="who">AI and older workers · Boston College CRR (Jun 2026)</span><p>Workers 55+ in AI-exposed occupations have seen relatively large increases in exits into unemployment since ChatGPT launched.</p></li>
    <li><span class="who">Résumé gaps · Socio-Economic Review (2026)</span><p>A meta-analysis of 28 résumé experiments finds gaps under six months do not hurt callbacks; penalties begin around 12 months and are larger for people who appear to have stopped looking.</p></li>
    <li><span class="who">Scarring · Goldman Sachs (Apr 2026)</span><p>Workers displaced by technology search about a month longer and see roughly 10 points less earnings growth over a decade; vocational training within three years of job loss is linked to better outcomes.</p></li>
  </ul>
</section>

<section id="applying" aria-labelledby="h-app">
  <div class="chapter-head"><div class="eyebrow">Chapter 06</div><h2 id="h-app">Applying in 2026: volume, screening software and AI on both sides</h2></div>
  <p class="lead">Applications per job have roughly doubled since 2022, so each application is far less likely to get a response. Candidates use AI to apply faster, employers use AI to screen faster, and trust on both sides has fallen.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit 13</span>
    <span class="ex-title">The application funnel, by source</span>
    <div class="cells">
      <div class="cell"><span class="lbl">Applications per job, 2025 (Greenhouse, North America)</span><span class="val">244</span><span class="chg">about 115 in 2022</span></div>
      <div class="cell"><span class="lbl">Applications per hire, 2026 (Ashby)</span><span class="val">300+</span><span class="chg">about 3x the 2021 level</span></div>
      <div class="cell"><span class="lbl">Applications per interview, job-tracker users (Huntr, Q1 2026)</span><span class="val">24–48</span><span class="chg">tailored vs. generic résumé</span></div>
      <div class="cell"><span class="lbl">Median time from search start to offer, job-tracker users (Huntr, Q1 2026)</span><span class="val">108 days</span><span class="chg">Huntr Q1 2026 report</span></div>
    </div>
    <span class="ex-note">Greenhouse and Ashby figures come from their customers' hiring systems; Huntr figures come from people who use its job-tracking tool, who skew toward heavy appliers. All three companies sell hiring or job-search software. Applications per interview is a NextChapter calculation from Huntr's interview rates (4.2% tailored, 2.1% generic).</span>
  </div>
  <ul class="items">
    <li><span class="who">How many applications it takes</span><p>Among Huntr users, two-thirds of offers came within 50 applications. Interview rates fall as volume rises: 9.3% per application for people sending 11–20, 2.6% for people sending 100 or more. In that sample, seekers with 20+ years of experience had the highest interview rate (9.2%).</p></li>
    <li><span class="who">Recruiters are overloaded</span><p>Greenhouse counts 746 applications per recruiter per year in 2025, up from 146 in 2022, while recruiters per organization fell to 5 and time to fill rose to 57 days.</p></li>
    <li><span class="who">AI on both sides</span><p>In Greenhouse's November 2025 survey (U.S. subset: 1,200 job seekers, 665 hiring professionals), 70% of hiring managers said AI leads to faster, better decisions, but only 8% of job seekers called it fair. 41% of U.S. job seekers said they had put hidden instructions in résumés to get past AI filters. Only 21% of recruiters were very confident their AI does not reject qualified candidates.</p></li>
    <li><span class="who">Fake jobs, fake candidates</span><p>69% of job seekers said they had seen fake job postings (Greenhouse). Gartner forecasts that one in four candidate profiles worldwide will be fake by 2028; that is a prediction, not a measurement.</p></li>
    <li><span class="who">Employer adoption · SHRM (Apr 2026)</span><p>39% of organizations use AI in HR, rising to 60% of those with 5,000+ employees; recruiting is the most common use.</p></li>
    <li><span class="who">Law and litigation</span><p>Illinois began regulating AI in hiring decisions on January 1, 2026. California's rules on automated decision systems (October 2025) hold employers responsible for their vendors' tools. Colorado replaced its AI Act with a narrower law effective January 2027. In <i>Mobley v. Workday</i>, a nationwide age-discrimination case over AI screening of applicants 40 and older, about 14,000 people reportedly opted in; the case is in discovery. The EEOC withdrew its AI hiring guidance in January 2025.</p></li>
  </ul>
</section>

<section id="skills" aria-labelledby="h-skl">
  <div class="chapter-head"><div class="eyebrow">Chapter 07</div><h2 id="h-skl">Skills, retraining and universities</h2></div>
  <p class="lead">AI skills now carry a measurable pay premium, and demand for them has spread well beyond tech. Universities are responding mainly with free certificates for alumni, while public retraining money is not yet reaching professionals.</p>
  <ul class="items">
    <li><span class="who">Pay premium · Lightcast (Jul 2025)</span><p>U.S. postings that list AI skills offer 28% higher pay, about $18,000 a year; 51% are outside IT and computer science. Demand for AI skills grew 66% a year in HR, 50% in marketing and 40% in finance.</p></li>
    <li><span class="who">Pay premium · PwC (Jun 2026, global)</span><p>Workers with AI skills earn a 62% wage premium on average, up from 57%. PwC measures worker wages and Lightcast posted salaries, so the two are not directly comparable.</p></li>
    <li><span class="who">Fastest-growing skill · McKinsey (Nov 2025)</span><p>Demand for "AI fluency" in postings grew almost sevenfold in two years.</p></li>
    <li><span class="who">Rising skills · LinkedIn; WEF</span><p>LinkedIn's 2026 U.S. list of fastest-growing skills (as reported by EdTech Innovation Hub) is led by AI implementation, workflow automation and AI business strategy. The World Economic Forum expects about 39% of core skills to change by 2030.</p></li>
  </ul>
  <div class="exhibit">
    <span class="ex-label">Exhibit 14</span>
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
  <ul class="items">
    <li><span class="who">Alumni view · NACM (2024)</span><p>In a survey of 9,000+ alumni at 34 institutions, 49% rated their school highly on career preparation and 23% on its ongoing investment in their careers.</p></li>
    <li><span class="who">Adult learners</span><p>First-time college students aged 25+ fell 15.5% from fall 2024 to fall 2025, as reported by Inside Higher Ed.</p></li>
    <li><span class="who">Workforce Pell</span><p>Short-term Pell grants for 8–15-week programs began July 1, 2026, and bachelor's degree holders can qualify. Programs approved so far are in trades and health care, not white-collar retraining.</p></li>
    <li><span class="who">WIOA and funding</span><p>H.R. 8210 (A Stronger Workforce for America Act) passed committee on a party-line vote; the House FY2027 Labor-HHS bill would cut Labor Department training by about $3.3–3.7 billion while raising the Dislocated Worker National Reserve to $326 million. Labor Department guidance (TEGL 15-25) made about $50 million in "Rapid Reskill" grants available for workers affected by AI.</p></li>
    <li><span class="who">Does retraining work? · Anthropic (Aug 2026)</span><p>A review of 56 U.S. randomized trials finds training raises employment 2–3 points and earnings about $1,000 a year, at roughly $13,000 per participant; sector programs built with employers do several times better.</p></li>
    <li><span class="who">State partnerships · California (Jul 2026)</span><p>"AI-Ready California" offers free AI-literacy micro-credentials through San Diego State, including to unemployment-insurance claimants, and the state now tracks jobless claims in AI-exposed occupations monthly.</p></li>
  </ul>
</section>

<section id="geography" aria-labelledby="h-geo">
  <div class="chapter-head"><div class="eyebrow">Chapter 08</div><h2 id="h-geo">States: where jobs grew most and least</h2></div>
  <p class="lead">Over the year to August 2026, job growth was fastest in South Carolina, New Mexico and Louisiana (+1.6% each), and Texas added the most jobs (+159,400). The District of Columbia was the only place with a statistically significant decline (−27,000, −3.6%), driven by government job losses.</p>
  <div class="exhibit">
    <span class="ex-label">Exhibit 15</span>
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
  <div class="chapter-head"><div class="eyebrow">Chapter 09</div><h2 id="h-sn">The safety net and policy</h2></div>
  <p class="lead">In the 12 months to August 2026, 39.3% of unemployment insurance claimants exhausted their benefits. Claimants drew benefits for 15.8 weeks on average, at $493 a week. These are completed benefit spells; the 24.8-week average in Exhibit 4 is for searches still in progress, so the two measure different things. Together they suggest many long-term job seekers are past the end of their benefits.</p>
  <ul class="items">
    <li><span class="who">Uneven access</span><p>State recipiency rates ranged from 8% to 55% of the unemployed in 2025 (Minneapolis Fed). Florida and North Carolina cap benefits at 12 weeks. Virginia raised its maximum weekly benefit to $478 and Iowa to $790 in July 2026.</p></li>
    <li><span class="who">Severance</span><p>Some states delay or offset benefits during paid severance; executives should check their state's rules before filing.</p></li>
    <li><span class="who">Paid family leave</span><p>Delaware and Minnesota began paying benefits January 1, 2026, and Maine on May 1; Minnesota received about 100,000 applications in six months. Maryland's start is delayed to 2028. Returnship programs continue at large employers, but we found no reliable 2026 count.</p></li>
    <li><span class="who">AI layoff disclosure</span><p>California's SB 951 takes effect January 1, 2027. A federal bill, the AI-Related Job Impacts Clarity Act, would require large employers to report AI-related layoffs to the Labor Department.</p></li>
    <li><span class="who">Funding timeline</span><p>A federal stopgap keeps workforce programs funded through December 11, 2026.</p></li>
  </ul>
</section>

<section id="context" aria-labelledby="h-ctx">
  <div class="chapter-head"><div class="eyebrow">Chapter 10</div><h2 id="h-ctx">For context: new graduates and blue-collar work</h2></div>
  <p><strong>New graduates.</strong> The entry-level picture is mixed. Unemployment for 20–24-year-olds fell to 8.0% from 9.2%, and employers told NACE in the spring they planned to hire 5.6% more graduates from the class of 2026. But the New York Fed puts recent-graduate unemployment near 5.6% and underemployment at 42%, and an NBER study found no summer 2026 spike in graduate unemployment.</p>
  <p><strong>Blue-collar work.</strong> Hands-on sectors carried more of the job growth: construction added 109,000 jobs over the year and manufacturing is up 72,000 since its December low, while health care added about 372,000. This contrast with shrinking office sectors is one reason the overall numbers look steadier than white-collar workers feel.</p>
</section>

<section id="outlook" aria-labelledby="h-out">
  <div class="chapter-head"><div class="eyebrow">Chapter 11</div><h2 id="h-out">What to watch and release calendar</h2></div>
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
</section>

<section id="faq" aria-labelledby="h-faq">
  <div class="chapter-head"><div class="eyebrow">Frequently asked questions</div><h2 id="h-faq">FAQ</h2></div>
  <div>
    <details><summary>What is the NextChapter White-Collar Displacement Index?</summary><p>A monthly measure of long-term unemployment among managers and professionals: people whose last job was in management, business, financial or professional occupations and who have been unemployed 27 weeks or more, as a share of that labor force. It is seasonally adjusted, averaged over three months and set to 2019 = 100, calculated by NextChapter from Census CPS microdata. It was 162 in August 2026.</p></details>
    <details><summary>What was the U.S. unemployment rate in September 2026?</summary><p>4.2%, up from 4.1% in August and down from 4.4% in September 2025, according to BLS. Employers added 29,000 jobs.</p></details>
    <details><summary>How many people are long-term unemployed?</summary><p>1.94 million people had been unemployed 27 weeks or more in September 2026, 27.1% of all unemployed, up from 23.6% a year earlier. About two in three of them have been looking for a year or more.</p></details>
    <details><summary>How many layoffs have been blamed on AI in 2026?</summary><p>Employers attributed 120,136 announced job cuts to AI from January through September 2026, about 21% of announced cuts (Challenger, Gray &amp; Christmas). AI appears far less often in formal filings: 2 of 170 SEC restructuring filings reference AI in the restructuring disclosure itself.</p></details>
    <details><summary>Is AI causing higher unemployment?</summary><p>Most 2026 research, including from the Yale Budget Lab and the Federal Reserve, finds no broad AI effect on unemployment yet. Stanford and others find reduced hiring of young workers in highly AI-exposed jobs.</p></details>
    <details><summary>How many applications does it take to get a job in 2026?</summary><p>Employers received about 244 applications per job in 2025 (Greenhouse) and more than 300 per hire in 2026 (Ashby). Among users of the Huntr job tracker, two-thirds of offers came within 50 applications, and it took roughly 24–48 applications per interview.</p></details>
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
  <p>The index is seasonally adjusted with monthly factors equal to each calendar month's average ratio to its year's mean, estimated over 2015–2019 and 2022–2025 (pandemic years 2020–2021 excluded) and normalized to average 1.0 (Jan 1.104, Feb 1.059, Mar 0.998, Apr 0.949, May 0.907, Jun 0.926, Jul 1.039, Aug 1.075, Sep 1.057, Oct 0.995, Nov 0.965, Dec 0.926). Factors are re-estimated once a year. This is simpler than the X-13ARIMA-SEATS method BLS uses; we plan to adopt X-13 once the series has enough post-pandemic history. All other microdata comparisons use the same months in each year (January–August) and are not seasonally adjusted.</p>
  <h3>Margins of error</h3>
  <p>The CPS is a sample survey, and households are interviewed in several consecutive months. We report approximate 90% margins of error using a conservative rule: a design effect of 2.0, with eight pooled months counted as 3.2 independent months and three-month averages as 1.5. This yields ±26 index points on a single monthly reading and ±0.11 percentage points on the January–August long-term rate comparison. A change is labeled "significant" only if it exceeds its 90% margin. Groups with fewer than about 100 unemployed respondents are not reported. We plan to replace this approximation with Census generalized variance parameters or replicate weights.</p>
  <h3>Measures reported every month</h3>
  <p>To avoid reporting only the cells that moved, each edition reports this fixed list regardless of direction: the White-Collar Index; white-collar unemployment and long-term rates and shares; long-term duration bands for all and white-collar workers; long-term shares by occupation (Exhibit 9 groups), by white-collar industry (Exhibit 10 groups) and by white-collar age group; BLS headline indicators (Exhibit 4); JOLTS; Challenger cuts and AI attributions; the SEC Item 2.05 comparison; state payroll leaders and laggards; and unemployment-insurance exhaustion.</p>
  <h3>Other NextChapter calculations</h3>
  <p>Year-to-date and over-the-year payroll changes are calculated from FRED levels as of October 2, 2026, and will change with revisions. Openings per unemployed person divides JOLTS openings by CPS unemployment. State percent changes use BLS levels. The SEC comparison counts distinct filings returned by EDGAR full-text search and is described in the note to Exhibit 8.</p>
  <h3>Revisions and corrections</h3>
  <p>Government data are revised. Each edition reflects data available on its "data through" date. Errors are corrected in the online edition with a dated note below, and the data files are updated to match. Send corrections to justin.kulla@consequentialcapital.com.</p>
  <div class="exhibit">
    <span class="ex-label">Version log</span>
    <div class="tbl"><table>
      <thead><tr><th>Version</th><th>Date</th><th class="l">Change</th></tr></thead>
      <tbody><tr><td>1.0</td><td>Oct 5, 2026</td><td class="l">First publication.</td></tr></tbody>
    </table></div>
  </div>
  <div class="box cite">
    <div class="eyebrow">How to cite</div>
    <code id="cite-text">Kulla, J. (2026, October 5). NextChapter Displacement Report: September 2026 (Version 1.0). NextChapter. https://launchyournextchapter.com/reports/displacement-report-september-2026</code>
    <button class="btn2 no-print" type="button" id="copy-cite">Copy citation</button>
    <p class="note">Data: <a href="/reports/displacement-report-2026-09-data.csv">report figures (CSV)</a> · <a href="/reports/wc-index.csv">White-Collar Index history, 2015–2026 (CSV)</a>. Charts and data may be republished with attribution under CC BY 4.0. Index code is available on request.</p>
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
    <li>TrueUp Layoffs Tracker (accessed Oct 5, 2026).</li>
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
  </ol>
</section>

<section id="about" aria-labelledby="h-about">
  <div class="about">
    <div class="eyebrow">About NextChapter</div>
    <h2 id="h-about" style="font-size:1.4rem">About the publisher</h2>
    <p>NextChapter is a career-transition platform for senior professionals and executives, and offers programs for employers, universities and public workforce agencies. This section is the only part of the report that describes NextChapter's services. Learn more at <a href="https://launchyournextchapter.com">launchyournextchapter.com</a>.</p>
  </div>
</section>

</main>
</div>
<footer>
  <span>© 2026 NextChapter. The NextChapter Displacement Report is published monthly. Data and charts: CC BY 4.0.</span>
  <span>This report summarizes public data for general information. It is not legal, financial or career advice.</span>
</footer>
</div>`
