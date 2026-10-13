import { Briefcase, Compass, DoorOpen, GraduationCap, RefreshCw, Shield, Shuffle, TrendingUp, type LucideIcon } from 'lucide-react'
import { JOURNEY_TO_SITUATION, type SituationKey } from '@/lib/constants/onboarding'
import { JOURNEYS, type JourneyType } from '@/lib/journey/journey'

// The eight journey cards (src/lib/journey/journey.ts), shared by the
// homepage and the onboarding situation step so the two never drift.
const ICONS: Record<JourneyType, LucideIcon> = {
  LAID_OFF: Briefcase,
  READY_TO_MOVE: DoorOpen,
  EXPLORING_MOVE: Shield,
  PROMOTION: TrendingUp,
  CAREER_CHANGE: Shuffle,
  STUDENT_NEW_GRAD: GraduationCap,
  RETURNING: RefreshCw,
  NEXT_ACT: Compass,
}

export const JOURNEY_CARDS: { situation: SituationKey; icon: LucideIcon; label: string; description: string }[] = JOURNEYS.map((j) => ({
  situation: JOURNEY_TO_SITUATION[j.key],
  icon: ICONS[j.key],
  label: j.card.label,
  description: j.card.description,
}))
