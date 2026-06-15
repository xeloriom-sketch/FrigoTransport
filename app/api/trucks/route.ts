import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trucks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { name, plate_number } = await req.json()
  if (!name || !plate_number) {
    return NextResponse.json({ error: 'Nom et immatriculation requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('trucks')
    .insert({ name, plate_number })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { id } = await req.json()
  const { error } = await supabase.from('trucks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
