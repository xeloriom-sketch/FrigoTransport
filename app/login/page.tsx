'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message.includes('confirm')
        ? 'Confirmez votre email avant de vous connecter'
        : 'Email ou mot de passe incorrect'
      )
      setLoading(false)
      return
    }
    router.push(next)
  }

  return (
    <div className="w-full h-screen flex items-center justify-center p-4 sm:p-6 bg-bg-main overflow-hidden" style={{ letterSpacing: '-0.01em' }}>
      <div className="w-full max-w-[1100px] h-full max-h-[700px] grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Panneau gauche */}
        <div className="relative hidden lg:flex flex-col justify-between p-10 rounded-3xl bg-bg-card border border-border-thin overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 bg-cover bg-center mix-blend-luminosity pointer-events-none"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&auto=format&fit=crop&q=60')" }}
          />
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="120" x2="1000" y2="120" stroke="white" strokeWidth="0.5" />
              <line x1="0" y1="320" x2="1000" y2="320" stroke="white" strokeWidth="0.5" />
              <line x1="180" y1="0" x2="180" y2="800" stroke="white" strokeWidth="0.5" />
              <line x1="420" y1="0" x2="420" y2="800" stroke="white" strokeWidth="0.5" />
            </svg>
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white rounded-md flex items-center justify-center">
                <div className="w-2 h-2 bg-black rounded-full" />
              </div>
              <span className="text-lg font-bold tracking-tight">FrigoTransport.</span>
            </div>
            <Link href="/register/" className="text-xs font-medium text-neutral-300 bg-bg-main border border-border-thin px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-neutral-800 transition">
              Créer un compte <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="relative z-10 space-y-5">
            <h1 className="text-3xl font-medium tracking-tight leading-tight max-w-xs text-neutral-100">
              Gérez votre flotte,<br />tracez vos camions.
            </h1>
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-6 bg-white rounded-full" />
              <div className="h-[2px] w-2 bg-neutral-700 rounded-full" />
              <div className="h-[2px] w-2 bg-neutral-700 rounded-full" />
            </div>
          </div>
        </div>

        {/* Panneau droit — formulaire */}
        <div className="flex flex-col justify-center px-4 sm:px-10 lg:px-14">
          <div className="mb-8">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-2">
              Connexion
            </h2>
            <p className="text-sm text-txt-muted">
              Pas encore de compte ?{' '}
              <Link href="/register/" className="text-neutral-200 underline underline-offset-4 hover:text-white transition">
                S'inscrire
              </Link>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Email"
              className="w-full bg-bg-card border border-border-thin rounded-xl px-4 py-3 text-sm text-white placeholder-txt-muted transition focus:bg-bg-input focus:outline-none focus:border-neutral-600"
              style={{ colorScheme: 'dark' }}
            />

            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Mot de passe"
                className="w-full bg-bg-card border border-border-thin rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-txt-muted transition focus:bg-bg-input focus:outline-none focus:border-neutral-600"
                style={{ colorScheme: 'dark' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-white transition p-1"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs px-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-black font-semibold text-sm py-3 rounded-xl hover:bg-[#d2eb57] active:scale-[0.99] transition duration-150 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Connexion...</> : 'Se connecter'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-txt-muted" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
