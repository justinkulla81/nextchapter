# Journey 12: Buy a business

Defined 2026-10-23. Code: `src/lib/journey/buy-business.ts` (all content, pure), page
`src/app/dashboard/buy-a-business/` (tabs in `src/components/dashboard/buy/BuyTabs.tsx`), mockups under
`/dev-preview/learn/buy-a-business/*`. Tests: `src/test/buy-business.test.ts`.

## Who it is for

Someone who wants to own a small business instead of (or as well as) holding a job: laid off and considering it,
employed and planning an exit, a senior leader who wants to own, a veteran, someone with capital and operating skills.

## Runs in parallel with any other journey

Buying is not a replacement for a job search, so it is not only a journey:

- **Alongside** (default): the intake and the buying stage live in `journeyDetails.buy`. The member keeps their main
  journey (laid off, thinking about a move, ...) and its plan, menu and emails. The page is in Learn > Buy a business for everyone.
- **Main journey** (`BUY_BUSINESS`): the weekly plan, menu mode (`BUYING`) and emails follow the purchase. Job-search tools
  are locked, job-listing emails stop (`notLookingNow`), and the plan never asks for applications. The shared journey stage
  follows the buying stage (table below). Switch at any time: "Make buying my main plan" on the page, the situation
  selector in Account and privacy, or the check-in answer "I want to buy a business".

`journeyDetails.buy` is the source of truth for the stage in both modes; the shared stage is kept in step by
`applyJourneyChange` when buying is the main journey.

## Stages

| Buying stage | Shared stage | What the member is doing |
| --- | --- | --- |
| Decide | EXPLORING | Whether buying fits what they want from work and money |
| Get ready | PREPARING | Numbers, target, team (SBDC, SCORE, attorney, CPA), lender pre-qualification |
| Search | APPLYING | Saved searches on marketplaces, calls to brokers, direct notes to owners, five listings a week |
| Evaluate | INTERVIEWING | Meet the owner, three years of returns, own SDE calculation, letter of intent |
| Diligence and close | OFFER | CPA tie-out of P&L to returns and bank, lender package, asset list, handover |
| First 100 days | LANDED | Keep what works, meet staff and top customers, learn the cash cycle, change nothing big |
| Run and improve | STAYING | One number per quarter, owner-dependence, monthly review, written processes |

## Information we collect (the buying profile)

Twelve questions, asked two or three at a time with the reason first, all private (never shown to employers, recruiters,
schools or coaches). A blank answer never clears an earlier one. Each answer is read by something:

| Question | Used for |
| --- | --- |
| Skills (multi) | Fit to industries; coach and report framing |
| Industries (multi) | Orders marketplaces; picks training |
| Main reason to own (own boss, wealth, employers not hiring, need income, keep a business going) | One plain note on the Plan tab; "hiring" and "income" point at interim or fractional work and the job search as a parallel path, because buying takes six months to a year. Asked once: not the same as "What motivates you?" (coaching tone) or What I Need (independence at work) |
| Owner earnings wanted (SDE band) | Orders marketplaces (Baton, Axial, online brokers by size) |
| Cash to invest | Price range the cash supports (SBA 10% rule plus ~5% closing and cushion) |
| How you expect to pay (multi) | Orders financing options; adds the SBA check to the Search plan |
| How involved (hands-on, manager, absentee) | Sets expectations on price and what a lender asks |
| Where | Local brokers and lenders; SBDC |
| When | Weekly pace |
| Alone, partner, investors | Who signs; what a lender looks at |
| Hard parts you are ready for (multi: long hours, personal loan guarantee, lower pay, managing people, selling, paid last) | "Hard parts to plan for": each one not ticked gets a reason and a place to learn. Not scored, not a grit test; grit and conscientiousness already come from what members do (Dossier) |
| Credit score (optional, never nagged) | Pre-qualification steps |

## Where to find businesses (links checked 2026-10-22)

Marketplaces: [BizBuySell](https://www.bizbuysell.com/), [BizQuest](https://www.bizquest.com/), [Baton](https://www.baton.com/),
[DealStream](https://www.dealstream.com/). Search across many: [Kumo](https://www.withkumo.com/) (paid aggregator).
Broker networks: [Transworld](https://www.tworld.com/), [Sunbelt](https://www.sunbeltnetwork.com/),
[VR Business Brokers](https://www.vrbusinessbrokers.com/), [IBBA](https://www.ibba.org/). Online businesses:
[Acquire.com](https://acquire.com/), [Flippa](https://flippa.com/), [Empire Flippers](https://empireflippers.com/),
[Quiet Light](https://quietlight.com/). Buyers with investors: [Searchfunder](https://searchfunder.com/),
[Axial](https://www.axial.net/) (larger deals). Sites that return 403 to automated requests (BizBuySell, BizQuest, Axial,
Quiet Light, DealStream, SCORE, Sunbelt) are well-known public sites and were kept.

## Financing

SBA 7(a) (minimum 10% of total cost from the buyer; a seller note counts only on full standby and for at most half;
the cash cannot be borrowed; SOP 50 10), SBA 504 (real estate and equipment), seller financing and earn-outs, own cash and
home equity (a home equity line does not count toward an SBA lender's required cash), ROBS with a 401(k) or IRA (IRS
treats these as questionable and the plan must file annually), and partners, investors and search funds. Pre-qualification
steps are on the Pay for it tab. SOP 50 10 8.1 takes effect 2026-10-01 for the 504 program; lenders and the SBA site are
the source of truth, and the page says to confirm every figure with a lender and CPA.

## Training

Buy it well: SBDC advising, SCORE mentors, SBA Learning Platform, SBA local assistance, Boots to Business (veterans and
military spouses), Stanford's search fund primer, SBA lender resources, a valuation professional (NACVA), the IRS page on
how a sale price is divided. Run it and improve it: SBA manage-your-business guides, a SCORE mentor for year one, SBDC
advising on cash and pricing, coaching. Podcasts and videos (linked, not affiliated; checked 2026-10-23): Acquiring Minds, ETA Insider (Polsky Center, Chicago Booth), The Found & Funded Podcast, Codie Sanchez and Alex Hormozi on YouTube, and Searchfunder's list of more shows. Books: Buy Then Build (Walker Deibel); HBS Guide to Buying a Small Business
(Ruback and Yudkoff). The stage's items carry a "Good for now" mark.

## Seven checks before signing

Profit and loss against returns and bank deposits; top-five customer share; what the owner does each week; lease
transfer; licences and contracts that transfer; what is owed; seller handover length. Shown under "The whole path".

## Analytics (PostHog)

`buy_business_page_viewed`, `buy_business_started`, `buy_business_intake_saved`, `buy_business_stage_changed`,
`buy_business_made_main_journey`, `buy_business_resource_clicked` (kind, id, stage, href), `buy_business_tab_opened`,
plus button and "show more" opens. `journey_changed` fires as usual when buying is the main journey.

## Cost

Static content. No model calls and nothing metered.

## Partnerships (as of 2026-10-23)

Baton runs referral programs for brokers and M&A firms and a general owner-referral program, and invites other ideas through its contact form; it lists nothing for buyers, lenders, coaches or career platforms. BizBuySell has no public API or affiliate program; it syndicates listings to partner sites by agreement. Kumo has no public partner program. Nothing has been sent to any of them.

## Not built (decided, not forgotten)

A saved list of listings and a deal tracker; broker and lender introductions; a paid course of our own; real-time
listing feeds (Kumo and the marketplaces already do this).
