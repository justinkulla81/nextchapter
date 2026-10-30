# Keyword map

Generated from `src/lib/seo/keywords.ts` by `npm run seo:keyword-map`. Do not edit by hand: change the data, then regenerate.
`src/test/seo-keyword-map.test.ts` fails if this file is out of date, if a phrase has two owners, or if an owner page does not exist.

Each search phrase has exactly one owning page, so pages do not compete with each other. A page that touches a phrase it does not own links to the owner instead of repeating the phrase in its title.

Page families (one page per state, employer, job and so on) get their title, description and headline from `src/lib/seo/templates.ts`.

Pages with no target phrase (legal, security, editorial, per-item pages): `/privacy-policy`, `/terms`, `/security`, `/editorial-standards`, `/authors/:slug`, `/reports/replication`, `/news/:slug`, `/reports/:edition`, `/insights/:slug`, `/start`, `/network`.

187 clusters, 1084 phrases.

| Owner page | Kind | Primary phrase | Searcher wants | Other phrases it owns |
| --- | --- | --- | --- | --- |
| `/` | page | job transition platform | Find help after a layoff or while changing jobs; brand searches | job transition; job search help; free job search tools; help finding a job after a layoff; white collar job search; job search for experienced professionals; market reality assessment; nextchapter |
| `/about` | page | about NextChapter | Who is NextChapter | nextchapter company; justin kulla; job transition company |
| `/careers` | page | careers at NextChapter | Jobs at NextChapter | nextchapter jobs; work at nextchapter; nextchapter openings |
| `/how-it-works` | page | how NextChapter works | How the product works | weekly job search plan; search sprint; job search action plan; job search score |
| `/faq` | page | NextChapter FAQ | Product questions | is nextchapter free; nextchapter privacy |
| `/pricing` | page | plans and pricing | What it costs | free job search platform; nextchapter plans; job search tools free |
| `/contact` | page | contact NextChapter | Reach NextChapter | nextchapter support |
| `/refer` | page | refer someone who was laid off | Send a friend | help a friend who lost their job; refer a friend job search |
| `/start/laid-off` | page | laid off | I was just laid off and want to know what to do | i got laid off; just got laid off; what to do when you get laid off; laid off what now; laid off help; layoff help; laid off professionals; after a layoff; recently laid off; job loss help; lost my job |
| `/resources/72-hours` | page | first 72 hours after a layoff | Checklist for the first days after a layoff | layoff checklist; job loss checklist; what to do first after being laid off; first week after layoff; what to do after losing your job |
| `/resources/unemployed` | page | job search while unemployed | Job search while out of work | unemployed professional; unemployed what to do; how to look for a job while unemployed; how to structure a job search; job search routine |
| `/resources/pre-exit` | page | how to prepare for a layoff | Prepare for a layoff or a departure | signs of a layoff; about to be laid off; before you leave a job; preparing to leave a job; exit checklist; what to take when leaving a job |
| `/topics/severance` | page | severance package | Understand and negotiate a severance package | severance pay; severance agreement; severance negotiation; how to negotiate severance; what is severance; severance and unemployment; is severance required; how much severance; layoff package |
| `/topics/first-two-weeks-after-layoff` | page | what to do after being laid off | Know what to do in the first two weeks after a layoff | laid off what to do first; first steps after a layoff; after a layoff checklist |
| `/topics/resume-ats-ai-screening` | page | resume for ats and ai screening | Write a resume that parses in applicant tracking and AI screening | resume ats; ats friendly resume; resume for applicant tracking system; beat ats; resume ai screening |
| `/topics/hidden-job-market` | page | hidden job market | Find jobs that are never posted publicly | unadvertised jobs; jobs not posted online; how to find unposted jobs; hidden jobs |
| `/topics/linkedin-after-layoff` | page | linkedin after layoff | Update LinkedIn after a layoff | update linkedin after being laid off; linkedin open to work after layoff; linkedin headline after layoff |
| `/topics/career-coach-cost` | page | is a career coach worth it | Decide whether a career coach is worth the cost | career coach cost; how much does a career coach cost; career coach for job transition; should i hire a career coach |
| `/topics/unemployment-and-job-search` | page | unemployment work search requirements | Understand work search rules while collecting unemployment | job search while on unemployment; collect unemployment and look for work; unemployment weekly certification; work search log |
| `/topics/best-job-sites-for-executives` | page | executive job search | Find senior and executive jobs | best job sites for executives; senior executive job search; director level jobs; how to find executive jobs |
| `/topics/networking-after-layoff` | page | networking after layoff | Network after a layoff without feeling embarrassed | how to network when laid off; networking when unemployed; reach out to contacts after layoff; embarrassed to network |
| `/mcp` | page | job search mcp server | Connect an AI assistant to NextChapter job search | mcp server for jobs; job search api for ai assistants |
| `/topics/job-search-tracker` | page | job application tracker | Organize job applications and follow-ups | track job applications; job search spreadsheet |
| `/topics/skills-gap-analysis` | page | skills gap analysis | Find the skills gap for a target role | find my skills gap; skills gap for jobs; what skills am i missing; skills i need for a job |
| `/topics/is-this-salary-fair` | page | is this job offer fair | Check whether a job offer pays fairly | check salary for my level; compare job offer pay; what should i be paid |
| `/topics/fake-job-postings` | page | fake job postings | Spot fake job postings and recruiter scams | job posting scam; how to spot a fake job; is this job real; fake recruiter |
| `/topics/ai-and-entry-level-jobs` | page | ai and entry-level jobs | Understand how AI affects entry-level jobs | is ai eliminating entry level jobs; ai entry level hiring; entry level jobs ai; ai replacing junior jobs |
| `/topics/ai-cover-letters` | page | ai cover letter | Use AI to write a cover letter well | cover letter with ai; chatgpt cover letter; write a cover letter with ai |
| `/topics/relocating-for-a-job` | page | relocating for a job | Compare cities before relocating for work | move for a job; compare cities to move; relocate for work; moving for a new job |
| `/topics/benefits-after-layoff` | page | benefits after a layoff | Know which benefits and help apply after a layoff | benefits after being laid off; what benefits do i get when laid off; snap after layoff |
| `/topics/american-job-centers` | page | american job center | Use an American Job Center after a layoff | one stop career center; workforce center near me; dislocated worker program |
| `/topics/buy-a-business-vs-job` | page | buy a business instead of a job | Decide between buying a business and a job | should i buy a business; buying a business after layoff; buy a small business or get a job |
| `/topics/interview-after-career-gap` | page | interview after a career gap | Interview well after a career gap | career gap interview; interviewing after time off; returning to work interview |
| `/topics/resume-gap` | page | explain a resume gap | Explain a gap on a resume | explain a gap in my resume; employment gap on resume; gap in work history |
| `/topics/negotiate-a-job-offer` | page | negotiate a job offer | Negotiate a job offer | how to negotiate salary; negotiate salary offer; counter offer salary; negotiating a new job offer |
| `/topics/references-after-layoff` | page | references after a layoff | Line up references after a layoff | job references after being laid off; who to ask for a reference; reference after layoff |
| `/topics/how-long-job-search-takes` | page | how long does a job search take | Know how long a job search takes | job search timeline |
| `/topics/job-search-while-employed` | page | job search while employed | Search for a job while employed | looking for a job while employed; job hunting while working; search for a new job in secret |
| `/topics/401k-after-layoff` | page | 401k after a layoff | Decide what to do with a 401(k) after a layoff | what to do with 401k after layoff; 401k rollover after layoff; cash out 401k after losing job |
| `/topics/freelance-after-layoff` | page | freelance after a layoff | Freelance or consult after a layoff | freelancing after losing job; start freelancing after layoff |
| `/topics/informational-interviews` | page | informational interview questions | Ask for and run informational interviews | how to ask for an informational interview |
| `/topics/thank-you-email-after-interview` | page | interview thank you email | Send a thank-you email after an interview | thank you note after interview; follow up after interview |
| `/resources/cobra-aca` | page | health insurance after a layoff: COBRA vs. marketplace | Compare COBRA with an ACA Marketplace plan after a job loss | cobra; cobra vs aca; cobra or aca; aca vs cobra; cobra vs obamacare; cobra or obamacare; cobra vs affordable care act; cobra vs marketplace; which is better cobra or marketplace; is aca cheaper than cobra; health insurance after layoff; health insurance after job loss; aca marketplace after job loss; special enrollment period; cobra deadline; cobra cost |
| `/resources/cobra-aca/:state` | family | cobra vs aca in {state} | Compare COBRA with an ACA Marketplace plan in one state | is aca cheaper than cobra in {state}; cobra vs aca cost {state}; {state} cobra vs marketplace; can i get aca instead of cobra in {state}; {state} health insurance after a layoff |
| `/tools/cobra-vs-aca-calculator` | page | cobra vs aca calculator | Work out what COBRA and a Marketplace plan would each cost me | cobra vs aca cost calculator; cobra or marketplace cost calculator; aca subsidy calculator after layoff; how much is health insurance after a layoff |
| `/resources/severance-pay` | page | is severance taxed | Understand how severance is taxed, how long I have to sign, and what to ask for | severance pay taxes; severance tax withholding; is severance taxed at 22%; is severance taxed at a higher rate; how long do i have to sign a severance agreement; do i have to sign a severance agreement; severance agreement over 40; severance agreement 21 days 7 days; lump sum severance or salary continuation; what to ask for in a severance package; is severance pay required by law |
| `/resources/bridge-income` | page | bridge income | Earn while searching | income while job searching; interim jobs; contract work after layoff; freelance after layoff; consulting after layoff; side income after layoff |
| `/funding` | page | funding for laid-off workers | Money to relocate, retrain or study after a job loss | relocation assistance; retraining grants; training grants for laid off workers; tuition assistance after layoff; displaced worker programs; free courses for job seekers; wioa training funds; reskilling funding |
| `/unemployment-benefits` | page | unemployment benefits by state | Unemployment insurance rules across states | unemployment benefits; unemployment insurance; how to file for unemployment; apply for unemployment; unemployment eligibility; weekly unemployment benefit amount; maximum unemployment benefit by state; how long does unemployment last; unemployment waiting week; does severance affect unemployment |
| `/unemployment-benefits/:state` | family | {state} unemployment benefits | Unemployment benefits in one state | {state} unemployment; file for unemployment in {state}; {state} weekly unemployment benefit; {state} unemployment eligibility; {state} unemployment weeks; does severance affect unemployment in {state}; can i collect unemployment if i get severance in {state}; {state} severance and unemployment |
| `/layoffs` | page | layoff tracker | Which companies are laying off, and where | layoffs; recent layoffs; layoffs today; companies laying off; layoff list; mass layoffs; WARN notices; WARN notice list; WARN Act layoffs; who is laying off |
| `/layoffs/2026` | page | layoffs 2026 | How many layoffs there have been this year, by month, state and company | layoffs in 2026; 2026 layoffs; layoff statistics 2026; layoffs by month 2026; companies laying off 2026; biggest layoffs 2026; layoff list 2026; how many layoffs in 2026 |
| `/layoffs/2026/:month` | family | {month} 2026 layoffs | Layoffs in one month of 2026 | layoffs in {month} 2026; {month} 2026 layoff notices; {month} 2026 WARN notices |
| `/layoffs/this-week` | page | layoffs this week | Layoff notices filed in the last seven days | layoffs this week 2026; recent layoff notices; new WARN notices this week; latest layoff announcements |
| `/layoffs/week` | page | layoffs by week | Layoff notices week by week | weekly layoffs; weekly layoff report; layoffs last week; WARN notices by week |
| `/layoffs/week/:week` | family | layoffs week of {date} | Layoffs in one calendar week | layoffs {week}; WARN notices week of {date} |
| `/press` | page | white-collar unemployment data to cite | Cite and download our labor-market data | white-collar long-search index; long-term unemployment white-collar data; how to cite layoff data |
| `/feeds` | page | layoff notices rss feed | Subscribe to layoff notices by RSS | WARN notices rss; layoff alerts by state rss; layoff news feed; WARN notice feed |
| `/data` | page | layoff data download | Download layoff data | WARN notices csv; WARN notice data; layoff data by state; layoffs dataset |
| `/data/embed` | page | layoff widget for website | Embed layoff, jobs and benefits widgets | embed layoff tracker; unemployment benefits widget; jobs widget by industry |
| `/layoffs/:state` | family | {state} layoffs | Layoffs in one state | {state} WARN notices; {state} layoff list; recent layoffs in {state}; {state} companies laying off |
| `/layoffs/company/:slug` | family | {company} layoffs | Layoffs at one employer | {company} WARN notice; {company} layoff dates; {company} layoff 2026 |
| `/network/company/:slug` | family | {company} laid-off workers | What happens to workers laid off from one employer | former {company} employees; {company} laid off employees jobs; {company} severance and benefits; {company} alumni |
| `/tools/warn-act-checker` | page | WARN Act checker | Employer asks whether WARN notice is required | WARN Act; WARN Act requirements; WARN Act 60 day notice; WARN Act calculator; mass layoff notice; reduction in force notice; plant closing notice; do I need to give WARN notice |
| `/rapid-response` | page | rapid response layoff services | Employer planning a layoff looks for state support | rapid response; rapid response team; layoff aversion; layoff support for employers; plan a layoff; state rapid response coordinator |
| `/rapid-response/:state` | family | {state} rapid response layoff support | Employer layoff support in one state | {state} rapid response; {state} layoff support for employers; {state} WARN Act |
| `/news` | page | layoff and job market news | Layoff and job-market news | layoff news; hiring news; job market news; AI layoffs news; labor market news |
| `/reports` | page | white collar employment report | White-collar job market data | white collar jobs report; white collar job market; job market report; professional jobs report; hiring trends; job market 2026; unemployment rate for professionals |
| `/reports/white-collar-index` | page | how long a job search takes | How long does a job search take | average job search length; how long to find a job; long search index; time to hire white collar |
| `/reports/early-warning` | page | young graduates unemployment | Are graduates and entry-level workers being hit | recent graduate unemployment rate; entry level jobs and AI; AI layoffs; early warning labor indicators; AI job cuts by country |
| `/ai-skills` | page | AI skills in job postings | AI skills in demand and what they pay | AI jobs; AI skills by function; in-demand AI skills; which jobs need AI skills; AI-proof careers; careers that use AI skills; AI jobs pay |
| `/resources/ai-skills-pay-premium` | page | AI skills salary premium | Do AI skills increase pay (explainer with a citable table) | do AI skills increase salary; AI skills salary increase; AI skills non tech jobs salary; how much do AI skills pay; AI pay premium by function; AI skills pay marketing |
| `/ai-training` | page | AI training for workforce programs | Organizations buying AI upskilling | AI upskilling; AI reskilling; AI courses for laid off workers; AI training for colleges; AI training for employers; AI skills gap |
| `/jobs` | page | job search | Find open jobs | find jobs; job board; white collar jobs; professional jobs; executive jobs; senior level jobs; remote professional jobs; jobs with salary; manager jobs; director jobs |
| `/jobs/:id` | family | {job title} jobs at {company} | One specific opening | {job title} {city}; {company} {job title} salary; {job title} remote |
| `/employers/:slug` | family | {company} jobs | Jobs and pay at one employer | {company} salaries; {company} open roles; {company} hiring; {company} careers openings |
| `/topics/job-search-strategy` | page | job search strategy | How to run a job search | career search; how to search for a job; job search tips; job search plan; job search tracker; job hunting |
| `/why-stuck` | page | why your job search isn’t working | Why is my search not working | why cant i find a job; not getting interviews; applications going nowhere; ghosted after applying; ats rejection; hard to find a job right now |
| `/start/searching-too-long` | page | job search taking too long | Search has dragged on for months | been looking for a job for months; long-term unemployed; job search stalled; unemployed for a year |
| `/resources/gatekeeper` | page | getting past ATS screens and recruiters | Get past recruiters and resume screening | applicant tracking system; ATS resume; resume screening; how recruiters screen resumes; get an interview; getting past the gatekeeper |
| `/topics/resume-tips` | page | resume tips for experienced professionals | Write or fix a resume | resume help; resume after layoff; executive resume; resume writing; resume summary; how to write a resume |
| `/dossier` | page | executive dossier | Proof of work beyond a resume | professional portfolio; proof of work; verified references; career portfolio; resume alternative; candidate evidence |
| `/membership` | page | membership between jobs | Keep a profile current between jobs | keep your dossier current; alumni membership; career maintenance |
| `/resources/interview-prep` | page | interview prep | Prepare for interviews | how to prepare for an interview; behavioral interview; phone screen; final round interview; executive interview |
| `/resources/post-interview` | page | follow up after an interview | What to do after an interview | thank you email after interview; interview thank you note; waiting to hear back; second interview follow up |
| `/resources/offer-letter` | page | how to negotiate a job offer | Read and negotiate an offer | salary negotiation; offer letter; total compensation; negotiation script; job offer red flags; counteroffer |
| `/resources/first-90-days` | page | first 90 days in a new job | Start well in a new job | new job first 90 days plan; starting a new role; onboarding yourself; first month at a new job |
| `/resources` | page | job search and layoff guides | Browse job search and layoff guides | job search guides; layoff guides; career guides; free job search resources |
| `/resources/network-activation` | page | how to network when you’re job searching | Use your network in a search | networking for job seekers; informational interview; reconnect with contacts; networking without feeling awkward; job search networking |
| `/resources/network-scripts` | page | networking email and message scripts | Message templates for outreach | networking message templates; cold outreach linkedin message; reach out to a former colleague; ask for an introduction; referral request template |
| `/resources/ask-for-help` | page | how to ask for help with your job search | Ask people for help in a search | asking for job leads; tell people you were laid off; how to tell friends you lost your job; ask for referrals |
| `/resources/narrative-workshop` | page | your career story: tell me about yourself | Tell your career story | career story; personal pitch; elevator pitch; how to explain a layoff; personal narrative for job search |
| `/resources/thought-leadership` | page | thought leadership for job seekers | Build visibility during a search | thought leadership; linkedin posts for job seekers; personal brand; get noticed by recruiters; linkedin profile |
| `/start/career-change` | page | career change | Move to a new field | changing careers; how to change careers; switch careers; career switch; new career path; career change plan; career transition |
| `/topics/career-pivot` | page | career pivot | Pivot from one role or industry to a related one | job pivot; how to pivot careers; pivot to a new industry; career pivot examples; transferable skills; pivot your career; professional pivot |
| `/topics/career-exploration` | page | career exploration | Figure out what to do next | explore careers; career options; what career is right for me; career path ideas; what should I do next in my career; careers for experienced professionals; explore new careers |
| `/start/thinking-about-a-move` | page | thinking about leaving my job | Considering a change before anything happens | should I leave my job; know my market value; confidential job search; quietly looking for a job; am I underpaid; sensing a layoff |
| `/start/managing-my-career` | page | career management | Manage a career while employed | career growth plan; stay employable; layoff-proof your career; prepare for performance review; ask for a raise |
| `/start/resigned` | page | quit without another job lined up | Left a job without another lined up | resigned no job lined up; after quitting my job; left my job to find a better one |
| `/start/returning` | page | return to work after a career break | Return to work after a gap | returning to work; resume gap; career gap; back to work after caregiving; returnship |
| `/start/promotion` | page | how to ask for a promotion | Ask for a promotion | promotion conversation; get promoted; build the case for a promotion; promotion or new job |
| `/start/new-grad` | page | new grad job search | First job after school | first job after college; entry level jobs; recent graduate jobs; first job search; graduate career plan |
| `/start/next-act` | page | next act career | Board, consulting or part-time work later in a career | encore career; second act career; board seats; consulting after a corporate career; part-time professional work; package your experience |
| `/start/taking-a-break` | page | career break | Step away and return | sabbatical; family leave and career; step away from work; time off between jobs |
| `/start/happy-with-fractional-work` | page | fractional work | Fractional and consulting work | fractional executive; interim executive; portfolio career; independent consulting; keep a consulting practice full |
| `/start/building-something` | page | starting something while you keep your job | Start something on the side | side business; startup while keeping your job; start a company; leave a job to start a company |
| `/topics` | page | job search and career change topics | Browse job search and career topics | career topics; layoff topics; job search questions |
| `/tools` | page | free job search and layoff tools | Free calculators and lookups for job seekers | free job search tools online; layoff tools; job loss calculator; free career tools |
| `/tools/severance-calculator` | page | severance calculator | Work out a severance figure | severance pay calculator; how much severance should I get; severance by years of service; severance weeks per year; severance estimate; severance calculator after taxes; severance pay tax calculator; net severance pay |
| `/tools/salary-converter` | page | salary converter | Convert hourly pay to a yearly salary | hourly to salary calculator; hourly to yearly; salary to hourly; annual salary to hourly wage; hourly rate to annual salary |
| `/tools/layoff-runway` | page | layoff runway calculator | Work out how long money lasts after a layoff | how long will my savings last after a layoff; savings runway calculator; how many months of savings do I need; job loss budget calculator |
| `/tools/job-loss-readiness` | page | layoff readiness check | Check how ready I am if my job ended, while still employed | am i prepared for a layoff; what if i lose my job; what happens to my benefits if i get laid off; what happens to my life insurance if i lose my job; layoff preparedness |
| `/tools/unemployment-estimator` | page | unemployment benefit estimator | Estimate unemployment benefits | unemployment calculator; how much unemployment will I get; unemployment benefits calculator by state; estimate unemployment pay |
| `/tools/layoff-deadlines` | page | deadlines after a layoff | Find the dates that matter after a layoff | layoff deadlines; cobra deadline after layoff; when to file for unemployment after layoff; what to do after being laid off by when; layoff checklist dates |
| `/tools/layoff-risk-check` | page | layoff risk calculator | See whether there are warning signs of a layoff at an employer | layoff risk assessment; am I going to be laid off; signs of layoffs; my layoff risk; layoff risk check; is my job safe from layoffs |
| `/tools/ai-job-check` | page | is my job safe from AI | A worker asks whether AI will affect their job and what to do about it | will AI replace my job; AI exposure by job; jobs most exposed to AI; AI job risk by occupation; how much of my job can AI do; AI job check |
| `/data/ai-jobs-index` | page | AI jobs index | A researcher, journalist or worker wants current data on AI exposure, openings and AI-skill pay by occupation | AI exposure by occupation data; AI jobs data; which occupations are most exposed to AI; AI job market data download; AI skills pay and openings by occupation |
| `/tools/resume-bullet-rewriter` | page | resume bullet point rewriter | A job seeker wants stronger résumé bullet points | rewrite resume bullets; resume bullet points generator; improve resume bullet points; resume bullet point examples; AI resume bullet rewriter; resume bullet points checker |
| `/tools/interview-answer-coach` | page | interview answer feedback | A job seeker wants feedback on an interview answer before the interview | practice interview answers; interview answer coach; how to answer why were you laid off; how to answer tell me about yourself; AI interview practice; interview answer checker |
| `/resources/warn-act` | page | WARN Act rights | A worker asks what a WARN notice means and what an employer owes | WARN notice meaning; what is the WARN Act; WARN Act severance; WARN Act pay; WARN Act exceptions; WARN Act for employees; state WARN laws |
| `/layoffs/by-state` | page | WARN notices by state | Find every state’s WARN layoff notices in one place | WARN notice list by state; layoffs by state 2026; state WARN notice database; WARN notices by state 2026 |
| `/tools/pay-check` | page | am i paid fairly | Check whether a salary is in line for a job title | is my salary fair; salary check by job title; compare my salary to market; pay check tool |
| `/tools/resume-check` | page | free resume check | Score my resume with a free tool | resume checker; resume score; check my resume; free resume score; resume analyzer |
| `/glossary` | page | layoff and job search glossary | Define a layoff or job search term | what is a WARN notice; what is a reduction in force; what is COBRA; what is a retained search; what is garden leave; what is an applicant tracking system; what is a dislocated worker; what is an american job center; what is a release agreement; what is fractional work; what are transferable skills; what is total compensation; what is a non-compete |
| `/events` | page | job fairs near me | Job fairs and business events near me | career fairs near me; hiring events near me; small business workshops near me; startup events near me |
| `/events/:state` | family | {state} job fairs | Job fairs and business events in one state | {state} career fairs; {state} hiring events; {state} small business workshops; {state} startup events |
| `/places` | page | local job markets | Job market in my area | jobs near me; job market by state and county; local unemployment rate; job openings by county; largest employers near me |
| `/places/:state` | family | {state} jobs | Job market in one state | {state} job market; {state} unemployment rate; {state} largest employers; {state} job openings |
| `/places/:state/county/:county` | family | {county} jobs | Job market in one county | {county} unemployment rate; {county} largest employers; {county} job openings; {county} layoffs |
| `/places/:state/city/:city` | family | {city} jobs | Job market in one city | {city} layoffs; {city} employers hiring; {city} job center |
| `/industries` | page | jobs by industry | Jobs, conferences and layoffs by industry | industry job market; industry layoffs; industries hiring |
| `/industries/:slug` | family | {industry} jobs | One industry | {industry} layoffs; {industry} conferences; {industry} associations |
| `/functions` | page | jobs by function | Jobs, conferences and layoffs by job function | job functions; finance jobs; engineering jobs; marketing jobs; legal jobs; function job market |
| `/functions/:slug` | family | {function} jobs | One job function | {function} layoffs; {function} conferences; {function} careers |
| `/conferences` | page | conferences and trade shows | Find conferences to attend or speak at | industry conferences; conference calendar; call for speakers; trade shows by industry; networking conferences |
| `/conferences/:slug` | family | {conference} dates and cost | One conference | {conference} speakers; {conference} call for speakers; {conference} registration |
| `/associations` | page | industry associations | Industry associations and organizers | professional associations; conference organizers; event organizers |
| `/associations/:slug` | family | {association} conferences | One association | {association} events; {association} speaking opportunities |
| `/salaries` | page | salary by job title | What does a job pay | average salary by job title; professional salaries; how much do jobs pay; job salary lookup; pay by profession |
| `/salaries/:slug` | family | {title} salary | What one job title pays | {title} average salary; {title} pay range; how much does a {title} make; {title} salary by state; {title} median pay |
| `/jobs/title` | page | jobs by title | Browse open jobs by title | job titles; open jobs by job title; job openings by profession |
| `/jobs/title/:slug` | family | {title} jobs | Open jobs for one title | {title} job openings; {title} openings; {title} jobs hiring now; {title} jobs with salary |
| `/jobs/type/:type` | family | {type} professional jobs | Remote, hybrid, contract, part-time or interim jobs | {type} jobs; remote jobs for managers; remote director jobs; contract jobs for professionals; part-time professional jobs; interim executive jobs; hybrid jobs |
| `/coaching` | page | career coach | Find a career coach | professional coach; executive coach; career coaching; AI career coach; job search coach; executive coaching for job seekers; find a career coach; online career coach; free career coach |
| `/topics/laid-off-over-40` | page | laid off at 50 | Laid off later in a career | laid off at 40; laid off over 50; laid off after 20 years; laid off later in life; age discrimination layoff; job search after 50 |
| `/topics/laid-off-no-savings` | page | laid off with no savings | Laid off with little saved | laid off no money; help paying bills after layoff; laid off and need income now; laid off and a mortgage |
| `/topics/explain-a-layoff` | page | how to explain a layoff in an interview | Answer why you were laid off in an interview | why were you laid off interview answer; how to talk about a layoff; explain being laid off; interview question laid off |
| `/topics/what-to-say-when-laid-off` | page | what to say when you get laid off | Know what to say and ask in the layoff meeting and right after | what to say in a layoff meeting; what to say to hr when laid off; how to respond when you are laid off; what to ask when you are laid off; laid off what to say; how to react to being laid off |
| `/topics/acquisition-layoffs` | page | layoffs after an acquisition | Judge the risk of layoffs after my company is acquired | will i be laid off after an acquisition; company acquired what happens to my job; layoffs after a merger; merger layoffs; acquisition layoffs timeline; what to ask if your company is acquired; worried about layoffs after acquisition |
| `/topics/should-i-take-the-buyout` | page | should i take the buyout | Decide whether to accept a voluntary buyout offer | voluntary buyout; voluntary separation package; voluntary separation program; buyout offer from employer; voluntary severance; deferred resignation; is a buyout worth it |
| `/topics/fired-vs-laid-off` | page | fired vs laid off | Understand the difference between being fired and laid off | difference between fired and laid off; laid off vs fired; terminated vs laid off; laid off or fired unemployment; fired vs let go; can i collect unemployment if i was fired |
| `/topics/how-to-lay-off-employees` | page | how to lay off employees | Employer plans a layoff | layoff checklist for employers; layoff communication plan; layoff process; how to conduct a layoff; layoff meeting script |
| `/topics/cover-letter-tips` | page | cover letter tips | Write a cover letter | cover letter for experienced professionals; cover letter after layoff; cover letter for career change; how long should a cover letter be; do I need a cover letter |
| `/topics/executive-recruiters` | page | executive recruiters | Work with executive recruiters and search firms | executive search firms; retained search firms; headhunters; how to work with an executive recruiter; how to get on a recruiter’s radar; contingent vs retained recruiters; find an executive recruiter; executive search |
| `/topics/reverse-recruiter` | page | reverse recruiter | Have someone represent me to employers | reverse recruiting; reverse recruiting services; candidate marketing; job search representation; someone to find jobs for me; recruiter that works for the candidate |
| `/topics/resume-review` | page | free resume review | Get my resume reviewed | resume review; resume feedback; review my resume; is my resume good; resume critique; ats resume checker |
| `/topics/interview-questions-and-answers` | page | interview questions and answers | Answer common interview questions | interview questions; common interview questions; tell me about yourself; behavioral interview questions; what is your biggest weakness; questions to ask the interviewer |
| `/topics/career-advice` | page | career advice | General career advice | career advice for professionals; career guidance; career help; career development advice; how to advance your career; when to change jobs |
| `/topics/problems-at-work` | page | problems at work | Deal with a problem at work | work problems; difficult boss; bad boss; micromanager; toxic workplace; burnout at work; passed over for promotion; conflict with coworker |
| `/topics/what-is-a-job-transition-platform` | page | what is a job transition platform | Understand what a job transition platform is | job transition platform meaning; job transition services; what is job transition; job transition help |
| `/topics/job-transition-platforms-for-laid-off-professionals` | page | best job transition platform for laid-off professionals | Pick a service to help after a layoff | best outplacement services; outplacement for laid off professionals; job transition services for laid off workers; where to get help after a layoff |
| `/topics/what-is-outplacement` | page | what is outplacement | Understand outplacement as a laid-off employee | outplacement meaning; what does outplacement include; how to get outplacement; is outplacement worth it |
| `/topics/career-test` | page | career test | Find what career fits me | career assessment; career quiz; career test for adults; best career for me; free career test |
| `/topics/resume-examples` | page | resume examples for experienced professionals | See resume examples | resume examples; resume bullet examples; resume summary examples; resume samples; good resume bullet points |
| `/topics/how-to-choose-a-career-coach` | page | how to choose a career coach | Choose a career coach | ai career coach vs human; how to find a career coach; what to ask a career coach |
| `/submit-resume` | page | submit resume to recruiters | Put my resume in front of recruiters | send my resume to recruiters; get recruiters to find me; resume submission; recruiter introductions |
| `/scam-watch` | page | fake recruiter scams | Is this recruiter or job offer fake | job scam; recruiter scam; fake job offer; is this recruiter real; linkedin recruiter scam; job offer scam email |
| `/for-managers/give-a-reference` | page | give a reference for an employee you let go | Manager wants to give a reference after a layoff | reference for a former employee; write a reference after a layoff; manager reference; recommendation for a laid off employee |
| `/outplacement` | page | outplacement services | Buy outplacement | outplacement; outplacement support; outplacement for employers; outplacement vendors; outplacement program; severance outplacement; layoff support for employees |
| `/vs` | page | outplacement providers compared | Compare outplacement vendors | best outplacement companies; outplacement providers; outplacement comparison; outplacement vendor comparison |
| `/vs/:competitor` | family | {competitor} alternative | Compare NextChapter with one vendor | NextChapter vs {competitor}; {competitor} outplacement review; {competitor} competitors |
| `/rfp-template` | page | outplacement RFP template | Write an outplacement RFP | outplacement RFP; outplacement vendor scorecard; outplacement vendor evaluation; outplacement RFP questions |
| `/insights` | page | outplacement insights for HR | Evaluate outplacement as an HR buyer | questions to ask an outplacement vendor; outplacement reporting; outplacement contract; outplacement account after contract |
| `/employers` | page | employer solutions | Employer overview | HR layoff support; support laid off employees; employee lifecycle; hiring employees and outplacement |
| `/employees` | page | employee development and retention | Employee development and retention | employee retention; internal mobility; employee career development; skills plan for employees; promotion preparation |
| `/talent` | page | hire experienced professionals | Employer wants to hire experienced professionals | hire laid off professionals; white collar recruiting; post a job free; candidate evidence brief; hire executives |
| `/recruiters` | page | recruiter candidate search | Recruiter wants candidates | candidate sourcing; search firm tools; recruiting workspace; candidate submission packet; executive search candidates |
| `/submit-search` | page | send us a search | Hand NextChapter an open search | submit a search to recruiters; confidential search; screened shortlist of candidates; candidate shortlist for recruiters |
| `/coaches` | page | software for career coaches | Coach wants client software | coaching client workspace; career coach tools; coach client management; pre-session brief; coaching session notes |
| `/higher-education` | page | alumni career services for colleges | College buys alumni career support | alumni career services; student career services; college career services platform; alumni relations; career services workspace |
| `/higher-education/:state` | family | {state} college career services | Colleges in one state | {state} colleges alumni support; {state} colleges career services; {state} university alumni career help |
| `/government-workforce` | page | workforce board software | Workforce agency buys job seeker support | workforce development software; job seeker services; WIOA career services; economic development job seekers; chamber of commerce workforce |
| `/workforce-boards` | page | workforce development boards | Find a local workforce board or job center | american job centers; local workforce board near me; workforce board directory; workforce investment board; job center near me; one-stop career center |
| `/workforce-boards/:state` | family | {state} workforce development boards | Workforce boards in one state | {state} american job centers; {state} workforce boards; {state} job centers near me |
| `/workforce-boards/:state/:board` | family | {board} workforce board | One workforce board | {board} american job center; {board} counties served; {board} contact |
| `/nonprofits` | page | workspace for nonprofits serving job seekers | Nonprofit buys job seeker support | nonprofit job seeker services; community organization workforce; job readiness program software |
| `/for-organizations` | page | NextChapter for organizations | Pick the organization portal | organization portals; portals for colleges employers recruiters coaches |

## Titles and descriptions

Title is shown before the site suffix " | NextChapter".

### `/`

- Title: NextChapter: Job Search Help After a Layoff or Career Change
- Description: NextChapter is the leading job transition platform for laid-off and career-changing professionals. Free assessment, weekly job search plan and an AI career coach.

### `/how-it-works`

- Title: How NextChapter Works: Assessment, Plan and Dossier
- Description: From a Market Reality Assessment to a weekly job search plan and a verified Dossier: how NextChapter, the leading job transition platform, helps you get hired.
- H1: How NextChapter works

### `/faq`

- Title: NextChapter FAQ: Plans, Assessment and Privacy
- Description: Answers about NextChapter: what is free for job seekers, how the Market Reality Assessment works, what employers can see, and how matching works.
- H1: NextChapter frequently asked questions

### `/pricing`

- Title: Plans and Pricing: Free for Job Seekers
- Description: NextChapter is free for job seekers. See the plans for individuals, colleges, workforce organizations, employers, recruiters and coaches, and what each includes.
- H1: Plans and pricing

### `/contact`

- Title: Contact NextChapter
- Description: Contact NextChapter: job seekers, organizations, coaches, recruiters and press. Email us or tell us what you need and we will reply.

### `/refer`

- Title: Refer Someone Who Was Laid Off or Is Job Hunting
- Description: Someone you care about lost a job or is job hunting. Send them NextChapter, free for job seekers, so they start with a plan instead of a blank page.
- H1: Refer someone who was laid off or is job hunting

### `/start/laid-off`

- Title: Laid Off? What to Do Next and a Plan to Get Hired
- Description: Just laid off? Get a free Market Reality Assessment, a weekly job search plan, unemployment and layoff resources, and a community of people going through it too.
- H1: Laid off? A real plan beats another job board.

### `/resources/72-hours`

- Title: Laid Off? Your First 72 Hours: A Checklist
- Description: The first 72 hours after a layoff: what to do, in what order, before the shock wears off and the deadlines start. Unemployment, COBRA, severance, references.
- H1: Laid off? Your first 72 hours.

### `/resources/unemployed`

- Title: Job Search While Unemployed: What Actually Works
- Description: Job search while unemployed: what to do in week one, how to split your time across applications, outreach and visibility, and what works by month three.
- H1: Job search while unemployed: what actually works

### `/resources/pre-exit`

- Title: Preparing for a Layoff: What to Do Before You Leave
- Description: Bracing for a layoff or planning a departure? Secure references, your own data and clarity on what you can take while you still have access. A checklist.
- H1: Preparing for a layoff: what to do before you leave

### `/topics/severance`

- Title: Severance Package: What It Is and How to Negotiate
- Description: What a severance package usually includes, what is negotiable, how severance affects unemployment benefits and health coverage, and what to check before you sign.

### `/topics/first-two-weeks-after-layoff`

- Title: Laid Off: What to Do in the First Two Weeks
- Description: The first two weeks after a layoff, in order: unemployment, severance review, health coverage, then your network. What has a deadline and what can wait.

### `/topics/resume-ats-ai-screening`

- Title: ATS Resume: How to Get Through AI Screening
- Description: How to format an ATS-friendly resume, match a job posting without stuffing keywords, and what AI resume screening can and cannot do.

### `/topics/hidden-job-market`

- Title: The Hidden Job Market: How to Find Unposted Jobs
- Description: Four ways into the hidden job market: referrals, recruiters, direct outreach and early alerts, plus a simple weekly rhythm to keep it going.

### `/topics/linkedin-after-layoff`

- Title: LinkedIn After a Layoff: What to Change First
- Description: What to change on LinkedIn after a layoff: headline, About, open-to-work settings and the one post that brings introductions.

### `/topics/career-coach-cost`

- Title: Is a Career Coach Worth It? Cost and What to Ask
- Description: When a career coach is worth paying for, what to ask before you buy, and the free options to try first, including outplacement.

### `/topics/unemployment-and-job-search`

- Title: Unemployment and Your Job Search: The Rules
- Description: What most states require to keep collecting unemployment: weekly certification, a work-search record, reporting earnings and severance.

### `/topics/best-job-sites-for-executives`

- Title: Executive Job Search: Where Senior Roles Are Found
- Description: Where senior and executive roles are found: search firms, LinkedIn, career pages and your network, and how to work each channel.

### `/topics/networking-after-layoff`

- Title: Networking After a Layoff: A Message That Works
- Description: How to network after a layoff: the message to send, who to contact first and how to keep conversations going.

### `/mcp`

- Title: NextChapter MCP Server for Job Search
- Description: A free, read-only MCP server that lets an AI assistant search current professional job openings and find career guides on layoffs and job search.

### `/topics/job-search-tracker`

- Title: Job Search Tracker: Organize Applications and Follow-Ups
- Description: What to record for every application and contact, the habits that keep a job search tracker useful, and how to read it when the search stalls.

### `/topics/skills-gap-analysis`

- Title: Skills Gap Analysis: Find What You Are Missing
- Description: A five-step method to find your skills gap from real job postings, what counts as proof, and which gaps are only wish lists.

### `/topics/is-this-salary-fair`

- Title: Is This Job Offer Fair? How to Check Pay
- Description: Where to find pay for your role and city, how to compare the whole package, and what to do if an offer is low.

### `/topics/fake-job-postings`

- Title: Fake Job Postings: How to Spot Recruiter Scams
- Description: Warning signs of a job scam, how to check a posting and a recruiter, and what to do if you shared money or details.

### `/topics/ai-and-entry-level-jobs`

- Title: Is AI Eliminating Entry-Level Jobs? Reading the Evidence
- Description: What to look at to judge how AI affects entry-level hiring in your field, what tends to hold up, and what early-career workers can do.

### `/topics/ai-cover-letters`

- Title: AI Cover Letter: Use It Without Sounding Like AI
- Description: A process for drafting a cover letter with AI, what to check before you send, and when a short note works better.

### `/topics/relocating-for-a-job`

- Title: Relocating for a Job: How to Compare Cities
- Description: The four things to compare before a move for work, checks to make before you commit, and how remote work changes it.

### `/topics/benefits-after-layoff`

- Title: Benefits and Help After a Layoff: What You May Qualify For
- Description: Unemployment, health coverage, workforce services and other help you may qualify for after a layoff, in the order that matters.

### `/topics/american-job-centers`

- Title: American Job Centers: Free Help for Laid-Off Workers
- Description: What American Job Centers offer for free, how to use one, and how dislocated worker training funds work.

### `/topics/buy-a-business-vs-job`

- Title: Buy a Business or Find a Job? How to Decide
- Description: Questions to answer before buying a business, checks to run before you sign, and a middle path that keeps your options open.

### `/topics/interview-after-career-gap`

- Title: Interviewing After a Career Gap
- Description: How to answer for a career gap in a sentence or two, show you are current, and practice so it does not derail the interview.

### `/topics/resume-gap`

- Title: How to Explain a Resume Gap
- Description: How to show a gap on a resume honestly in one line, what to say in a cover note or interview, and what never to do.

### `/topics/negotiate-a-job-offer`

- Title: How to Negotiate a Job Offer
- Description: What to do before you reply, how to make the counter, and how to negotiate the whole package when base pay will not move.

### `/topics/references-after-layoff`

- Title: References After a Layoff: Who to Ask and What to Say
- Description: Who to ask for a reference after a layoff, how to ask, and what to request from your former employer.

### `/topics/how-long-job-search-takes`

- Title: How Long Does a Job Search Take?
- Description: What shapes the length of a job search, how to plan your money and week, and what to change when it takes long.

### `/topics/job-search-while-employed`

- Title: Looking for a Job While You Still Have One
- Description: How to keep a job search private, manage your time, handle references, and know when to tell your employer.

### `/topics/401k-after-layoff`

- Title: Your 401(k) After a Layoff: Keep, Roll Over or Cash Out
- Description: Your options for a 401(k) after a layoff, tax and penalty details to check, and what to compare before you decide.

### `/topics/freelance-after-layoff`

- Title: Freelancing or Consulting After a Layoff
- Description: How to get first clients, run the business side, report income if you collect unemployment, and keep your options open.

### `/topics/informational-interviews`

- Title: Informational Interviews: How to Ask and What to Say
- Description: How to ask for a short conversation, what to ask, and how to follow up without asking for a job.

### `/topics/thank-you-email-after-interview`

- Title: Thank-You Email After an Interview
- Description: What to include in a short thank-you email after an interview, practical points, and what to do if you forgot something.

### `/resources/cobra-aca`

- Title: COBRA vs ACA After a Layoff: Which Costs Less?
- Description: COBRA or the ACA Marketplace after a layoff: how the cost compares, the 60-day deadlines, the 2026 and 2027 subsidy rules and Medicaid, with a free calculator.
- H1: COBRA vs ACA: health insurance after a layoff

### `/tools/cobra-vs-aca-calculator`

- Title: COBRA vs ACA Calculator: What You Would Pay
- Description: Free COBRA vs ACA calculator: enter your COBRA quote and household income to see the Marketplace cost after the premium tax credit, with your deadlines.
- H1: COBRA vs ACA cost calculator

### `/resources/severance-pay`

- Title: Severance Pay: Taxes, Your Agreement, What Is Typical
- Description: How severance is taxed, how many days you have to review and sign an agreement, what to ask for, and how it affects unemployment in your state. Sourced.
- H1: Severance pay: taxes, your agreement and what is typical

### `/resources/bridge-income`

- Title: Bridge Income While Job Searching: Interim Work
- Description: Ways to earn while you search without derailing the search: fractional work, interim roles and contract work, and how to weigh the tradeoffs.
- H1: Bridge income while you search

### `/funding`

- Title: Funding for Laid-Off Workers: Relocate, Retrain, Study
- Description: Relocation grants, tuition aid, federal training money and free courses for laid-off workers, ranked for you. Join NextChapter free to see what you qualify for.

### `/unemployment-benefits`

- Title: Unemployment Benefits by State: Amounts and How to File
- Description: Unemployment benefits in every state and DC: the maximum and minimum weekly benefit, how many weeks, the waiting week, how severance counts, and where to file.

### `/layoffs`

- Title: Layoff Tracker: Recent Layoffs and WARN Notices by State
- Description: Recent layoffs from WARN Act notices filed with state labor departments, collected daily: totals, the latest filings, and a page for every state and employer.

### `/layoffs/2026`

- Title: Layoffs 2026: Every WARN Notice by Month, State and Company
- Description: Layoffs in 2026 from WARN notices filed with state labor departments: totals by month, state, industry and company, a free CSV, and a line to cite.
- H1: Layoffs 2026: every WARN notice, month by month

### `/layoffs/this-week`

- Title: Layoffs This Week: New WARN Notices by State
- Description: Layoff notices filed in the last seven days: how many workers, which states and employers, with the state record for each. Updated every day.
- H1: Layoffs this week: new WARN notices

### `/layoffs/week`

- Title: Layoffs by Week: WARN Notices, Week by Week
- Description: Every week of WARN layoff notices from the last two years: how many notices and workers, which states and employers, with the state record for each.
- H1: Layoffs by week: WARN notices

### `/press`

- Title: Press and Data: Cite Our Labor-Market Figures
- Description: The White-Collar Long-Search Index, layoff counts and AI-skill pay premium, each with its method, margin of error, license, citation and download.
- H1: Press and data

### `/feeds`

- Title: Layoff Notice RSS Feeds by State and Industry
- Description: Free RSS and JSON feeds of new WARN layoff notices by state, industry and size, each with the state record, how it compares, and help for affected workers.
- H1: Layoff and conference feeds

### `/data`

- Title: Layoff Data Download: WARN Notices as CSV and JSON
- Description: Download every WARN Act layoff notice of the last 24 months as CSV or JSON, by state or all states, free to reuse with a link back.
- H1: Layoff data: download the WARN record

### `/data/embed`

- Title: Free Layoff, Jobs and Benefits Widgets for Your Site
- Description: Add live layoff notices, open jobs by industry or state unemployment benefits widgets to your website with one copy-paste snippet. Free, with a link back.
- H1: Embeddable layoff, jobs and benefits widgets

### `/tools/warn-act-checker`

- Title: WARN Act Checker: Is 60 Days’ Notice Required?
- Description: A free WARN Act calculator for employers. Enter your headcount and the number of jobs being cut to see whether federal 60-day notice is likely required.

### `/rapid-response`

- Title: Rapid Response and Layoff Support for Employers by State
- Description: Planning a layoff? Find your state’s rapid response team, workforce boards and American Job Centers, the federal WARN Act rules, and a free calculator for notice.

### `/news`

- Title: Layoff and Job Market News
- Description: Articles, videos, podcasts and posts on layoffs, hiring and the job market, picked by NextChapter, with what each means for people looking for work.
- H1: Layoff and job market news

### `/reports`

- Title: White Collar Employment Report: Jobs, Hiring, Search Length
- Description: A monthly, independent read on the U.S. white-collar job market: hiring, job changes, how long searches take, AI and what public programs are adding.

### `/reports/white-collar-index`

- Title: How Long Does a Job Search Take? White-Collar Search Index
- Description: How long white-collar job searches are taking right now, by month and level, from live postings and published labor data. Updated with each report.

### `/reports/early-warning`

- Title: Young Graduates and AI: Early-Warning Labor Indicators
- Description: Are young graduates the canary? Unemployment for recent graduates, entry-level hiring and AI-attributed job cuts by country, tracked against earlier downturns.

### `/ai-skills`

- Title: AI Skills in Job Postings: How Common and What They Pay
- Description: Which jobs ask for AI skills, how much more those postings advertise, and what research says about seniority. Measured on live U.S. job postings, limits stated.

### `/resources/ai-skills-pay-premium`

- Title: AI Skills Salary Premium: What U.S. Postings Advertise
- Description: The AI skills salary premium by function: how much more U.S. postings that ask for an AI skill advertise, matched on level and industry, with sample sizes and a CSV.

### `/ai-training`

- Title: AI Training for Employees, Colleges and Workforce Boards
- Description: AI training programs for employees and the people you serve: we measure the AI-skill gap and build short courses for budgets that already pay for training.

### `/jobs`

- Title: Job Search: Live Professional Jobs, Checked Open
- Description: Search live professional and executive jobs taken from employers’ own career sites and checked to still be open. Filter by location and remote.
- H1: Job search: live professional jobs

### `/topics/job-search-strategy`

- Title: Job Search Strategy: A Weekly Plan That Gets Interviews
- Description: How to run a job search as a project: set a weekly plan, split time across applications, outreach and visibility, track results and change the plan when it stalls.

### `/why-stuck`

- Title: Why Your Job Search Isn’t Working (and What to Change)
- Description: Job searching is hard right now and most of it happens before a person sees your name. Why you aren’t getting interviews, and what to change this week.
- H1: Why your job search isn’t working

### `/start/searching-too-long`

- Title: Job Search Taking Too Long? Change the Plan
- Description: Months into a job search and nothing is moving? Find what is stalling it, change the plan and get a weekly list of new things to try. Free to start.
- H1: Job search taking too long? Change the plan.

### `/resources/gatekeeper`

- Title: Getting Past ATS Screens and Recruiters to the Interview
- Description: How recruiters, ATS resume screeners and hiring managers actually work, and what it takes to move from an application in a queue to an interview.
- H1: Getting past ATS screens and recruiters

### `/topics/resume-tips`

- Title: Resume Tips for Experienced Professionals After a Layoff
- Description: What a resume has to do for an experienced professional: lead with results, explain a layoff or gap in one line, pass the screen and set up the interview.

### `/dossier`

- Title: Executive Dossier: Proof of Your Work, Beyond a Resume
- Description: The Executive Dossier shows how you work, backed by the people who worked with you. What it contains, who sees it, and what you keep.

### `/membership`

- Title: Membership: Keep Your Dossier Current Between Jobs
- Description: Your Dossier stays alive after you land. Membership keeps your evidence current so you are ready the next time you search.

### `/resources/interview-prep`

- Title: Interview Prep for Experienced Professionals, Stage by Stage
- Description: How to prepare for interviews at every stage, from the phone screen to the final round, and what changes as you move through the process.
- H1: Interview prep, from phone screen to final round

### `/resources/post-interview`

- Title: Follow Up After an Interview: Thank-You Note and the Wait
- Description: What to do in the 24 to 48 hours after an interview: the thank-you note that stands out, how to follow up, and how to handle the wait.
- H1: How to follow up after an interview

### `/resources/offer-letter`

- Title: Job Offer Letter: How to Read and Negotiate It
- Description: A total-comp breakdown, salary negotiation scripts and the red flags to catch before you sign: everything an offer letter does not say outright.
- H1: Job offer letter: read it, then negotiate it

### `/resources/first-90-days`

- Title: Your First 90 Days in a New Job: What to Prioritize
- Description: How to start strong in a new role: what to prioritize in the first month, and the mistakes that quietly cost people in their first quarter.
- H1: Your first 90 days in a new job

### `/resources`

- Title: Job Search and Layoff Guides: Free, From Day One to Day 90
- Description: Free guides for every stage of a job search after a layoff, from your first 72 hours to your first 90 days in a new job: benefits, networking, interviews, offers.
- H1: Job search and layoff guides

### `/resources/network-activation`

- Title: How to Network When You’re Job Searching
- Description: How to turn your existing contacts into real conversations without it feeling like you only reach out when you need something. Who to contact first.
- H1: How to network when you’re job searching

### `/resources/network-scripts`

- Title: Networking Email and LinkedIn Message Scripts for Job Seekers
- Description: Scripts for every kind of outreach, cold, warm and in between, so you never start a networking message from a blank page.
- H1: Networking email and message scripts

### `/resources/ask-for-help`

- Title: How to Ask for Help With Your Job Search
- Description: Why asking for help works and how to do it without it feeling awkward: the reframe that makes outreach easier before you send a single message.
- H1: How to ask for help with your job search

### `/resources/narrative-workshop`

- Title: Your Career Story: Answer “Tell Me About Yourself”
- Description: A workshop for building the one story you tell about your career, the version that works the same on a resume, in an interview and in a networking conversation.
- H1: Your career story: answer “tell me about yourself”

### `/resources/thought-leadership`

- Title: Thought Leadership for Job Seekers: Build a Presence
- Description: How to write and share thought leadership content that gets noticed by recruiters and hiring managers, without it feeling like self-promotion. A guide.
- H1: Build a professional presence with thought leadership

### `/start/career-change`

- Title: Career Change: A New Field Is a Plan, Not a Leap
- Description: Changing careers? Get a free Market Reality Assessment of how the market reads your background, which roles fit, and a weekly plan to move into a new field.
- H1: Career change: a new field is a plan, not a leap

### `/topics/career-pivot`

- Title: Career Pivot: How to Move to a New Role or Industry
- Description: A career pivot keeps what you already do well and points it at a new role or industry. How to find the pivot, prove the skills transfer and make the move.

### `/topics/career-exploration`

- Title: Career Exploration: Find Your Next Direction
- Description: Career exploration for experienced professionals: use your work history to find roles you can move into, see what each pays and requires, and test them first.

### `/start/thinking-about-a-move`

- Title: Thinking About Leaving Your Job? Know Your Market First
- Description: Curious, unhappy or sensing a layoff? See how the market reads you and what you are worth, privately, before anyone at work knows you looked. Free.
- H1: Thinking about leaving your job? Know your market first.

### `/start/managing-my-career`

- Title: Career Management: Make the Job You Have a Stronger One
- Description: You are not leaving, and you still should not coast. Know your worth, build skills that hold up in a downturn and prepare for reviews and raise conversations.
- H1: Career management: make the job you have a stronger one

### `/start/resigned`

- Title: Quit Without Another Job Lined Up? Make It Pay Off
- Description: You made the hard call. Close the gap fast with a structured search, a weekly plan and reference-backed proof of what you bring. Free to start.
- H1: Quit without another job lined up? Make it pay off.

### `/start/returning`

- Title: Returning to Work After a Career Gap or Break
- Description: A gap on your resume isn’t the whole story. Come back with your value clearly proven: a plan, a profile and references that show what you can do now.
- H1: Returning to work after a career gap

### `/start/promotion`

- Title: How to Ask for a Promotion: Walk In With Proof
- Description: Build the case for the next level, inside your company or outside it. Know your market, gather evidence and prepare the promotion conversation.
- H1: How to ask for a promotion: walk in with proof

### `/start/new-grad`

- Title: New Grad Job Search: A Plan, Not a Pile of Applications
- Description: Starting your career? Get a plan for your first job or internship and a strong first year, instead of a pile of applications. Free to start.
- H1: New grad job search: a plan, not a pile of applications

### `/start/next-act`

- Title: Next Act Career: Board, Consulting and Part-Time Work
- Description: Your experience is the product. Package it for board, fractional, consulting or part-time work that fits the next stage of your career.
- H1: Next act career: package your experience

### `/start/taking-a-break`

- Title: Career Break or Sabbatical: Plan the Time Away
- Description: Family leave, time off or a sabbatical? Plan the break, keep your profile and network warm, and come back ready to work. Free to start.
- H1: Career break or sabbatical: step away without losing your footing

### `/start/happy-with-fractional-work`

- Title: Fractional Work: Run Your Portfolio Like a Business
- Description: Happy with fractional, interim or consulting work? Keep your calendar full with a pipeline, proof of results and a profile clients can trust.
- H1: Fractional work: run your portfolio like a business

### `/start/building-something`

- Title: Starting Something While You Keep Your Job
- Description: Building a business or project on the side? Keep your job, your footing and your options open while you start something of your own.
- H1: Starting something while you keep your job

### `/topics`

- Title: Job Search, Career Change and Layoff Topics
- Description: Plain answers on severance, resumes, job search strategy, career pivots, career exploration, executive recruiters and reverse recruiters.
- H1: Job search, career change and layoff topics

### `/tools`

- Title: Free Job Search and Layoff Tools
- Description: Free calculators and lookups for people who lost a job or plan a move: severance calculator, unemployment benefits by state, layoff tracker, WARN Act checker.
- H1: Free job search and layoff tools

### `/tools/severance-calculator`

- Title: Severance Calculator: Pay by Years of Service
- Description: Free severance calculator: the common one-to-two weeks per year range from your pay, what is left after withholding, and your state’s unemployment rule.
- H1: Severance calculator

### `/tools/salary-converter`

- Title: Salary Converter: Hourly to Yearly Pay and Back
- Description: Free salary converter: turn hourly pay into yearly, monthly, weekly and daily pay, or the reverse, with hours and weeks you can change for any schedule.
- H1: Salary converter: hourly to yearly and back

### `/tools/layoff-runway`

- Title: Layoff Runway: How Long Will Your Money Last?
- Description: Free calculator: enter savings, monthly spending and severance to see how many months they cover, and what your state’s unemployment benefits add.
- H1: Layoff runway: how long your money will last

### `/tools/job-loss-readiness`

- Title: Layoff Readiness Check: If Your Job Ended Tomorrow
- Description: Still employed and nervous? See how long your money would last, what unemployment would pay, and what ends with your health, life and disability cover.
- H1: Layoff readiness check: if your job ended tomorrow

### `/tools/unemployment-estimator`

- Title: Unemployment Benefit Estimator: How Much Will You Get?
- Description: Pick your state and enter your pay for a planning estimate of your weekly unemployment benefit, the weeks it can last and the most you could receive.
- H1: Unemployment benefit estimator: about how much you could get

### `/tools/layoff-deadlines`

- Title: Layoff Deadlines: What to Do and By When
- Description: Free layoff deadline tool: enter your last day to see when to file for unemployment and when the usual 60-day COBRA and Marketplace windows run out.
- H1: Layoff deadlines: what to do and by when

### `/tools/layoff-risk-check`

- Title: Layoff Risk Check: Are There Warning Signs at Your Employer?
- Description: Check five warning signs against public layoff records: your employer’s WARN notices, your industry’s trend and AI exposure. Free, nothing saved, not a prediction.
- H1: Layoff risk check: are there warning signs where you work?

### `/tools/ai-job-check`

- Title: Is My Job Safe from AI? Free AI Exposure Check by Job Title
- Description: Type your job title to see how much of the work AI already does, which related jobs pay more or are less exposed, and the skills to build. Free, from real usage.
- H1: Is my job safe from AI? Free AI exposure check

### `/data/ai-jobs-index`

- Title: NextChapter AI Jobs Index: AI Exposure, Openings and Pay
- Description: Monthly AI jobs index: how much of each occupation AI already does, how many jobs are open, and what AI skills add to advertised pay. Free CSV and citation.
- H1: The NextChapter AI Jobs Index

### `/tools/resume-bullet-rewriter`

- Title: Free Résumé Bullet Rewriter: Stronger Bullets, Your Facts
- Description: Paste up to four résumé bullet points and get stronger versions that keep your facts, plus a prompt for the number worth adding. Free, no account, nothing saved.
- H1: Free résumé bullet rewriter

### `/tools/interview-answer-coach`

- Title: Free Interview Answer Coach: Feedback and a Stronger Answer
- Description: Pick a common interview question, write your answer, and get honest feedback and a stronger version built from what you said. Free, no account, nothing saved.
- H1: Free interview answer coach

### `/resources/warn-act`

- Title: WARN Notice Explained: 60 Days, Who Is Covered, Your Rights
- Description: The federal WARN Act in plain language: who is covered, when 60 days of notice is due, the three exceptions, what is owed if notice is skipped, and five state laws.
- H1: The WARN Act in plain language: 60 days’ notice and what it means for you

### `/layoffs/by-state`

- Title: WARN Notices by State: Layoffs Filed in the Last 12 Months
- Description: Every state’s WARN layoff notices in one table: notices and workers named in the last 12 months, the latest filing and the state’s own record. Free to download.
- H1: WARN notices by state: what each state’s record shows

### `/tools/pay-check`

- Title: Pay Check: Am I Paid Fairly for My Job Title?
- Description: Free pay check: enter your job title and yearly pay to see where it sits against the range employers list today, with the median and the middle half.
- H1: Pay check: is your salary in line?

### `/tools/resume-check`

- Title: Free Resume Check: Score Your Resume Out of 100
- Description: Paste your resume to get a free score out of 100 and see how many fixes it needs. Rule-based, no AI, and we do not save your resume.
- H1: Free resume check: score your resume in a minute

### `/glossary`

- Title: Layoff and Job Search Glossary: Plain Definitions
- Description: Plain definitions of WARN notice, reduction in force, severance, COBRA, outplacement, executive recruiter, reverse recruiter, ATS and more layoff terms.
- H1: Layoff and job search glossary

### `/events`

- Title: Job Fairs and Business Events Near You, by State
- Description: Upcoming job fairs, hiring events, career workshops, small-business counseling and startup events from chambers, workforce boards, SBDCs, SCORE, colleges and cities.
- H1: Job fairs and business events near you

### `/places`

- Title: Local Job Markets: Every State, County and City
- Description: Jobs, layoff notices, largest employers, colleges, workforce boards and American Job Centers for every U.S. state, county and city we cover.
- H1: Local job markets

### `/industries`

- Title: Jobs by Industry: Openings, Conferences and Layoffs
- Description: Every industry NextChapter tracks: open jobs, upcoming conferences, recent layoff notices, industry associations and the job functions inside it.
- H1: Industries: jobs, conferences and layoffs

### `/functions`

- Title: Jobs by Function: Finance, Engineering, Marketing and More
- Description: Every job function NextChapter tracks, from finance and engineering to marketing and legal: open jobs, conferences, associations and the industries that hire.
- H1: Job functions: jobs, conferences and layoffs

### `/conferences`

- Title: Conferences and Trade Shows: Dates, Costs and Speaking
- Description: Conferences, trade shows and summits by industry and function: dates, costs, calls for speakers, the associations that run them and the employers worth meeting.
- H1: Conferences and trade shows

### `/associations`

- Title: Industry Associations and Conference Organizers
- Description: Industry associations and event organizers that run two or more conferences in the NextChapter catalog, with their dates, costs and calls for speakers.
- H1: Industry associations and conference organizers

### `/salaries`

- Title: Salary by Job Title: Median and Pay Range
- Description: What professional jobs pay, from current listings that state a pay range: the median and middle half for each job title, annual in US dollars.
- H1: Salary by job title

### `/jobs/title`

- Title: Jobs by Title: Open Professional Roles
- Description: Open professional jobs by job title, from employers’ own career sites and checked to still be open, with pay where listed.
- H1: Jobs by title

### `/coaching`

- Title: Career Coach: Free AI Coach and a Human Executive Coach
- Description: Get a free AI career coach, Victoria, and add a human executive and professional career coach matched to your background and target role. Waitlist open.
- H1: Career coach: a free AI coach, and a human executive coach when you want one

### `/topics/laid-off-over-40`

- Title: Laid Off at 40, 50 or Older: What to Do Next
- Description: Laid off later in a career? The protections that apply at 40 and older, how to run the search through your network, and how to show your skills are current.

### `/topics/laid-off-no-savings`

- Title: Laid Off With No Savings: What to Do First
- Description: Laid off with little saved? Start income, protect your health coverage, cut costs and find programs that pay for what you need, in the right order.

### `/topics/explain-a-layoff`

- Title: How to Explain a Layoff in an Interview
- Description: Say it in two sentences: the role was eliminated, what you delivered, what you want next. A simple structure, what to avoid, and what to say if you were fired.

### `/topics/what-to-say-when-laid-off`

- Title: What to Say When You Get Laid Off: Scripts and Questions
- Description: Word-for-word lines for the layoff meeting, the questions to ask before you leave the room, what not to say, how to ask for better terms and the first 24 hours.

### `/topics/acquisition-layoffs`

- Title: Layoffs After an Acquisition: What to Expect and Ask
- Description: Why roles are cut after a deal, how the timing usually runs, the questions to ask your manager and HR, and what to do now to protect your severance and your options.

### `/topics/should-i-take-the-buyout`

- Title: Should I Take the Buyout? What to Weigh Before You Answer
- Description: What a voluntary buyout is, the answers to get in writing, a simple way to compare it with staying, when it makes sense and how to ask for more time or money.

### `/topics/fired-vs-laid-off`

- Title: Fired vs Laid Off: The Difference and Why It Matters
- Description: How a layoff differs from a firing, what each means for unemployment, severance and COBRA, what the paperwork should say and how to explain either in an interview.

### `/topics/how-to-lay-off-employees`

- Title: How to Lay Off Employees: A Checklist for Employers
- Description: A layoff checklist for employers: check WARN notice, choose roles by documented criteria, run the conversations plainly and support the people leaving.

### `/topics/cover-letter-tips`

- Title: Cover Letter Tips for Experienced Professionals
- Description: A good cover letter is short: why this role, two results that match it and what you will do first. When to write one and how to explain a change or a layoff.

### `/topics/executive-recruiters`

- Title: Executive Recruiters: How to Work With Search Firms
- Description: How executive recruiters and search firms work, how retained and contingent recruiters differ, and how to get in front of the right ones when you are job searching.

### `/topics/reverse-recruiter`

- Title: Reverse Recruiter: What It Is and How It Compares
- Description: A reverse recruiter represents the job seeker instead of the employer. What they do, how they charge, what to ask, and how it compares with recruiters and coaches.

### `/topics/resume-review`

- Title: Free Resume Review: What to Check and Where to Get One
- Description: How to review your resume yourself in fifteen minutes, where to get a free outside review, and what a good review should tell you before you apply.

### `/topics/interview-questions-and-answers`

- Title: Common Interview Questions and How to Answer Them
- Description: The interview questions experienced professionals get most, how to answer each in under two minutes, a structure for behavioral questions and what to ask back.

### `/topics/career-advice`

- Title: Career Advice for Experienced Professionals
- Description: Practical career advice for experienced professionals: know your market, keep proof of your results current, stay connected and decide when to stay or move.

### `/topics/problems-at-work`

- Title: Problems at Work: Difficult Boss, Burnout, Passed Over
- Description: What to do about a difficult boss, burnout, a micromanager or a missed promotion: document it, talk first, use the formal channel and line up options early.

### `/topics/what-is-a-job-transition-platform`

- Title: What Is a Job Transition Platform? A Plain Definition
- Description: A job transition platform helps people move from one job to the next after a layoff or career change. What it includes, who pays for it and how to choose one.

### `/topics/job-transition-platforms-for-laid-off-professionals`

- Title: Job Transition Platforms for Laid-Off Professionals
- Description: If your severance offers outplacement, use it first. Then free public help, then free-to-start tools. How the options compare and how to choose between them.

### `/topics/what-is-outplacement`

- Title: What Is Outplacement? What It Includes and How to Get It
- Description: Outplacement is job search help an employer pays for when it ends your job. What it includes, how to ask HR for it and what to do if it is not offered.

### `/topics/career-test`

- Title: Career Test: How to Find the Right Next Career
- Description: A career test can suggest jobs to explore, but it cannot tell you what employers will hire you for. How to use one, a free option and how to check the market.

### `/topics/resume-examples`

- Title: Resume Examples for Experienced Professionals
- Description: Before-and-after resume bullet and summary examples for experienced professionals, how to write a layoff line and how to check your own resume for free.
- H1: Resume examples for experienced professionals: before and after

### `/topics/how-to-choose-a-career-coach`

- Title: How to Choose a Career Coach: AI or Human
- Description: Choose a career coach by what you need: a plan, accountability, interview practice or a career change. AI or human, what to ask and what to avoid.

### `/submit-resume`

- Title: Submit Your Resume to Recruiters: Free, No Signup
- Description: Send your resume and we will pass strong matches along to recruiters and search firms in our network. Free, no obligation, and no need to sign up first.
- H1: Submit your resume to recruiters

### `/scam-watch`

- Title: Fake Recruiter and Job Offer Scams: How to Spot Them
- Description: Fake recruiters and fake job offers target people who are job hunting. NextChapter checks recruiter emails in your connected Gmail and flags the ones that look fake.

### `/for-managers/give-a-reference`

- Title: Give a Reference for an Employee You Let Go
- Description: You just let someone great go. Leave a reference while it is fresh so they can show future employers what they did and how they worked.
- H1: Give a reference for someone you let go

### `/outplacement`

- Title: Outplacement Services for Employers and HR Teams
- Description: Outplacement for departing employees: a Dossier each person keeps, reporting in counts for HR and a compliance record for each seat for legal. Set up by contract.

### `/vs`

- Title: Outplacement Providers Compared: LHH, RiseSmart and More
- Description: Side-by-side comparisons of NextChapter with LHH, Randstad RiseSmart, Careerminds and INTOO, and the questions to ask each outplacement vendor.

### `/rfp-template`

- Title: Outplacement RFP Template and Vendor Scorecard
- Description: A free, vendor-neutral outplacement RFP template and scorecard: eight questions that separate a real evaluation from a sales pitch.

### `/insights`

- Title: Outplacement Insights for HR Buyers
- Description: The questions to ask an outplacement vendor, what an outplacement report should show, and what happens to your account when the contract ends.

### `/employers`

- Title: Employer Solutions: Hiring, Employee Development, Outplacement
- Description: NextChapter for employers, by stage of the employee lifecycle: Hiring for future employees, Employees for current ones, and Outplacement for people who are leaving.

### `/employees`

- Title: Employee Development and Retention for HR Teams
- Description: Give current employees promotion and raise preparation, internal roles and a skills plan that starts with your courses. HR sees counts by team, never by person.

### `/talent`

- Title: Hire Experienced Professionals: Post a Role Free
- Description: Post a role and see candidates who chose to be seen, matched on what they say they want, with an evidence brief for each. Names stay private until they agree.

### `/recruiters`

- Title: Candidate Search for Recruiters and Search Firms
- Description: Search candidates who chose to be found, ask for an introduction, and submit a packet in your firm’s logo built from the candidate’s Dossier. Free for now.

### `/submit-search`

- Title: Send Us a Search: Screened Shortlist of Candidates
- Description: Recruiters and employers: send NextChapter an open or confidential search. We return a screened shortlist of members at the right level within days. Free.
- H1: Send us a search

### `/coaches`

- Title: Client Workspace Software for Career Coaches
- Description: Invite clients with a code, see what each chooses to share, get a pre-session brief and keep session notes in one place, under your practice’s name. Free for now.

### `/higher-education`

- Title: Alumni and Student Career Services for Colleges
- Description: Claim your institution’s page with a work email at your domain. A free workspace gives career services and alumni relations a page, services and basic counts.

### `/government-workforce`

- Title: Workforce Board Workspace for Job Seeker Services
- Description: Claim your organization’s page with a work email at your domain. A free workspace gives workforce boards and chambers a page, services and basic counts.

### `/workforce-boards`

- Title: Workforce Development Boards and Job Centers by State
- Description: Every local workforce development board and American Job Center by state: counties served, local unemployment, nearby colleges and recent layoff notices.

### `/nonprofits`

- Title: Workspace for Nonprofits Serving Job Seekers
- Description: Claim your organization’s page with a work email at your domain. A free workspace gives your nonprofit its own page, services and basic counts.

### `/for-organizations`

- Title: NextChapter for Organizations: Colleges, Employers, Recruiters
- Description: Portals for colleges, workforce organizations, employers, recruiters and coaches. Each has its own page, its own plans and its own log in.

