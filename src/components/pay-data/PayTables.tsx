import Link from 'next/link'
import type { PayGroup, SkillPay } from '@/lib/pay-data/types'
import { signedPct, skillName, usd, num } from '@/lib/pay-data/text'

const TH = 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground'
const TD = 'px-3 py-2 text-sm tabular-nums text-navy'

/** A group's like-for-like gap as a signed percent; a dash when the cells were too thin to show one. */
const gap = (pct: number | undefined) => (pct === undefined ? <span className="text-muted-foreground" title="Too few matching postings to show a like-for-like figure">n/a</span> : signedPct(pct))

export function GroupTable({ caption, rows, href, gapHeading = 'Gap, job mix matched' }: { caption: string; rows: PayGroup[]; href?: (g: PayGroup) => string | null; gapHeading?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[640px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-off-white">
          <tr>
            <th scope="col" className={TH}>Group</th>
            <th scope="col" className={TH}>Median</th>
            <th scope="col" className={TH}>Middle half</th>
            <th scope="col" className={TH}>{gapHeading}</th>
            <th scope="col" className={TH}>Postings</th>
            <th scope="col" className={TH}>Employers</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((g) => {
            const to = href?.(g)
            return (
              <tr key={g.key}>
                <th scope="row" className="px-3 py-2 text-left text-sm font-medium text-navy">{to ? <Link href={to} className="text-brand underline underline-offset-4">{g.label}</Link> : g.label}</th>
                <td className={TD}>{usd(g.p50)}</td>
                <td className={TD}>{usd(g.p25)} to {usd(g.p75)}</td>
                <td className={TD}>{gap(g.likePct)}</td>
                <td className={TD}>{num(g.n)}</td>
                <td className={TD}>{num(g.companies)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SkillTable({ caption, rows, href, sortNote }: { caption: string; rows: SkillPay[]; href: (s: SkillPay) => string; sortNote?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[680px]">
        <caption className="sr-only">{caption}{sortNote ? ` ${sortNote}` : ''}</caption>
        <thead className="border-b border-border bg-off-white">
          <tr>
            <th scope="col" className={TH}>Skill</th>
            <th scope="col" className={TH}>Median pay listing it</th>
            <th scope="col" className={TH}>Raw gap</th>
            <th scope="col" className={TH}>Gap, job mix matched</th>
            <th scope="col" className={TH}>Postings</th>
            <th scope="col" className={TH}>Employers</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((s) => (
            <tr key={s.skill}>
              <th scope="row" className="px-3 py-2 text-left text-sm font-medium text-navy"><Link href={href(s)} className="text-brand underline underline-offset-4">{skillName(s.skill)}</Link></th>
              <td className={TD}>{usd(s.p50)}</td>
              <td className={TD}>{signedPct(s.rawPct)}</td>
              <td className={TD}>{gap(s.likePct)}</td>
              <td className={TD}>{num(s.n)}</td>
              <td className={TD}>{num(s.companies)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
