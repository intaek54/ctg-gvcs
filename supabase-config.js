/* ============================================================
   Your Supabase project keys.

   Fill these in from:
   Supabase dashboard > your project > Project Settings >
   API (or "Data API") > Project URL and the anon / publishable key.

   Note: these keys are meant to be public. They identify the
   project, they don't grant access. What actually protects the
   data is the Row Level Security policies in supabase/schema.sql.
   Never put the service_role / secret key in this file.
   ============================================================ */
const SUPABASE_URL = 'https://vroriodfxtsuiizkooqh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kzuu1lWkSMOvP7AkCtgZ_Q_rzdqe2zl';

const sb = (SUPABASE_URL.startsWith('https://') && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : undefined;
