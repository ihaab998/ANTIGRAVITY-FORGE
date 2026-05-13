const { Client } = require('pg');
const fs = require('fs');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

async function fixAuthUsers() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    console.log('=== Fixing NULL values in auth.users ===');
    
    // Set all NULL token/change columns to empty string ''
    const res = await client.query(`
      UPDATE auth.users 
      SET 
        confirmation_token = COALESCE(confirmation_token, ''),
        recovery_token = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change = COALESCE(email_change, ''),
        phone_change_token = COALESCE(phone_change_token, ''),
        phone_change = COALESCE(phone_change, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        email_change_token_current = COALESCE(email_change_token_current, '')
      WHERE 
        confirmation_token IS NULL OR
        recovery_token IS NULL OR
        email_change_token_new IS NULL OR
        email_change IS NULL OR
        phone_change_token IS NULL OR
        phone_change IS NULL OR
        reauthentication_token IS NULL OR
        email_change_token_current IS NULL
      RETURNING email;
    `);
    
    console.log(`Fixed ${res.rows.length} users.`);

  } catch (err) {
    console.error('Error fixing users:', err.message);
  } finally {
    await client.end();
  }

  // Now test login
  console.log('\n=== Testing login after fixing NULLs ===');
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

fixAuthUsers();
