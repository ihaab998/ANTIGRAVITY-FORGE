const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function checkAuthInternals() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Check auth.instances
    console.log('=== auth.instances ===');
    const instances = await client.query('SELECT * FROM auth.instances');
    console.log(JSON.stringify(instances.rows, null, 2));

    // 2. Check grants for supabase_auth_admin
    console.log('\n=== Grants for supabase_auth_admin ===');
    const grants = await client.query(`
      SELECT grantee, table_schema, table_name, privilege_type
      FROM information_schema.table_privileges
      WHERE grantee = 'supabase_auth_admin'
      AND table_schema = 'public'
    `);
    console.log('Public schema grants:', grants.rows);

    // 3. Check if there are custom hooks configured via environment
    // GoTrue reads hooks from auth.hooks or env vars
    console.log('\n=== Check for hook-related tables/views ===');
    const hookTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'auth' AND table_name LIKE '%hook%'
    `);
    console.log('Hook tables:', hookTables.rows);

    // 4. Check all functions in public schema
    console.log('\n=== All public schema functions ===');
    const pubFuncs = await client.query(`
      SELECT p.proname, n.nspname
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
    `);
    console.log('Public functions:', pubFuncs.rows.map(r => r.proname));

    // 5. Check if GoTrue has access to public schema
    console.log('\n=== Schema usage grants ===');
    const schemaGrants = await client.query(`
      SELECT nspname, nspacl 
      FROM pg_namespace 
      WHERE nspname IN ('public', 'auth', 'extensions')
    `);
    schemaGrants.rows.forEach(r => console.log(r.nspname, ':', r.nspacl));

    // 6. Check if there's something wrong with the one_time_tokens table
    console.log('\n=== one_time_tokens ===');
    try {
      const ott = await client.query('SELECT count(*) FROM auth.one_time_tokens');
      console.log('one_time_tokens count:', ott.rows[0].count);
    } catch(e) {
      console.log('one_time_tokens error:', e.message);
    }

    // 7. Check the most recent auth.schema_migrations
    console.log('\n=== Full auth schema migrations ===');
    const migrations = await client.query('SELECT version FROM auth.schema_migrations ORDER BY version');
    console.log('Total migrations:', migrations.rows.length);
    console.log('Last 10:', migrations.rows.slice(-10).map(r => r.version));

    // 8. Try to use auth.uid() and auth.role() directly
    console.log('\n=== Testing auth functions ===');
    try {
      const uid = await client.query('SELECT auth.uid()');
      console.log('auth.uid():', uid.rows[0]);
    } catch(e) {
      console.log('auth.uid() error:', e.message);
    }

    // 9. Check if there are any broken/invalid indexes
    console.log('\n=== Invalid indexes in auth schema ===');
    const indexes = await client.query(`
      SELECT indexrelid::regclass, indisvalid 
      FROM pg_index 
      WHERE NOT indisvalid
    `);
    console.log('Invalid indexes:', indexes.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

checkAuthInternals();
