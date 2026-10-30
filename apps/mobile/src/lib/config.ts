export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://launchyournextchapter.com').replace(/\/$/, '')
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'
export const SIGN_UP_URL = 'https://launchyournextchapter.com/auth/signup'
export const DELETION_URL = 'https://launchyournextchapter.com/account-deletion'
export const PRIVACY_URL = 'https://launchyournextchapter.com/privacy-policy'
