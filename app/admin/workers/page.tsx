'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/types'
import { Loader2, Shield, User, Plus, X, ArrowUpRight, AlertCircle } from 'lucide-react'

export default function WorkersPage() {
  const { loading: authLoading } = useAuth('admin')
  const supabase = createClient()

  const [workers, setWorkers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setWorkers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (!authLoading) load() }, [authLoading])

  async function createWorker(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    // Étape 1 : créer le compte auth
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name, role: 'worker' } },
    })

    if (signUpErr) {
      // Si "signups disabled" → essayer de créer le profil manuellement
      // pour les utilisateurs déjà créés côté Supabase par d'autres moyens
      setError(`Erreur Supabase : ${signUpErr.message}. Active les inscriptions email dans Supabase → Authentication → Providers → Email.`)
      setSaving(false)
      return
    }

    // Étape 2 : insérer profil
    if (signUpData.user) {
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        full_name: form.full_name,
        role: 'worker',
      }, { onConflict: 'id' })

      if (profileErr) {
        setError(`Compte créé mais profil échoué : ${profileErr.message}`)
      } else {
        setSuccess(`Compte créé pour ${form.full_name} ! L'ouvrier peut maintenant se connecter.`)
        setForm({ full_name: '', email: '', password: '' })
        setShowForm(false)
        load()
      }
    }

    setSaving(false)
  }

  if (authLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-txt-muted" /></div>

  return (
    <div className="max-w-4xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-medium text-white">Ouvriers</h1>
          <p className="text-xs text-txt-muted mt-0.5">Gérez les comptes de vos ouvriers</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-yellow-300 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Créer un compte
        </button>
      </div>

      {/* Alerte si signups désactivés */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-300 leading-relaxed">
          <strong className="text-amber-200">Si tu vois "Email signups are disabled" :</strong><br />
          Va sur <a href="https://supabase.com/dashboard/project/pomscilzzjnlevrwyvap/auth/providers" target="_blank" className="underline">Supabase → Auth → Providers → Email</a> → active le provider et décoche "Confirm email".
        </div>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="bg-bg-card border border-border-thin rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-white">Nouveau compte ouvrier</h2>
            <button onClick={() => setShowForm(false)} className="p-1 text-txt-muted hover:text-white transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={createWorker} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-txt-muted mb-1.5 uppercase tracking-wider">Nom complet</label>
                <input
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  required placeholder="Prénom Nom"
                  className="w-full px-3 py-2.5 bg-bg-input border border-border-thin rounded-xl text-white text-sm placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent/50 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] text-txt-muted mb-1.5 uppercase tracking-wider">Email</label>
                <input
                  type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required placeholder="nom@email.fr"
                  className="w-full px-3 py-2.5 bg-bg-input border border-border-thin rounded-xl text-white text-sm placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent/50 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] text-txt-muted mb-1.5 uppercase tracking-wider">Mot de passe</label>
                <input
                  type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required minLength={6} placeholder="Min. 6 caractères"
                  className="w-full px-3 py-2.5 bg-bg-input border border-border-thin rounded-xl text-white text-sm placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent/50 transition"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-300 text-xs">{error}</div>
            )}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-emerald-300 text-xs">{success}</div>
            )}

            <button
              type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-yellow-300 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {saving ? 'Création...' : 'Créer le compte'}
            </button>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-border-thin rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-txt-muted" /></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] text-txt-muted border-b border-border-thin font-medium uppercase tracking-wider">
                <th className="px-5 py-3 font-normal">Nom</th>
                <th className="px-5 py-3 font-normal">Rôle</th>
                <th className="px-5 py-3 font-normal">Inscrit le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/60 text-xs">
              {workers.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-txt-muted">Aucun ouvrier</td></tr>
              )}
              {workers.map(w => (
                <tr key={w.id} className="hover:bg-neutral-800/20 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-white font-medium">{w.full_name}</p>
                    <p className="text-txt-muted text-[10px] mt-0.5">{w.phone || '—'}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium ${
                      w.role === 'admin' ? 'bg-accent/10 text-accent' : 'bg-bg-input text-txt-muted'
                    }`}>
                      {w.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {w.role === 'admin' ? 'Admin' : 'Ouvrier'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-txt-muted">
                    {new Date(w.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
