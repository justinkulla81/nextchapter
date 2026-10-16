import { Briefcase, Coffee, Compass, DoorOpen, GraduationCap, Layers, LineChart, RefreshCw, Rocket, Shield, Shuffle, TrendingUp, type LucideIcon } from 'lucide-react'
import { JOURNEY_TO_SITUATION, type SituationKey } from '@/lib/constants/onboarding'
import { JOURNEYS, type JourneyType } from '@/lib/journey/journey'

// The journey cards (src/lib/journey/journey.ts), shared by the
// homepage and the onboarding situation step so the two never drift.
const ICONS: Record<JourneyType, LucideIcon> = {
  LAID_OFF: Briefcase,
  READY_TO_MOVE: DoorOpen, // legacy; not shown
  EXPLORING_MOVE: Shield,
  GROWING: LineChart,
  PROMOTION: TrendingUp,
  CAREER_CHANGE: Shuffle,
  STUDENT_NEW_GRAD: GraduationCap,
  RETURNING: RefreshCw,
  NEXT_ACT: Compass,
  TIME_OFF: Coffee,
  FRACTIONAL: Layers,
  ENTREPRENEUR: Rocket,
}

export const JOURNEY_CARDS: { situation: SituationKey; icon: LucideIcon; label: string; description: string }[] = JOURNEYS.map((j) => ({
  situation: JOURNEY_TO_SITUATION[j.key],
  icon: ICONS[j.key],
  label: j.card.label,
  description: j.card.description,
}))
