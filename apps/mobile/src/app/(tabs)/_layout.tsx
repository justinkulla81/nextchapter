import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/theme'

const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.navy, headerStyle: { backgroundColor: colors.bg }, headerTitleStyle: { color: colors.navy, fontWeight: '800' }, headerShadowVisible: false }}>
      <Tabs.Screen name="index" options={{ title: 'Jobs', tabBarIcon: icon('briefcase-outline') }} />
      <Tabs.Screen name="ai-check" options={{ title: 'AI job check', tabBarLabel: 'AI check', tabBarIcon: icon('sparkles-outline') }} />
      <Tabs.Screen name="layoffs" options={{ title: 'Layoffs', tabBarIcon: icon('alert-circle-outline') }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: icon('bookmark-outline') }} />
    </Tabs>
  )
}
