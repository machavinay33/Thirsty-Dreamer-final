/*
 * Public browser configuration only. The anon/publishable key is designed for
 * browser use when every table and Storage operation is protected by RLS.
 * NEVER place a Supabase service_role/secret key in this file.
 */
window.SUPABASE_CONFIG = {
  url: '', // Example: https://abcdefghijklmnopqrst.supabase.co
  anonKey: '' // Supabase publishable key (or legacy anon key)
};
