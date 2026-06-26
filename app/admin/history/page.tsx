'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Truck, Clock, Gauge, AlertTriangle, MapPin, Loader2, Route, ChevronRight } from 'lucide-react'
import type { Location } from '@/types'

const TripMap = dynamic(() => import('@/components/TripMap'), { ssr: false })

interface TruckOption { id: string; name: string; plate_number: string }

// ── Helpers ──────────────────────────────────────────────────────────────────
function haversineKm(a: Location, b: Location) {
  const R = 6371
  const dLat = (b.latitude  - a.latitude)  * Math.PI / 180
  const dLng = (b.longitude - a.longitude) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function fmtDuration(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const supabase = createClient()

  const [trucks,  setTrucks]  = useState<TruckOption[]>([])
  const [truckId, setTruckId] = useState<string>('')
  const [date,    setDate]    = useState(todayStr())
  const [points,  setPoints]  = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded,  setLoaded]  = useState(false)

  // Charger la liste des camions
  useEffect(() => {
    supabase.from('trucks').select('id,name,plate_number').order('name')
      .then(({ data }) => {
        if (data) { setTrucks(data); if (data.length > 0) setTruckId(data[0].id) }
      })
  }, [])

  const loadTrip = useCallback(async () => {
    if (!truckId) return
    setLoading(true)
    setLoaded(false)

    const from = `${date}T00:00:00`
    const to   = `${date}T23:59:59`

    const { data } = await supabase
      .from('locations')
      .select('*')
      .eq('truck_id', truckId)
      .gte('recorded_at', from)
      .lte('recorded_at', to)
      .order('recorded_at', { ascending: true })

    const valid = (data ?? []).filter(
      p => !(Math.abs(p.latitude) < 0.001 && Math.abs(p.longitude) < 0.001)
    )
    setPoints(valid)
    setLoading(false)
    setLoaded(true)
  }, [truckId, date])

  // Stats calculées
  const totalKm = points.length > 1
    ? points.slice(1).reduce((acc, p, i) => acc + haversineKm(points[i], p), 0)
    : 0

  const duration = points.length > 1
    ? new Date(points.at(-1)!.recorded_at).getTime() - new Date(points[0].recorded_at).getTime()
    : 0

  const speeds   = points.map(p => (p.speed ?? 0) * 3.6).filter(s => s > 0)
  const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b) / speeds.length : 0
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0
  const overSpeed = points.filter(p => (p.speed ?? 0) * 3.6 > 90).length

  const selectedTruck = trucks.find(t => t.id === truckId)

  return (
    <div className="max-w-5xl space-y-4" style={{ animation: 'fadeInUp .4s cubic-bezier(0.22,1,0.36,1) both' }}>

      {/* ── En-tête + sélecteurs ── */}
      <div>
        <h1 className="text-[16px] font-medium text-white">Historique des trajets</h1>
        <p className="text-xs text-txt-muted mt-0.5">Replay complet du trajet par camion et par jour</p>
      </div>

      <div className="bg-bg-card border border-border-thin rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        {/* Sélecteur camion */}
        <div className="flex-1">
          <label className="text-[10px] text-txt-muted uppercase tracking-wider block mb-1.5">Camion</label>
          <div className="relative">
            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-txt-muted pointer-events-none" />
            <select
              value={truckId}
              onChange={e => setTruckId(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-bg-input border border-border-thin rounded-xl text-white text-sm focus:outline-none focus:border-neutral-600 transition appearance-none"
            >
              {trucks.map(t => (
                <option key={t.id} value={t.id}>{t.name} — {t.plate_number}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sélecteur date */}
        <div className="flex-1">
          <label className="text-[10px] text-txt-muted uppercase tracking-wider block mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 bg-bg-input border border-border-thin rounded-xl text-white text-sm focus:outline-none focus:border-neutral-600 transition"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={loadTrip}
            disabled={loading || !truckId}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-[#d2eb57] transition disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Route className="w-4 h-4" />}
            Voir le trajet
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {loaded && points.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5"
          style={{ animation: 'fadeInUp .35s cubic-bezier(0.22,1,0.36,1) both' }}>
          {[
            { icon: Route,         label: 'Distance',   value: `${totalKm.toFixed(1)} km`,          color: 'text-accent' },
            { icon: Clock,         label: 'Durée',      value: fmtDuration(duration),               color: 'text-blue-400' },
            { icon: Gauge,         label: 'Vitesse moy', value: `${Math.round(avgSpeed)} km/h`,     color: 'text-purple-400' },
            { icon: AlertTriangle, label: 'Excès 90 km/h', value: `${overSpeed} point${overSpeed !== 1 ? 's' : ''}`, color: overSpeed > 0 ? 'text-red-400' : 'text-txt-muted' },
          ].map(({ icon: Icon, label, value, color }, i) => (
            <div key={label} className="bg-bg-card border border-border-thin rounded-2xl p-4"
              style={{ animation: 'fadeInUp .35s cubic-bezier(0.22,1,0.36,1) both', animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <span className="text-[10px] text-txt-muted uppercase tracking-wider">{label}</span>
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Carte ── */}
      {loaded && (
        <div className="bg-bg-card border border-border-thin rounded-2xl overflow-hidden"
          style={{ height: 440, animation: 'fadeInUp .4s cubic-bezier(0.22,1,0.36,1) .1s both' }}>
          {points.length > 0
            ? <TripMap points={points} />
            : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-6">
                <div className="w-12 h-12 bg-bg-input rounded-2xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-txt-muted" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Aucun trajet ce jour</p>
                  <p className="text-txt-muted text-xs mt-1">
                    {selectedTruck?.name} n'a pas enregistré de positions le {
                      new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                    }
                  </p>
                </div>
              </div>
            )
          }
        </div>
      )}

      {/* ── Timeline des arrêts / vitesse excessive ── */}
      {loaded && points.length > 0 && (
        <div className="bg-bg-card border border-border-thin rounded-2xl p-4"
          style={{ animation: 'fadeInUp .4s cubic-bezier(0.22,1,0.36,1) .15s both' }}>
          <h3 className="text-[13px] font-medium text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-txt-muted" />
            Timeline du trajet
          </h3>

          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {/* Départ */}
            <TimelineItem
              time={points[0].recorded_at}
              label="Départ"
              sub={`${selectedTruck?.name}`}
              dot="bg-green-500"
            />

            {/* Points à vitesse excessive */}
            {points
              .filter(p => (p.speed ?? 0) * 3.6 > 90)
              .slice(0, 20)
              .map((p, i) => (
                <TimelineItem
                  key={i}
                  time={p.recorded_at}
                  label={`Excès de vitesse`}
                  sub={`${Math.round((p.speed ?? 0) * 3.6)} km/h`}
                  dot="bg-red-500"
                />
              ))
            }

            {/* Arrivée */}
            {points.length > 1 && (
              <TimelineItem
                time={points.at(-1)!.recorded_at}
                label="Arrivée"
                sub={`${points.length} points GPS · ${totalKm.toFixed(1)} km`}
                dot="bg-red-400"
              />
            )}
          </div>
        </div>
      )}

      {/* État initial (pas encore chargé) */}
      {!loaded && !loading && (
        <div className="bg-bg-card border border-border-thin rounded-2xl p-12 text-center">
          <div className="w-14 h-14 bg-bg-input rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Route className="w-6 h-6 text-txt-muted" />
          </div>
          <p className="text-white text-sm font-medium">Sélectionnez un camion et une date</p>
          <p className="text-txt-muted text-xs mt-1">puis cliquez sur "Voir le trajet"</p>
        </div>
      )}
    </div>
  )
}

function TimelineItem({ time, label, sub, dot }: { time: string; label: string; sub: string; dot: string }) {
  const t = new Date(time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border-thin last:border-0">
      <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span className="text-[11px] text-txt-muted font-mono shrink-0">{t}</span>
      <ChevronRight className="w-3 h-3 text-border-thin shrink-0" />
      <span className="text-[12px] text-white font-medium">{label}</span>
      <span className="text-[11px] text-txt-muted ml-auto shrink-0">{sub}</span>
    </div>
  )
}
