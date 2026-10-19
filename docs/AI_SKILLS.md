# AI skills

One system: the 24 AI skill items from the 2026-10-16 AI-skills analysis (crawler + live board, boilerplate-filtered, about 86% precise by hand check). It sits beside the O*NET taxonomy (`docs/CAREER_TAXONOMY.md`), which has almost nothing on AI. No model calls anywhere: fixed vocabularies, so nothing here costs money per view.

An older 16-skill draft (`src/lib/ai-skills/`, three levels and three role tiers read from the stored excerpt at view time) was retired on 2026-10-17. Its useful parts were folded in: the Learning page section (rebuilt below), its verified catalog courses (now tagged with the 24 items), and its known limits.

## The 24 items

`src/lib/skills/ai-skills.ts`, three groups:

- **Builder** (build / train / ship AI): ML frameworks, LLM application engineering, RAG and vector search, fine-tuning, model training and deep learning, MLOps, AI evaluation and guardrails, GPU and CUDA, machine learning engineering.
- **Applied** (use AI tools inside a non-AI job): AI tools in daily work, named assistants, prompt design, AI coding assistants, AI agents and agentic workflows, automation platforms, AI-enabled analytics, AI in enterprise apps, creative tools.
- **Leadership** (strategy, adoption, governance): AI strategy, transformation and adoption, responsible AI, AI governance and risk, AI product management, leading AI teams.

Each item has a member-facing label and the aliases that show a member has it (matched against the skills matrix: résumé keywords, confirmed skills, certifications).

## Where the data comes from

- **Postings.** The crawler reads each posting's full text (`~/nextchapter-jobs`, `ncrawl/ai_skills.py`, same ids, with the boilerplate filter) and the import stores `ExclusiveJobPosting.aiSkillGroups`, `aiSkillItems`, `aiToolsNamed`, `aiCertsNamed` (`importAiSkillFields`). The live board was backfilled (`scripts/careers/backfill-ai-skills.ts`). DDL: `prisma/manual/2026-10-17-ai-skills.sql`.
- **Market numbers.** `src/lib/skills/ai-skill-market.data.ts`: static table from the analysis (share asking, posted-pay premium raw and like-for-like, top tools and items per function and function x industry). Always shown raw and controlled together.

## Where members see it

- **Job board: AI / Non-AI / All** (`src/lib/jobs/ai-view.ts`, `ai-view-server.ts`, `AiViewToggle`). AI = the job asks for at least one specific AI skill (`aiSkillGroups` non-empty); Non-AI = none. All is the default. The choice is the `ai` URL parameter (`board-url.ts`), applied as a keep predicate, so it works with search, Narrow / Wide and every other filter. BoardLightRow carries no AI columns, so the board checks membership in a cached set of AI posting ids (partial index `ExclusiveJobPosting_ai_ids_idx`, `prisma/manual/2026-10-17-ai-view-index.sql`). Each button shows how many jobs it would show for this member, with every other filter on (`loadBoardShortlist` `views` / `keptCounts`: one extra in-memory ranking pass per button). Partner-search jobs carry no AI data, so they show under All only. As of 2026-10-17: 27,663 of 368,801 live jobs (7.5%) ask for an AI skill.
- **Skills gap.** A job's gap names its AI asks first (at most 3, most specific first; `jobSkillGap`), and the "Why this job" line names an AI gap. The saved-and-applied skills card (`SkillsGapInsightCard`) marks AI skills; in My jobs it has AI skills / Other skills / All buttons, and on the board it follows the board's AI / Non-AI / All choice. An AI gap links straight to the course tagged for it.
- **Learning: "Skills your best-fit jobs ask for"** (`AiSkillGapSection`, `SkillGapViews`). Across the member's strong and good fits (one vote per employer), each skill those jobs ask for, whether the member shows it, and whether it is an AI skill, with AI skills / Other skills / All buttons. Each AI gap links to the first active catalog course tagged for it.
- **Learn, redesigned (flag on).** The featured and "more" courses can now come from AI gaps (`src/lib/redesign/learn-ai-gap.ts`): an AI skill at least 3 of the member's best-fit employers ask for, not on their profile, with a tagged catalog course, becomes a candidate with the reason "N of M employers… ask for “X”". AI-gap courses sort ahead of the plan's own items in `pickLearnCourses`. Event: `learn_home_viewed` gains `featuredIsAiGap`, `aiGapCourses`.
- **AI review of work samples** (`src/lib/evidence/ai-sample-review.ts`, `-server.ts`, `AiSampleReviewPanel`, `review-actions.ts`). A member asks for a review of one of their AI work samples; `claude-sonnet-5-5` reads what they wrote against the sample type's proof checks and returns, per check, met or not with a one-sentence reason, plus a summary and up to three suggestions. The verdict (Strong / Solid / Needs more detail) is derived by code from the checks, not by the model. It does not verify claims (the UI says so). **Member-only**: never shown to recruiters or employers, never part of the evidence score (`score.ts`) or any ranking. Off except for the owner until `AI_SAMPLE_REVIEW=on` (everyone) or `AI_SAMPLE_REVIEW_EMAILS` (a list) is set (`ai-review-flag.ts`).
  - **Cost.** Measured 2026-10-19 on three test samples: ~1,200 tokens in, ~350–450 out, about **$0.006 per review** at $2 / $10 per million tokens. Caps: 3 reviews per sample per rolling week, 6,000 characters per sample, and a **$50 monthly budget across all members** (UTC calendar month) after which grading stops (`ai_sample_review_blocked` with code `budget` is the alert). Every call's tokens and cost are stored (`AiSampleReview.costMicros`); a failed call that spent tokens still counts toward the budget but not the member's weekly limit.
  - **Table.** `AiSampleReview`, created by hand: `prisma/manual/2026-10-19-ai-sample-review.sql`. Until it exists the panel is hidden and no call is made.
  - **Before showing it to recruiters:** do not, until counsel has looked at automated-employment-decision rules (NYC Local Law 144). The existing evidence score and fit ranking are rule-based and already visible to recruiters; they belong on the same review.
  - **Events.** `ai_sample_review_requested`, `ai_sample_reviewed` (`verdict`, `checksMet`, `checksTotal`, `remainingThisWeek`), `ai_sample_review_blocked` (`code`).
- **Skills page.** "AI you use" offers the tools named most for the member's function x industry (`tools-checklist.ts`).
- **Market size / pivot paths.** The function's AI-skill share and premium (`MarketSizeBlock`, `PivotRoleDetail`).
- **Work Samples.** Three guided AI sample types with proof-map checks and copyable résumé bullets (`src/lib/evidence/ai-work-samples.ts`); a measured result weighs most in the evidence score.

## Courses

`src/lib/learning/ai-course-tags.ts`: which items each catalog course covers, by URL (`AI_COURSE_TAGS`), and the AI courses this system adds (`AI_LEARNING_PATHS`: NIST AI RMF, IAPP AIGP, ISACA AAIA, Copilot for finance, Power Automate for operations, Agentforce for sales, plus the ten courses merged from the retired draft: Claude 101, AI Fluency, prompt engineering for developers, LangChain, LangGraph agents, crewAI, MCP, vector databases, evaluating agents, red teaming). Seed: `node --env-file=.env.local --import tsx scripts/seed-ai-learning-paths.ts` (skips URLs already there, so admin edits stay). A course not in the tag map covers no item.

## Known limits

- Gaps describe what postings say, not a test of the person. Copy says "on your profile", never "you have" or "you lack".
- Still no tagged course for leading AI teams (`l_ai_org_lead`): the only options found are paid university programs on cohort-specific pages, and they are for managers using AI, not for heads of AI. Add a verified link when found. On 2026-10-19 courses were added and tagged for AI coding assistants, content tools, MLOps, fine-tuning, GPU and automation (every link fetched that day).
- Proof beyond completions: AI work samples count as evidence (rule-based checks), and members can get an AI review of a sample (above, member-only, owner-only until switched on). No badge is shown to anyone else.
- No trend yet: the analysis had two weeks of full-scale crawl. A weekly snapshot would make it measurable in 8 to 12 weeks.
- Excerpt-only sources (Careerjet, Jooble, Phenom, Consider) carry little text, so AI asks there are undercounted.

## Events

- `ai_filter_changed` {`view`, `surface`, `from`, `count`}: surface `find_my_job` (board), `skills_gap_my_jobs`, `learning`.
- `ai_skill_gap_viewed` (server) {`employers`, `employersAskingAi`, `aiGaps`, `otherGaps`, `aiHave`, `coursesLinked`}; course clicks fire the Learning card events with section `ai-skill-gap`.
- `skills_gap_insight_viewed` / `skills_gap_insight_clicked` (with `aiView`; action `ai_course` for a course link).
