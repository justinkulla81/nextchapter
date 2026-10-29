// Generates new Victoria ("Vic") pictures that match public/marketing/victoria-headshot-v4.jpg.
// Metered: ~$0.07 per image on gemini-3.1-flash-image. Hard cap of MAX_IMAGES per run.
// Usage: node --env-file=.env.local scripts/generate-vic-pics.mjs <outDir> [name ...]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const MODEL = 'gemini-3.1-flash-image'
const MAX_IMAGES = 12
const REFERENCE = new URL('../public/marketing/victoria-headshot-v4.jpg', import.meta.url)

const BASE =
  'Using the attached photo as the identity reference, generate a new photograph of the same woman: ' +
  'same face shape, eyes, nose, smile and shoulder-length blonde hair, small gold stud earrings. ' +
  'Her skin is smoother and fresher than the reference, with only faint laugh lines and no deep wrinkles, still natural with real skin texture. ' +
  'Candid documentary-style photo taken on a phone or mirrorless camera, not a posed stock photo: slightly off-center framing, natural imperfect light, real clutter in the background, she is not always looking at the lens. ' +
  'No text, no logos. '

const SHOTS = {
  'vic-office-charcoal': 'Charcoal blazer over a soft pink blouse. She is in a busy open-plan office, mid-laugh while talking to a colleague just out of frame, monitors and sticky notes behind her. Square 1:1.',
  'vic-conference-room': 'Forest green cardigan over a cream top. She is in a glass-walled conference room with a whiteboard of scribbles behind her, glancing down at a printed page in her hand, small natural smile. Square 1:1.',
  'vic-desk-burgundy': 'Burgundy blazer over a light blue shirt. She is at a cluttered desk with a laptop, coffee cup and papers, looking at the screen and smiling slightly, window light from the side. Square 1:1.',
  'vic-hallway': 'Light grey blazer over a black top. She is walking through an office hallway carrying a notebook and a laptop, caught mid-step, turning her head toward the camera with a relaxed grin. Square 1:1.',
  'vic-video-call': 'Soft camel sweater over a white collared shirt. She is on a video call at a home-office desk, headphones on, looking at the screen and listening, a bookshelf and plant behind her. Square 1:1.',
  'vic-coffee-chat': 'Rust-orange blouse with a dark denim jacket. She sits across from the camera in a cafe or coworking lounge, holding a mug and laughing naturally at something someone said, background softly blurred. Square 1:1.',
}

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
