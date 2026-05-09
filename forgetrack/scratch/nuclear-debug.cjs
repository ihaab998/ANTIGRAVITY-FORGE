const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function fullNuclearDebug() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Check ALL triggers on ALL auth tables (not just information_schema)
    console.log('=== ALL non-RI triggers in auth schema ===');
    const triggers = await client.query(`
      SELECT t.tgname, c.relname as table_name, 
        p.proname as function_name, n.nspname as func_schema
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace ns ON c.relnamespace = ns.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE ns.nspname = 'auth'
      AND NOT t.tgisinternal
      AND t.tgname NOT LIKE 'RI_%'
    `);
    console.log('Non-RI auth triggers:', triggers.rows);

    // 2. Check ALL views that reference auth tables
    console.log('\n=== Views referencing auth ===');
    const views = await client.query(`
      SELECT schemaname, viewname, definition 
      FROM pg_views 
      WHERE definition LIKE '%auth.%'
    `);
    views.rows.forEach(r => {
      console.log(`${r.schemaname}.${r.viewname}:`);
      console.log(r.definition.substring(0, 300));
      console.log('---');
    });

    // 3. Check GoTrue's actual query by looking at pg_stat_statements
    console.log('\n=== Recent queries with errors ===');
    try {
      const stmts = await client.query(`
        SELECT query, calls, mean_exec_time 
        FROM pg_stat_statements 
        WHERE query LIKE '%auth%' AND query NOT LIKE '%pg_stat%'
        ORDER BY calls DESC
        LIMIT 10
      `);
      stmts.rows.forEach(r => console.log(`[${r.calls}x, ${r.mean_exec_time}ms] ${r.query.substring(0, 200)}`));
    } catch(e) {
      console.log('pg_stat_statements error:', e.message);
    }

    // 4. Check the exact auth.users table structure
    console.log('\n=== auth.users columns ===');
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users'
      ORDER BY ordinal_position
    `);
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'} ${r.column_default ? 'DEFAULT=' + r.column_default.substring(0, 50) : ''}`));

    // 5. Check if there are any CHECK constraints on auth.users
    console.log('\n=== CHECK constraints on auth.users ===');
    const checks = await client.query(`
      SELECT con.conname, pg_get_constraintdef(con.oid) as def
      FROM pg_constraint con
      JOIN pg_class c ON con.conrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'auth' AND c.relname = 'users' AND con.contype = 'c'
    `);
    console.log('Checks:', checks.rows);

    // 6. Check RLS on auth.users
    console.log('\n=== RLS on auth.users ===');
    const authRls = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'auth' AND c.relname = 'users'
    `);
    console.log('auth.users RLS:', authRls.rows);

    // 7. Check auth.users policies
    console.log('\n=== auth.users policies ===');
    const authPolicies = await client.query(`
      SELECT policyname, roles, cmd, qual
      FROM pg_policies
      WHERE schemaname = 'auth' AND tablename = 'users'
    `);
    console.log('Policies:', authPolicies.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

fullNuclearDebug();
