-- ============================================================
-- Vue : dernière position connue de chaque camion
-- (indépendant du statut actif/rangé)
-- Exécuter dans l'éditeur SQL Supabase
-- ============================================================

CREATE OR REPLACE VIEW public.truck_last_known_positions AS
SELECT DISTINCT ON (l.truck_id)
  l.truck_id,
  t.name        AS truck_name,
  t.plate_number,
  p.full_name   AS worker_name,
  l.latitude,
  l.longitude,
  l.accuracy,
  l.speed,
  l.recorded_at,
  a.id          AS assignment_id,
  a.is_active
FROM public.locations l
JOIN public.trucks      t ON t.id = l.truck_id
JOIN public.profiles    p ON p.id = l.worker_id
JOIN public.assignments a ON a.id = l.assignment_id
ORDER BY l.truck_id, l.recorded_at DESC;

GRANT SELECT ON public.truck_last_known_positions TO authenticated;
