import { useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useQuery } from '@tanstack/react-query'
import { getLayoffs, lookupEmployer, saveItem, ApiError, type EmployerFacts, type Notice } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import { enablePush } from '@/lib/push'
import { track } from '@/lib/track'
import { Button, Empty, card } from '@/components/ui'
import { colors } from '@/theme'

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function Layoffs() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [found, setFound] = useState<{ q: string; employers: EmployerFacts[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const feed = useQuery({ queryKey: ['layoffs'], queryFn: () => getLayoffs() })

  async function check() {
    const q = name.trim()
    if (q.length < 2) return
    setBusy(true)
    try {
      const r = await lookupEmployer(q)
      setFound({ q, employers: r.employers })
      track('layoff_employer_lookup', { q, found: r.employers.length })
    } catch { setFound({ q, employers: [] }) } finally { setBusy(false) }
  }

  async function watch(employer: string) {
    if (!(await getAccessToken())) { router.push('/sign-in'); return }
    try {
      await saveItem({ kind: 'employer', q: employer, loc: '', remote: false, minPay: 0 })
      const on = await enablePush().catch(() => false)
      Alert.alert('Watching ' + employer, on ? 'We will send a notification if a new layoff filing appears.' : 'Turn on notifications in Settings to get a notification for new filings.')
    } catch (e) { Alert.alert('Could not save', e instanceof ApiError ? e.message : 'Try again.') }
  }

  const header = (
    <View style={{ gap: 12, marginBottom: 8 }}>
      <View style={[card, { gap: 10 }]}>
        <Text style={s.h}>Is my employer filing layoffs?</Text>
        <TextInput style={s.input} placeholder="Company name" value={name} onChangeText={setName} onSubmitEditing={check} returnKeyType="search" autoCorrect={false} />
        <Button label="Check" onPress={check} loading={busy} />
        {found ? (
          found.employers.length === 0 ? (
            <Text style={s.body}>No layoff filings found for “{found.q}” in the public notices we track. Filings are only one signal.</Text>
          ) : (
            found.employers.map((e) => (
              <View key={e.slug} style={s.hit}>
                <Text style={s.title}>{e.name}</Text>
                <Text style={s.body}>{e.recentNotices} filing{e.recentNotices === 1 ? '' : 's'} in the last 12 months{e.latest ? `, latest ${day(e.latest)}` : ''}.{e.announcedRecently ? ' Layoffs were also reported or announced.' : ''}</Text>
                <Button label="Alert me about new filings" kind="ghost" onPress={() => watch(e.name)} />
              </View>
            ))
          )
        ) : null}
      </View>
      <Text style={s.h}>Recent layoff filings</Text>
      {feed.data ? <Text style={s.small}>{feed.data.count.toLocaleString('en-US')} notices in the last 30 days · {feed.data.totalWorkers.toLocaleString('en-US')} workers</Text> : null}
    </View>
  )

  return (
    <FlatList<Notice>
      data={feed.data?.notices ?? []}
      keyExtractor={(n, i) => `${n.employer}-${n.filedOn}-${i}`}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={feed.isLoading ? <ActivityIndicator style={{ marginTop: 24 }} /> : feed.isError ? <Empty title="Could not load the feed" body="Pull down to try again." /> : <Empty title="No recent notices" />}
      refreshing={feed.isRefetching}
      onRefresh={() => feed.refetch()}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="link" onPress={() => { track('layoff_notice_opened', { employer: item.employer }); WebBrowser.openBrowserAsync(item.employerPage) }} style={[card, { gap: 2 }]}>
          <Text style={s.title}>{item.employer}</Text>
          <Text style={s.body}>{[item.workers ? `${item.workers.toLocaleString('en-US')} workers` : 'Workers not stated', [item.place, item.state].filter(Boolean).join(', ')].join(' · ')}</Text>
          <Text style={s.small}>Filed {day(item.filedOn)}{item.effectiveOn ? ` · effective ${day(item.effectiveOn)}` : ''}</Text>
        </Pressable>
      )}
    />
  )
}

const s = StyleSheet.create({
  h: { fontSize: 18, fontWeight: '800', color: colors.navy },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  hit: { gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  small: { fontSize: 13, color: colors.muted },
})
