// Learning paths. Each is tied to one goal the member told us about, or one we can
// infer, so learning is never generic. A member can have several; the weekly plan
// shows the next step of the first two. Derived each time from what we know (so
// they follow the member across journey changes); only progress is stored, in
// journeyDetails.pathProgress. Pure and client-safe.

import { assessPivot } from './feasibility'
import { FUNCTION_PROFILES, costText, buildPathway } from './pathway'
import { isCommitted, type PivotDetails } from './pivot'
import type { CareerDetails } from './career'

export type GoalKind = 'PIVOT' | 'NEXT_LEVEL' | 'SKILL' | 'AI' | 'BOARD'

export type PathStep = { id: string; title: string; kind: 'learn' | 'build' | 'talk' | 'decide'; hours?: number }

export type LearningPath = {
  id: string
  goalKind: GoalKind
  // Why this path exists, in the member's terms.
  goal: string
  // They told us, or we inferred it from something they did tell us.
  source: 'expressed' | 'implied'
  because: string
  title: string
  steps: PathStep[]
  route?: 'INFORMAL' | 'FORMAL'
}

export type PathInput = {
  from: string | null
  pivot: PivotDetails | null
  career: CareerDetails | null
  skillsToBuild: string[]
  aiDisplaced: boolean
  boardInterest: boolean
  seniorLevel?: boolean
  ownedFunctions?: string[]
}

const step = (pathId: string, n: number, title: string, kind: PathStep['kind'], hours?: number): PathStep => ({ id: `${pathId}:${n}`, title, kind, hours })

function pivotPath(input: PathInput, t: PivotDetails['targets'][number]): LearningPath | null {
  if (t.tier === 'SAME' || t.tier === 'LEVEL_GATED') return null
  const fn = t.function
  const id = `pivot-${fn.toLowerCase().replace(/[^a-z]+/g, '-')}`
  const a = assessPivot(input.from, fn, { seniorLevel: input.seniorLevel, ownedFunctions: input.ownedFunctions })
  const p = FUNCTION_PROFILES[fn]
  const goal = `Move into ${fn}`
  if (t.tier === 'ADJACENT' || a.tier === 'ADJACENT') {
    return {
      id, goalKind: 'PIVOT', goal, source: 'expressed', because: `You said you are open to ${fn}.`, title: `Get ready for ${fn} roles`,
      steps: [
        step(id, 1, `Have two conversations with people doing ${fn} work and ask how your experience maps`, 'talk'),
        step(id, 2, `Finish one short course in ${p?.coreSkills[0] ?? fn}`, 'learn', 8),
        step(id, 3, `Add one project to your résumé that shows ${p?.proof.toLowerCase() ?? fn}`, 'build', 10),
      ],
    }
  }
  if (!isCommitted(t)) {
    return {
      id, goalKind: 'PIVOT', goal, source: 'expressed', because: `You said you are open to ${fn} but have not committed yet.`, title: `Test ${fn} cheaply before you commit`,
      steps: [
        step(id, 1, `Talk to three people doing ${fn} work and ask what the first year is like`, 'talk'),
        step(id, 2, `Spend four weeks on one small ${fn} project, about 5 hours a week`, 'build', 20),
        step(id, 3, `Decide: commit to a ${fn} plan, or take it off your list`, 'decide'),
      ],
    }
  }
  const route = t.route ?? 'INFORMAL'
  const pathway = buildPathway(input.from, fn, { seniorLevel: input.seniorLevel, ownedFunctions: input.ownedFunctions })
  const edu = a.education?.[route] ?? []
  const hours = t.hoursPerWeek ?? 5
  const steps: PathStep[] = []
  let n = 1
  if (route === 'FORMAL') {
    steps.push(step(id, n++, `Compare two programs: ${edu[0] ?? 'training in ' + fn}. Check cost (${pathway ? costText(pathway.cost.FORMAL) : 'confirm'}), length, and whether target employers ask for it`, 'decide'))
    steps.push(step(id, n++, 'Apply and enroll in the program you choose', 'learn', hours * 2))
  } else {
    steps.push(step(id, n++, edu[0] ?? `Learn the foundations of ${fn}`, 'learn', hours * 4))
  }
  steps.push(step(id, n++, `Build your proof: ${p?.proof.toLowerCase() ?? 'a project that shows the work'}`, 'build', hours * 8))
  steps.push(step(id, n++, `Get feedback from someone doing ${fn} work, every two weeks`, 'talk'))
  if (a.stepDown) steps.push(step(id, n++, `Decide in writing the level and pay you would accept to start in ${fn}`, 'decide'))
  steps.push(step(id, n++, `Apply to ${p?.entryRoles[0] ?? fn + ' roles'} with your proof attached`, 'build'))
  return { id, goalKind: 'PIVOT', goal, source: 'expressed', because: `You committed to this: ${route === 'FORMAL' ? 'formal training' : 'learning on your own'}, ${hours} hours a week.`, title: `Your ${fn} plan`, steps, route }
}

export function deriveLearningPaths(input: PathInput): LearningPath[] {
  const paths: LearningPath[] = []
  for (const t of input.pivot?.targets ?? []) {
    const p = pivotPath(input, t)
    if (p) paths.push(p)
  }
  const c = input.career
  if (c?.nextLevel) {
    const id = 'next-level'
    paths.push({
      id, goalKind: 'NEXT_LEVEL', goal: `Reach ${c.nextLevel}`, source: 'expressed', because: 'You told us the next level you want.', title: `The road to ${c.nextLevel}`,
      steps: [
        step(id, 1, `Ask your manager in writing what ${c.nextLevel} requires`, 'talk'),
        step(id, 2, 'List the three biggest gaps between that and what you do now', 'decide'),
        step(id, 3, `Lead one cross-team initiative that shows ${c.nextLevel} scope`, 'build', 20),
        step(id, 4, input.skillsToBuild[0] ? `Finish a course in ${input.skillsToBuild[0].replace(/_/g, ' ')}` : 'Finish a course in the biggest gap', 'learn', 12),
        step(id, 5, 'Collect two written examples of your impact from people you worked with', 'talk'),
      ],
    })
  } else if (c?.focus === 'level' || c?.focus === 'both') {
    const id = 'next-level'
    paths.push({
      id, goalKind: 'NEXT_LEVEL', goal: 'The next level', source: 'implied', because: 'You said the next level matters most, but have not named it yet.', title: 'Name your next level',
      steps: [step(id, 1, 'Write down the role or title you want next', 'decide'), step(id, 2, 'Ask your manager or a sponsor what it takes to get there', 'talk')],
    })
  }
  const skill = input.skillsToBuild[0]
  if (skill && !(c?.nextLevel)) {
    const id = `skill-${skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    const label = skill.replace(/_/g, ' ')
    paths.push({
      id, goalKind: 'SKILL', goal: `Build ${label}`, source: 'expressed', because: 'You told us this is a skill you want to build.', title: `Build ${label}`,
      steps: [step(id, 1, `Pick one course in ${label} and finish it`, 'learn', 10), step(id, 2, `Use ${label} on a real piece of work`, 'build', 8), step(id, 3, 'Ask someone who knows it for feedback', 'talk')],
    })
  }
  if (input.aiDisplaced) {
    const id = 'ai-outlook'
    paths.push({
      id, goalKind: 'AI', goal: 'Stay valuable as AI changes your field', source: 'implied', because: 'You said AI had a part in your last role.', title: 'Hold up against AI',
      steps: [
        step(id, 1, 'See which roles hold up against AI and which skills they ask for', 'learn', 2),
        step(id, 2, 'Add one in-demand skill to your learning list', 'decide'),
        step(id, 3, 'Use an AI tool on real work and write down what it did well and badly', 'build', 4),
      ],
    })
  }
  if (input.boardInterest) {
    const id = 'board-readiness'
    paths.push({
      id, goalKind: 'BOARD', goal: 'Join a board or advisory group', source: 'expressed', because: 'You said you are open to board and advisory work.', title: 'Get board-ready',
      steps: [step(id, 1, 'Write a one-page board bio: your expertise, sectors and what you would add', 'build'), step(id, 2, 'Join one nonprofit committee or advisory group to build experience', 'build'), step(id, 3, 'Ask two board members for an introduction to a nominating committee', 'talk')],
    })
  }
  return paths.slice(0, 5)
}

export type PathProgress = Record<string, string[]>

export function pathProgressOf(details: unknown): PathProgress {
  const v = (details as { pathProgress?: unknown } | null)?.pathProgress
  if (!v || typeof v !== 'object') return {}
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, ids]) => [k, Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []]))
}

export function nextStep(path: LearningPath, progress: PathProgress): PathStep | null {
  const done = new Set(progress[path.id] ?? [])
  return path.steps.find((s) => !done.has(s.id)) ?? null
}

export function pathPercent(path: LearningPath, progress: PathProgress): number {
  const done = new Set(progress[path.id] ?? [])
  return Math.round((path.steps.filter((s) => done.has(s.id)).length / path.steps.length) * 100)
}

// The plan shows the next step of up to two paths, expressed goals first.
export function pathPlanItems(paths: LearningPath[], progress: PathProgress, max = 2): { text: string; actionType?: string }[] {
  // The AI path is already a plan step of its own (aiOutlookItems), so it is not repeated here.
  const ordered = paths.filter((p) => p.goalKind !== 'AI').sort((a, b) => Number(b.source === 'expressed') - Number(a.source === 'expressed'))
  const out: { text: string; actionType?: string }[] = []
  for (const p of ordered) {
    if (out.length >= max) break
    const s = nextStep(p, progress)
    if (!s) continue
    out.push({ text: `${p.title}, next step: ${s.title}`, actionType: s.kind === 'talk' ? 'OUTREACH_CALL' : s.kind === 'learn' || s.kind === 'build' ? 'LEARNING_MODULE' : undefined })
  }
  return out
}

export function markStepDone(progress: PathProgress, paths: LearningPath[], pathId: string, stepId: string): PathProgress | null {
  const p = paths.find((x) => x.id === pathId)
  if (!p || !p.steps.some((s) => s.id === stepId)) return null
  const done = new Set(progress[pathId] ?? [])
  done.add(stepId)
  return { ...progress, [pathId]: [...done] }
}
