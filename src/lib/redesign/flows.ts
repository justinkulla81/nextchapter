import { PERFORMANCE_FLOW } from '@/lib/redesign/performance-rounds'
import type { FlowDef } from '@/lib/redesign/rounds'
import { TRACK_RECORD_FLOW } from '@/lib/redesign/track-record-rounds'

/** The two questionnaires that run as short rounds. Client components look a flow up by id, so only an id crosses from the server. */
export const FLOWS: Record<FlowDef['id'], FlowDef> = {
  track_record: TRACK_RECORD_FLOW,
  how_i_perform: PERFORMANCE_FLOW,
}
