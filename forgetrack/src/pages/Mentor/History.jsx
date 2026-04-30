import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search } from 'lucide-react';

export default function History() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, total: 0, percentage: 0 });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentHistory(selectedStudent.id);
    } else {
      setAttendance([]);
      setStats({ present: 0, total: 0, percentage: 0 });
    }
  }, [selectedStudent]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [studentsRes, sessionsRes] = await Promise.all([
        supabase.from('students').select('*').eq('is_active', true).order('name'),
        supabase.from('sessions').select('*').order('date', { ascending: true })
      ]);
      setStudents(studentsRes.data || []);
      setSessions(sessionsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentHistory = async (studentId) => {
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId);
      
      const attData = data || [];
      setAttendance(attData);

      const present = attData.filter(a => a.present).length;
      const total = attData.length;
      setStats({
        present,
        total,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0
      });
    } catch (err) {
      console.error(err);
    }
  };

  const getStatus = (sessionId) => {
    const record = attendance.find(a => a.session_id === sessionId);
    if (!record) return 'unmarked';
    return record.present ? 'present' : 'absent';
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      <div>
        <h1 className="text-display-lg text-fg-primary">Student History</h1>
        <p className="text-body text-fg-secondary mt-2">View detailed attendance history and analytics for any student.</p>
      </div>

      <div className="max-w-[400px] relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
        <select 
          className="w-full bg-surface-inset border border-border-default rounded-md pl-10 pr-4 py-3 text-fg-primary text-[14px] appearance-none focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
          onChange={(e) => {
            const id = e.target.value;
            setSelectedStudent(students.find(s => s.id.toString() === id) || null);
          }}
          defaultValue=""
        >
          <option value="" disabled>Search and select a student...</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.usn})</option>
          ))}
        </select>
      </div>

      {selectedStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1 bg-surface rounded-2xl border border-border-default shadow-card p-6 flex flex-col relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-surface-raised border border-border-default flex items-center justify-center text-display-sm text-fg-primary mb-4">
                {selectedStudent.name.charAt(0)}
              </div>
              <h2 className="text-h2 text-fg-primary mb-1">{selectedStudent.name}</h2>
              <p className="text-body font-mono text-fg-secondary mb-1">{selectedStudent.usn}</p>
              <p className="text-body text-fg-tertiary mb-6 uppercase tracking-wider">{selectedStudent.branch_code} Branch</p>

              <div className="w-full bg-surface-inset rounded-xl p-4 border border-border-subtle mt-auto">
                <p className="text-caption text-fg-secondary uppercase tracking-wider mb-2">Overall Attendance</p>
                <div className="flex items-end justify-center gap-2 mb-3">
                  <span className="text-display-lg text-fg-primary leading-none">{stats.percentage}%</span>
                </div>
                <div className="w-full bg-surface-raised h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${stats.percentage >= 75 ? 'bg-success' : 'bg-danger'}`} 
                    style={{ width: `${stats.percentage}%` }}
                  ></div>
                </div>
                <p className="text-body-sm text-fg-tertiary mt-3">
                  Present for {stats.present} out of {stats.total} marked sessions
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Heatmap */}
            <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6 relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
              <div className="relative z-10">
                <h3 className="text-h3 text-fg-primary mb-4">Activity Heatmap</h3>
                <div className="flex flex-wrap gap-2">
                  {sessions.map(s => {
                    const status = getStatus(s.id);
                    return (
                      <div 
                        key={s.id}
                        title={`${s.date}: ${s.topic} - ${status}`}
                        className={`w-6 h-6 rounded-sm border ${
                          status === 'present' ? 'bg-success border-success-border' :
                          status === 'absent' ? 'bg-danger border-danger-border' :
                          'bg-surface-inset border-border-subtle'
                        }`}
                      ></div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-6">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-success border border-success-border"></div><span className="text-caption text-fg-secondary">Present</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-danger border border-danger-border"></div><span className="text-caption text-fg-secondary">Absent</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-surface-inset border border-border-subtle"></div><span className="text-caption text-fg-secondary">Unmarked</span></div>
                </div>
              </div>
            </div>

            {/* Session Table */}
            <div className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
              <div className="p-6 border-b border-border-subtle">
                <h3 className="text-h3 text-fg-primary">Detailed History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-inset">
                      <th className="text-left p-4 font-[500] text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle">Date</th>
                      <th className="text-left p-4 font-[500] text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle">Topic</th>
                      <th className="text-left p-4 font-[500] text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle">Duration</th>
                      <th className="text-left p-4 font-[500] text-[12px] text-fg-tertiary uppercase tracking-[0.02em] border-b border-border-subtle">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sessions].reverse().map(s => {
                      const status = getStatus(s.id);
                      return (
                        <tr key={s.id} className="hover:bg-surface-raised transition-colors">
                          <td className="p-4 border-b border-border-subtle text-body text-fg-secondary">{s.date}</td>
                          <td className="p-4 border-b border-border-subtle text-body text-fg-primary">{s.topic}</td>
                          <td className="p-4 border-b border-border-subtle text-body text-fg-secondary">{s.duration_hours}h</td>
                          <td className="p-4 border-b border-border-subtle">
                            {status === 'present' ? (
                              <span className="inline-flex items-center gap-1 bg-success-bg/20 text-success border border-success-border px-2 py-1 rounded text-[12px] font-medium uppercase">
                                Present
                              </span>
                            ) : status === 'absent' ? (
                              <span className="inline-flex items-center gap-1 bg-danger-bg/20 text-danger border border-danger-border px-2 py-1 rounded text-[12px] font-medium uppercase">
                                Absent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-surface-raised text-fg-tertiary border border-border-subtle px-2 py-1 rounded text-[12px] font-medium uppercase">
                                Unmarked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
