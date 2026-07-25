/**
 * Real push notification registration.
 *
 * The app previously *simulated* push: it polled /missions every 4 seconds and
 * called scheduleNotificationAsync locally when it noticed a new one. That only
 * works while the app is open and in the foreground — so a responder with the
 * phone in their pocket was never told they'd been dispatched.
 *
 * This registers the device's Expo push token with the server, which pushes on
 * dispatch (see server/lib/push.js). Polling stays as a fallback for when the
 * app *is* open, not as the delivery mechanism.
 */
import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { apiFetch } from '../api/client'

/** Must match the channelId the server sends on, or Android drops the push
 *  into the default channel and it loses its high-importance treatment. */
export const DISPATCH_CHANNEL_ID = 'dispatch'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
})

export type PushRegistrationResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'simulator' | 'permission-denied' | 'no-project-id' | 'error'; detail?: string }

/**
 * Android 13+ requires the notification channel to exist *before* the token
 * request, otherwise the permission prompt never appears.
 */
async function ensureDispatchChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(DISPATCH_CHANNEL_ID, {
    name: 'Mission dispatch',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#dc2626',
    // A dispatch must break through Do Not Disturb — this is the whole point
    // of the app.
    bypassDnd: true,
  })
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  // Push tokens require real hardware; a simulator can't receive them.
  if (!Device.isDevice) {
    return { ok: false, reason: 'simulator' }
  }

  await ensureDispatchChannel()

  const existing = await Notifications.getPermissionsAsync()
  let status = existing.status
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    })
    status = requested.status
  }
  if (status !== 'granted') {
    return { ok: false, reason: 'permission-denied' }
  }

  // Resolved from app.config extra.eas.projectId. Without an EAS project there
  // is no token to get — fail loudly here rather than silently never pushing.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId

  if (!projectId) {
    return { ok: false, reason: 'no-project-id' }
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    await apiFetch('/me/push-token', {
      method: 'PATCH',
      body: { token, platform: Platform.OS },
    })
    return { ok: true, token }
  } catch (err) {
    return { ok: false, reason: 'error', detail: (err as Error).message }
  }
}

/** Called on logout so this device stops receiving the previous user's
 *  dispatches. Best-effort: a failure here must not block signing out. */
export async function unregisterPushToken() {
  try {
    await apiFetch('/me/push-token', { method: 'DELETE' })
  } catch {
    // Offline logout is still a logout.
  }
}

/**
 * Human-readable explanation for a failed registration, shown in the Profile
 * screen. Silent failure here means a responder believes they're on duty while
 * dispatches can't reach them, so this must always be visible somewhere.
 */
export function describeRegistrationFailure(result: PushRegistrationResult): string | null {
  if (result.ok) return null
  switch (result.reason) {
    case 'simulator':
      return 'Push notifications need a physical device.'
    case 'permission-denied':
      return 'Notifications are blocked. Enable them in system settings or you will not be alerted to new dispatches.'
    case 'no-project-id':
      return 'Push is not configured for this build (missing EAS project ID).'
    default:
      return `Could not register for dispatch alerts${result.detail ? `: ${result.detail}` : '.'}`
  }
}
