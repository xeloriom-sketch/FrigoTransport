// Non utilisé en static export — logique déplacée dans les composants client (Supabase direct)
export async function GET() {
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}
