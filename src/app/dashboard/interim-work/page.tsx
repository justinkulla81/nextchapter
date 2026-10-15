import { redirect } from 'next/navigation'

// Interim Work is now part of the one job board: its jobs show under the
// Part-time & fractional, Contract & 1099 and Advisory & board toggles, and its
// toolkit (platform activity, launch plan, marketplaces, board directories,
// expert networks) sits on the board when those are on. This route stays for old
// links and emails; the browser keeps any #anchor (launch-phase-4,
// board-advisory-work, gig-directory-unlock all exist on the board).
export default function InterimWorkPage() {
  redirect('/dashboard/find-my-job?types=part_time,contract,advisory')
}
