import { useState } from 'react'
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TextInput, View, Pressable } from 'react-native'
import { findOccupations, getAiCheck, ApiError, type AiCheck, type OccupationMatch } from '@/lib/api'
import { usd } from '@/lib/format'
import { track } from '@/lib/track'
import { Button, Empty, card } from '@/components/ui'
import { BAND_COLOR, colors } from '@/theme'

export function AiCheck() {
  const [title, setTitle] = useState('')
  const [matches, setMatches] = useState<OccupationMatch[] | null>(null)
  const [result, setResult] = useState<AiCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function search() {
    if (title.trim().length < 2) return
    setBusy(true); setError(''); setResult(null)
    try {
      const r = await findOccupations(title.trim())
      setMatches(r.matches)
      track('ai_check_searched', { title: title.trim(), matches: r.matches.length })
      if (r.matches.length === 1 || r.matches[0]?.exact) await open(r.matches[0])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach NextChapter.')
    } finally { setBusy(false) }
  }

  async function open(m: OccupationMatch) {
    setBusy(true); setError('')
    try {
      const r = await getAiCheck(m.soc6)
      setResult(r)
      track('ai_check_viewed', { soc6: r.soc6, band: r.band })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach NextChapter.')
    } finally { setBusy(false) }
  }

  async function share(r: AiCheck) {
    try {
      const res = await Share.share({ message: r.shareMessage, url: r.shareUrl })
      if (res.action === Share.sharedAction) track('ai_job_check_shared', { soc6: r.soc6, method: 'native_share' })
    } catch { /* closed */ }
  }

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Text style={s.lede}>How much of your job’s work does AI already do? Type your job title.</Text>
      <TextInput style={s.input} placeholder="e.g. marketing manager" value={title} onChangeText={setTitle} onSubmitEditing={search} returnKeyType="search" autoCorrect={false} />
      <Button label="Check my job" onPress={search} loading={busy} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      {matches && matches.length === 0 ? <Empty title="No match" body="Try the plain name of the job, like “nurse manager”." /> : null}
      {!result && matches && matches.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Text style={s.h2}>Which one is closest?</Text>
          {matches.map((m) => (
            <Pressable key={m.soc6} accessibilityRole="button" onPress={() => open(m)} style={[card, { paddingVertical: 14 }]}><Text style={s.matchTitle}>{m.title}</Text></Pressable>
          ))}
        </View>
      ) : null}
      {busy && !result ? <ActivityIndicator /> : null}
      {result ? (
        <View style={[card, s.result]}>
          <Text style={s.resultTitle}>{result.title}</Text>
          <Text style={[s.big, { color: BAND_COLOR[result.band] }]}>{result.scorePercent}</Text>
          <Text style={[s.band, { color: BAND_COLOR[result.band] }]}>{result.bandLabel}</Text>
          <Text style={s.body}>{result.sentence}</Text>
          <Text style={s.small}>{result.why}</Text>
          {result.medianWage ? <Text style={s.body}>National median pay: {usd(result.medianWage)} a year</Text> : null}
          {result.related.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text style={s.h2}>Related jobs worth a look</Text>
              {result.related.slice(0, 3).map((b) => <Text key={b.soc6} style={s.body}>• {b.title}{b.payDelta && b.payDelta > 0 ? ` (pays ${usd(b.payDelta)} more)` : ''}</Text>)}
            </View>
          ) : null}
          {result.skillsToBuild.length > 0 ? <Text style={s.body}>Skills to build: {result.skillsToBuild.slice(0, 4).join(', ')}</Text> : null}
          <Text style={s.small}>{result.retraining}</Text>
          <Text style={s.small}>Source: {result.source}</Text>
          <Button label="Share this result" onPress={() => share(result)} />
        </View>
      ) : null}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  lede: { fontSize: 16, color: colors.muted },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  error: { color: colors.danger, fontSize: 15 },
  h2: { fontSize: 16, fontWeight: '700', color: colors.text },
  matchTitle: { fontSize: 16, color: colors.navy, fontWeight: '600' },
  result: { gap: 10 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  big: { fontSize: 56, fontWeight: '800' },
  band: { fontSize: 18, fontWeight: '700', marginTop: -8 },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
})
