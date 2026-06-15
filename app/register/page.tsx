'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react'

type Step = 'form' | 'done'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [agree, setAgree] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('form')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!agree) { setError('Acceptez les conditions d\'utilisation'); return }
    if (form.password.length < 6) { setError('Minimum 6 caractères'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const full_name = `${form.first_name} ${form.last_name}`.trim()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name, role: 'worker' } },
    })

    if (signUpError) {
      const msg = signUpError.message.includes('already') ? 'Email déjà utilisé'
        : signUpError.message.includes('rate') ? 'Trop de tentatives, réessayez dans quelques minutes'
        : signUpError.message.includes('disabled') ? 'Les inscriptions sont désactivées — contactez votre responsable'
        : signUpError.message
      setError(msg)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').upsert(
        { id: data.user.id, full_name, role: 'worker' },
        { onConflict: 'id' }
      )
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    setLoading(false)
    if (!loginError) {
      setStep('done')
      setTimeout(() => router.push('/worker/'), 1200)
    } else {
      setError('Inscription réussie mais connexion impossible. Contactez votre responsable.')
    }
  }

  if (step === 'done') return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-7 h-7 text-accent" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Bienvenue !</h2>
        <p className="text-txt-muted text-sm">Connexion en cours...</p>
      </div>
    </div>
  )

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
            <svg className="w-full h-full" fill="none">
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
            <Link href="/login/" className="text-xs font-medium text-neutral-300 bg-bg-main border border-border-thin px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-neutral-800 transition">
              Se connecter <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="relative z-10 space-y-5">
            <h1 className="text-3xl font-medium tracking-tight leading-tight max-w-xs text-neutral-100">
              Gérez votre flotte,<br />tracez vos camions.
            </h1>
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-2 bg-neutral-700 rounded-full" />
              <div className="h-[2px] w-2 bg-neutral-700 rounded-full" />
              <div className="h-[2px] w-6 bg-white rounded-full" />
            </div>
          </div>
        </div>

        {/* Panneau droit — formulaire */}
        <div className="flex flex-col justify-center px-4 sm:px-10 lg:px-14">
          <div className="mb-7">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-2">
              Créer un compte
            </h2>
            <p className="text-sm text-txt-muted">
              Déjà un compte ?{' '}
              <Link href="/login/" className="text-neutral-200 underline underline-offset-4 hover:text-white transition">
                Se connecter
              </Link>
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                required
                placeholder="Prénom"
                className="w-full bg-bg-card border border-border-thin rounded-xl px-4 py-3 text-sm text-white placeholder-txt-muted transition focus:bg-bg-input focus:outline-none focus:border-neutral-600"
              />
              <input
                type="text"
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                required
                placeholder="Nom"
                className="w-full bg-bg-card border border-border-thin rounded-xl px-4 py-3 text-sm text-white placeholder-txt-muted transition focus:bg-bg-input focus:outline-none focus:border-neutral-600"
              />
            </div>

            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              placeholder="Email"
              className="w-full bg-bg-card border border-border-thin rounded-xl px-4 py-3 text-sm text-white placeholder-txt-muted transition focus:bg-bg-input focus:outline-none focus:border-neutral-600"
            />

            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                placeholder="Mot de passe"
                className="w-full bg-bg-card border border-border-thin rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-txt-muted transition focus:bg-bg-input focus:outline-none focus:border-neutral-600"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-white transition p-1"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2 py-1">
              <label className="relative flex items-center cursor-pointer">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="sr-only" />
                <div className={`w-4 h-4 rounded border transition flex items-center justify-center ${agree ? 'bg-white border-white' : 'bg-bg-card border-border-thin'}`}>
                  {agree && (
                    <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </label>
              <span className="text-xs text-txt-muted">
                J'accepte les{' '}
                <a href="#" className="text-neutral-300 underline underline-offset-2 hover:text-white">Conditions d'utilisation</a>
              </span>
            </div>

            {error && <p className="text-red-400 text-xs px-1">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-black font-semibold text-sm py-3 rounded-xl hover:bg-[#d2eb57] active:scale-[0.99] transition duration-150 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Création...</> : 'Créer et se connecter'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
