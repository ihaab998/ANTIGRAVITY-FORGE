import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DevSupabase() {
  const [testResults, setTestResults] = useState({
    env: { status: 'pending', url: false, key: false },
    client: { status: 'pending', message: '' },
    students: { status: 'pending', data: null, error: null },
    sessions: { status: 'pending', data: null, error: null },
    attendance: { status: 'pending', data: null, error: null },
  });

  useEffect(() => {
    runTests();
  }, []);

  const runTests = async () => {
    const results = { ...testResults };

    // STEP 1: Env Validation
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    results.env = {
      status: url && key ? 'success' : 'error',
      url: !!url,
      key: !!key
    };
    
    setTestResults({ ...results });

    if (results.env.status === 'error') return;

    // STEP 2: Client Initialization
    results.client = {
      status: supabase ? 'success' : 'error',
      message: supabase ? 'Supabase client instance created successfully.' : 'Failed to create Supabase client instance.'
    };
    setTestResults({ ...results });

    if (results.client.status === 'error') return;

    // STEP 3.1: Test Students
    try {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,usn,branch_code")
        .limit(5);
        
      if (error) throw error;
      results.students = { status: 'success', data, error: null };
    } catch (error) {
      results.students = { status: 'error', data: null, error: error.message || JSON.stringify(error) };
    }
    setTestResults({ ...results });

    // STEP 3.2: Test Sessions
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .limit(5);
        
      if (error) throw error;
      results.sessions = { status: 'success', data, error: null };
    } catch (error) {
      results.sessions = { status: 'error', data: null, error: error.message || JSON.stringify(error) };
    }
    setTestResults({ ...results });

    // STEP 3.3: Test Attendance
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          present,
          students(name,usn),
          sessions(date,topic)
        `)
        .limit(5);
        
      if (error) throw error;
      results.attendance = { status: 'success', data, error: null };
    } catch (error) {
      results.attendance = { status: 'error', data: null, error: error.message || JSON.stringify(error) };
    }
    setTestResults({ ...results });
  };

  const renderSection = (title, status, content, errorData) => (
    <div className="mb-8 border border-border-default rounded-xl overflow-hidden bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      <div className={`px-6 py-4 border-b border-border-subtle flex items-center justify-between ${
        status === 'success' ? 'bg-[#10B981]/10' : 
        status === 'error' ? 'bg-[#F43F5E]/10' : 'bg-surface-inset'
      }`}>
        <h2 className="text-h3 text-fg-primary">{title}</h2>
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-semibold tabular-nums uppercase ${
          status === 'success' ? 'bg-success-bg text-success border border-success-border' :
          status === 'error' ? 'bg-danger-bg text-danger border border-danger-border' :
          'bg-surface-raised text-fg-tertiary border border-border-subtle'
        }`}>
          {status}
        </span>
      </div>
      
      <div className="p-6 relative">
        <div className="absolute inset-0 bg-card-gradient pointer-events-none opacity-50"></div>
        <div className="relative z-10">
          {status === 'error' && errorData ? (
            <div className="bg-danger-bg border border-danger-border p-4 rounded-md">
              <h3 className="text-[14px] font-semibold text-danger mb-2">Error encountered</h3>
              <p className="text-body text-danger opacity-90 font-mono text-[13px]">{errorData}</p>
            </div>
          ) : content}
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-main p-8 min-h-screen bg-void pb-20">
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none" style={{ backgroundImage: 'var(--glow-cosmic)' }}></div>
      <div className="max-w-[800px] mx-auto relative z-10">
        <h1 className="text-display-lg text-fg-primary mb-8">Supabase Self-Test</h1>

        {/* Section 1: Env */}
        {renderSection(
          "Section 1: Environment Status", 
          testResults.env.status,
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${testResults.env.url ? 'bg-success' : 'bg-danger'}`}></span>
              <span className="text-body text-fg-primary font-mono text-[13px]">VITE_SUPABASE_URL: {testResults.env.url ? 'Loaded' : 'Missing'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${testResults.env.key ? 'bg-success' : 'bg-danger'}`}></span>
              <span className="text-body text-fg-primary font-mono text-[13px]">VITE_SUPABASE_ANON_KEY: {testResults.env.key ? 'Loaded' : 'Missing'}</span>
            </div>
          </div>
        )}

        {/* Section 2: Client */}
        {renderSection(
          "Section 2: Connection Status", 
          testResults.client.status,
          <p className="text-body text-fg-primary">{testResults.client.message || 'Waiting...'}</p>
        )}

        {/* Section 3: Students */}
        {renderSection(
          "Section 3: Students Table Query", 
          testResults.students.status,
          testResults.students.data ? (
            <pre className="text-[13px] font-mono text-fg-secondary overflow-x-auto p-4 bg-surface-inset rounded-md border border-border-subtle max-h-[300px] overflow-y-auto">
              {JSON.stringify(testResults.students.data, null, 2)}
            </pre>
          ) : <p className="text-body text-fg-secondary">Awaiting execution...</p>,
          testResults.students.error
        )}

        {/* Section 4: Sessions */}
        {renderSection(
          "Section 4: Sessions Table Query", 
          testResults.sessions.status,
          testResults.sessions.data ? (
            <pre className="text-[13px] font-mono text-fg-secondary overflow-x-auto p-4 bg-surface-inset rounded-md border border-border-subtle max-h-[300px] overflow-y-auto">
              {JSON.stringify(testResults.sessions.data, null, 2)}
            </pre>
          ) : <p className="text-body text-fg-secondary">Awaiting execution...</p>,
          testResults.sessions.error
        )}

        {/* Section 5: Attendance */}
        {renderSection(
          "Section 5: Attendance Join Query", 
          testResults.attendance.status,
          testResults.attendance.data ? (
            <pre className="text-[13px] font-mono text-fg-secondary overflow-x-auto p-4 bg-surface-inset rounded-md border border-border-subtle max-h-[300px] overflow-y-auto">
              {JSON.stringify(testResults.attendance.data, null, 2)}
            </pre>
          ) : <p className="text-body text-fg-secondary">Awaiting execution...</p>,
          testResults.attendance.error
        )}
      </div>
    </div>
  );
}
