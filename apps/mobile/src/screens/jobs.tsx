import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { searchJobs, saveItem, ApiError, type Job, type JobFilters } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import { enablePush } from '@/lib/push'
import { ago, pay } from '@/lib/format'
import { track } from '@/lib/track'
import { Button, Chip, Empty, card } from '@/components/ui'
import { colors } from '@/theme'

const PAY_STEPS = [0, 60_000, 100_000, 150_000, 200_000]
const payLabel = (n: number) => (n === 0 ? 'Any pay' : `$${n / 1000}k+`)

export function Jobs() {
  const router = useRouter()
  const params = useLocalSearchParams<{ q?: string; loc?: string; remote?: string; minPay?: string }>()
  const [f, setF] = useState<JobFilters>({ q: '', loc: '', remote: false, minPay: 0 })
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  const run = useRef(0)

  const load = useCallback(async (filters: JobFilters, offset = 0) => {
    const id = ++run.current
    if (offset === 0) setState('loading')
    else setMore(true)
    try {
      const page = await searchJobs(filters, offset)
      if (id !== run.current) return
      setJobs((prev) => (offset === 0 ? page.jobs : [...prev, ...page.jobs.filter((j) => !prev.some((p) => p.id === j.id))]))
      setTotal(page.total)
      setNext(page.nextOffset ?? null)
      setState('ready')
      if (offset === 0) track('job_search_run', { q: filters.q, loc: filters.loc, remote: filters.remote, minPay: filters.minPay, total: page.total })
    } catch (e) {
      if (id !== run.current) return
      setError(e instanceof ApiError ? e.message : 'Could not reach NextChapter. Check your connection.')
      setState('error')
    } finally {
      if (id === run.current) setMore(false)
    }
  }, [])

  // A saved search opened from the Saved tab arrives as route params.
  useEffect(() => {
    const incoming: JobFilters = { q: params.q ?? '', loc: params.loc ?? '', remote: params.remote === '1', minPay: Number(params.minPay ?? 0) || 0 }
    setF(incoming)
    load(incoming)
  }, [params.q, params.loc, params.remote, params.minPay, load])

  const update = (patch: Partial<JobFilters>, now = false) => {
    const nextF = { ...f, ...patch }
    setF(nextF)
    if (now) load(nextF)
  }

  async function save() {
    if (!(await getAccessToken())) {
      router.push('/sign-in')
      return
    }
    try {
      await saveItem({ kind: 'jobs', q: f.q, loc: f.loc, remote: f.remote, minPay: f.minPay })
      const pushOn = await enablePush().catch(() => false)
      Alert.alert('Search saved', pushOn ? 'We will send a notification when new jobs match.' : 'Turn on notifications in Settings to get a notification for new matches.')
    } catch (e) {
      Alert.alert('Could not save', e instanceof ApiError ? e.message : 'Try again.')
    }
  }

  async function apply(job: Job) {
    track('job_apply_opened', { jobId: job.id, company: job.company, title: job.title })
    await WebBrowser.openBrowserAsync(job.url)
  }

  const header = (
    <View style={s.filters}>
      <TextInput style={s.input} placeholder="Job title or company" value={f.q} onChangeText={(q) => update({ q })} onSubmitEditing={() => load(f)} returnKeyType="search" autoCorrect={false} />
      <TextInput style={s.input} placeholder="City, state or zip" value={f.loc} onChangeText={(loc) => update({ loc })} onSubmitEditing={() => load(f)} returnKeyType="search" autoCorrect={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="Remote" on={f.remote} onPress={() => update({ remote: !f.remote }, true)} />
        {PAY_STEPS.map((n) => <Chip key={n} label={payLabel(n)} on={f.minPay === n} onPress={() => update({ minPay: n }, true)} />)}
      </ScrollView>
      <View style={s.row}>
        <Button label="Search" onPress={() => load(f)} style={{ flex: 1 }} />
        <Button label="Save search" kind="ghost" onPress={save} style={{ flex: 1 }} />
      </View>
      {state === 'ready' && total !== null ? <Text style={s.count}>About {total.toLocaleString('en-US')} jobs</Text> : null}
    </View>
  )

  return (
    <FlatList
      data={state === 'ready' ? jobs : []}
      keyExtractor={(j) => j.id}
      ListHeaderComponent={header}
      contentContainerStyle={s.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(f)} />}
      onEndReachedThreshold={0.6}
      onEndReached={() => { if (state === 'ready' && next !== null && !more) load(f, next) }}
      ListEmptyComponent={
        state === 'loading' ? <ActivityIndicator style={{ marginTop: 32 }} /> :
        state === 'error' ? <View><Empty title={error} /><Button label="Try again" kind="ghost" onPress={() => load(f)} style={{ marginHorizontal: 24 }} /></View> :
        <Empty title="No jobs match yet" body="Try fewer words, a wider place, or Any pay." />
      }
      ListFooterComponent={more ? <ActivityIndicator style={{ margin: 16 }} /> : undefined}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="link" accessibilityHint="Opens the employer's career site" onPress={() => apply(item)} style={({ pressed }) => [card, s.job, pressed && { opacity: 0.85 }]}>
          <Text style={s.title}>{item.title}</Text>
          <Text style={s.company}>{item.company}</Text>
          <Text style={s.meta}>{[item.location, pay(item.salaryMin, item.salaryMax), ago(item.postedAt)].filter(Boolean).join(' · ')}</Text>
          <Text style={s.apply}>Apply on employer site</Text>
        </Pressable>
      )}
    />
  )
}

const s = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  filters: { gap: 12, marginBottom: 4 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chips: { flexDirection: 'row', gap: 8 },
  count: { fontSize: 14, color: colors.muted },
  job: { gap: 2 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  company: { fontSize: 15, color: colors.navy, fontWeight: '600' },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  apply: { fontSize: 14, color: colors.navy, fontWeight: '700', marginTop: 8 },
})
