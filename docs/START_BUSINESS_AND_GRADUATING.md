# Starting a business, and the about-to-graduate plan

Defined 2026-10-23. Journeys stay at twelve: neither is a new journey.

## Starting a business

Code: `src/lib/journey/start-business.ts` (pure), page `src/app/dashboard/start-a-business/`, tabs
`src/components/dashboard/start/StartTabs.tsx`. Tests: `src/test/start-business.test.ts`.

It is the plan behind two things that already existed: the journey **Building something of my own** (`ENTREPRENEUR`) and the parallel
path **Starting a business** (`src/lib/journey/paths.ts`). Stage and answers live in `journeyDetails.start`, so they survive a change of
journey and run next to a job or a job search. The shared journey stage is not touched (a builder keeps their career plan).

**Five steps:** idea, validate, build, launch, grow. Each has a goal, a first step and a plan. Traction suggests the stage
(no customers, talked to buyers, first paying customers, steady revenue); the member's own stage wins. The weekly plan carries the
stage's steps (at most three) and a runway step when runway is six months or less.

**What we ask, and what we already know:** four questions (customers, kind of business, alone or with others, how it will be funded),
two at a time with the reason first. Not asked again: the venture itself (`journeyDetails.venture`), months of runway
(`runwayMonths`) and hours a week (`hoursAvailable`). They are shown as known.

**Where to get help** (links checked 2026-10-23; we link to public and free programs and have no relationship with any of them):

| Group | What |
| --- | --- |
| Start with your school | Who to ask at the school (career center, business or engineering school, research or tech transfer office, alumni office), a search built from the member's school for its entrepreneurship center, and [NSF I-Corps](https://new.nsf.gov/funding/initiatives/i-corps) for technical founders |
| Free local help | [SBDC](https://americassbdc.org/), [SCORE](https://www.score.org/), [SBA local help](https://www.sba.gov/local-assistance) (Women's Business Centers, Veterans Business Outreach Centers), [SBA 10 steps](https://www.sba.gov/business-guide/10-steps-start-your-business), [Boots to Business](https://bootstobusiness.sba.gov/), [local chamber](https://www.uschamber.com/co) |
| Incubators and accelerators | [INBIA](https://www.inbia.org/) incubator directory, [Y Combinator](https://www.ycombinator.com/apply), [Techstars](https://www.techstars.com/accelerators), [Venture Café](https://venturecafeglobal.org/), [F6S](https://www.f6s.com/) |
| Programs for owners already in business | [Goldman Sachs 10,000 Small Businesses](https://10ksbapply.com/program-details/) (eligibility is on the program page and varies by place), [SBA Learning Platform](https://learning.sba.gov/) |
| Money | [SBA microloans](https://www.sba.gov/funding-programs/loans/microloans), [SBIR and STTR](https://www.sbir.gov/), Funding you qualify for on NextChapter |

Help is ordered by the member's stage and kind of business (technology-only programs do not lead for a local shop).

**Partners, later.** The Get help tab is the structure for pointing members to partners at each step. Nothing is sent to any of them and no
referral arrangement exists; if we grow into partnerships, this is where they would sit.

Analytics: `start_business_page_viewed`, `_started`, `_intake_saved`, `_stage_changed`, `_resource_clicked` (kind, id, stage), `_tab_opened`.

## The about-to-graduate plan

Code: `src/lib/early-career/graduation-plan.ts` (pure), section `src/components/dashboard/early-career/GraduationPlan.tsx` on
`/dashboard/early-career`. Tests: `src/test/graduation-plan.test.ts`.

For students and new grads, timed to the graduation date (from the school entry): more than a year out, 6 to 12 months, under 6
months, graduated. No date counts as 6 to 12 months out. Three tracks in every phase:

- **Position yourself:** a one-line story, a résumé built from projects, coursework, clubs and campus jobs, LinkedIn, interview practice.
- **Use your school's network:** the career center, alumni (a short note as a student asking for 15 minutes), professors who can introduce,
  career fairs and recruiting events, and after graduation how long career services and the alumni network stay open.
- **Build proof, for a student with no job:** lead a club or class project, turn a project into a résumé line with a result, an internship,
  or a small real project to show.

A short list of who at school can help (career center, alumni directory, professors, clubs, class projects and capstones, campus jobs
and research, the entrepreneurship center) and a note to an alum to start from. The member edits and sends it; we send nothing.

The weekly plan gets one positioning or network step and one proof step for the phase, rotating (only a lead step once applying).

**What it adds and removes:** adds one section to the early-career page and moves "Starting pay" behind Show more for new grads.

Analytics: `graduation_step_clicked` (step, phase, track), `graduation_plan_more_opened`.

## Cost

Static. No model calls and nothing metered.
