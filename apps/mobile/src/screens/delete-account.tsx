import { useState } from 'react'
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { deleteAccount, ApiError } from '@/lib/api'
import { signOut } from '@/lib/auth'
import { track } from '@/lib/track'
import { Button } from '@/components/ui'
import { colors } from '@/theme'

export function DeleteAccount() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true); setError('')
    try {
      await deleteAccount(password, confirm)
      track('mobile_account_deletion_requested')
      await signOut()
      Alert.alert('Request received', 'Your account is deactivated and your saved searches are gone. We will finish deleting your account and data.')
      router.dismissAll()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach NextChapter.')
    } finally { setBusy(false) }
  }

  return (
    <View style={s.page}>
      <Text style={s.body}>This deactivates your NextChapter account now, removes your saved searches and notifications, and asks us to permanently delete your account and data.</Text>
      <TextInput style={s.input} placeholder="Your password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <TextInput style={s.input} placeholder="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Button label="Delete my account" onPress={submit} loading={busy} disabled={!password || confirm.trim().toUpperCase() !== 'DELETE'} />
    </View>
  )
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  error: { color: colors.danger, fontSize: 15 },
})
