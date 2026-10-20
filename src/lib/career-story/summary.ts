import { parseIso, type StoryEvent } from './events'

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`)

// One kind sentence about the story so far, built only from what is in it.
export function summarizeStory(events: StoryEvent[], now: Date): string {
  const work = events.filter((e) => e.kind === 'WORK').sort((a, b) => a.start.localeCompare(b.start))
  if (events.length === 0) return 'Your story starts here. Add a first chapter and it will take shape.'
  const pauses = events.filter((e) => e.kind === 'PAUSE' && !e.unlabeled)
  const ventures = events.filter((e) => e.kind === 'VENTURE')
  const learning = events.filter((e) => e.kind === 'LEARNING')
  const extras: string[] = []
  if (pauses.length) extras.push(pauses.length === 1 ? 'a pause' : `${pauses.length} pauses`)
  if (ventures.length) extras.push(ventures.length === 1 ? 'a venture of your own' : `${ventures.length} ventures of your own`)
  if (learning.length) extras.push(plural(learning.length, 'something new learned', 'new things learned'))
  const tail = extras.length ? `, with ${extras.slice(0, 3).join(', ').replace(/, ([^,]*)$/, ' and $1')} along the way` : ''
  if (work.length === 0) return `${extras.length ? `A story with ${extras.join(', ').replace(/, ([^,]*)$/, ' and $1')}` : 'A story with a lot ahead of it'}. Add your work and the rest fills in.`
  const first = work[0]
  const current = work.find((w) => w.end === null) ?? work[work.length - 1]
  const years = Math.max(1, Math.round((now.getTime() - parseIso(first.start).getTime()) / (365.25 * 86_400_000)))
  const arc = first.id === current.id ? `${years} ${years === 1 ? 'year' : 'years'} as ${first.label}` : `${first.label} to ${current.label} in about ${years} ${years === 1 ? 'year' : 'years'}`
  return `${arc}${tail}.`
}
