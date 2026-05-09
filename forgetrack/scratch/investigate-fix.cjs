const { Client } = require('pg');
const fs = require('fs');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

async function investigateAndFix() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Check if there's an auth config table with hooks
    console.log('=== Checking auth config ===');
    try {
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        ORDER BY table_name
      `);
      console.log('Auth tables:', tables.rows.map(r => r.table_name));
    } catch(e) {
      console.log('Error listing auth tables:', e.message);
    }

    // 2. Check for auth hooks config
    console.log('\n=== Checking for auth hooks config ===');
    try {
      // Some Supabase versions store hooks config here
      const hookConfig = await client.query("SELECT * FROM auth.mfa_factors LIMIT 1");
      console.log('mfa_factors accessible');
    } catch(e) {
      console.log('mfa_factors:', e.message);
    }

    // 3. Check supabase_functions schema
    console.log('\n=== Checking supabase_functions ===');
    try {
      const sf = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'supabase_functions'
      `);
      console.log('supabase_functions tables:', sf.rows);
    } catch(e) {
      console.log('supabase_functions error:', e.message);
    }

    // 4. Check if there's a hook in the config
    console.log('\n=== Checking auth.config ===');
    try {
      const cfg = await client.query("SELECT * FROM auth.audit_log_entries ORDER BY created_at DESC LIMIT 3");
      console.log('Recent audit:', cfg.rows.map(r => ({ event: r.payload?.action || r.payload, ts: r.created_at })));
    } catch(e) {
      console.log('audit_log error:', e.message);
    }

    // 5. The nuclear option: recreate public.users without RLS
    console.log('\n=== Recreating public.users (no RLS) ===');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
        student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('Table created.');

    // Re-populate from auth.users
    console.log('Re-populating public.users from auth.users...');
    // Mentors
    await client.query(`
      INSERT INTO public.users (id, email, role, display_name)
      SELECT id, email, 'mentor', raw_user_meta_data->>'display_name'
      FROM auth.users
      WHERE raw_user_meta_data->>'role' = 'mentor'
      ON CONFLICT (id) DO NOTHING
    `);
    // Students
    await client.query(`
      INSERT INTO public.users (id, email, role, student_id, display_name)
      SELECT u.id, u.email, 'student', 
        (u.raw_user_meta_data->>'student_id')::int,
        u.raw_user_meta_data->>'display_name'
      FROM auth.users u
      WHERE u.raw_user_meta_data->>'role' = 'student'
      ON CONFLICT (id) DO NOTHING
    `);
    
    const count = await client.query('SELECT count(*) FROM public.users');
    console.log('public.users count:', count.rows[0].count);

    // 6. Check Postgres logs for the actual error
    console.log('\n=== Recent Postgres log entries ===');
    try {
      const logs = await client.query(`
        SELECT * FROM pg_stat_activity 
        WHERE datname = 'postgres' AND query LIKE '%auth%' AND state = 'active'
        LIMIT 5
      `);
      console.log('Active auth queries:', logs.rows.length);
    } catch(e) {
      console.log('pg_stat_activity error:', e.message);
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }

  // Test login again
  console.log('\n=== Testing login with public.users restored ===');
  const res = await fetch(env.VITE_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      email: 'varun@theboringpeople.in',
      password: 'password123'
    })
  });
  console.log('Status:', res.status);
  const body = await res.json();
  if (res.ok) {
    console.log('SUCCESS! User ID:', body.user?.id);
  } else {
    console.log('Error:', body);
  }

  // Also test a student
  console.log('\n=== Testing student login ===');
  const res2 = await fetch(env.VITE_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.VITE_SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      email: '4sh24cs003@forge.local',
      password: '4SH24CS003'
    })
  });
  console.log('Student status:', res2.status);
  const body2 = await res2.json();
  if (res2.ok) {
    console.log('SUCCESS! Student ID:', body2.user?.id);
  } else {
    console.log('Error:', body2);
  }
}

investigateAndFix();
