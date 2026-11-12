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
const SUPABASE_URL = 'PASTE_YOUR_PROJECT_URL_HERE';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE';

const sb = (SUPABASE_URL.startsWith('https://') && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : undefined;
