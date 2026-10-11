'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { defaultRuleSet } from '@/lib/pitch/defaults'
import { mergeRuleSet } from '@/lib/pitch/store'
import { CUSTOMER_TYPES, type CustomerType, type RuleSet } from '@/lib/pitch/types'

const lines = (v: FormDataEntryValue | null) => String(v ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
const text = (v: FormDataEntryValue | null) => String(v ?? '').trim()

/** Saves everything on the editor page. A "move" button reorders instead of leaving the page. */
export async function saveRules(formData: FormData) {
  const user = await requireAdmin()
  const type = text(formData.get('type')) as CustomerType
  if (!CUSTOMER_TYPES.includes(type)) return
  const base = defaultRuleSet(type)
  const order = lines(formData.get('order'))
  const ids = order.length ? order : base.slides.map((s) => s.id)

  // reorder request: "move" = "<slideId>:up|down"
  const move = text(formData.get('move'))
  if (move) {
    const [id, d] = move.split(':')
    const i = ids.indexOf(id)
    const j = d === 'up' ? i - 1 : i + 1
    if (i >= 0 && j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]]
  }

  const saved: Partial<RuleSet> = {
    buyer: text(formData.get('buyer')), angle: text(formData.get('angle')), tone: text(formData.get('tone')), ask: text(formData.get('ask')),
    offer: {
      name: text(formData.get('offer_name')), term: text(formData.get('offer_term')), price: text(formData.get('offer_price')),
      scope: lines(formData.get('offer_scope')), theyProvide: lines(formData.get('offer_they')),
    },
    suggestedPeople: lines(formData.get('suggested')),
    reviewNotes: lines(formData.get('review_notes')),
    // Packages: blocks separated by a blank line. First line "Name | best for", the rest are what it includes.
    packages: String(formData.get('packages') ?? '').split(/\n\s*\n/).map((blk) => blk.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length).map((b, i) => {
      const [name, ...bestFor] = b[0].split('|').map((x) => x.trim())
      return { id: `pkg${i + 1}`, name, bestFor: bestFor.join(' | '), includes: b.slice(1) }
    }),
    slides: ids.map((id) => {
      const d = base.slides.find((s) => s.id === id)!
      return { ...d, enabled: formData.get(`on_${id}`) === 'on', title: text(formData.get(`title_${id}`)) || d.title, kicker: text(formData.get(`kicker_${id}`)) || undefined, bullets: lines(formData.get(`bullets_${id}`)) }
    }),
  }
  await prisma.pitchRuleSet.upsert({ where: { type }, create: { type, rules: saved as object, updatedBy: user.email }, update: { rules: saved as object, updatedBy: user.email } })
  captureServerEvent(user.email ?? 'admin', move ? 'pitch_slide_moved' : 'pitch_rules_saved', {
    type, enabled: saved.slides?.filter((s) => s.enabled).length, disabled: saved.slides?.filter((s) => !s.enabled).map((s) => s.id), priceSet: !!saved.offer?.price,
  })
  revalidatePath(`/support/admin/crm/pitch-rules/${type}`)
  redirect(`/support/admin/crm/pitch-rules/${type}?saved=${move ? 'moved' : '1'}`)
}

export async function resetRules(formData: FormData) {
  const user = await requireAdmin()
  const type = text(formData.get('type')) as CustomerType
  if (!CUSTOMER_TYPES.includes(type)) return
  await prisma.pitchRuleSet.deleteMany({ where: { type } })
  captureServerEvent(user.email ?? 'admin', 'pitch_rules_reset', { type })
  revalidatePath(`/support/admin/crm/pitch-rules/${type}`)
  redirect(`/support/admin/crm/pitch-rules/${type}?saved=reset`)
}

export { mergeRuleSet }
