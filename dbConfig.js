require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables.");
  // process.exit(1); // Decouple from forceful crash to allow Vercel logs to capture state
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = { supabase, db: supabase };
