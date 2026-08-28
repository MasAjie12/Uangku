import { supabase } from './supabaseClient'

export const PUSH_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

export async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Browser ini tidak mendukung Service Worker.')
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export function isPushSupported() {
  return Boolean(
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window,
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export async function getPushState() {
  if (!isPushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }
  const registration = await registerPushServiceWorker()
  const subscription = await registration.pushManager.getSubscription()
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
    subscription,
  }
}

export async function enablePushNotifications(profile) {
  if (!isPushSupported()) throw new Error('Browser HP ini belum mendukung Push Notification.')
  if (!PUSH_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY belum diatur di file .env.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Izin notifikasi tidak diberikan.')

  const registration = await registerPushServiceWorker()
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Data subscription browser tidak lengkap.')
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: profile.id,
      keluarga_id: profile.keluarga_id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      expiration_time: subscription.expirationTime || null,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return subscription
}

export async function disablePushNotifications() {
  if (!isPushSupported()) return
  const registration = await registerPushServiceWorker()
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
