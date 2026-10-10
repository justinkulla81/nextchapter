// Computes the 0-100 fit score for WIOA boards, American Job Centers, EDA districts,
// state agencies, local EDOs and nonprofit leads (the weekly cron does the same).
//   npx tsx --conditions=react-server scripts/geo/score-partners.ts [--apply]
import 'dotenv/config'
import { scoreAllPartners } from '../../src/lib/geo/score-partners'

scoreAllPartners(process.argv.includes('--apply'))
  .then((s) => {
    for (const [k, v] of Object.entries(s)) console.log(`${k.padEnd(22)} n=${String(v.n).padStart(5)}  min ${v.min}  median ${v.median}  p90 ${v.p90}  max ${v.max}`)
    console.log(process.argv.includes('--apply') ? 'written' : 'dry run — pass --apply')
    process.exit(0)
  })
  .catch((e) => { console.error(e); process.exit(1) })
