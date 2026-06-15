'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle, CheckCircle, Mail } from 'lucide-react'

type Step = 'form' | 'confirm_email' | 'done'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('form')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (form.password.length < 6) { setError('Minimum 6 caractères'); return }

    setLoading(true)
    const supabase = createClient()

    // Inscription
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: 'worker' } },
    })

    if (signUpError) {
      setError(signUpError.message.includes('already') ? 'Email déjà utilisé' : signUpError.message)
      setLoading(false)
      return
    }

    // Insérer profil (fallback si trigger non déclenché)
    if (data.user) {
      await supabase.from('profiles').upsert(
        { id: data.user.id, full_name: form.full_name, role: 'worker' },
        { onConflict: 'id' }
      )
    }

    // Connexion automatique directe
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    setLoading(false)

    if (!loginError) {
      setStep('done')
      setTimeout(() => router.push('/worker/'), 1200)
    } else {
      // Email confirmation requise (Supabase settings)
      setStep('confirm_email')
    }
  }

  if (step === 'done') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Bienvenue !</h2>
        <p className="text-slate-400 text-sm">Connexion en cours...</p>
      </div>
    </div>
  )

  if (step === 'confirm_email') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white/[0.06] border border-white/10 rounded-3xl p-8 text-center">
          <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Mail className="w-7 h-7 text-sky-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Vérifiez votre email</h2>
          <p className="text-slate-400 text-sm mb-2">
            Un lien a été envoyé à
          </p>
          <p className="text-white font-medium text-sm mb-6">{form.email}</p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-xs text-amber-300 text-left leading-relaxed">
            <strong className="text-amber-200">Pour le patron :</strong> Désactivez la confirmation email dans Supabase → Authentication → Providers → Email → décochez "Confirm email".
          </div>
          <Link href="/login/" className="block w-full py-3 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-xl transition text-sm">
            Aller à la connexion
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-sky-400 to-sky-600 rounded-2xl shadow-lg shadow-sky-500/30 mb-5">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h8l2-2zM16 6h3l3 4v6h-6V6z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">FrigoTransport</h1>
          <p className="text-slate-400 mt-1 text-sm">Créer mon compte ouvrier</p>
        </div>

        <div className="bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Nom complet</label>
              <input
                type="text" value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                required placeholder="Prénom Nom"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Email</label>
              <input
                type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required placeholder="nom@email.fr"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Mot de passe</label>
                <input
                  type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required placeholder="••••••••" minLength={6}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Confirmer</label>
                <input
                  type="password" value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  required placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-sky-500/20 mt-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Création...</> : "Créer et se connecter"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-slate-500 text-sm">
              Déjà un compte ?{' '}
              <Link href="/login/" className="text-sky-400 hover:text-sky-300 font-medium transition">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
