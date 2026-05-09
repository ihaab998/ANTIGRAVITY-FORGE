const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function deepDebug2() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Check functions that reference public.users (using prosrc instead of pg_get_functiondef)
    console.log('=== Functions referencing public.users ===');
    const funcRefs = await client.query(`
      SELECT n.nspname, p.proname, p.prosrc
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.prosrc LIKE '%public.users%' OR p.prosrc LIKE '%public."users"%'
    `);
    funcRefs.rows.forEach(r => {
      console.log(`${r.nspname}.${r.proname}`);
      console.log(r.prosrc.substring(0, 200));
      console.log('---');
    });

    // 2. Check auth schema views
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

    // 3. Simulate GoTrue update
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

    // 4. Full auth record
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

    // 5. Check identities
    console.log('\n=== Auth identities for varun ===');
    const identities = await client.query(`
      SELECT i.id, i.user_id, i.provider, i.provider_id
      FROM auth.identities i
      JOIN auth.users u ON i.user_id = u.id
      WHERE u.email = 'varun@theboringpeople.in'
    `);
    console.log(JSON.stringify(identities.rows, null, 2));

    // 6. Check the auth.users columns - specifically raw_app_meta_data
    console.log('\n=== raw_app_meta_data for all users (sample) ===');
    const meta = await client.query(`
      SELECT email, raw_app_meta_data 
      FROM auth.users LIMIT 3
    `);
    console.log(JSON.stringify(meta.rows, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

deepDebug2();
