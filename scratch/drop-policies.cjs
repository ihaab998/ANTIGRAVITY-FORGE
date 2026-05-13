const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function dropPolicies() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const res = await client.query("SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'");
    for (let row of res.rows) {
      console.log(`Dropping policy: ${row.policyname} on ${row.tablename}`);
      await client.query(`DROP POLICY "${row.policyname}" ON public."${row.tablename}"`);
    }
    console.log('All public policies dropped.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
dropPolicies();
