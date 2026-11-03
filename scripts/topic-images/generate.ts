// One-time generator for the header picture on each industry page: an editorial illustration per industry,
// saved as public/images/topics/industry-<slug>.webp. Run: npx tsx scripts/topic-images/generate.ts [slug ...]
// Skips files that exist. About 4 cents an image; run once and commit the files, nothing calls this at request time.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { INDUSTRIES, JOB_FUNCTIONS } from '../../src/lib/seo/topics'

const MODEL = 'gemini-2.5-flash-image'
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
const OUT = path.join(process.cwd(), 'public/images/topics')

const FN_SCENE: Record<string, string> = {
  Engineering: 'engineers reviewing a prototype and code on monitors',
  Operations: 'an operations lead with a supply-chain map, boxes and a tablet',
  Finance: 'finance professionals with charts, a calculator and a forecast model',
  'Data & Analytics': 'analysts around dashboards and glowing charts',
  Sales: 'a salesperson shaking hands with a client, a rising chart',
  'Human Resources': 'an HR partner interviewing a candidate warmly',
  Marketing: 'a marketing team with campaign boards and a megaphone',
  Legal: 'a counsel reviewing contracts with scales of justice',
  Product: 'a product manager at a roadmap board with sticky notes and app screens',
  Design: 'a designer sketching app screens and color swatches',
  'Customer Success': 'a support lead on a headset helping a happy customer',
  Administration: 'an executive assistant managing a calendar and a tidy office',
  'Executive Leadership': 'a leader presenting a vision to a team in a boardroom',
  Clinical: 'a clinician with a patient in a bright clinic',
  Investment: 'an investor analyzing portfolio charts with a city skyline',
  Security: 'a cybersecurity analyst with shield and lock motifs on screens',
  Programs: 'a program manager with a timeline board and a community team',
  Strategy: 'strategists mapping a plan on a glass wall',
  'Fundraising & development': 'a development officer with donors at a community gala',
  Research: 'researchers examining data and papers in a library lab',
  Academic: 'a professor lecturing in a university hall',
}

// Place pages: six regions for states, and three settings with three variants each for counties and cities.
const PLACE_SCENE: Record<string, string> = {
  'region-northeast': 'a New England town with a white church steeple, brick mill buildings, fall foliage and a harbor, plus a small city skyline in the distance',
  'region-southeast': 'a Southern city street with live oaks, porches, a river and a mix of old brick and new offices at golden hour',
  'region-midwest': 'Midwest farmland and a mid-size city with grain elevators, a downtown with a clock tower, and a lake',
  'region-southwest': 'desert mesas, saguaro cacti and a modern city with adobe-style buildings and a big sky at sunset',
  'region-mountain': 'snow-capped mountains over a mountain town and a small city, pine trees, a river valley',
  'region-pacific': 'a Pacific coast city with palms or evergreens, a bay, a bridge, mountains and the ocean',
  'city-1': 'a big city downtown with tall office towers, a busy street, a train and people commuting to work in the morning light',
  'city-2': 'a big city waterfront with skyscrapers, a harbor, parks and people walking and cycling',
  'city-3': 'a big city at dusk with lit towers, a plaza with people, trees and a stadium in the distance',
  'town-1': 'a mid-size city main street with brick storefronts, a courthouse, a hospital and a university building, people on the sidewalk',
  'town-2': 'a mid-size city with a river, a riverfront park, mid-rise offices, factories turned lofts and people at a farmers market',
  'town-3': 'a mid-size city with a historic downtown, a college campus, a community health center and tree-lined streets',
  'campus-1': 'a college campus quad with brick halls, a clock tower, students walking with backpacks and a career center entrance, autumn trees',
  'campus-2': 'a modern university campus with glass science buildings, a library, students and a professor talking outdoors, a lawn and bicycles',
  'campus-3': 'a community college campus with a trades workshop, a nursing lab, a welcoming entrance, students of all ages heading to class',
  'rural-1': 'a small town with a main street, a diner, a feed store, a water tower and farmland beyond, friendly neighbors chatting',
  'rural-2': 'a small county seat with a courthouse square, a library, a school and rolling hills and fields',
  'rural-3': 'a small rural community with a church, a general store, a community college sign and open countryside at golden hour',
}

const SCENE: Record<string, string> = {
  'Venture Capital & Private Equity': 'a small team around a table reviewing growth charts and a startup pitch, city skyline behind',
  'Financial Services & Banking': 'a bright bank branch and advisors meeting clients, a city street outside',
  Insurance: 'an agent reviewing a policy with a family at a kitchen table, a house and umbrella motif',
  'Accounting & Audit': 'accountants with ledgers, calculators and laptops in a tidy office',
  'Legal Services': 'lawyers at a conference table with documents and a courthouse in the window',
  'Professional Services & Consulting': 'consultants at a whiteboard mapping a plan with sticky notes',
  'Technology & Software': 'engineers collaborating at laptops and monitors showing code, a bright open office',
  Telecommunications: 'a technician and a cell tower at sunrise, signal waves',
  'Healthcare & Hospital Systems': 'nurses and doctors in a bright hospital corridor',
  'Pharmaceuticals & Biotech': 'scientists in a bright laboratory with glassware and a microscope',
  'Medical Devices': 'engineers assembling a medical device in a clean workshop',
  'Retail & E-commerce': 'a boutique storefront and a packed delivery box with a laptop showing a shop',
  'Consumer Packaged Goods': 'colorful packaged goods on a grocery shelf and a product designer sketching',
  'Hospitality, Travel & Food Service': 'a hotel lobby and a chef plating food, suitcases and a map',
  'Agriculture & Food Production': 'farm fields at golden hour with a tractor and a food scientist checking crops',
  'Manufacturing & Industrial': 'a modern factory floor with robotic arms and an engineer in a hard hat',
  'Automotive & Mobility': 'electric cars on a road with a charging station and a designer',
  'Aerospace & Defense': 'an airplane and a satellite over a hangar with engineers',
  'Energy & Utilities': 'wind turbines and solar panels across a landscape with a lineworker',
  'Construction & Real Estate': 'a building under construction with cranes and an architect holding plans',
  'Transportation & Logistics': 'trucks, a cargo ship and a warehouse, dispatchers at a map',
  'Media & Entertainment': 'a studio with cameras, a microphone and an editor at a screen',
  'Advertising, Marketing & PR': 'a creative team with mood boards, a megaphone motif and campaign layouts',
  'Education & EdTech': 'a teacher with students and a tablet in a bright classroom',
  'Government & Public Sector': 'a capitol building with civil servants and a community meeting',
  'Non-profit & Social Impact': 'volunteers and staff working together at a community event',
  'Staffing & Human Capital': 'a recruiter greeting a candidate in a modern office, a handshake',
}

async function make(name: string, kindWord = 'industry', scene = SCENE[name] ?? name): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  const subject = kindWord === 'place' ? `a place: ${scene}` : `the ${name} ${kindWord}: ${scene}`
  const prompt = `Warm editorial illustration for a career website header about ${subject}. Friendly modern flat illustration with soft shapes, a rich but harmonious palette of teal, coral, sunny yellow and deep navy on a light background. Diverse people of different ages, including experienced mid-career professionals, going about their working day. No text, no letters, no logos. Wide cinematic composition with the main subject on the right and open space on the left.`
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { imageConfig: { aspectRatio: '16:9' } } }),
  })
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const part = data.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData)
  if (!part) throw new Error('no image returned')
  return sharp(Buffer.from(part.inlineData.data, 'base64')).resize(1280, 560, { fit: 'cover' }).webp({ quality: 78 }).toBuffer()
}

async function main() {
  const only = new Set(process.argv.slice(2))
  for (const [key, scene] of Object.entries(PLACE_SCENE)) {
    if (only.size && !only.has(`place-${key}`)) continue
    const file = path.join(OUT, `place-${key}.webp`)
    if (fs.existsSync(file)) continue
    try {
      fs.writeFileSync(file, await make(key, 'place', scene))
      console.log('ok', key)
    } catch (e) {
      console.log('FAIL', key, e instanceof Error ? e.message : e)
    }
  }
  for (const f of JOB_FUNCTIONS) {
    if (only.size && !only.has(`fn-${f.slug}`)) continue
    const file = path.join(OUT, `function-${f.slug}.webp`)
    if (fs.existsSync(file)) continue
    try {
      fs.writeFileSync(file, await make(f.name, 'profession', FN_SCENE[f.name] ?? f.name))
      console.log('ok', f.slug)
    } catch (e) {
      console.log('FAIL', f.slug, e instanceof Error ? e.message : e)
    }
  }
  for (const i of INDUSTRIES) {
    if (only.size && !only.has(i.slug)) continue
    const file = path.join(OUT, `industry-${i.slug}.webp`)
    if (fs.existsSync(file)) continue
    try {
      fs.writeFileSync(file, await make(i.name))
      console.log('ok', i.slug)
    } catch (e) {
      console.log('FAIL', i.slug, e instanceof Error ? e.message : e)
    }
  }
}
main()
