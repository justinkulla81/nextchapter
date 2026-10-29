// Generates new candid pictures of our site personas (Vic by default; PERSONA=chris|sarah) that match their headshot.
// Metered: ~$0.07 per image on gemini-3.1-flash-image. Hard cap of MAX_IMAGES per run.
// Usage: [PERSONA=chris REF_IMAGE=<label-free headshot>] node --env-file=.env.local scripts/generate-vic-pics.mjs <outDir> [name ...]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const MODEL = 'gemini-3.1-flash-image'
const MAX_IMAGES = 12
const REFERENCE = (process.env.REF_IMAGE ?? new URL('../public/marketing/victoria-headshot-v4.jpg', import.meta.url))

const PERSONA = process.env.PERSONA ?? 'vic'
const IDENTITIES = {
  vic: 'same face shape, eyes, nose, smile and shoulder-length blonde hair, small gold stud earrings. Her skin is smoother and fresher than the reference, with only faint laugh lines and no deep wrinkles, still natural with real skin texture. ',
  chris: 'same man: same face, short brown hair graying at the temples, light blue eyes, clean shaven, late 40s, natural skin texture. ',
  sarah: 'same woman: same face, long dark brown hair with soft caramel highlights, brown eyes, small gold hoop earrings and thin gold pendant necklace, mid 40s, natural skin texture. ',
}
const BASE =
  'Using the attached photo as the identity reference, generate a new photograph of the ' + (PERSONA === 'vic' ? 'same woman: ' : 'same person, ') +
  IDENTITIES[PERSONA] +
  'Candid documentary-style photo taken on a phone or mirrorless camera, not a posed stock photo: slightly off-center framing, natural imperfect light, real clutter in the background, they are not always looking at the lens. ' +
  'No text, no logos. '

const VIC_SHOTS = {
  'vic-office-charcoal': 'Charcoal blazer over a soft pink blouse. She is in a busy open-plan office, mid-laugh while talking to a colleague just out of frame, monitors and sticky notes behind her. Square 1:1.',
  'vic-conference-room': 'Forest green cardigan over a cream top. She is in a glass-walled conference room with a whiteboard of scribbles behind her, glancing down at a printed page in her hand, small natural smile. Square 1:1.',
  'vic-desk-burgundy': 'Burgundy blazer over a light blue shirt. She is at a cluttered desk with a laptop, coffee cup and papers, looking at the screen and smiling slightly, window light from the side. Square 1:1.',
  'vic-hallway': 'Light grey blazer over a black top. She is walking through an office hallway carrying a notebook and a laptop, caught mid-step, turning her head toward the camera with a relaxed grin. Square 1:1.',
  'vic-video-call': 'Soft camel sweater over a white collared shirt. She is on a video call at a home-office desk, headphones on, looking at the screen and listening, a bookshelf and plant behind her. Square 1:1.',
  'vic-coffee-chat': 'Rust-orange blouse with a dark denim jacket. She sits across from the camera in a cafe or coworking lounge, holding a mug and laughing naturally at something someone said, background softly blurred. Square 1:1.',
}

const SHOTS_BY_PERSONA = {
  vic: VIC_SHOTS,
  chris: {
    'chris-home-office': 'Navy quarter-zip over a white tee. He is at a home-office desk with an unbranded silver laptop (plain back, no logo) and a mug, reading the screen with a focused, relaxed expression, morning window light, bookshelf behind. Square 1:1.',
    'chris-coffee-shop': 'Olive green jacket over a grey sweater. He sits at a cafe table with an unbranded silver laptop whose back is plain with no logo, mid-conversation and smiling at someone off camera, background softly blurred. Square 1:1.',
    'chris-interview-ready': 'Charcoal blazer over a light blue shirt, no tie. He is in an office lobby holding a folder, glancing to the side with a calm, confident half-smile, caught mid-step. Square 1:1.',
  },
  sarah: {
    'sarah-conference-room': 'Cream blazer over a navy top. She is in a glass conference room with a whiteboard behind her, listening to someone out of frame and nodding with a warm expression. Square 1:1.',
    'sarah-kitchen-laptop': 'Soft green sweater. She is at a home kitchen counter with a laptop and a notepad, looking up with a natural smile as if someone just walked in. Natural daylight. Square 1:1.',
    'sarah-walking-outside': 'Black blazer over a white blouse. She is walking along a city sidewalk carrying a tote bag and a coffee, caught mid-stride, laughing at something off camera. Golden hour. Square 1:1.',
  },
}
const SHOTS = SHOTS_BY_PERSONA[PERSONA]

const [outDir, ...names] = process.argv.slice(2)
if (!outDir) throw new Error('usage: generate-vic-pics.mjs <outDir> [name ...]')
const key = process.env.GEMINI_API_KEY
if (!key) throw new Error('GEMINI_API_KEY is not set')
const todo = (names.length ? names : Object.keys(SHOTS)).slice(0, MAX_IMAGES)
mkdirSync(outDir, { recursive: true })
const reference = readFileSync(REFERENCE).toString('base64')

for (const name of todo) {
  if (!SHOTS[name]) throw new Error(`unknown shot ${name}`)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: reference } }, { text: BASE + SHOTS[name] }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    }
  )
  const json = await res.json()
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data)
  const data = (part?.inlineData ?? part?.inline_data)?.data
  if (!data) {
    console.error(`${name}: no image`, JSON.stringify(json).slice(0, 300))
    continue
  }
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(data, 'base64'))
  console.log(`${name}: saved`)
}
