import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  // Pendant le pre-render SSG (build), on retourne un client vide — les données
  // sont chargées côté client uniquement (useEffect), donc pas d'impact
  if (!url || !key) {
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-anon-key-for-build-only')
  }

  return createBrowserClient(url, key)
}
