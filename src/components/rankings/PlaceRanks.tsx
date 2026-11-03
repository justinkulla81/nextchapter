import { RankingContext } from '@/components/rankings/RankingContext'

/** "Where this place ranks": every month's placing in the lists it is in the top 25 of, linked. Renders nothing when it is in none. */
export async function PlaceRanks({ placeKey, scope }: { placeKey: string; scope: string }) {
  return <RankingContext places={[{ name: scope, keys: [placeKey] }]} surface="place" />
}
