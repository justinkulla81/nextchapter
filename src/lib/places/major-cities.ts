import { placeUrl } from '@/lib/places/places'

import { MAJOR } from '@/lib/places/major-cities-data'


export const majorCityLinks = MAJOR.map(([label, state, city]) => ({ href: placeUrl.city(state, city), label }))
