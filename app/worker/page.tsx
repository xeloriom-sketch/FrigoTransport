import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WorkerClient from './client'

export default async function WorkerPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, started_at, truck:trucks(name, plate_number)')
    .eq('worker_id', user.id)
    .eq('is_active', true)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <WorkerClient
      userId={user.id}
      fullName={profile?.full_name ?? ''}
      assignment={assignment as any}
    />
  )
}
