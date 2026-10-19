import { SectionPills } from '@/components/candidate/SectionPills'
import { NETWORK_PARTS, type NetworkPartKey } from '@/lib/redesign/network-pages'

// The small switches across the top of every circle page, so moving between circles is one tap.
export function NetworkParts({ current }: { current: NetworkPartKey }) {
  return <SectionPills label="Your circles" current={current} items={NETWORK_PARTS} />
}
