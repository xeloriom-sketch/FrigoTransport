'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import type { TruckPosition } from '@/types'
import type { LiveMapHandle } from '@/components/LiveMap'
import { Truck, Users, Activity, MapPin, ArrowUpRight, CheckCircle } from 'lucide-react'

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false })

interface ActiveAssignment {
  id: string
  started_at: string
  worker: { full_name: string }
  truck: { name: string; plate_number: string }
}

type TabFilter = 'Tous' | 'Actifs' | 'Terminés'

export default function AdminDashboard() {
  const { loading: authLoading } = useAuth('admin')
  const supabase = createClient()

  const [positions, setPositions]         = useState<TruckPosition[]>([])
  const [assignments, setAssignments]     = useState<ActiveAssignment[]>([])
  const [allAssignments, setAllAssignments] = useState<any[]>([])
  const [totalTrucks, setTotalTrucks]     = useState(0)
  const [totalWorkers, setTotalWorkers]   = useState(0)
  const [tab, setTab]                     = useState<TabFilter>('Actifs')
  const [focusTruckId, setFocusTruckId]  = useState<string | null>(null)
  const mapRef = useRef<LiveMapHandle>(null)

  const loadData = useCallback(async () => {
    const [locsRes, activeRes, allRes, truckCount, workerCount] = await Promise.all([
      // Dernières positions de TOUS les camions (actifs ET rangés) — via locations + dédup client-side
      supabase.from('locations')
        .select('truck_id, latitude, longitude, speed, accuracy, recorded_at, assignment_id, worker_id, truck:trucks(name, plate_number), worker:profiles(full_name), assignment:assignments(is_active)')
        .order('recorded_at', { ascending: false })
        .limit(300),
      supabase.from('assignments')
        .select('id, started_at, worker:profiles(full_name), truck:trucks(name, plate_number)')
        .eq('is_active', true)
        .order('started_at', { ascending: false }),
      // 1 seule ligne par camion (dernier utilisateur)
      supabase.from('assignments')
        .select('id, truck_id, started_at, ended_at, is_active, worker:profiles(full_name), truck:trucks(name, plate_number)')
        .order('started_at', { ascending: false })
        .limit(50),
      supabase.from('trucks').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'worker'),
    ])

    // Construire les positions carte : une par camion, la plus récente
    if (locsRes.data) {
      const seen = new Set<string>()
      const lastPos: TruckPosition[] = []
      for (const l of locsRes.data as any[]) {
        if (seen.has(l.truck_id)) continue
        seen.add(l.truck_id)
        lastPos.push({
          truck_id: l.truck_id,
          truck_name: (l.truck as any)?.name ?? '',
          plate_number: (l.truck as any)?.plate_number ?? '',
          worker_name: (l.worker as any)?.full_name ?? '',
          latitude: l.latitude,
          longitude: l.longitude,
          accuracy: l.accuracy,
          speed: l.speed,
          recorded_at: l.recorded_at,
          assignment_id: l.assignment_id,
          is_active: (l.assignment as any)?.is_active ?? false,
        })
      }
      setPositions(lastPos)
    }

    if (activeRes.data) setAssignments(activeRes.data as any)
    if (allRes.data) {
      // Dédupliquer : garder seulement le dernier par camion
      const seen = new Set<string>()
      const deduped = (allRes.data as any[]).filter(a => {
        if (seen.has(a.truck_id)) return false
        seen.add(a.truck_id)
        return true
      })
      setAllAssignments(deduped)
    }
    if (truckCount.count != null) setTotalTrucks(truckCount.count)
    if (workerCount.count != null) setTotalWorkers(workerCount.count)
  }, [])

  useEffect(() => {
    if (authLoading) return
    loadData()
    const channel = supabase.channel('realtime-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authLoading, loadData])

  if (authLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const activePercent = totalTrucks > 0 ? Math.round((assignments.length / totalTrucks) * 100) : 0

  const filteredAssignments = allAssignments.filter(a => {
    if (tab === 'Actifs') return a.is_active
    if (tab === 'Terminés') return !a.is_active
    return true
  })

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[300px_1fr] lg:gap-4 lg:items-start">

      {/* ── CARTE (mobile: en premier, pleine largeur) ── */}
      <div className="lg:hidden rounded-2xl relative overflow-hidden border border-border-thin" style={{ height: 260 }}>
        <div className="h-full">
          <LiveMap ref={mapRef} positions={positions} onRefresh={loadData} focusTruckId={focusTruckId} />
        </div>
      </div>

      {/* ── STATS MOBILES (2x2 grid) ── */}
      <div className="lg:hidden grid grid-cols-2 gap-2.5">
        {[
          { icon: Truck, label: 'Camions', value: totalTrucks },
          { icon: Users, label: 'Ouvriers', value: totalWorkers },
          { icon: Activity, label: 'En service', value: assignments.length },
          { icon: MapPin, label: 'Positions GPS', value: positions.length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-bg-card border border-border-thin rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-bg-input rounded-xl flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-txt-muted" />
            </div>
            <div>
              <p className="text-xl font-bold text-white leading-none">{value}</p>
              <p className="text-[11px] text-txt-muted mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── LEFT COLUMN DESKTOP ── */}
      <div className="hidden lg:block space-y-4">

        <div className="bg-bg-card rounded-2xl p-5 border border-border-thin">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-medium text-white">Activité du jour</h3>
            <ArrowUpRight className="w-4 h-4 text-txt-muted" />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-6">
            {[
              { icon: Truck, label: 'Camions total', value: totalTrucks },
              { icon: Users, label: 'Ouvriers', value: totalWorkers },
              { icon: Activity, label: 'En service', value: assignments.length },
              { icon: MapPin, label: 'Positions GPS', value: positions.length },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-bg-input/40 border border-border-thin rounded-xl p-3 flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-txt-muted shrink-0" />
                <span className="text-[11px] text-txt-muted leading-tight">
                  {label} <b className="text-white font-semibold">{value}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="relative pt-4 pb-2">
            <div className="w-full h-[2px] bg-bg-input rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${activePercent}%`,
                  background: 'linear-gradient(90deg, rgba(225,249,112,0.3) 0%, #e1f970 100%)',
                  boxShadow: '0 0 8px rgba(225,249,112,0.4)',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-txt-muted mt-2 px-0.5">
              <span>0%</span>
              <span className="text-white font-semibold">{activePercent}% actifs</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-thin">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-medium text-white">Statut flotte</h3>
            <ArrowUpRight className="w-4 h-4 text-txt-muted" />
          </div>
          <div className="space-y-3.5 text-xs">
            {[
              { label: 'En service', count: assignments.length, total: totalTrucks, color: 'bg-accent' },
              { label: 'GPS actif', count: positions.length, total: assignments.length, color: 'bg-emerald-400' },
              { label: 'Disponibles', count: Math.max(0, totalTrucks - assignments.length), total: totalTrucks, color: 'bg-neutral-500' },
            ].map(({ label, count, total, color }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const filled = Math.round((pct / 100) * 20)
              return (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-txt-muted w-24 shrink-0">{label}</span>
                  <span className="text-white font-medium w-5 shrink-0">{count}</span>
                  <div className="flex-1 flex items-center gap-[2px]">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className={`w-[2px] h-3 rounded-sm ${i < filled ? color : 'bg-neutral-800'}`} />
                    ))}
                  </div>
                  <span className="text-txt-muted w-8 text-right shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-bg-card rounded-2xl p-5 border border-border-thin">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-medium text-white">Positions GPS</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] text-txt-muted">Live</span>
            </div>
          </div>
          <div className="space-y-3">
            {positions.length === 0 && (
              <p className="text-txt-muted text-xs text-center py-4">Aucune position enregistrée</p>
            )}
            {positions.slice(0, 5).map(pos => (
              <button
                key={pos.truck_id}
                onClick={() => { setFocusTruckId(pos.truck_id); mapRef.current?.flyTo(pos.latitude, pos.longitude, 17) }}
                className="w-full flex items-center gap-3 py-2 border-b border-border-thin last:border-0 hover:bg-bg-input/30 rounded-lg px-1 -mx-1 transition text-left"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${pos.is_active !== false ? 'bg-accent/15' : 'bg-bg-input'}`}>
                  <Truck className={`w-3.5 h-3.5 ${pos.is_active !== false ? 'text-accent' : 'text-txt-muted'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-white leading-tight">{pos.truck_name}</p>
                  <p className="text-[10px] text-txt-muted">{pos.worker_name} · {pos.is_active !== false ? '● Actif' : '○ Rangé'}</p>
                </div>
                <div className="text-right shrink-0">
                  {pos.speed != null && pos.is_active !== false && (
                    <p className="text-[11px] font-medium text-accent">{Math.round(pos.speed * 3.6)} km/h</p>
                  )}
                  <p className="text-[10px] text-txt-muted">{timeAgo(pos.recorded_at)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN DESKTOP + Affectations mobile ── */}
      <div className="space-y-4">

        {/* CARTE DESKTOP */}
        <div className="hidden lg:block rounded-3xl h-[520px] relative overflow-hidden border border-border-thin">
          <div className="h-full">
            <LiveMap ref={mapRef} positions={positions} onRefresh={loadData} focusTruckId={focusTruckId} />
          </div>
        </div>

        {/* AFFECTATIONS */}
        <div className="bg-bg-card rounded-2xl p-4 lg:p-5 border border-border-thin">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 lg:mb-6">
            <h3 className="text-[15px] font-medium text-white">Affectations</h3>
            <div className="bg-neutral-900/60 p-0.5 rounded-xl border border-border-thin flex gap-0.5 text-xs">
              {(['Tous', 'Actifs', 'Terminés'] as TabFilter[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg transition font-medium ${
                    tab === t
                      ? t === 'Actifs' ? 'bg-accent text-black' : 'bg-neutral-800 text-white'
                      : 'text-txt-muted hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Table desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] text-txt-muted border-b border-neutral-800 font-medium uppercase tracking-wider">
                  <th className="pb-2 font-normal">Camion</th>
                  <th className="pb-2 font-normal">Ouvrier</th>
                  <th className="pb-2 font-normal">Plaque</th>
                  <th className="pb-2 font-normal">Début</th>
                  <th className="pb-2 font-normal">Durée</th>
                  <th className="pb-2 font-normal">Statut</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-neutral-900/60">
                {filteredAssignments.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-txt-muted">Aucune affectation</td></tr>
                )}
                {filteredAssignments.map(a => {
                  const duration = getDuration(a.started_at, a.ended_at)
                  return (
                    <tr key={a.id} className="hover:bg-neutral-800/20 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-bg-input rounded-lg flex items-center justify-center">
                            <Truck className="w-3 h-3 text-txt-muted" />
                          </div>
                          <span className="font-medium text-white">{a.truck?.name}</span>
                        </div>
                      </td>
                      <td className="py-3"><span className="text-white font-medium">{a.worker?.full_name}</span></td>
                      <td className="py-3"><span className="font-mono text-txt-muted text-[11px]">{a.truck?.plate_number}</span></td>
                      <td className="py-3 text-txt-muted">
                        {new Date(a.started_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 text-neutral-300">{duration}</td>
                      <td className="py-3">
                        {a.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-accent text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />En service
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-txt-muted text-[11px]">
                            <CheckCircle className="w-3 h-3" />Terminé
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cartes mobile */}
          <div className="md:hidden space-y-2">
            {filteredAssignments.length === 0 && (
              <p className="py-6 text-center text-txt-muted text-sm">Aucune affectation</p>
            )}
            {filteredAssignments.map(a => {
              const duration = getDuration(a.started_at, a.ended_at)
              return (
                <div key={a.id} className="bg-bg-input/40 border border-border-thin rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 bg-bg-input rounded-xl flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-txt-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{a.truck?.name}</p>
                      <span className="font-mono text-[10px] text-txt-muted shrink-0">{a.truck?.plate_number}</span>
                    </div>
                    <p className="text-[11px] text-txt-muted mt-0.5">{a.worker?.full_name} · {duration}</p>
                  </div>
                  <div className="shrink-0">
                    {a.is_active ? (
                      <span className="flex items-center gap-1 text-accent text-[11px] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />Live
                      </span>
                    ) : (
                      <CheckCircle className="w-4 h-4 text-txt-muted" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h`
}

function getDuration(start: string, end: string | null): string {
  const diff = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}
