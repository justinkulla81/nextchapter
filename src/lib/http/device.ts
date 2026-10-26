// Buckets a stored user-agent string into a device class for the admin
// Visitors report. Order matters: tablets are checked before phones because
// an Android tablet UA lacks "Mobile" while an Android phone's has it, and
// iPadOS 13+ Safari reports a desktop-Mac UA — the only tell left is the
// "Macintosh" + touch string some in-app browsers still send, which we cannot
// see server-side, so those few iPads read as Desktop (an accepted, rare miss).

export type DeviceClass = 'Mobile' | 'Tablet' | 'Desktop' | 'Unknown'

export function classifyDevice(userAgent: string | null): DeviceClass {
  if (!userAgent) return 'Unknown'
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet|kindle|silk\/|playbook/.test(ua)) return 'Tablet'
  if (/android/.test(ua) && !/mobile/.test(ua)) return 'Tablet'
  if (/iphone|ipod|android|mobile|windows phone|blackberry|opera mini/.test(ua)) return 'Mobile'
  if (/windows|macintosh|mac os x|x11|linux|cros/.test(ua)) return 'Desktop'
  return 'Unknown'
}

// Order matters here too: Edge, Opera and the in-app browsers all contain
// "Chrome" and/or "Safari", so the specific tokens are matched first.
export function classifyBrowser(userAgent: string | null): string {
  if (!userAgent) return 'Unknown'
  const ua = userAgent.toLowerCase()
  if (ua.includes('fban') || ua.includes('fbav')) return 'Facebook app'
  if (ua.includes('instagram')) return 'Instagram app'
  if (ua.includes('linkedinapp')) return 'LinkedIn app'
  if (ua.includes('edg/') || ua.includes('edga/') || ua.includes('edgios/')) return 'Edge'
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera'
  if (ua.includes('firefox/') || ua.includes('fxios/')) return 'Firefox'
  if (ua.includes('samsungbrowser')) return 'Samsung Internet'
  if (ua.includes('chrome/') || ua.includes('crios/')) return 'Chrome'
  if (ua.includes('safari/')) return 'Safari'
  return 'Other'
}

export function classifyOs(userAgent: string | null): string {
  if (!userAgent) return 'Unknown'
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macOS'
  if (ua.includes('cros')) return 'ChromeOS'
  if (ua.includes('linux') || ua.includes('x11')) return 'Linux'
  return 'Other'
}
