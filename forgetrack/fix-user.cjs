const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    await client.query(`
      INSERT INTO public.users (id, email, role, display_name)
      VALUES ('4c229053-1a94-4c6e-a848-0f1d5fe43694', 'ihaab050@gmail.com', 'mentor', 'Ihaab')
      ON CONFLICT (id) DO UPDATE SET role = 'mentor';
    `);
    
    console.log('Inserted user into public.users');

  } catch (err) {
    console.error('Database execution error:', err);
  } finally {
    await client.end();
  }
}

run();
