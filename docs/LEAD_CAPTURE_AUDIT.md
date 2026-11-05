# Lead capture audit: pain and payoff

Started 2026-11-04 at the owner's direction: every lead capture says the pain the reader has and the payoff they get, in plain words
(no "WARN", no product names in the headline). Button labels are the action: "Get my ...", "Start my ...", "Show me ...".

Copy lives in `src/lib/capture/pull-copy.ts` (the navy `NextStepBox` on every public page) and is picked by the page's first folder.

## Done in this pass

| Where | Before | After |
|---|---|---|
| `NextStepBox` default (every public page) | "See where you stand in the market today" | "Applying and hearing nothing back?" Button stays the tested assessment label |
| `NextStepBox` on `/layoffs/*`, `/unemployment-benefits/*`, `/start/*` | same as default | "Just got laid off? Do not spend week one guessing." / "Get my laid-off game plan" |
| `NextStepBox` on `/salaries/*` | default | "Not sure you are paid what you are worth?" / "Show me what I am worth" |
| `NextStepBox` on `/ai-skills`, `/ai-job-check` | default | "Worried a computer could take your job?" / "Start my AI-proof plan" |
| "Not ready?" link | "Get a first-week plan by email instead." | "Email me a first-week plan instead." |
| `JourneyPicker` step 4 box | assessment headline | same pain copy (laid-off version when that situation was picked) |
| Network join headline (role, function, industry pages) | "Are you a CRO? Join your peers." | "Job hunting as a CRO? Do not do it alone." |
| Nine seeker tool pages (`ActionBand`) | "Get my free assessment" everywhere | one pain headline and one action button per tool |
| `/layoffs/this-week` page | "new WARN notices", "workers named" | plain headline and intro, "people", one line that explains WARN |
| Weekly roundup (LinkedIn, email, press pitch) and the two automated social roundups | "state WARN filings ... naming N workers" | "N people found out this week that they are losing their jobs", a laid-off ask, hashtags (posts only) |

## Held for the owner

- **The nav button test** (`src/lib/ab/nav-cta.ts`, started 2026-11-03) rewrites any label containing "assessment". The default box keeps that label so the test
  stays clean. The pain buttons ("Get my laid-off game plan" and the others) are outside the test, so they are not measured against the four arms. Decide whether
  to add them as arms or end the test.
- Hashtags are on the roundup posts only. `src/lib/social/validate.ts` still rejects hashtags in model-written posts; change that rule if the owner wants them there too.

## Done in the second pass (2026-11-04)

| Where | After |
|---|---|
| Home footer and shared site footer band | "Still guessing why nobody calls back?" / "Still guessing what to do next?" (buttons stay on the tested label) |
| Follow-by-email boxes on topic pages (`saveCopy`) | "Tired of checking job boards every day?" / "Email me new jobs"; company, college and place pages have their own pain line |
| Résumé check (`FitCheck`) | "Want a real read on your résumé?" / "Send me my résumé read" |
| Layoff risk check result, COBRA vs ACA pages | "Get my job-safety plan", "Get my laid-off game plan" |
| Workforce board candidate band | "Not sure you match what employers here are hiring for?" / "Show me jobs near me" |
| AI exposure section, free AI tools | "Start my AI-proof plan"; "Sending applications and hearing nothing?" / "Show me jobs that fit me" |
| Layoff alert and deadline emails | Buttons "Get my laid-off game plan", "Get my deadlines and first week" |

## Left as they are, on purpose

- Site header button, home hero button, picker "Or start now" button, the journey-plan email button: these are the four-arm label test.
- Lifecycle email subjects: already questions about the reader's pain ("Heard back about your application?").
- Layoff company page answers (`Q1`): already pain-first.
- Organization asks (`OwnerInquiry`, `/for-organizations`, outplacement bands): an employer's pain needs the owner's wording and must not promise anything the company is not required to provide.

## Closed out (2026-11-05)

- **"People", not "workers":** every layoff page that shows a headcount (this week, state, month, week) now says "people". The WARN Act's own "100 or more workers" rule is unchanged. Page titles keep "Workers" for search.
- **Hashtags on model-written posts:** `withHashtags` (`src/lib/social/tags.ts`) adds the topic's tags in code after a draft passes the check, only when they fit the channel limit. The writer still may not write hashtags, so it cannot invent one.
- **Employer asks:** the organization box asks a pain question ("Hiring in {industry} and not seeing enough experienced applicants?") and the button reads "Show me how it works". The text of what they get is unchanged, so it promises nothing new.
- **Nav button test:** left as it is. Adding arms to a test that started 2026-11-03 would change who sees what mid-run. The pain buttons are measured by the `copy` property on `pull_cta_clicked`; compare click-through by it in PostHog, then fold the winner into the test or end it.

## One ask per page (2026-11-05)

Crawled 130 live pages, two from each kind of page in the sitemap, counting links into the assessment flow outside the header. 15 had two or more. Fixed:

| Page | Was | Now |
|---|---|---|
| `/layoffs/<state>` | navy box + red state band | the box; the "independent page" line stays as a note |
| `/layoffs/company/<slug>` | band + "Build my free plan" + footer band | the page's own journey form |
| Nine seeker tool pages, severance pages | box + bottom band or button | the box, with tool-specific copy (`BY_PREFIX` in `pull-copy.ts`) |
| `/topics/<slug>` | box + band pointing at the assessment | the box (bands that point elsewhere stay) |
| `/about`, `/ai-skills`, `/funding`, `/scam-watch` | own ask + footer band | own ask |
| `/how-it-works`, `/funding` | box or hero + a repeat at the bottom | one |
| Home | hero + funding + AI section + footer | hero |

Left as they are: `/why-stuck` (twelve links are the page's chooser), the follow and deadline email boxes (a different capture), the header button.

The box is smaller (less padding, the "Not ready?" link sits under the sentence, not on its own row) so page content starts higher. Guard: `src/test/one-ask-per-page.test.ts`.

The wider crawl after the merge (220 pages, five per kind) found nine more: the AI job check detail and compare pages carried their own "Get my free assessment" button beside the box. Removed; the box has the AI copy for them.

## Organization ask (2026-11-05)

The organization box (workforce boards, rapid response, colleges, search firms, the WARN tools) used to say "Do you run this, hire for it or serve these people?". Now:

- **Most organization pages:** "Hard to reach experienced job seekers where they already look?" / "Get your own page and your own numbers on NextChapter. A short call shows how."
- **Rapid response and the WARN tools:** "A layoff is coming and the people affected have nowhere to start?" / "Send them one link to a job search plan, local jobs and career support. A short call shows how."
- The button stays "Talk to us": organization plans are sold by contract. No placement-rate, speed or price wording (`docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md`).

Directory pages (workforce boards, job centers, economic development; `OrgPageView`): the organization box now opens the page and the job seeker band (the page's second ask, for a different audience) is gone. The "independent page, not run by or affiliated with" line and the connected-people count stay as a note under the box. The box was at 4,661px on a workforce board page before.

## Organization button (2026-11-05, owner direction)

No "Talk to us". Where an organization can claim a page and get a free workspace (workforce boards, job centers, economic development, rapid response, nonprofits, colleges): "Give the platform to your job seekers, free." / "Start here, free", and the button starts the claim (`/government-workforce#claim`, `/nonprofits#claim`, `/higher-education#claim`). Other organizations: the pain headline and "Start here" to the contact form. Employers on the WARN tools: "Start here" to `/outplacement`, with no "free", because outplacement is set up by contract.
