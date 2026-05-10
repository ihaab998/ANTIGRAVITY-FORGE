import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Activity, Users, Calendar, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { session } = useAuth();
  const userName = session?.user?.user_metadata?.display_name || 'Mentor';
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeStudents: 0,
    lastSessionDate: null,
    overallAttendance: 0
  });
  
  const [todaySession, setTodaySession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState({
    marked: false,
    presentCount: 0,
    totalCount: 0,
    absentStudents: []
  });

  const [overview, setOverview] = useState({
    highestStudent: null,
    lowestStudent: null
  });

  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const [studentsRes, sessionsRes, attendanceRes, importRes] = await Promise.all([
        supabase.from('students').select('*').eq('is_active', true),
        supabase.from('sessions').select('*').order('date', { ascending: false }),
        supabase.from('attendance').select('*, students(name), sessions(date, topic)').order('marked_at', { ascending: false }),
        supabase.from('import_log').select('*').order('uploaded_at', { ascending: false }).limit(5)
      ]);

      const students = studentsRes.data || [];
      const sessions = sessionsRes.data || [];
      const attendance = attendanceRes.data || [];
      const imports = importRes.data || [];

      // 1. Ticker Stats
      const totalSessions = sessions.length;
      const activeStudents = students.length;
      const lastSessionDate = sessions[0]?.date || null;
      
      const totalAttendanceRecords = attendance.length;
      const totalPresent = attendance.filter(a => a.present).length;
      const overallAttendance = totalAttendanceRecords > 0 
        ? Math.round((totalPresent / totalAttendanceRecords) * 100) 
        : 0;

      setStats({
        totalSessions,
        activeStudents,
        lastSessionDate,
        overallAttendance
      });

      // 2. Today's Sessions
      const todaySessions = sessions.filter(s => s.date === today);
      setTodaySessions(todaySessions);
      const currentSession = todaySessions[0] || null;
      setTodaySession(currentSession);

      // 3. Today's Attendance (Aggregate)
      const todaySessionIds = todaySessions.map(s => s.id);
      const todaysRecords = attendance.filter(a => todaySessionIds.includes(a.session_id));
      
      if (todaysRecords.length > 0) {
        const presentCount = todaysRecords.filter(a => a.present).length;
        const totalCount = students.length * todaySessions.length;
        const absentStudents = todaysRecords
          .filter(a => !a.present)
          .map(a => a.students?.name || 'Unknown')
          .slice(0, 5);

        setTodayAttendance({
          marked: true,
          presentCount,
          totalCount,
          absentStudents
        });
      } else {
        setTodayAttendance({
          marked: false,
          presentCount: 0,
          totalCount: 0,
          absentStudents: []
        });
      }

      // 4. Program Overview (Highest / Lowest)
      if (attendance.length > 0) {
        const studentStats = {};
        attendance.forEach(a => {
          if (!studentStats[a.student_id]) {
            studentStats[a.student_id] = { name: a.students.name, present: 0, total: 0 };
          }
          studentStats[a.student_id].total++;
          if (a.present) studentStats[a.student_id].present++;
        });

        let highest = { name: '-', pct: -1 };
        let lowest = { name: '-', pct: 101 };

        Object.values(studentStats).forEach(s => {
          if (s.total > 0) {
            const pct = (s.present / s.total) * 100;
            if (pct > highest.pct) highest = { name: s.name, pct };
            if (pct < lowest.pct) lowest = { name: s.name, pct };
          }
        });

        setOverview({
          highestStudent: highest.pct !== -1 ? `${highest.name} (${Math.round(highest.pct)}%)` : '-',
          lowestStudent: lowest.pct !== 101 ? `${lowest.name} (${Math.round(lowest.pct)}%)` : '-'
        });
      }

      // 5. Recent Activity
      // Group attendance by session
      const groupedAttendance = [];
      const seenSessions = new Set();
      
      attendance.forEach(a => {
        if (!seenSessions.has(a.session_id) && a.marked_at) {
          seenSessions.add(a.session_id);
          groupedAttendance.push({
            type: 'attendance',
            title: `Attendance marked for ${a.sessions.topic}`,
            date: a.marked_at,
            timestamp: new Date(a.marked_at).getTime()
          });
        }
      });

      const mappedImports = imports.map(i => ({
        type: 'import',
        title: `CSV Uploaded: ${i.filename}`,
        date: i.uploaded_at,
        timestamp: new Date(i.uploaded_at).getTime()
      }));

      const combinedActivity = [...groupedAttendance, ...mappedImports]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

      setRecentActivity(combinedActivity);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-fg-secondary animate-pulse">Loading dashboard...</div>;
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Hero */}
      <section>
        <h1 className="text-display-lg text-fg-primary">Welcome Back, {userName.split(' ')[0]}</h1>
        <p className="text-body text-fg-secondary mt-2">Here's what's happening with your bootcamp today.</p>
      </section>

      {/* Ticker Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sessions', value: stats.totalSessions, icon: Calendar },
          { label: 'Overall Attendance', value: `${stats.overallAttendance}%`, icon: Activity },
          { label: 'Active Students', value: stats.activeStudents, icon: Users },
          { label: 'Last Session', value: stats.lastSessionDate || '-', icon: Clock },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-inset border border-border-subtle rounded-xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-fg-tertiary">
              <stat.icon size={20} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-caption text-fg-secondary uppercase tracking-wider">{stat.label}</p>
              <p className="text-h2 text-fg-primary mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Grid Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Today's Sessions */}
        <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6 flex flex-col relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-h3 text-fg-primary">Today's Sessions</h2>
              {todaySessions.length > 0 && (
                <span className="text-[10px] bg-accent-glow/10 text-accent-glow px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  {todaySessions.length} PLANNED
                </span>
              )}
            </div>
            
            {todaySessions.length > 0 ? (
              <div className="flex flex-col gap-3">
                {todaySessions.map((s, idx) => (
                  <div key={s.id} className={`p-4 rounded-xl border ${idx === 0 ? 'bg-surface-raised border-accent-glow/20 shadow-sm' : 'bg-surface-inset border-border-subtle opacity-80'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <p className="text-body font-bold text-fg-primary truncate">{s.topic}</p>
                        <p className="text-caption text-fg-tertiary mt-1 flex items-center gap-2">
                          <Clock size={12} /> {s.duration_hours}h • {s.session_type}
                        </p>
                      </div>
                      {idx === 0 && <span className="text-[10px] bg-accent-glow text-void px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">Latest</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <Calendar size={32} className="text-fg-tertiary mb-3" />
                <p className="text-body text-fg-secondary mb-4">No session scheduled for today.</p>
                <Link to="/attendance" className="bg-fg-primary text-void px-4 py-2 rounded-md text-[13px] font-medium hover:bg-[#E5E5E7] transition-colors">
                  Create Session
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Today's Attendance */}
        <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6 flex flex-col relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <div className="relative z-10 flex-1 flex flex-col">
            <h2 className="text-h3 text-fg-primary mb-6">Today's Attendance</h2>
            
            {todaySessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <p className="text-body text-fg-tertiary">Create a session first to mark attendance.</p>
              </div>
            ) : !todayAttendance.marked ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <AlertCircle size={32} className="text-danger mb-3" />
                <p className="text-body text-fg-secondary mb-4">Attendance has not been marked yet.</p>
                <Link to="/attendance" className="bg-fg-primary text-void px-4 py-2 rounded-md text-[13px] font-medium hover:bg-[#E5E5E7] transition-colors">
                  Mark Attendance
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-display-lg text-fg-primary leading-none">
                      {todayAttendance.presentCount} 
                      <span className="text-h3 text-fg-tertiary"> / {todayAttendance.totalCount}</span>
                    </p>
                    <p className="text-caption text-fg-secondary mt-2 uppercase tracking-widest font-bold">Aggregate Present</p>
                  </div>
                  <div className="text-right">
                    <p className="text-h2 text-success leading-none">
                      {Math.round((todayAttendance.presentCount / todayAttendance.totalCount) * 100)}%
                    </p>
                    <p className="text-caption text-fg-tertiary mt-2">Avg. Participation</p>
                  </div>
                </div>
                
                <div className="bg-surface-inset rounded-xl p-4 border border-border-subtle">
                  <p className="text-caption text-fg-secondary uppercase tracking-wider mb-3">Recently Absent</p>
                  <div className="flex flex-wrap gap-2">
                    {todayAttendance.absentStudents.length > 0 ? todayAttendance.absentStudents.map((name, i) => (
                      <span key={i} className="text-[11px] bg-danger/5 text-danger border border-danger/10 px-2 py-1 rounded">
                        {name}
                      </span>
                    )) : (
                      <span className="text-[11px] text-fg-tertiary italic">Full attendance across today's sessions!</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Program Overview */}
        <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6 relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <div className="relative z-10">
            <h2 className="text-h3 text-fg-primary mb-6">Program Overview</h2>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between py-3 border-b border-border-subtle">
                <span className="text-body text-fg-secondary">Total Sessions Conducted</span>
                <span className="text-body font-medium text-fg-primary">{stats.totalSessions}</span>
              </div>
              <div className="flex justify-between py-3 border-b border-border-subtle">
                <span className="text-body text-fg-secondary">Average Attendance</span>
                <span className="text-body font-medium text-fg-primary">{stats.overallAttendance}%</span>
              </div>
              <div className="flex justify-between py-3 border-b border-border-subtle">
                <span className="text-body text-fg-secondary">Highest Attendance</span>
                <span className="text-body font-medium text-success">{overview.highestStudent}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-body text-fg-secondary">Lowest Attendance</span>
                <span className="text-body font-medium text-danger">{overview.lowestStudent}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Recent Activity */}
        <div className="bg-surface rounded-2xl border border-border-default shadow-card p-6 relative overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-h3 text-fg-primary">Recent Activity</h2>
              <Link to="/history" className="text-[13px] text-fg-tertiary hover:text-fg-primary flex items-center gap-1 transition-colors">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            
            {recentActivity.length === 0 ? (
              <p className="text-body text-fg-tertiary py-4 text-center">No recent activity.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="mt-1">
                      {activity.type === 'attendance' ? (
                        <div className="w-2 h-2 rounded-full bg-success ring-4 ring-success-bg"></div>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-[#6366F1] ring-4 ring-[#6366F1]/20"></div>
                      )}
                    </div>
                    <div>
                      <p className="text-body text-fg-primary">{activity.title}</p>
                      <p className="text-caption text-fg-tertiary mt-1">
                        {new Date(activity.date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
      </section>
    </div>
  );
}
