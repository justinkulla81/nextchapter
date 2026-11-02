import { placeUrl } from '@/lib/places/places'

/** The biggest US metros, as [label, state slug, city slug]. Fixed so the /places index costs no query. */
const MAJOR: [string, string, string][] = [
  ['New York, NY', 'new-york', 'new-york'], ['Los Angeles, CA', 'california', 'los-angeles'], ['Chicago, IL', 'illinois', 'chicago'],
  ['Houston, TX', 'texas', 'houston'], ['Phoenix, AZ', 'arizona', 'phoenix'], ['Philadelphia, PA', 'pennsylvania', 'philadelphia'],
  ['San Antonio, TX', 'texas', 'san-antonio'], ['San Diego, CA', 'california', 'san-diego'], ['Dallas, TX', 'texas', 'dallas'],
  ['San Jose, CA', 'california', 'san-jose'], ['Austin, TX', 'texas', 'austin'], ['Jacksonville, FL', 'florida', 'jacksonville'],
  ['Fort Worth, TX', 'texas', 'fort-worth'], ['Columbus, OH', 'ohio', 'columbus'], ['Charlotte, NC', 'north-carolina', 'charlotte'],
  ['San Francisco, CA', 'california', 'san-francisco'], ['Indianapolis, IN', 'indiana', 'indianapolis'], ['Seattle, WA', 'washington', 'seattle'],
  ['Denver, CO', 'colorado', 'denver'], ['Washington, DC', 'district-of-columbia', 'washington'], ['Boston, MA', 'massachusetts', 'boston'],
  ['Nashville, TN', 'tennessee', 'nashville-davidson'], ['Detroit, MI', 'michigan', 'detroit'], ['Oklahoma City, OK', 'oklahoma', 'oklahoma-city'],
  ['Portland, OR', 'oregon', 'portland'], ['Las Vegas, NV', 'nevada', 'las-vegas'], ['Memphis, TN', 'tennessee', 'memphis'],
  ['Louisville, KY', 'kentucky', 'louisville'], ['Baltimore, MD', 'maryland', 'baltimore'], ['Milwaukee, WI', 'wisconsin', 'milwaukee'],
  ['Albuquerque, NM', 'new-mexico', 'albuquerque'], ['Tucson, AZ', 'arizona', 'tucson'], ['Sacramento, CA', 'california', 'sacramento'],
  ['Kansas City, MO', 'missouri', 'kansas-city'], ['Atlanta, GA', 'georgia', 'atlanta'], ['Miami, FL', 'florida', 'miami'],
  ['Raleigh, NC', 'north-carolina', 'raleigh'], ['Omaha, NE', 'nebraska', 'omaha'], ['Minneapolis, MN', 'minnesota', 'minneapolis'],
  ['Tampa, FL', 'florida', 'tampa'], ['Cleveland, OH', 'ohio', 'cleveland'], ['Pittsburgh, PA', 'pennsylvania', 'pittsburgh'],
  ['Cincinnati, OH', 'ohio', 'cincinnati'], ['St. Louis, MO', 'missouri', 'st-louis'], ['Orlando, FL', 'florida', 'orlando'],
  ['Salt Lake City, UT', 'utah', 'salt-lake-city'], ['Boise, ID', 'idaho', 'boise-city'], ['Richmond, VA', 'virginia', 'richmond'],
  ['New Orleans, LA', 'louisiana', 'new-orleans'], ['Buffalo, NY', 'new-york', 'buffalo'],
]

export const majorCityLinks = MAJOR.map(([label, state, city]) => ({ href: placeUrl.city(state, city), label }))
