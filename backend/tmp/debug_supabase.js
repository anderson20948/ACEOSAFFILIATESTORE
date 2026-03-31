require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('MISSING ENV');
  process.exit(1);
}
const supabase = createClient(url, key);
(async () => {
  const { data, error, status } = await supabase.from('users').select('id').limit(1);
  console.log('status', status);
  console.log('error', error);
  console.log('sample', data && data.length);
})();
