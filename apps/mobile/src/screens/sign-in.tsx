import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { signIn } from '@/lib/auth'
import { SIGN_UP_URL } from '@/lib/config'
import { track } from '@/lib/track'
import { Button } from '@/components/ui'
import { colors } from '@/theme'

export function SignIn() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true); setError('')
    const err = await signIn(email, password)
    setBusy(false)
    track('mobile_sign_in', { ok: !err })
    if (err) setError(err)
    else router.back()
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.page}>
      <Text style={s.lede}>Use your NextChapter account to save searches and get notifications.</Text>
      <TextInput style={s.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" />
      <TextInput style={s.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button label="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
      <Button label="Create a free account" kind="ghost" onPress={() => WebBrowser.openBrowserAsync(SIGN_UP_URL)} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  lede: { fontSize: 16, color: colors.muted },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  error: { color: colors.danger, fontSize: 15 },
})
