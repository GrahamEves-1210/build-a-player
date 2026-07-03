import { createClient } from '@supabase/supabase-js'

const raw = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Strip any accidental path suffix (e.g. /rest/v1/ included in env var)
const url = raw ? raw.replace(/\/(rest|auth|storage|realtime)(\/.*)?$/, '').replace(/\/$/, '') : raw

export const supabase = (url && key && url.startsWith('https://'))
  ? createClient(url, key)
  : null
