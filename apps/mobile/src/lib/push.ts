import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { registerDevice } from '@/lib/api'
import { track } from '@/lib/track'

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
})

// Asked for only when someone saves a search, because that is the moment the permission makes sense. Returns true when this device is registered.
export async function enablePush(): Promise<boolean> {
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return false
  let { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
  track('push_permission_answered', { granted: status === 'granted' })
  if (status !== 'granted') return false
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Alerts', importance: Notifications.AndroidImportance.DEFAULT })
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
  if (!projectId) return false
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
  await registerDevice(data, Platform.OS)
  return true
}
