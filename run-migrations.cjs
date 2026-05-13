const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:Ihaab@0506932607@db.gxtytfgbjcvqrwtlomwj.supabase.co:5432/postgres';

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const seedSql = fs.readFileSync(path.join(__dirname, 'supabase', 'seed.sql'), 'utf8');
    
    // Split the seed.sql into chunks because pg client sometimes struggles with huge multi-statement DO blocks mixed with inserts
    const statements = [
      `DO $$
      DECLARE
        mentor_id1 uuid := gen_random_uuid();
        mentor_id2 uuid := gen_random_uuid();
      BEGIN
        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, raw_user_meta_data, created_at, updated_at) 
        VALUES (mentor_id1, '00000000-0000-0000-0000-000000000000', 'nischay@theboringpeople.in', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"role":"mentor","display_name":"Nischay B K"}', now(), now());

        INSERT INTO public.users (id, email, role, display_name) 
        VALUES (mentor_id1, 'nischay@theboringpeople.in', 'mentor', 'Nischay B K');

        INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, raw_user_meta_data, created_at, updated_at) 
        VALUES (mentor_id2, '00000000-0000-0000-0000-000000000000', 'varun@theboringpeople.in', crypt('password123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{"role":"mentor","display_name":"Varun"}', now(), now());

        INSERT INTO public.users (id, email, role, display_name) 
        VALUES (mentor_id2, 'varun@theboringpeople.in', 'mentor', 'Varun');
      END $$;`,
      
      `INSERT INTO public.students (name, usn, branch_code) VALUES
      ('Abhishek Sharma', '4SH24CS001', 'CS'),
      ('Divya Kulkarni', '4SH24CS002', 'AI'),
      ('Ravi Kumar', '4SH24CS003', 'CS'),
      ('Neha Reddy', '4SH24CS004', 'IS'),
      ('Karan Singh', '4SH24CS005', 'CS'),
      ('Pooja Bhat', '4SH24CS006', 'AI'),
      ('Rahul K', '4SH24CS007', 'CS'),
      ('Sneha Patil', '4SH24CS008', 'IS'),
      ('Aditya Rao', '4SH24CS009', 'AI'),
      ('Ananya M', '4SH24CS010', 'CS'),
      ('Vikram N', '4SH24CS011', 'IS'),
      ('Swati Desai', '4SH24CS012', 'CS'),
      ('Rohan Joshi', '4SH24CS013', 'AI'),
      ('Megha Gowda', '4SH24CS014', 'CS'),
      ('Arjun P', '4SH24CS015', 'IS'),
      ('Kavya V', '4SH24CS016', 'CS'),
      ('Sandeep K', '4SH24CS017', 'AI'),
      ('Priyanka R', '4SH24CS018', 'CS'),
      ('Gaurav S', '4SH24CS019', 'IS'),
      ('Shreya T', '4SH24CS020', 'AI'),
      ('Vinay B', '4SH24CS021', 'CS'),
      ('Aishwarya C', '4SH24CS022', 'IS'),
      ('Manoj D', '4SH24CS023', 'CS'),
      ('Rekha E', '4SH24CS024', 'AI'),
      ('Suresh F', '4SH24CS025', 'CS') ON CONFLICT DO NOTHING;`,

      `INSERT INTO public.sessions (date, topic, month_number) VALUES
      ('2025-08-10', 'Python Basics & Environment Setup', 1),
      ('2025-08-17', 'Pandas & Data Manipulation', 1),
      ('2025-08-24', 'Intro to Machine Learning', 1),
      ('2025-09-07', 'Supervised Learning Algorithms', 2),
      ('2025-09-14', 'Neural Networks from Scratch', 2),
      ('2025-09-21', 'PyTorch Fundamentals', 2),
      ('2025-10-05', 'Transformers Architecture', 3),
      ('2025-10-12', 'Fine-tuning LLMs', 3),
      ('2025-11-02', '8 Layer AI Stack', 4),
      ('2025-11-09', 'Prompt Engineering Mastery', 4),
      ('2025-11-16', 'Vector Databases & Embeddings', 4),
      ('2025-12-07', 'ReAct Agent Pattern', 5),
      ('2025-12-14', 'pgvector RAG', 5),
      ('2026-01-11', 'Multi-Agent Frameworks', 6),
      ('2026-01-18', 'Tiered Autonomy Multi-Agent', 6) ON CONFLICT DO NOTHING;`,

      `INSERT INTO public.materials (session_id, title, type, url)
      SELECT id, topic || ' - Slides', 'slides', 'https://docs.google.com/presentation/'
      FROM public.sessions ON CONFLICT DO NOTHING;`,

      `INSERT INTO public.materials (session_id, title, type, url)
      SELECT id, topic || ' - Recording', 'recording', 'https://youtube.com/'
      FROM public.sessions ON CONFLICT DO NOTHING;`,

      `DO $$
      DECLARE
        student RECORD;
        sess RECORD;
        is_present BOOLEAN;
      BEGIN
        FOR student IN SELECT id FROM public.students LOOP
          FOR sess IN SELECT id FROM public.sessions LOOP
            is_present := (student.id + sess.id) % 10 != 0;
            
            BEGIN
              INSERT INTO public.attendance (student_id, session_id, present, marked_by)
              VALUES (student.id, sess.id, is_present, 'system');
            EXCEPTION WHEN unique_violation THEN
              -- ignore
            END;
          END LOOP;
        END LOOP;
      END $$;`
    ];

    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        console.log(`Executed chunk ${i + 1}`);
      } catch (err) {
        console.error(`Error in chunk ${i + 1}:`, err.message);
      }
    }

    const res1 = await client.query('SELECT count(*) FROM students');
    const res2 = await client.query('SELECT count(*) FROM sessions');
    const res3 = await client.query('SELECT count(*) FROM attendance');

    console.log(`Counts -> Students: ${res1.rows[0].count}, Sessions: ${res2.rows[0].count}, Attendance: ${res3.rows[0].count}`);

  } catch (err) {
    console.error('Database execution error:', err);
  } finally {
    await client.end();
  }
}

run();
