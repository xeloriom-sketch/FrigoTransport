'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/types'
import { Loader2, Shield, User, Info } from 'lucide-react'

export default function WorkersPage() {
  const { loading: authLoading } = useAuth('admin')
  const supabase = createClient()
  const [workers, setWorkers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setWorkers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (!authLoading) load() }, [authLoading])

  if (authLoading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Ouvriers</h1>
        <p className="text-slate-500 text-sm">Liste des comptes enregistrés</p>
      </div>

      <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-700">
        <Info className="w-4 h-4 mt-0.5 shrink-0"/>
        <span>Les ouvriers créent leur compte eux-mêmes sur <strong>/register</strong>. Pour définir un admin, changez le rôle directement dans Supabase → Table Editor → profiles.</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400"/></div>
        ) : workers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Aucun ouvrier enregistré</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nom</th>
                <th className="px-4 py-3 text-left font-medium">Téléphone</th>
                <th className="px-4 py-3 text-left font-medium">Rôle</th>
                <th className="px-4 py-3 text-left font-medium">Inscrit le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map(w => (
                <tr key={w.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">{w.full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{w.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${w.role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                      {w.role === 'admin' ? <Shield className="w-3 h-3"/> : <User className="w-3 h-3"/>}
                      {w.role === 'admin' ? 'Admin' : 'Ouvrier'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{new Date(w.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
