# AI skills layer

Maps the AI skills job postings ask for to what a member shows, and to catalog courses that close the gap. Sits beside the O*NET taxonomy (`docs/CAREER_TAXONOMY.md`), which has almost nothing on AI.

- **Taxonomy** (`src/lib/ai-skills/taxonomy.ts`): 16 AI skills, three levels (aware, practitioner, builder), three role tiers (builds AI, uses AI in the job, governs and trains AI). Fixed vocabulary matched with word boundaries, so no model call and no per-view cost. `readPostingAi()` reads a posting; level is a heuristic from wording and role tier.
- **Person** (`person.ts`): levels from the skills matrix (resume mention = aware, confirmed or certified = practitioner), completed courses, AI projects and AI tools they use.
- **Gap** (`gap.ts`, `load.ts`): across the member's best-fit jobs (strong and good fits, as the existing skills gap does), which AI skills are asked for, at what level, and where the member stands. Shown on the Learning page (`AiSkillGapSection`).
- **Courses** (`courses.ts`): a course's skills and level are inferred from its own text and skill level, so an admin-added course joins automatically. `catalog-seed.ts` holds the additions that cover agents, retrieval, evaluation, governance and building on model APIs; `npm run seed:ai-skill-courses` adds them (idempotent).
- **Check the vocabulary against the market**: `npm run ai-skills:analyze` (read-only) prints AI share by skill, role tier and job function over the live board. First run (2026-10-16): 365k live jobs, 7.6% touch AI (builder 8.3k, embedded 19.0k, adjacent 0.4k); Data & Analytics 36%, Product 15%, Engineering 13%, Marketing 5.5%, Finance 2.1%.

## Known limits

- Gaps describe what postings say, not a test of the person. The UI says "we see you at", not "you are".
- Still no catalog course for: AI workflow automation, AI-assisted coding, AI for content, conversational AI, MLOps, training data. Verified links for these are needed (Microsoft Learn and Google Cloud Skills Boost paths tried did not resolve).
- Own assessments and badges (proof beyond completions) are not built; completions and AI projects count as evidence today.
- Postings are read at view time from the stored description. Reading them once at import and storing `aiSkills` on the posting would make a per-job gap line cheap; that needs a column (DDL).

## Events

`ai_skill_gap_viewed` (`jobsRead`, `jobsWithAi`, `gapSkills`, `coveredSkills`); course clicks fire the existing Learning card events with section `ai-skill-gap`.
