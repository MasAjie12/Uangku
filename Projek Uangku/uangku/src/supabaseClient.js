import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diatur. Salin file .env.example menjadi .env dan isi dengan data project Supabase kamu.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Uangku memakai "username" untuk login, tapi Supabase Auth butuh format email.
// Supaya tetap sederhana, username diubah jadi email palsu dengan domain tetap.
export const USERNAME_DOMAIN = '@uangku.local'

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}${USERNAME_DOMAIN}`
}
