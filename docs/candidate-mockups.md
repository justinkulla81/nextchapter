# Candidate mockups: every screen and what it replaces

Sample data only. Dev-only preview (run the app locally, open `/dev-preview`). Nothing here is wired to real data.
Each row is one proposed screen and the live pages it absorbs. The Personalize place is gone: its pages moved into Jobs (Get ready to apply), Learn (Know yourself, Your path), Network, Account and privacy, and the Improve your search page and the question flows. Finances and benefits is a new place, shown only when the member chooses money help. The career story is the real page from the career story session, fed sample data.

| Place | Screen | Replaces |
|---|---|---|
| Home | Your week (`/dev-preview/home/today`) | /dashboard |
| Home | Effort and results: what you’ve built (`/dev-preview/home/progress/built`) | /dashboard/stats (badges and leaderboards removed) |
| Home | Effort and results: your search timeline (`/dev-preview/home/progress/timeline`) | new |
| Network | Your network: all circles (`/dev-preview/network/circles/overview`) | /dashboard/network |
| Network | Close circle (`/dev-preview/network/circles/close`) | /dashboard/supporters, /dashboard/my-coaching |
| Jobs | Find a job: list and detail (`/dev-preview/jobs/find/jobs`) | /dashboard/find-my-job, /dashboard/jobs/ID |
| Jobs | Find a job: not posted yet (`/dev-preview/jobs/find/unposted`) | Likely openings on /dashboard/find-my-job |
| Jobs | Find a job: independent work (`/dev-preview/jobs/find/independent`) | Independent work toolkit on /dashboard/find-my-job |
| Jobs | Find a job: resources (`/dev-preview/jobs/find/resources`) | Job boards, résumé book, guides on /dashboard/find-my-job |
| Jobs | My jobs (`/dev-preview/jobs/mine`) | /dashboard/find-my-job?tab=my_jobs |
| Jobs | Companies (`/dev-preview/jobs/companies`) | /dashboard/companies, /dashboard/company-tracker |
| Jobs | Company profile (`/dev-preview/jobs/companies/profile`) | /dashboard/companies/[slug] |
| Jobs | Market: your market (`/dev-preview/jobs/market/market`) | /dashboard/market, market-reality, market-intelligence |
| Jobs | Market: know your worth (`/dev-preview/jobs/market/pay`) | /dashboard/pay |
| Jobs | Market: local market (`/dev-preview/jobs/market/local`) | /dashboard/local-market |
| Learn | Market: other roles you could do (`/dev-preview/learn/path/roles`) | /dashboard/pivot-paths, /dashboard/pivot |
| Jobs | Interviews (`/dev-preview/jobs/interviews`) | /dashboard/interview-prep, /dashboard/review-prep |
| Jobs | Offers (`/dev-preview/jobs/offers`) | /dashboard/got-hired, /dashboard/in-work |
| Network | People you know (`/dev-preview/network/circles/know`) | /dashboard/network/contacts, /dashboard/references |
| Network | Alumni and groups (`/dev-preview/network/circles/alumni`) | /dashboard/groups, /dashboard/universities, /dashboard/past-jobs |
| Network | Industry and function (`/dev-preview/network/circles/industry`) | /dashboard/community |
| Network | Recruiters (`/dev-preview/network/circles/recruiters`) | /dashboard/recruiter-requests |
| Network | This week (`/dev-preview/network/week`) | /dashboard/network/this-week, /dashboard/network/follow-ups |
| Network | Messages (`/dev-preview/network/messages`) | /dashboard/messages |
| Learn | Skills and courses (`/dev-preview/learn/learn/skills`) | /dashboard/learning |
| Learn | Videos and webinars (`/dev-preview/learn/learn/videos`) | /dashboard/webinars |
| Account | Profile (`/dev-preview/account/profile`) | /dashboard/profile, complete-profile |
| Jobs | Résumé (`/dev-preview/jobs/apply/resume`) | /dashboard/resume, resume/studio, resume/walkthrough |
| Jobs | Why hire me (`/dev-preview/jobs/apply/whyhire`) | /dashboard/strengths, track-record |
| Learn | Career story (`/dev-preview/learn/path/story`) | /dashboard/my-career (the real page, sample data) |
| Learn | How I work (`/dev-preview/learn/know`) | /dashboard/skills-assessments, how-i-perform, work-interests |
| Account | What recruiters see (`/dev-preview/account/visibility`) | /dashboard/recruiter-report, privacy |
| Account | Documents (`/dev-preview/account/documents`) | /dashboard/documents |
| Account | Membership (`/dev-preview/account/membership`) | /dashboard/membership |
| Help | Talk to someone (`/dev-preview/help/talk`) | /dashboard/support |
| Help | Scam watch (`/dev-preview/help/scams`) | /dashboard/scam-watch |
| Help | Questions and feedback (`/dev-preview/help/questions`) | /dashboard/help |
| Home | Improve your search (`/dev-preview/home/tailored`) | new: every personalization in one place |
| Home | Today: week 4, no interviews, widen the search (`/dev-preview/home/stalled`) | new: time-driven personalization |
| Home | The check-in in three tones (`/dev-preview/home/checkin`) | mood pop-up and Still searching dialog, merged |
| Home | Today: building something of my own (`/dev-preview/home/journey/entrepreneur`) | /dashboard for ENTREPRENEUR |
| Home | Today: taking time off (`/dev-preview/home/journey/time-off`) | /dashboard for TIME_OFF |
| Home | Today: changing careers (`/dev-preview/home/journey/career-change`) | /dashboard for CAREER_CHANGE |
| Home | Today: fractional and independent work (`/dev-preview/home/journey/fractional`) | /dashboard for FRACTIONAL |
| Flows | A question, with the payoff shown (`/dev-preview/flows/tune-question`) | every one-off question on profile, search strategy, and onboarding |
| Flows | The finish: what you just gained (`/dev-preview/flows/tune-done`) | new |
| Flows | A long assessment as short rounds (`/dev-preview/flows/deep-dive`) | How I Work Best (57 items), What I Need (24), Track Record (19) |
| Flows | Receipt: Home bundle (pace and tone) (`/dev-preview/flows/receipt-home`) | new |
| Flows | Receipt: Network bundle (who you want to reach) (`/dev-preview/flows/receipt-network`) | new |
| Moments | You earned Candidate+ (`/dev-preview/moments/candidate-plus`) | the unlock ladder and its locked rungs |
| Moments | The weekly progress email (`/dev-preview/moments/weekly-email`) | the "You just earned new badges" email |
| Moments | Onboarding: which sounds like you (`/dev-preview/moments/onboarding`) | /onboarding situation step |
| Moments | Your first week (`/dev-preview/moments/first-week`) | first-week plan on Home |
| Moments | Empty: no jobs yet (`/dev-preview/moments/empty-jobs`) | Find a job before it can match |
| Moments | Empty: no contacts yet (`/dev-preview/moments/empty-network`) | People you know with no contacts |
| Moments | Empty: first day (`/dev-preview/moments/empty-effort`) | Effort and results on day one |
| Finances and benefits | Your runway (laid off) (`/dev-preview/money/runway`) | /dashboard/benefits (financial bridge) |
| Finances and benefits | Benefits and deadlines (laid off) (`/dev-preview/money/deadlines`) | /dashboard/benefits action plan, benefits-network |
| Finances and benefits | Your runway (building something of my own) (`/dev-preview/money/runway-entrepreneur`) | new |
| Moments | Onboarding: would you like help with money? (`/dev-preview/moments/onboarding-money`) | new |
| Account | Money help (off state) (`/dev-preview/account/money`) | new |
