'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { Truck } from '@/types'
import { Plus, QrCode, Trash2, Loader2, Printer, X } from 'lucide-react'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://xeloriom-sketch.github.io/FrigoTransport'

export default function TrucksPage() {
  const { loading: authLoading } = useAuth('admin')
  const supabase = createClient()
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrModal, setQrModal] = useState<Truck | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)

  async function load() {
    const { data } = await supabase.from('trucks').select('*').order('created_at', { ascending: false })
    setTrucks(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (!authLoading) load() }, [authLoading])

  async function addTruck(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('trucks').insert({ name, plate_number: plate })
    setName(''); setPlate('')
    setSaving(false)
    load()
  }

  async function deleteTruck(id: string) {
    if (!confirm('Supprimer ce camion ?')) return
    await supabase.from('trucks').delete().eq('id', id)
    load()
  }

  async function showQR(truck: Truck) {
    setQrModal(truck)
    setTimeout(async () => {
      if (!qrRef.current) return
      try {
        const QRCode = (await import('qrcode')).default
        const url = `${APP_URL}/scan/?t=${truck.qr_token}`
        const canvas = await QRCode.toCanvas(url, { width: 240, margin: 2 })
        qrRef.current.innerHTML = ''
        qrRef.current.appendChild(canvas)
      } catch (err) {
        console.error('QR error', err)
      }
    }, 200)
  }

  function printQR(truck: Truck) {
    const url = `${APP_URL}/scan/?t=${truck.qr_token}`
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>QR — ${truck.name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#fff}h2{margin:0 0 4px}p{color:#666;margin:0 0 20px;font-size:14px}.note{color:#999;font-size:11px;margin-top:12px}</style></head>
      <body><h2>${truck.name}</h2><p>${truck.plate_number}</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}" width="280" height="280"/>
      <p class="note">Scanner pour pointer à l'arrivée</p>
      <script>window.onload=()=>window.print()</script></body></html>`)
  }

  if (authLoading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-txt-muted" /></div>

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-[16px] font-medium text-white">Camions</h1>
        <p className="text-xs text-txt-muted mt-0.5">Ajoutez des camions et générez leurs QR codes</p>
      </div>

      {/* Formulaire */}
      <div className="bg-bg-card border border-border-thin rounded-2xl p-4 lg:p-5">
        <h2 className="text-sm font-medium text-white mb-4">Ajouter un camion</h2>
        <form onSubmit={addTruck} className="space-y-3">
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Nom du camion (ex: Camion 01)" required
            className="w-full px-3 py-3 bg-bg-input border border-border-thin rounded-xl text-white text-sm placeholder-txt-muted focus:outline-none focus:border-neutral-600 transition"
          />
          <input
            value={plate} onChange={e => setPlate(e.target.value)}
            placeholder="Immatriculation (ex: AB-123-CD)" required
            className="w-full px-3 py-3 bg-bg-input border border-border-thin rounded-xl text-white text-sm placeholder-txt-muted focus:outline-none focus:border-neutral-600 transition"
          />
          <button
            type="submit" disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-[#d2eb57] transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </button>
        </form>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-txt-muted" /></div>
      ) : trucks.length === 0 ? (
        <div className="bg-bg-card border border-border-thin rounded-2xl p-10 text-center text-txt-muted text-sm">
          Aucun camion enregistré
        </div>
      ) : (
        <>
          {/* Table desktop */}
          <div className="hidden md:block bg-bg-card border border-border-thin rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] text-txt-muted border-b border-border-thin uppercase tracking-wider">
                  <th className="px-5 py-3 font-normal">Camion</th>
                  <th className="px-5 py-3 font-normal">Immatriculation</th>
                  <th className="px-5 py-3 font-normal">Ajouté le</th>
                  <th className="px-5 py-3 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900/60 text-xs">
                {trucks.map(truck => (
                  <tr key={truck.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-white">{truck.name}</td>
                    <td className="px-5 py-3 font-mono text-txt-muted">{truck.plate_number}</td>
                    <td className="px-5 py-3 text-txt-muted">{new Date(truck.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => showQR(truck)} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-input border border-border-thin hover:border-neutral-600 text-white rounded-lg text-[11px] font-medium transition">
                          <QrCode className="w-3.5 h-3.5 text-txt-muted" /> QR Code
                        </button>
                        <button onClick={() => printQR(truck)} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-input border border-border-thin hover:border-neutral-600 text-white rounded-lg text-[11px] font-medium transition">
                          <Printer className="w-3.5 h-3.5 text-txt-muted" /> Imprimer
                        </button>
                        <button onClick={() => deleteTruck(truck.id)} className="p-1.5 text-txt-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes mobile */}
          <div className="md:hidden space-y-3">
            {trucks.map(truck => (
              <div key={truck.id} className="bg-bg-card border border-border-thin rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{truck.name}</p>
                    <p className="font-mono text-xs text-txt-muted mt-0.5">{truck.plate_number}</p>
                  </div>
                  <button onClick={() => deleteTruck(truck.id)} className="p-2 text-txt-muted hover:text-red-400 hover:bg-red-500/10 rounded-xl transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => showQR(truck)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-bg-input border border-border-thin text-white rounded-xl text-xs font-medium transition active:scale-95"
                  >
                    <QrCode className="w-4 h-4 text-txt-muted" /> QR Code
                  </button>
                  <button
                    onClick={() => printQR(truck)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-bg-input border border-border-thin text-white rounded-xl text-xs font-medium transition active:scale-95"
                  >
                    <Printer className="w-4 h-4 text-txt-muted" /> Imprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal QR */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-bg-card border border-border-thin rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-xs"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-semibold text-white text-sm">{qrModal.name}</p>
                <p className="text-[11px] text-txt-muted font-mono mt-0.5">{qrModal.plate_number}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="p-1.5 text-txt-muted hover:text-white transition rounded-lg hover:bg-bg-input">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div ref={qrRef} className="flex justify-center bg-white rounded-xl p-3 mb-4" />
            <p className="text-center text-[11px] text-txt-muted mb-4">Collez ce QR dans le camion</p>
            <button
              onClick={() => printQR(qrModal)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-black rounded-xl text-sm font-semibold hover:bg-[#d2eb57] transition active:scale-95"
            >
              <Printer className="w-4 h-4" /> Imprimer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
