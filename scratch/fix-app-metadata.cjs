const { Client } = require('pg');
const fs = require('fs');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

async function fixAndTest() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Fix: Set raw_app_meta_data for ALL users that have it as null
    console.log('=== Fixing null raw_app_meta_data ===');
    const fixed = await client.query(`
      UPDATE auth.users 
      SET raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
      WHERE raw_app_meta_data IS NULL
      RETURNING email
    `);
    console.log('Fixed users:', fixed.rows);
  } catch (err) {
    console.error('Fix error:', err.message);
  } finally {
    await client.end();
  }

  // Now test login
  console.log('\n=== Testing login after fix ===');
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
    console.log('Role from metadata:', body.user?.user_metadata?.role);
  } else {
    console.log('Error:', body);
  }
}

fixAndTest();
