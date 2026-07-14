// One-time seed script: generates quad-block / Likert / BARS content via the
// Anthropic API and inserts it into the DB. Not part of app runtime or build.
//
// Run: npm run seed:assessment
//
// This is LLM-generated psychometric content — a starting point for testing
// and iteration, not professionally validated assessment material. Review
// before using with real candidates.
//
// Inserted at NEW_ROTATION_GROUP (not the default 1) so this content doesn't
// collide with any older rotationGroup:1 content still in the DB — bump
// CURRENT_ASSESSMENT_ROTATION_GROUP in src/lib/constants/onboarding.ts to
// match after running this.

import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NEW_ROTATION_GROUP = 2

const DIMENSION_KEYS = [
  'velocity',
  'architecture',
  'structure',
  'communication',
  'environment',
  'leadership',
  'oversight',
  'commitment',
  'conscientiousness',
] as const

const QUAD_BLOCK_COUNT = 12
const LIKERT_ITEM_COUNT = 16

const dimensionEnum = z.enum(DIMENSION_KEYS)
const poleEnum = z.enum(['high', 'low'])

const quadStatementSchema = z.object({
  dimension: dimensionEnum,
  pole: poleEnum,
  statementText: z.string(),
  socialDesirabilityScore: z.number(),
})

const quadBlockSchema = z.object({
  blockNumber: z.number().int(),
  statements: z.array(quadStatementSchema).length(4),
})

const likertItemSchema = z.object({
  dimension: dimensionEnum,
  pole: poleEnum,
  itemText: z.string(),
  isReversed: z.boolean(),
  targetedFriction: z.string(),
  pairedQuadDimension: dimensionEnum,
})

const barsAnchorSchema = z.object({
  dimension: dimensionEnum,
  scalePoint: z.number().int().min(1).max(5),
  anchorText: z.string(),
})

const generationSchema = z.object({
  quadBlocks: z.array(quadBlockSchema).length(QUAD_BLOCK_COUNT),
  likertItems: z.array(likertItemSchema).length(LIKERT_ITEM_COUNT),
  barsAnchors: z.array(barsAnchorSchema),
})

type GenerationOutput = z.infer<typeof generationSchema>

const prompt = `
You are building the psychometric assessment engine for NextChapter, a hiring platform.

The system measures candidates across 9 dimensions in opposing polarities:
1. Velocity: Deliberate & Planned (low) vs. Fast & Urgent (high)
2. Architecture: Creates the Playbook (low) vs. Executes the Playbook (high)
3. Structure: Needs Clear Scope (low) vs. Thrives in Ambiguity (high)
4. Communication: Async & Written (low) vs. Sync & Verbal (high)
5. Environment: Deep Focus Time (low) vs. Constant Collaboration (high)
6. Leadership: Coaching & Context (low) vs. Direct & Blunt (high)
7. Oversight: Hands-off (low) vs. Deeply Involved (high) — this is a subtle proxy for
   macro- vs. micro-management preference; phrase statements/items around concrete
   day-to-day behaviors (how often you check in, how much detail you want from
   others, how you divide up decisions), never using the words "macromanage" or
   "micromanage" directly.
8. Commitment: Protects 40 Hours (low) vs. Whatever It Takes (high)
9. Conscientiousness: Flexible with Process (low) vs. Rigorous with Detail (high) —
   about attention to detail, follow-through, and process discipline, phrased around
   specific behaviors (e.g. how you handle checklists, documentation, deadlines),
   not "are you conscientious" self-labeling.

IMPORTANT — anti-gaming requirements (this is the most common feedback on earlier
versions of this instrument: it was too easy to tell which answer "looks better"):
- NEVER write statements/items as first-person virtue-signaling ("I always...",
  "I never...", "I'm someone who..."). Frame them as specific, neutral situational
  behaviors instead ("When a deadline moves up, I...", "In a status meeting, I...").
- Do not phrase communication/leadership/oversight items in a way that telegraphs
  which pole is "the good one" — both poles of every dimension are equally valid
  professional styles, and the wording must not hint otherwise.
- Vary sentence structure and vocabulary across statements so patterns aren't
  obviously repeatable/gameable once a candidate reads a few.

Generate the following:

A) ${QUAD_BLOCK_COUNT} Quad-Blocks. Each block has exactly 4 statements — one representing the HIGH pole of 4 different dimensions chosen from the 9 above. Rules:
- Each statement must be written so it sounds equally professionally desirable (social desirability score 3.8-4.2 on a 5-point scale)
- No statement should contain jargon, negations, or obvious "right answers"
- Each block must use 4 different dimensions
- Statements describe specific workplace behaviors, not attitudes
- Include a socialDesirabilityScore estimate for each statement
- Across all ${QUAD_BLOCK_COUNT} blocks combined (${QUAD_BLOCK_COUNT * 4} total statement slots), each of the 9 dimensions must appear either 5 or 6 times — verify the total adds up to ${QUAD_BLOCK_COUNT * 4} before finalizing (e.g. 3 dimensions appearing 6 times and 6 dimensions appearing 5 times: 3×6 + 6×5 = ${QUAD_BLOCK_COUNT * 4}).

B) ${LIKERT_ITEM_COUNT} Likert verification items. Each item:
- Targets one specific dimension, and its pairedQuadDimension must be set to that exact same dimension
- Is framed as a historical, situational behavior from the past 24 months — NOT a first-person trait claim (see anti-gaming requirements above)
- Half should be reverse-scored (high agreement = LOW on that dimension)
- Must relate strictly to operational behavior — never age, health, family, lifestyle
- Every one of the 9 dimensions must have at least one Likert item, with the remaining ${LIKERT_ITEM_COUNT - 9} items distributed across dimensions that could use a second cross-check.

C) BARS anchors for all 9 dimensions — exactly 5 scale points each (1, 2, 3, 4, 5) with specific observable behaviors at each scale point.
`

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Add it to .env.local and try again.')
    process.exit(1)
  }

  console.log('Generating assessment content via Claude…')

  const client = new Anthropic()
  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    output_config: {
      format: zodOutputFormat(generationSchema),
      effort: 'high',
    },
    messages: [{ role: 'user', content: prompt }],
  })
  const message = await stream.finalMessage()

  const data = message.parsed_output
  if (!data) {
    console.error('No parsed_output returned from the API.')
    process.exit(1)
  }

  const errors = validate(data)
  if (errors.length > 0) {
    console.error(`Generated content failed validation (${errors.length} issue(s)):`)
    for (const error of errors) console.error(`  - ${error}`)
    console.error('\nNo data was inserted. Re-run the script — generation is non-deterministic.')
    process.exit(1)
  }

  console.log(`Validation passed. Inserting into database at rotationGroup ${NEW_ROTATION_GROUP}…`)
  await insert(data)

  console.log(
    `Done. Inserted ${data.quadBlocks.length} quad blocks (${data.quadBlocks.length * 4} statements), ${data.likertItems.length} Likert items, ${data.barsAnchors.length} BARS anchors at rotationGroup ${NEW_ROTATION_GROUP}.`
  )
  console.log(
    `Remember to set CURRENT_ASSESSMENT_ROTATION_GROUP = ${NEW_ROTATION_GROUP} in src/lib/constants/onboarding.ts so onboarding queries this new content.`
  )
}

function validate(data: GenerationOutput): string[] {
  const errors: string[] = []

  const dimensionCounts: Record<string, number> = {}
  data.quadBlocks.forEach((block, blockIndex) => {
    const dimsInBlock = new Set(block.statements.map((s) => s.dimension))
    if (dimsInBlock.size !== 4) {
      errors.push(`Block ${blockIndex} (blockNumber ${block.blockNumber}) has duplicate dimensions.`)
    }
    for (const statement of block.statements) {
      dimensionCounts[statement.dimension] = (dimensionCounts[statement.dimension] ?? 0) + 1
      if (statement.socialDesirabilityScore < 3.8 || statement.socialDesirabilityScore > 4.2) {
        errors.push(
          `Block ${blockIndex} statement (dimension ${statement.dimension}) has socialDesirabilityScore ${statement.socialDesirabilityScore}, expected 3.8-4.2.`
        )
      }
    }
  })
  for (const dim of DIMENSION_KEYS) {
    const count = dimensionCounts[dim] ?? 0
    if (count !== 5 && count !== 6) {
      errors.push(`Dimension "${dim}" appears ${count} times across quad blocks, expected 5 or 6.`)
    }
  }
  const totalSlots = Object.values(dimensionCounts).reduce((sum, c) => sum + c, 0)
  if (totalSlots !== QUAD_BLOCK_COUNT * 4) {
    errors.push(`Total quad statement slots is ${totalSlots}, expected ${QUAD_BLOCK_COUNT * 4}.`)
  }

  const likertDims = new Set(data.likertItems.map((item) => item.dimension))
  for (const dim of DIMENSION_KEYS) {
    if (!likertDims.has(dim)) errors.push(`Dimension "${dim}" has no Likert item.`)
  }
  data.likertItems.forEach((item, index) => {
    if (item.dimension !== item.pairedQuadDimension) {
      errors.push(
        `Likert item ${index} has dimension "${item.dimension}" but pairedQuadDimension "${item.pairedQuadDimension}" — they must match.`
      )
    }
  })

  const barsPointsByDim: Record<string, Set<number>> = {}
  for (const anchor of data.barsAnchors) {
    barsPointsByDim[anchor.dimension] ??= new Set()
    barsPointsByDim[anchor.dimension].add(anchor.scalePoint)
  }
  for (const dim of DIMENSION_KEYS) {
    const points = barsPointsByDim[dim]
    const hasAllFive = points && [1, 2, 3, 4, 5].every((p) => points.has(p)) && points.size === 5
    if (!hasAllFive) {
      errors.push(
        `Dimension "${dim}" BARS anchors incomplete (found scale points: ${points ? [...points].sort().join(',') : 'none'}).`
      )
    }
  }

  return errors
}

async function insert(data: GenerationOutput) {
  await prisma.$transaction(
    async (tx) => {
      const createdBlocks = await tx.quadBlock.createManyAndReturn({
        data: data.quadBlocks.map((block) => ({
          blockNumber: block.blockNumber,
          rotationGroup: NEW_ROTATION_GROUP,
        })),
      })

      const statementsData = data.quadBlocks.flatMap((block, index) =>
        block.statements.map((s) => ({
          blockId: createdBlocks[index].id,
          dimension: s.dimension,
          pole: s.pole,
          statementText: s.statementText,
          socialDesirabilityScore: s.socialDesirabilityScore,
        }))
      )
      await tx.quadBlockStatement.createMany({ data: statementsData })

      await tx.likertItem.createMany({
        data: data.likertItems.map((item) => ({
          dimension: item.dimension,
          pole: item.pole,
          itemText: item.itemText,
          isReversed: item.isReversed,
          targetedFriction: item.targetedFriction,
          pairedQuadDimension: item.pairedQuadDimension,
          rotationGroup: NEW_ROTATION_GROUP,
        })),
      })

      await tx.bARSAnchor.createMany({
        data: data.barsAnchors.map((anchor) => ({
          dimension: anchor.dimension,
          scalePoint: anchor.scalePoint,
          anchorText: anchor.anchorText,
        })),
      })
    },
    { timeout: 30000 }
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
