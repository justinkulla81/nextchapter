import 'server-only'
import { loadAiMarket } from '@/lib/skills/ai-market-live'
import { loadExposureMap, loadOpeningsBySoc } from '@/lib/skills/ai-exposure-server'
import { buildAiJobsIndex, type AiJobsIndex } from './build'

/** The current edition. Reads the stored exposure table, board figure and AI market snapshot; no scan, no model call. Null when the exposure table cannot be read. */
export async function loadAiJobsIndex(): Promise<AiJobsIndex | null> {
  const [map, openingsBySoc, market] = await Promise.all([loadExposureMap(), loadOpeningsBySoc(), loadAiMarket().catch(() => null)])
  if (!map.size) return null
  return buildAiJobsIndex({ map, openingsBySoc, market, today: new Date().toISOString().slice(0, 10) })
}
