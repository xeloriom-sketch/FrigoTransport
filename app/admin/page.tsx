'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { TruckPosition, Assignment } from '@/types'
import { Truck, Users, Activity, Clock } from 'lucide-react'

const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false })

interface ActiveAssignment {
  id: string
  started_at: string
  worker: { full_name: string }
  truck: { name: string; plate_number: string }
}

export default function AdminDashboard() {
  const supabase = createClient()
  const [positions, setPositions] = useState<TruckPosition[]>([])
  const [assignments, setAssignments] = useState<ActiveAssignment[]>([])
  const [totalTrucks, setTotalTrucks] = useState(0)
  const [totalWorkers, setTotalWorkers] = useState(0)

  const loadData = useCallback(async () => {
    const [posRes, assignRes, truckCount, workerCount] = await Promise.all([
      supabase.from('truck_latest_positions').select('*'),
      supabase
        .from('assignments')
        .select('id, started_at, worker:profiles(full_name), truck:trucks(name, plate_number)')
        .eq('is_active', true)
        .order('started_at', { ascending: false }),
      supabase.from('trucks').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'worker'),
    ])

    if (posRes.data) setPositions(posRes.data as TruckPosition[])
    if (assignRes.data) setAssignments(assignRes.data as any)
    if (truckCount.count != null) setTotalTrucks(truckCount.count)
    if (workerCount.count != null) setTotalWorkers(workerCount.count)
  }, [])

  useEffect(() => {
    loadData()

    // Realtime: mise à jour dès qu'une position est insérée
    const channel = supabase
      .channel('realtime-locations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  const stats = [
    { label: 'Total camions', value: totalTrucks, icon: Truck, color: 'sky' },
    { label: 'Ouvriers inscrits', value: totalWorkers, icon: Users, color: 'violet' },
    { label: 'En service', value: assignments.length, icon: Activity, color: 'emerald' },
    {
      label: 'Dernière mise à jour',
      value: positions.length > 0 ? timeAgo(positions.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0].recorded_at) : '—',
      icon: Clock,
      color: 'amber',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Tableau de bord</h1>
        <p className="text-slate-500 text-sm">Suivi en temps réel de votre flotte</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <div>
              <p className="text-xs text-slate-500 leading-tight">{label}</p>
              <p className="text-xl font-bold text-slate-800 leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Carte + liste */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Carte */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: '520px' }}>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-700">Carte en direct</span>
          </div>
          <div className="h-[calc(100%-49px)]">
            <LiveMap positions={positions} />
          </div>
        </div>

        {/* Liste affectations actives */}
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-700">Camions actifs ({assignments.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {assignments.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">
                Aucun camion en service
              </div>
            )}
            {assignments.map((a) => {
              const pos = positions.find(p => p.worker_name === a.worker?.full_name)
              return (
                <div key={a.id} className="px-4 py-3 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-slate-800 text-sm">{a.truck?.name}</p>
                    <span className="text-xs font-mono text-slate-400">{a.truck?.plate_number}</span>
                  </div>
                  <p className="text-xs text-slate-500">👷 {a.worker?.full_name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-400">Depuis {timeAgo(a.started_at)}</p>
                    {pos && (
                      <span className="text-xs text-emerald-500 font-medium">
                        {pos.speed != null ? `${Math.round(pos.speed * 3.6)} km/h` : 'GPS ✓'}
                      </span>
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
  if (m < 60) return `il y a ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}
