// A job title as the card shows it, without what job systems bolt on: requisition numbers ("2385787", "Req #12345",
// "(JR-104233)", "R0123456") and location or work-arrangement tails ("| Eden Prairie, Minnesota | Remote",
// "- Remote", "(Hybrid)"). The stored title is never changed; this is display only. Pure. Tests: src/test/display-title.test.ts.

import { statesFromLocation } from '@/lib/pay/market-pay'

const ARRANGEMENT = /^(?:remote|hybrid|on-?site|in[- ]office|telecommute|work from home|wfh|nationwide|multiple locations|various locations|usa?|united states)(?:\s*[-–(,].*)?$/i
const REQ_ID = /^(?:(?:req(?:uisition)?|job)\s*(?:id|#|no\.?|number)?\s*[:#]?\s*)?[A-Z]{0,3}[-_]?\d{5,}$/i

/** A piece of a title that is a place, a work arrangement or a requisition number. */
function isClutter(part: string): boolean {
  const p = part.trim().replace(/^[([]|[)\]]$/g, '').trim()
  if (!p) return true
  if (REQ_ID.test(p) || ARRANGEMENT.test(p)) return true
  // "Eden Prairie, Minnesota", "Austin, TX", "Remote, Arizona": a place, by its state.
  if (/,/.test(p) && statesFromLocation(p).states.length > 0 && p.split(/\s+/).length <= 5) return true
  return false
}

export function displayJobTitle(title: string): string {
  const original = title.trim()
  if (!original) return original
  // "Title | Place | Remote": keep the parts that are not clutter, in order.
  let t = original
  if (t.includes('|')) {
    const parts = t.split('|').map((x) => x.trim())
    const kept = parts.filter((x, i) => i === 0 || !isClutter(x))
    t = kept.join(' | ')
  }
  // A requisition number at the end of what is left ("… Products 2385787", "… (Req #12345)").
  t = t.replace(/\s*[([]?\s*(?:(?:req(?:uisition)?|job)\s*(?:id|#|no\.?|number)?\s*[:#]?\s*)?[A-Z]{0,3}[-_]?\d{5,}\s*[)\]]?\s*$/i, '')
  // A trailing "- Remote" / "(Hybrid)" / ", Remote".
  t = t.replace(/\s*(?:[-–,]\s*|\(\s*)(?:remote|hybrid|on-?site)\s*\)?\s*$/i, '')
  t = t.replace(/\s*[-–|,:]\s*$/, '').trim()
  // Never strip a title down to nothing useful.
  return t.length >= 3 ? t : original
}
