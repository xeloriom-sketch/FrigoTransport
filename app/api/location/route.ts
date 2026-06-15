import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { assignment_id, truck_id, latitude, longitude, accuracy, speed, heading } = body

  if (!assignment_id || latitude == null || longitude == null) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }

  // Récupérer truck_id depuis l'affectation si non fourni
  let finalTruckId = truck_id
  if (!finalTruckId) {
    const { data: assignment } = await supabase
      .from('assignments')
      .select('truck_id')
      .eq('id', assignment_id)
      .eq('worker_id', user.id)
      .single()
    finalTruckId = assignment?.truck_id
  }

  if (!finalTruckId) {
    return NextResponse.json({ error: 'Affectation invalide' }, { status: 400 })
  }

  const { error } = await supabase.from('locations').insert({
    assignment_id,
    truck_id: finalTruckId,
    worker_id: user.id,
    latitude,
    longitude,
    accuracy: accuracy ?? null,
    speed: speed ?? null,
    heading: heading ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
