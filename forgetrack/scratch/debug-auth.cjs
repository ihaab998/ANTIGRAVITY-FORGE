const { Client } = require('pg');
const fs = require('fs');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

async function debugAuth() {
  // 1. Check if auth hooks are configured
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  try {
    // Check for auth hooks
    console.log('=== Checking auth.hooks ===');
    try {
      const hooks = await client.query("SELECT * FROM auth.flow_state LIMIT 1");
      console.log('flow_state exists, rows:', hooks.rows.length);
    } catch (e) {
      console.log('flow_state error:', e.message);
    }

    // Check auth schema for any custom functions
    console.log('\n=== Auth schema functions ===');
    const funcs = await client.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'auth'
      AND p.proname NOT IN ('uid', 'role', 'email', 'jwt')
      LIMIT 10
    `);
    funcs.rows.forEach(r => console.log(r.proname));

    // Check auth config
    console.log('\n=== Auth config ===');
    try {
      const config = await client.query("SELECT * FROM auth.schema_migrations ORDER BY version DESC LIMIT 5");
      console.log('Last 5 auth migrations:', config.rows);
    } catch (e) {
      console.log('schema_migrations error:', e.message);
    }

    // Check if there's a hook function
    console.log('\n=== Checking for custom auth hooks ===');
    try {
      const hookCheck = await client.query(`
        SELECT p.proname, n.nspname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname LIKE '%hook%' OR p.proname LIKE '%custom_access_token%'
      `);
      console.log('Hook functions:', hookCheck.rows);
    } catch (e) {
      console.log('Hook check error:', e.message);
    }

    // Check if there are any event triggers
    console.log('\n=== Event triggers ===');
    try {
      const evtrig = await client.query("SELECT evtname, evtevent, evtfoid::regproc FROM pg_event_trigger");
      console.log('Event triggers:', evtrig.rows);
    } catch (e) {
      console.log('Event trigger error:', e.message);
    }

    // Try a direct password verification
    console.log('\n=== Direct password check ===');
    const pwcheck = await client.query(`
      SELECT id, email, 
        encrypted_password = crypt('password123', encrypted_password) as pw_match
      FROM auth.users 
      WHERE email = 'varun@theboringpeople.in'
    `);
    console.log('Password check:', pwcheck.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }

  // 2. Try signup to see if auth service works at all
  console.log('\n=== Testing signup ===');
  try {
    const res = await fetch(env.VITE_SUPABASE_URL + '/auth/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        email: 'test_debug@example.com',
        password: 'testpassword123'
      })
    });
    console.log('Signup status:', res.status);
    console.log('Signup body:', await res.text());
  } catch (e) {
    console.log('Signup error:', e.message);
  }
}

debugAuth();
