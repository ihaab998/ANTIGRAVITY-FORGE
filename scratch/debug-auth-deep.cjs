const { Client } = require('pg');
const fs = require('fs');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

async function deepDebug() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Check if GoTrue expects public.users (we dropped it!)
    console.log('=== Checking if public.users exists ===');
    const tableCheck = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'users'
    `);
    console.log('public.users exists:', tableCheck.rows.length > 0);

    // 2. Check all functions that reference "public.users"
    console.log('\n=== Functions referencing public.users ===');
    const funcRefs = await client.query(`
      SELECT n.nspname, p.proname, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE pg_get_functiondef(p.oid) LIKE '%public.users%'
    `);
    funcRefs.rows.forEach(r => {
      console.log(`${r.nspname}.${r.proname}`);
      console.log(r.def.substring(0, 200));
      console.log('---');
    });

    // 3. Check auth schema views
    console.log('\n=== Auth schema views ===');
    const views = await client.query(`
      SELECT viewname, definition 
      FROM pg_views 
      WHERE schemaname = 'auth'
    `);
    views.rows.forEach(r => {
      console.log(`View: ${r.viewname}`);
      console.log(r.definition.substring(0, 300));
      console.log('---');
    });

    // 4. Check for any broken dependencies
    console.log('\n=== Broken dependencies ===');
    const deps = await client.query(`
      SELECT DISTINCT d.refobjid::regclass as dependency
      FROM pg_depend d
      JOIN pg_class c ON d.objid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'auth'
      AND d.deptype = 'n'
      AND d.refobjsubid > 0
      LIMIT 10
    `);
    console.log('Dependencies:', deps.rows);

    // 5. Try to simulate GoTrue's login by updating last_sign_in_at
    console.log('\n=== Simulating GoTrue update ===');
    try {
      const upd = await client.query(`
        UPDATE auth.users 
        SET last_sign_in_at = now(), updated_at = now() 
        WHERE email = 'varun@theboringpeople.in'
        RETURNING id
      `);
      console.log('Update succeeded:', upd.rows);
    } catch (e) {
      console.log('Update FAILED:', e.message);
    }

    // 6. Check auth.identities for the user
    console.log('\n=== Auth identities for varun ===');
    const identities = await client.query(`
      SELECT i.id, i.user_id, i.provider, i.provider_id, i.identity_data
      FROM auth.identities i
      JOIN auth.users u ON i.user_id = u.id
      WHERE u.email = 'varun@theboringpeople.in'
    `);
    console.log('Identities:', JSON.stringify(identities.rows, null, 2));

    // 7. Check auth.sessions
    console.log('\n=== Auth sessions ===');
    const sessions = await client.query('SELECT count(*) FROM auth.sessions');
    console.log('Session count:', sessions.rows[0].count);

    // 8. Check the auth.users columns for any missing required fields
    console.log('\n=== Varun full auth record ===');
    const fullUser = await client.query(`
      SELECT id, instance_id, aud, role, email, 
        encrypted_password IS NOT NULL as has_password,
        email_confirmed_at IS NOT NULL as email_confirmed,
        is_sso_user, banned_until, deleted_at,
        confirmation_token, raw_app_meta_data, raw_user_meta_data
      FROM auth.users 
      WHERE email = 'varun@theboringpeople.in'
    `);
    console.log(JSON.stringify(fullUser.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

deepDebug();
