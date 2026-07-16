import 'server-only'

const MODEL = 'gemini-2.5-flash-image'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export interface GeneratedImage {
  base64: string
  mimeType: string
}

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

async function callNanoBanana(parts: GeminiPart[], aspectRatio?: string): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      ...(aspectRatio
        ? { generationConfig: { imageConfig: { aspectRatio } } }
        : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Nano Banana request failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p: GeminiPart) => p.inlineData
  ) as GeminiPart | undefined

  if (!imagePart?.inlineData) {
    throw new Error('Nano Banana did not return an image')
  }

  return { base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }
}

// Edits the candidate's uploaded photo into a professional headshot — keeps
// their actual likeness, only changes lighting/background/attire framing.
export async function generateHeadshot(photoBase64: string, mimeType: string): Promise<GeneratedImage> {
  return callNanoBanana([
    {
      text: 'Transform this photo into a professional LinkedIn headshot. Keep the exact same person — same face, same identity, do not change their features. Improve: lighting (soft, even, flattering), background (replace with a simple blurred neutral studio background, light gray or soft blue), framing (head-and-shoulders, centered), and overall polish (like a professional photographer took it). If their clothing looks casual, subtly adjust it toward smart business attire while keeping it realistic. Do not add accessories, change their age, or alter their ethnicity or gender presentation.',
    },
    { inlineData: { mimeType, data: photoBase64 } },
  ])
}

// Generates a matching, content-neutral LinkedIn banner — an abstract
// professional background, not a photo of the candidate.
export async function generateLinkedInBanner(primaryFunction: string | null): Promise<GeneratedImage> {
  const role = primaryFunction ? ` for someone working in ${primaryFunction}` : ''
  return callNanoBanana(
    [
      {
        text: `Generate a professional, elegant LinkedIn banner/cover image${role}. Wide horizontal format. Abstract, subtle geometric or gradient design in navy blue and soft gray tones — no people, no text, no logos. Should look premium and calm, suitable as a background banner behind a profile photo.`,
      },
    ],
    '16:9'
  )
}
