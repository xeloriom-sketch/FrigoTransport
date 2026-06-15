'use client'

import { useEffect, useState, useRef } from 'react'
import type { Truck } from '@/types'
import { Plus, QrCode, Trash2, Loader2, Printer, X } from 'lucide-react'

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrModal, setQrModal] = useState<Truck | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await fetch('/api/trucks')
    const data = await res.json()
    setTrucks(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addTruck(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/trucks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, plate_number: plate }),
    })
    setName('')
    setPlate('')
    setSaving(false)
    load()
  }

  async function deleteTruck(id: string) {
    if (!confirm('Supprimer ce camion ?')) return
    await fetch('/api/trucks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  async function showQR(truck: Truck) {
    setQrModal(truck)
    setTimeout(async () => {
      if (!qrRef.current) return
      const QRCode = (await import('qrcode')).default
      const url = `${window.location.origin}/scan?t=${truck.qr_token}`
      const canvas = await QRCode.toCanvas(url, { width: 280, margin: 2 })
      qrRef.current.innerHTML = ''
      qrRef.current.appendChild(canvas)
    }, 100)
  }

  function printQR(truck: Truck) {
    const url = `${window.location.origin}/scan?t=${truck.qr_token}`
    const win = window.open('', '_blank')!
    win.document.write(`
      <html><head><title>QR — ${truck.name}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h2 { margin: 0 0 4px; font-size: 24px; }
        p { color: #64748b; margin: 0 0 20px; font-size: 14px; }
        .note { color: #94a3b8; font-size: 11px; margin-top: 12px; }
      </style></head>
      <body>
        <h2>${truck.name}</h2>
        <p>${truck.plate_number}</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}" width="280" height="280" />
        <p class="note">Scanner pour pointer en arrivée</p>
        <script>window.onload=()=>window.print()</script>
      </body></html>
    `)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Gestion des camions</h1>
        <p className="text-slate-500 text-sm">Ajoutez des camions et générez leurs QR codes</p>
      </div>

      {/* Formulaire ajout */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Ajouter un camion</h2>
        <form onSubmit={addTruck} className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nom (ex: Camion 01)"
            required
            className="flex-1 min-w-40 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <input
            value={plate}
            onChange={e => setPlate(e.target.value)}
            placeholder="Immatriculation (ex: AB-123-CD)"
            required
            className="flex-1 min-w-40 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </button>
        </form>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : trucks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Aucun camion enregistré</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Camion</th>
                <th className="px-4 py-3 text-left font-medium">Immatriculation</th>
                <th className="px-4 py-3 text-left font-medium">Ajouté le</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trucks.map(truck => (
                <tr key={truck.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">{truck.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{truck.plate_number}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(truck.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => showQR(truck)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg text-xs font-medium transition"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        QR Code
                      </button>
                      <button
                        onClick={() => printQR(truck)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimer
                      </button>
                      <button
                        onClick={() => deleteTruck(truck.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal QR */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-xs w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-slate-800">{qrModal.name}</p>
                <p className="text-xs text-slate-500">{qrModal.plate_number}</p>
              </div>
              <button
                onClick={() => setQrModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div ref={qrRef} className="flex justify-center mb-4 rounded-xl overflow-hidden bg-slate-50 p-3" />
            <p className="text-center text-xs text-slate-400 mb-4">
              Collez ce QR dans le camion
            </p>
            <button
              onClick={() => printQR(qrModal)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-sm font-medium transition"
            >
              <Printer className="w-4 h-4" />
              Imprimer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
