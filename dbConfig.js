require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("CRITICAL: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables.");
  
  const makeMissingResponse = () => ({ data: null, error: { message: "Supabase environment variables missing" } });
  const logMissing = (table) => {
    console.error(`ERROR: Attempted to access table '${table}' but Supabase is NOT configured.`);
    return Promise.resolve(makeMissingResponse());
  };

  const mockClient = {
    from: (table) => {
      const chainable = {
        select: () => logMissing(table),
        insert: () => logMissing(table),
        update: () => logMissing(table),
        delete: () => logMissing(table),
        eq: () => chainable,
        single: () => logMissing(table),
        order: () => chainable,
        limit: () => chainable,
        then: (cb) => Promise.resolve(makeMissingResponse()).then(cb)
      };
      return chainable;
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: { message: "Supabase not configured" } }),
      signInWithPassword: () => Promise.resolve({ data: { session: null }, error: { message: "Supabase not configured" } })
    }
  };
  
  module.exports = { supabase: mockClient, db: mockClient };
} else {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  module.exports = { supabase, db: supabase };
}
