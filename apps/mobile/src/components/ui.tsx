import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { colors, radius } from '@/theme'

export function Button({ label, onPress, kind = 'primary', disabled, loading, style }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost'; disabled?: boolean; loading?: boolean; style?: ViewStyle }) {
  const primary = kind === 'primary'
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [s.btn, primary ? s.primary : s.ghost, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}>
      {loading ? <ActivityIndicator color={colors.navy} /> : <Text style={[s.btnText, !primary && { color: colors.navy }]}>{label}</Text>}
    </Pressable>
  )
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  )
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {body ? <Text style={s.emptyBody}>{body}</Text> : null}
    </View>
  )
}

export const card: ViewStyle = { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 16 }

const s = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: colors.action },
  ghost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  btnText: { fontSize: 16, fontWeight: '700', color: colors.actionText },
  chip: { paddingHorizontal: 14, minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody: { marginTop: 6, fontSize: 15, color: colors.muted, textAlign: 'center' },
})
