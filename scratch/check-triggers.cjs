const { Client } = require('pg');
const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function checkTriggers() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT trigger_name, event_object_table, action_statement 
      FROM information_schema.triggers 
      WHERE event_object_schema IN ('public', 'auth')
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
checkTriggers();
