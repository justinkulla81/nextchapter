import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { colors } from '@/theme'

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } } })

export default function RootLayout() {
  return (
    <QueryClientProvider client={client}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: colors.navy, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: 'Sign in to save' }} />
        <Stack.Screen name="delete-account" options={{ presentation: 'modal', title: 'Delete my account' }} />
      </Stack>
    </QueryClientProvider>
  )
}
