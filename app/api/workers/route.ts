import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

export async function GET() {
  const supabase = createClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { full_name, email, password, phone } = await req.json()
  if (!full_name || !email || !password) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'worker' },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  if (phone) {
    await supabase
      .from('profiles')
      .update({ phone })
      .eq('id', authData.user.id)
  }

  return NextResponse.json({ ok: true, user_id: authData.user.id })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { user_id } = await req.json()
  const adminClient = createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
