import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listSaved, removeSaved, type SavedItem } from '@/lib/api'
import { signOut, useSession } from '@/lib/auth'
import { enablePush } from '@/lib/push'
import { PRIVACY_URL } from '@/lib/config'
import { track } from '@/lib/track'
import { Button, Empty, card } from '@/components/ui'
import { colors } from '@/theme'

const describe = (i: SavedItem) =>
  i.kind === 'employer' ? i.q : [i.q || 'All jobs', i.loc, i.remote ? 'Remote' : '', i.minPay ? `$${i.minPay / 1000}k+` : ''].filter(Boolean).join(' · ')

export function Saved() {
  const router = useRouter()
  const qc = useQueryClient()
  const { session, ready } = useSession()
  const list = useQuery({ queryKey: ['saved', session?.user.id], queryFn: listSaved, enabled: !!session })
  const del = useMutation({ mutationFn: removeSaved, onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }) })

  if (!ready) return null
  if (!session) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Empty title="Save a search, get a notification" body="Sign in to save a job search or an employer. We notify you about new matches and new layoff filings." />
        <Button label="Sign in" onPress={() => router.push('/sign-in')} />
        <Footer />
      </View>
    )
  }

  return (
    <FlatList<SavedItem>
      data={list.data?.items ?? []}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListEmptyComponent={<Empty title="Nothing saved yet" body="Use Save search on the Jobs tab, or watch an employer on the Layoffs tab." />}
      ListHeaderComponent={<Button label="Turn on notifications" kind="ghost" onPress={async () => Alert.alert((await enablePush().catch(() => false)) ? 'Notifications are on' : 'Notifications are off', 'You can change this in Settings.')} style={{ marginBottom: 6 }} />}
      ListFooterComponent={<View style={{ gap: 12, marginTop: 12 }}><Text style={s.small}>Signed in as {session.user.email}</Text><Button label="Sign out" kind="ghost" onPress={() => signOut()} /><Button label="Delete my account" kind="ghost" onPress={() => router.push('/delete-account')} /><Footer /></View>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => item.kind === 'jobs' ? router.navigate({ pathname: '/', params: { q: item.q, loc: item.loc, remote: item.remote ? '1' : '', minPay: String(item.minPay || '') } }) : router.navigate('/layoffs')}
          style={[card, s.row]}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.kind}>{item.kind === 'jobs' ? 'Job search' : 'Employer layoff watch'}</Text>
            <Text style={s.title}>{describe(item)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Remove" hitSlop={12} onPress={() => { track('saved_item_removed', { kind: item.kind }); del.mutate(item.id) }}>
            <Text style={s.remove}>Remove</Text>
          </Pressable>
        </Pressable>
      )}
    />
  )
}

function Footer() {
  return <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}><Text style={[s.small, { textAlign: 'center', textDecorationLine: 'underline' }]}>Privacy policy</Text></Pressable>
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kind: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  small: { fontSize: 13, color: colors.muted },
})
