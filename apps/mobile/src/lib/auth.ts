import 'react-native-url-polyfill/auto'
import { createClient, type Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config'

// The app uses the existing Supabase accounts. Nothing asks for a sign-in until someone saves a search.
const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }) : null

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Sign-in is not set up in this build.'
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  return error ? (error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message) : null
}

export const signOut = () => supabase?.auth.signOut()

export function useSession(): { session: Session | null; ready: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabase)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return { session, ready }
}
