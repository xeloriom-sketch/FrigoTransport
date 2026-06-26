'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/types'
import { Loader2, Shield, User, Plus, X, Trash2, AlertTriangle } from 'lucide-react'

export default function WorkersPage() {
  const { loading: authLoading } = useAuth('admin')
  const supabase = createClient()

  const [workers, setWorkers]     = useState<Profile[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ full_name: '', email: '', password: '' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting]   = useState(false)

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setWorkers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (!authLoading) load() }, [authLoading])

  async function createWorker(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess('')

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const SERVICE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password, email_confirm: true, user_metadata: { full_name: form.full_name, role: 'worker' } }),
    })

    const newUser = await res.json()
    if (!res.ok || !newUser.id) {
      const msg = newUser.msg || newUser.message || 'Erreur lors de la création'
      setError(msg.includes('already') ? 'Email déjà utilisé' : msg)
      setSaving(false); return
    }

    await supabase.from('profiles').upsert({ id: newUser.id, full_name: form.full_name, role: 'worker' }, { onConflict: 'id' })
    setSuccess(`✓ Compte créé pour ${form.full_name}.`)
    setForm({ full_name: '', email: '', password: '' })
    setShowForm(false); setSaving(false)
    load()
  }

  async function deleteWorker() {
    if (!deleteTarget) return
    setDeleting(true)

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const SERVICE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!

    // 1. Fermer toutes les affectations actives
    await supabase.from('assignments')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('worker_id', deleteTarget.id).eq('is_active', true)

    // 2. Supprimer le profil (cascade sur assignments/locations via FK)
    await supabase.from('profiles').delete().eq('id', deleteTarget.id)

    // 3. Supprimer le compte auth via admin API
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY },
    })

    setDeleteTarget(null); setDeleting(false)
    load()
  }

  if (authLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-txt-muted" /></div>

  return (
    <div className="max-w-4xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-medium text-white">Ouvriers</h1>
          <p className="text-xs text-txt-muted mt-0.5">{workers.length} compte{workers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-black text-xs font-semibold rounded-xl hover:bg-yellow-300 transition active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Créer un compte</span>
          <span className="sm:hidden">Ajouter</span>
        </button>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-300 text-sm">{success}</div>
      )}

      {/* Modal création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-bg-card border border-border-thin rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-5"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Nouveau compte ouvrier</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-txt-muted hover:text-white transition rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={createWorker} className="space-y-3">
              <div>
                <label className="block text-[10px] text-txt-muted mb-1.5 uppercase tracking-wider">Nom complet</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required placeholder="Prénom Nom"
                  className="w-full px-3 py-3 bg-bg-input border border-border-thin rounded-xl text-white text-sm placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] text-txt-muted mb-1.5 uppercase tracking-wider">Email</label>
                <input type="text" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="nom@email.fr"
                  className="w-full px-3 py-3 bg-bg-input border border-border-thin rounded-xl text-white text-sm placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent/50 transition" />
              </div>
              <div>
                <label className="block text-[10px] text-txt-muted mb-1.5 uppercase tracking-wider">Mot de passe</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} placeholder="Min. 6 caractères"
                  className="w-full px-3 py-3 bg-bg-input border border-border-thin rounded-xl text-white text-sm placeholder-txt-muted focus:outline-none focus:ring-1 focus:ring-accent/50 transition" />
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-300 text-xs">{error}</div>}
              <button type="submit" disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-yellow-300 transition disabled:opacity-50 active:scale-95">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? 'Création...' : 'Créer le compte'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null) }}>
          <div className="bg-bg-card border border-border-thin rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm p-5"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/15 border border-red-500/20 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Supprimer ce compte ?</p>
                <p className="text-txt-muted text-xs mt-0.5">{deleteTarget.full_name}</p>
              </div>
            </div>
            <p className="text-txt-muted text-xs mb-5 leading-relaxed">
              Le compte sera définitivement supprimé. L'historique GPS et les affectations seront perdus.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-3 bg-bg-input border border-border-thin text-white text-sm rounded-xl hover:bg-neutral-800 transition disabled:opacity-50">
                Annuler
              </button>
              <button onClick={deleteWorker} disabled={deleting}
                className="flex-1 py-3 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table desktop */}
      {!loading && (
        <div className="hidden md:block bg-bg-card border border-border-thin rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] text-txt-muted border-b border-border-thin font-medium uppercase tracking-wider">
                <th className="px-5 py-3 font-normal">Nom</th>
                <th className="px-5 py-3 font-normal">Rôle</th>
                <th className="px-5 py-3 font-normal">Inscrit le</th>
                <th className="px-5 py-3 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/60 text-xs">
              {workers.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-txt-muted">Aucun ouvrier</td></tr>
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
                  <td className="px-5 py-3 text-txt-muted">{new Date(w.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-5 py-3 text-right">
                    {w.role !== 'admin' && (
                      <button onClick={() => setDeleteTarget(w)}
                        className="p-1.5 text-txt-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cartes mobile */}
      {!loading && (
        <div className="md:hidden space-y-3">
          {workers.length === 0 && (
            <div className="bg-bg-card border border-border-thin rounded-2xl p-8 text-center text-txt-muted text-sm">Aucun ouvrier</div>
          )}
          {workers.map(w => (
            <div key={w.id} className="bg-bg-card border border-border-thin rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-bg-input flex items-center justify-center shrink-0">
                {w.role === 'admin' ? <Shield className="w-5 h-5 text-accent" /> : <User className="w-5 h-5 text-txt-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{w.full_name}</p>
                <p className="text-txt-muted text-[11px] mt-0.5">
                  {w.role === 'admin' ? 'Administrateur' : 'Ouvrier'} · {new Date(w.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {w.role !== 'admin' && (
                <button onClick={() => setDeleteTarget(w)}
                  className="p-2.5 text-txt-muted hover:text-red-400 hover:bg-red-500/10 rounded-xl transition shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-txt-muted" /></div>}
    </div>
  )
}
