# Where everything is on the candidate site

Checked against the code on 2026-10-17: all 89 candidate pages, how a member reaches each one,
and what is buried. Addresses are on https://launchyournextchapter.com. "Menu" means you can
reach it from the left menu or the row of tabs at the top of the page. "Only a link" means the
only way in is a link inside another page.

## The honest summary

- **The live site has no timeline page.** One is built on another branch (see the end of this document). Nothing on the live site lists a member's search history in order.
  The Progress page (https://launchyournextchapter.com/dashboard/stats) holds weekly market
  grades, mood over time, effort, badges and leaderboards, but not applications, contacts,
  coaching sessions or stage changes. The database table for stage changes exists and is empty.
- **The "career explorer" is Pivot paths:** https://launchyournextchapter.com/dashboard/pivot-paths
  ("Explore other roles"): occupations close to yours with pay, growth, skills in common, gaps,
  funded training and local openings. Its data is loaded in production. Courses are not tagged to
  skills, so its course matches are empty.
- **Nothing is fully orphaned**, but about 25 features are only reachable from a link inside another
  page. The most valuable buried ones are marked below.

## Home

| Page | What it does | How to reach it |
|---|---|---|
| https://launchyournextchapter.com/dashboard | Today: the one note, weekly plan, jobs, network, unlocks | Menu: Home, Today |
| https://launchyournextchapter.com/dashboard/stats | Progress: stats, badges, leaderboards, weekly market grade history, mood, effort | Menu: Home, Progress |
| https://launchyournextchapter.com/dashboard/complete-profile | Checklist to finish your profile | Only a prompt on Home |

## Jobs

| Page | What it does | How to reach it |
|---|---|---|
| https://launchyournextchapter.com/dashboard/find-my-job | Job board, My jobs tracker (`?tab=my_jobs`), independent work toolkit | Menu: Jobs, Find a job |
| https://launchyournextchapter.com/dashboard/jobs/ID | One job with the apply kit | Only a link from a job card or an email |
| https://launchyournextchapter.com/dashboard/alumni-jobs | Jobs from your school and employer groups | Menu: Jobs, From my groups |
| https://launchyournextchapter.com/dashboard/early-career | Early career plan (students and up to 5 years in) | Menu, only for those members |
| https://launchyournextchapter.com/dashboard/companies | Company directory and tracker | Menu: Jobs, Companies |
| https://launchyournextchapter.com/dashboard/market | Your job market overview | Menu: Jobs, Market |
| https://launchyournextchapter.com/dashboard/market-reality | Graded Market Reality Report (**buried**) | Only a link inside Market, the top strip and a Home message |
| https://launchyournextchapter.com/dashboard/market-intelligence | Market Intelligence report (**buried**) | Only a link inside Market and company pages |
| https://launchyournextchapter.com/dashboard/pay | Know your worth: pay benchmarks | Menu: Jobs, Know your worth |
| https://launchyournextchapter.com/dashboard/local-market | Your local market | Menu: Jobs, Local market |
| https://launchyournextchapter.com/dashboard/pivot-paths | Pivot paths, the career explorer | Menu: Jobs, Pivot paths |
| https://launchyournextchapter.com/dashboard/interview-prep | Interview prep | Menu: Jobs, Interview prep |
| https://launchyournextchapter.com/dashboard/review-prep | Build your case for a review or raise | Menu: Jobs, Build your case |
| https://launchyournextchapter.com/dashboard/in-work | Reviews, raises, promotion | Menu, employed members only |
| https://launchyournextchapter.com/dashboard/got-hired | Report an offer or a hire | Menu: Jobs, Got an offer |
| https://launchyournextchapter.com/dashboard/internal-roles | Open roles inside your own company | Only a card on Home (staff programs) |
| https://launchyournextchapter.com/dashboard/company-courses | Courses your company sponsors | Only a card on Home (staff programs) |

## Network

| Page | What it does | How to reach it |
|---|---|---|
| https://launchyournextchapter.com/dashboard/network | Outreach stats, Gmail and calendar tracking | Menu: Network, This week |
| https://launchyournextchapter.com/dashboard/network/this-week | This week's outreach plan with hooks and asks (**buried**) | Only one link inside the Network page |
| https://launchyournextchapter.com/dashboard/network/follow-ups | Follow-ups due (**buried**) | Only the daily email and the marketing plan |
| https://launchyournextchapter.com/dashboard/network/contacts | Contacts | Menu: Network, Contacts |
| https://launchyournextchapter.com/dashboard/references | References | Menu: Network, References |
| https://launchyournextchapter.com/dashboard/work-samples | Work samples | Only a link from References and Portfolio |
| https://launchyournextchapter.com/dashboard/community | Community feed, groups, messages | Menu: Network, Community |
| https://launchyournextchapter.com/dashboard/supporters | My supporters | Menu: Network, My supporters |
| https://launchyournextchapter.com/dashboard/groups | My groups (schools, programs) | Menu: Network, My groups |
| https://launchyournextchapter.com/dashboard/universities | Schools you attended | Only a link from My groups |
| https://launchyournextchapter.com/dashboard/past-jobs | Past jobs and alumni reviews | Only a link from Find a job and My groups |
| https://launchyournextchapter.com/dashboard/my-coaching | Your coach, sessions left, redeem a code | Menu: Network, Coaching (Premium page without access) |
| https://launchyournextchapter.com/dashboard/book-session, coaching-match, coaching-form, coach-dossier | Book a session, get matched, intake form, what your coach sees (**buried**) | Only links inside Coaching |
| https://launchyournextchapter.com/dashboard/recruiter-requests | Recruiter requests | Menu: Network, Recruiters (paid) |

## Learn

| Page | What it does | How to reach it |
|---|---|---|
| https://launchyournextchapter.com/dashboard/learning | Learn new skills | Menu: Learn |
| https://launchyournextchapter.com/dashboard/webinars | Videos and webinars | Menu: Learn |

## Personalize

| Page | What it does | How to reach it |
|---|---|---|
| https://launchyournextchapter.com/dashboard/strengths | My story: why hire me | Menu: Personalize, My story |
| https://launchyournextchapter.com/dashboard/track-record, how-i-perform | Track record, How I Perform assessment (**buried**) | Only links from My story and the assessments hub |
| https://launchyournextchapter.com/dashboard/profile | My profile | Menu: Personalize, My profile |
| https://launchyournextchapter.com/dashboard/resume | Résumé | Only a link inside My profile |
| https://launchyournextchapter.com/dashboard/resume/studio | Résumé studio: drafts per target role, writing checks, keyword check (**buried, valuable**) | Only a link from the Résumé page |
| https://launchyournextchapter.com/dashboard/resume/walkthrough | Résumé review walkthrough (**buried**) | Only links from résumé versions |
| https://launchyournextchapter.com/dashboard/linkedin, portfolio | LinkedIn and headshot, Portfolio | Only links inside My profile |
| https://launchyournextchapter.com/dashboard/skills-assessments | Skills and behavioral assessments hub | Menu: Personalize, My work profile |
| https://launchyournextchapter.com/dashboard/skills-assessment, retake-assessment, work-interests | Skills inventory, How I Work Best, work interests (**buried**) | Only links inside the hub |
| https://launchyournextchapter.com/dashboard/search-strategy | Search strategy | Menu: Personalize, My search |
| https://launchyournextchapter.com/dashboard/what-i-need, marketing-plan | What I need, My marketing plan (**buried**) | Only links inside My search, Pay and Portfolio |
| https://launchyournextchapter.com/dashboard/recruiter-report | What recruiters see | Menu: Personalize, For recruiters |
| https://launchyournextchapter.com/dashboard/privacy | Privacy, your journey, recruiter opt-in, delete account | Only a link inside For recruiters, and many others |
| https://launchyournextchapter.com/dashboard/documents | Documents your coach requests | Menu: Personalize, Documents |
| https://launchyournextchapter.com/dashboard/membership | Membership and plans | Menu: Personalize, Membership |

## Help

| Page | What it does | How to reach it |
|---|---|---|
| https://launchyournextchapter.com/dashboard/support | Support during transition | Menu: Help |
| https://launchyournextchapter.com/dashboard/benefits | Benefits and financial bridge | Menu: Help, Money and benefits |
| https://launchyournextchapter.com/dashboard/benefits-network | Higher Education Benefits Network | Only a link from Benefits |
| https://launchyournextchapter.com/dashboard/scam-watch | Scam watch | Menu: Help |
| https://launchyournextchapter.com/dashboard/help | Questions and feedback | Menu: Help |

## Pages that only redirect (safe to delete once links are updated)

job-board, job-discovery, job-fit, interim-work, company-tracker, circle, pivot, plans, sprint,
messages (the "Inbox" tab), email-activity, calendar-activity.

## Pages that overlap (candidates to merge in the redo)

- Network overview, This week and Follow-ups: three views of one weekly job.
- Market, Market Reality, Market Intelligence and Local market: four market reports.
- The assessment cluster: skills assessments, inventory, How I Work Best, How I Perform, Track record, Work interests, What I need.
- My story, For recruiters, Portfolio, Marketing plan and the coach dossier all present you to others.
- Coaching: my coaching, book, match and intake could be one stepped page.
- Benefits and Benefits Network. Support and Help. Membership and Premium.
- Groups, Universities, Past jobs and From my groups.
- Résumé, Résumé studio and Walkthrough.

## Built on other branches, not live yet

- **Your career story** (timeline of school, work, ventures, pauses and learning, doors you could open,
  a pause what-if, people like you): https://launchyournextchapter.com/dashboard/my-career, tab
  "Career timeline" under Personalize. Branch `claude/compassionate-edison-fkfdu5`. Needs
  `prisma/manual/2026-10-17-career-events.sql` applied before it works fully.
- **What would it take** (a pathway map with cost, time, challenges and alternatives) and **Thinking about
  a pivot**: same branch.
