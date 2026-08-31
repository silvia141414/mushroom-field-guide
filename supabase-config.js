const SUPABASE_URL = "https://hwwavmqaachiglpmvrft.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QSLUp6Qi9QmXFMILCXyCJA_6bZ8B7ZX";
window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);