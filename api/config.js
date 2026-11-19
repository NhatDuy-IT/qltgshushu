/**
 * GET /api/config
 * Exposes safe public runtime environment keys to the static frontend.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    singleUserDomain: process.env.SINGLE_USER_EMAIL_DOMAIN || 'shushu.app'
  });
}
