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
- **Skills page.** "AI you use" offers the tools named most for the member's function x industry (`tools-checklist.ts`).
- **Market size / pivot paths.** The function's AI-skill share and premium (`MarketSizeBlock`, `PivotRoleDetail`).
- **Work Samples.** Three guided AI sample types with proof-map checks and copyable résumé bullets (`src/lib/evidence/ai-work-samples.ts`); a measured result weighs most in the evidence score.

## Courses

`src/lib/learning/ai-course-tags.ts`: which items each catalog course covers, by URL (`AI_COURSE_TAGS`), and the AI courses this system adds (`AI_LEARNING_PATHS`: NIST AI RMF, IAPP AIGP, ISACA AAIA, Copilot for finance, Power Automate for operations, Agentforce for sales, plus the ten courses merged from the retired draft: Claude 101, AI Fluency, prompt engineering for developers, LangChain, LangGraph agents, crewAI, MCP, vector databases, evaluating agents, red teaming). Seed: `node --env-file=.env.local --import tsx scripts/seed-ai-learning-paths.ts` (skips URLs already there, so admin edits stay). A course not in the tag map covers no item.

## Known limits

- Gaps describe what postings say, not a test of the person. Copy says "on your profile", never "you have" or "you lack".
- Still no tagged course for leading AI teams (`l_ai_org_lead`): the only options found are paid university programs on cohort-specific pages, and they are for managers using AI, not for heads of AI. Add a verified link when found. On 2026-10-19 courses were added and tagged for AI coding assistants, content tools, MLOps, fine-tuning, GPU and automation (every link fetched that day).
- Own assessments and badges (proof beyond completions) are not built; completions, AI projects and AI work samples count as evidence today.
- No trend yet: the analysis had two weeks of full-scale crawl. A weekly snapshot would make it measurable in 8 to 12 weeks.
- Excerpt-only sources (Careerjet, Jooble, Phenom, Consider) carry little text, so AI asks there are undercounted.

## Events

- `ai_filter_changed` {`view`, `surface`, `from`, `count`}: surface `find_my_job` (board), `skills_gap_my_jobs`, `learning`.
- `ai_skill_gap_viewed` (server) {`employers`, `employersAskingAi`, `aiGaps`, `otherGaps`, `aiHave`, `coursesLinked`}; course clicks fire the Learning card events with section `ai-skill-gap`.
- `skills_gap_insight_viewed` / `skills_gap_insight_clicked` (with `aiView`; action `ai_course` for a course link).
