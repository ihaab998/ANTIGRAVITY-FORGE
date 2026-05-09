import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar as CalendarIcon, CheckSquare, Square, Save, Plus } from 'lucide-react';

export default function MarkAttendance() {
  const { session: authSession } = useAuth();
  const userName = authSession?.user?.user_metadata?.display_name || 'System';

  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Session Form State
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(2.0);
  const [type, setType] = useState('offline');

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    setMessage('');
    try {
      // 1. Fetch Session
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('date', currentDate)
        .maybeSingle();

      if (sessionError) {
        console.error('Error fetching session:', sessionError);
      }

      setSession(sessionData || null);

      // 2. Fetch Active Students
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name, usn, branch_code')
        .eq('is_active', true)
        .order('usn');

      if (studentError) throw studentError;
      setStudents(studentData || []);

      // 3. If session exists, fetch attendance
      const newMap = {};
      if (sessionData) {
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('student_id, present')
          .eq('session_id', sessionData.id);

        if (attendanceData) {
          attendanceData.forEach(a => {
            newMap[a.student_id] = a.present;
          });
        }
      }
      setAttendanceMap(newMap);

    } catch (err) {
      console.error(err);
      setMessage('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([{
          date: currentDate,
          topic,
          duration_hours: duration,
          session_type: type,
          month_number: new Date(currentDate).getMonth() + 1
        }])
        .select()
        .single();

      if (error) throw error;
      setSession(data);
      setMessage('Session created successfully.');
      setTopic('');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (studentId) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const setAll = (value) => {
    const newMap = {};
    students.forEach(s => {
      newMap[s.id] = value;
    });
    setAttendanceMap(newMap);
  };

  const handleSaveAttendance = async () => {
    if (!session) return;
    setSaving(true);
    setMessage('');
    
    try {
      const records = students.map(s => ({
        student_id: s.id,
        session_id: session.id,
        present: attendanceMap[s.id] === true, // default false if undefined
        marked_by: userName,
        marked_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,session_id' });

      if (error) throw error;
      setMessage('Attendance saved successfully.');
    } catch (err) {
      setMessage(`Error saving attendance: ${err.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-fg-primary">Mark Attendance</h1>
          <p className="text-body text-fg-secondary mt-2">Record participation for your sessions.</p>
        </div>
        <div className="flex items-center gap-3 bg-surface border border-border-default rounded-md px-4 py-2">
          <CalendarIcon size={18} className="text-fg-tertiary" />
          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="bg-transparent text-body text-fg-primary outline-none [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md border ${message.includes('Error') ? 'bg-danger-bg border-danger-border text-danger' : 'bg-success-bg border-success-border text-success'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-fg-secondary animate-pulse">Loading data...</div>
      ) : !session ? (
        <div className="bg-surface rounded-2xl border border-border-default shadow-card p-8" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <h2 className="text-h3 text-fg-primary mb-2">No Session Found</h2>
          <p className="text-body text-fg-secondary mb-8">There is no session scheduled for {currentDate}. Create one to mark attendance.</p>
          
          <form onSubmit={handleCreateSession} className="flex flex-col gap-5 max-w-[400px]">
            <div className="flex flex-col gap-2">
              <label className="text-label text-fg-secondary">TOPIC</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                placeholder="e.g. Intro to Machine Learning"
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-label text-fg-secondary">DURATION (HOURS)</label>
                <input
                  type="number"
                  step="0.5"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value))}
                  required
                  className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-label text-fg-secondary">TYPE</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none appearance-none"
                >
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-fg-primary text-void rounded-md py-3 px-5 font-medium text-[14px] hover:bg-[#E5E5E7] transition-colors mt-2 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden flex flex-col" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <div className="p-6 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-h3 text-fg-primary">{session.topic}</h2>
              <div className="flex gap-3 mt-2">
                <span className="text-caption text-fg-tertiary uppercase tracking-wider">{session.session_type}</span>
                <span className="text-caption text-fg-tertiary uppercase tracking-wider">•</span>
                <span className="text-caption text-fg-tertiary uppercase tracking-wider">{session.duration_hours} hours</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setAll(true)}
                className="bg-surface-raised border border-border-default text-fg-primary px-4 py-2 rounded-md text-[13px] font-medium hover:bg-surface transition-colors"
              >
                Mark All Present
              </button>
              <button 
                onClick={() => setAll(false)}
                className="bg-surface-raised border border-border-default text-fg-primary px-4 py-2 rounded-md text-[13px] font-medium hover:bg-surface transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-inset">
                  <th className="w-16 p-4 border-b border-border-subtle"></th>
                  <th className="text-left p-4 font-[500] text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle">Student Name</th>
                  <th className="text-left p-4 font-[500] text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle">USN</th>
                  <th className="text-left p-4 font-[500] text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle">Branch</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const isPresent = attendanceMap[student.id] === true;
                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-surface-raised transition-colors cursor-pointer ${isPresent ? 'bg-[#10B981]/5' : ''}`}
                      onClick={() => handleToggle(student.id)}
                    >
                      <td className="p-4 border-b border-border-subtle text-center">
                        {isPresent ? (
                          <CheckSquare size={20} className="text-success inline-block" />
                        ) : (
                          <Square size={20} className="text-fg-tertiary inline-block" />
                        )}
                      </td>
                      <td className="p-4 border-b border-border-subtle text-body text-fg-primary font-medium">{student.name}</td>
                      <td className="p-4 border-b border-border-subtle text-body text-fg-secondary font-mono">{student.usn}</td>
                      <td className="p-4 border-b border-border-subtle text-body text-fg-secondary">{student.branch_code}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-border-subtle flex justify-end bg-surface-inset/50">
            <button
              onClick={handleSaveAttendance}
              disabled={saving}
              className="bg-fg-primary text-void rounded-md py-3 px-6 font-medium text-[14px] hover:bg-[#E5E5E7] transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
