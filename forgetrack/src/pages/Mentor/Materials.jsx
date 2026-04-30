import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Filter, Link as LinkIcon, Video, Presentation, X } from 'lucide-react';

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formSessionId, setFormSessionId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('slides');
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [materialsRes, sessionsRes] = await Promise.all([
        supabase.from('materials').select('*, sessions(date, topic, month_number)').order('created_at', { ascending: false }),
        supabase.from('sessions').select('*').order('date', { ascending: false })
      ]);
      setMaterials(materialsRes.data || []);
      setSessions(sessionsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('materials')
        .insert([{
          session_id: formSessionId,
          title: formTitle,
          type: formType,
          url: formUrl,
          description: formDescription
        }])
        .select('*, sessions(date, topic, month_number)')
        .single();

      if (error) throw error;
      setMaterials([data, ...materials]);
      setIsModalOpen(false);
      
      // Reset form
      setFormSessionId('');
      setFormTitle('');
      setFormUrl('');
      setFormDescription('');
      setFormType('slides');
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Group and filter materials
  const groupedMaterials = useMemo(() => {
    let filtered = materials;

    if (selectedMonth) {
      filtered = filtered.filter(m => m.sessions?.month_number.toString() === selectedMonth);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(q) || 
        m.sessions?.topic.toLowerCase().includes(q)
      );
    }

    const groups = {};
    filtered.forEach(m => {
      const key = `${m.sessions?.date}::${m.sessions?.topic}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });

    // Sort keys chronologically descending
    return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(key => ({
      date: key.split('::')[0],
      topic: key.split('::')[1],
      items: groups[key]
    }));
  }, [materials, searchQuery, selectedMonth]);

  const getIcon = (type) => {
    switch (type) {
      case 'recording': return <Video size={18} />;
      case 'slides': return <Presentation size={18} />;
      default: return <LinkIcon size={18} />;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-display-lg text-fg-primary">Materials Library</h1>
          <p className="text-body text-fg-secondary mt-2">Manage session slides, recordings, and resources.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-fg-primary text-void px-4 py-2 rounded-md text-[13px] font-medium hover:bg-[#E5E5E7] transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Add Material
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-[400px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <input 
            type="text"
            placeholder="Search materials or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-inset border border-border-default rounded-md pl-10 pr-4 py-2 h-[44px] text-fg-primary text-[14px] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
          />
        </div>
        <div className="relative w-[180px]">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full bg-surface-inset border border-border-default rounded-md pl-10 pr-4 py-2 h-[44px] text-fg-primary text-[14px] appearance-none focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
          >
            <option value="">All Months</option>
            {[1,2,3,4,5,6].map(m => (
              <option key={m} value={m}>Month {m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-fg-secondary animate-pulse">Loading materials...</div>
      ) : groupedMaterials.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-2xl border border-border-default shadow-card">
          <p className="text-body text-fg-secondary">No materials found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedMaterials.map((group, idx) => (
            <div key={idx} className="bg-surface rounded-2xl border border-border-default shadow-card overflow-hidden" style={{ backgroundImage: 'var(--card-gradient)' }}>
              <div className="p-5 border-b border-border-subtle bg-surface-inset/50 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <h2 className="text-h3 text-fg-primary">{group.topic}</h2>
                <span className="text-caption font-mono text-fg-tertiary">{group.date}</span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.items.map(material => (
                  <a 
                    key={material.id} 
                    href={material.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block group"
                  >
                    <div className="border border-border-default bg-surface-inset rounded-xl p-4 hover:border-border-subtle hover:bg-surface-raised transition-all h-full flex flex-col">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h3 className="text-body text-fg-primary font-medium group-hover:text-[#6366F1] transition-colors line-clamp-2">
                          {material.title}
                        </h3>
                        <div className="w-8 h-8 shrink-0 rounded-full bg-surface border border-border-subtle flex items-center justify-center text-fg-tertiary group-hover:text-[#6366F1] transition-colors">
                          {getIcon(material.type)}
                        </div>
                      </div>
                      <p className="text-caption text-fg-tertiary uppercase tracking-wider mb-2">{material.type}</p>
                      {material.description && (
                        <p className="text-body-sm text-fg-secondary line-clamp-2 mt-auto pt-2 border-t border-border-subtle/50">
                          {material.description}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-sm">
          <div className="bg-surface border border-border-default rounded-2xl p-6 w-full max-w-[500px] shadow-2xl relative" style={{ backgroundImage: 'var(--card-gradient)' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-h2 text-fg-primary">Add Material</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-fg-tertiary hover:text-fg-primary">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddMaterial} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-label text-fg-secondary">SESSION</label>
                <select
                  value={formSessionId}
                  onChange={(e) => setFormSessionId(e.target.value)}
                  required
                  className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] appearance-none focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                >
                  <option value="" disabled>Select a session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.date} - {s.topic}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-label text-fg-secondary">TITLE</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  placeholder="e.g. Session 1 Slides"
                  className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-label text-fg-secondary">TYPE</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] appearance-none focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                  >
                    <option value="slides">Slides</option>
                    <option value="recording">Recording</option>
                    <option value="link">Link</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-label text-fg-secondary">URL</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  required
                  placeholder="https://"
                  className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-label text-fg-secondary">DESCRIPTION (OPTIONAL)</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="bg-surface-inset border border-border-default rounded-md px-4 py-3 text-fg-primary text-[14px] focus:border-accent-glow focus:shadow-[0_0_0_3px_rgba(99,102,241,0.25)] outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-[13px] font-medium text-fg-secondary hover:text-fg-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-fg-primary text-void rounded-md px-6 py-2 font-medium text-[13px] hover:bg-[#E5E5E7] transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
