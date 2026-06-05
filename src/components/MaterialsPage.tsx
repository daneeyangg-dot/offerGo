import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Trash2, Edit3, X, Save, Building2, UserCircle,
  Briefcase, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getJDs, getResumes, createJD, updateJD, deleteJD, createResume, updateResume, deleteResume } from '../lib/api';
import type { JDEntry, ResumeEntry } from '../types';

interface MaterialsPageProps {
  userPhone: string;
}

export default function MaterialsPage({ userPhone }: MaterialsPageProps) {
  const [activeTab, setActiveTab] = useState<'jd' | 'resume'>('jd');

  // JD Library
  const [jds, setJDs] = useState<JDEntry[]>([]);
  const [showJDForm, setShowJDForm] = useState(false);
  const [editingJD, setEditingJD] = useState<string | null>(null);
  const [jdForm, setJDForm] = useState({ company: '', position: '', content: '' });
  const [jdSearch, setJDSearch] = useState('');
  const [expandedJD, setExpandedJD] = useState<Set<string>>(new Set());

  // Resume Library
  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [showResumeForm, setShowResumeForm] = useState(false);
  const [editingResume, setEditingResume] = useState<string | null>(null);
  const [resumeForm, setResumeForm] = useState({ name: '', content: '' });
  const [resumeSearch, setResumeSearch] = useState('');

  useEffect(() => {
    loadJDs();
    loadResumes();
  }, [userPhone]);

  const loadJDs = async () => {
    try {
      const items = await getJDs();
      setJDs(items);
    } catch {
      setJDs([]);
    }
  };

  const loadResumes = async () => {
    try {
      const items = await getResumes();
      setResumes(items);
    } catch {
      setResumes([]);
    }
  };

  const handleSaveJD = async () => {
    if (!jdForm.company.trim() || !jdForm.content.trim()) {
      alert('公司名和JD内容不能为空');
      return;
    }
    if (editingJD) {
      try {
        await updateJD(editingJD, {
          company: jdForm.company,
          position: jdForm.position,
          content: jdForm.content,
        });
        await loadJDs();
      } catch {
        alert('保存失败');
      }
    } else {
      const newJD: JDEntry = {
        id: crypto.randomUUID(),
        company: jdForm.company,
        position: jdForm.position,
        content: jdForm.content,
        createdAt: Date.now(),
      };
      try {
        await createJD(newJD);
        await loadJDs();
      } catch {
        alert('添加失败');
      }
    }
    setJDForm({ company: '', position: '', content: '' });
    setEditingJD(null);
    setShowJDForm(false);
  };

  const handleDeleteJD = async (id: string) => {
    if (!confirm('确定删除这条JD吗？')) return;
    try {
      await deleteJD(id);
      await loadJDs();
    } catch {
      alert('删除失败');
    }
  };

  const handleEditJD = (jd: JDEntry) => {
    setJDForm({ company: jd.company, position: jd.position, content: jd.content });
    setEditingJD(jd.id);
    setShowJDForm(true);
  };

  const handleSaveResume = async () => {
    if (!resumeForm.name.trim() || !resumeForm.content.trim()) {
      alert('简历名称和内容不能为空');
      return;
    }
    if (editingResume) {
      try {
        await updateResume(editingResume, {
          name: resumeForm.name,
          content: resumeForm.content,
        });
        await loadResumes();
      } catch {
        alert('保存失败');
      }
    } else {
      const newResume: ResumeEntry = {
        id: crypto.randomUUID(),
        name: resumeForm.name,
        content: resumeForm.content,
        updatedAt: Date.now(),
      };
      try {
        await createResume(newResume);
        await loadResumes();
      } catch {
        alert('添加失败');
      }
    }
    setResumeForm({ name: '', content: '' });
    setEditingResume(null);
    setShowResumeForm(false);
  };

  const handleDeleteResume = async (id: string) => {
    if (!confirm('确定删除这条简历吗？')) return;
    try {
      await deleteResume(id);
      await loadResumes();
    } catch {
      alert('删除失败');
    }
  };

  const handleEditResume = (r: ResumeEntry) => {
    setResumeForm({ name: r.name, content: r.content });
    setEditingResume(r.id);
    setShowResumeForm(true);
  };

  const filteredJDs = jds.filter(j =>
    !jdSearch ||
    j.company.toLowerCase().includes(jdSearch.toLowerCase()) ||
    j.position.toLowerCase().includes(jdSearch.toLowerCase())
  );

  const filteredResumes = resumes.filter(r =>
    !resumeSearch || r.name.toLowerCase().includes(resumeSearch.toLowerCase())
  );

  const toggleExpandJD = (id: string) => {
    const set = new Set(expandedJD);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setExpandedJD(set);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
        {[
          { key: 'jd' as const, label: 'JD 库', icon: <Building2 className="w-4 h-4" /> },
          { key: 'resume' as const, label: '简历库', icon: <UserCircle className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all",
              activeTab === tab.key
                ? "bg-white text-pink-600 shadow-sm border border-pink-100"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* JD Tab */}
        {activeTab === 'jd' && (
          <motion.div
            key="jd"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-pink-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">JD 库</h3>
                <span className="text-[10px] text-slate-400 font-bold">({jds.length})</span>
              </div>
              <button
                onClick={() => { setShowJDForm(!showJDForm); setEditingJD(null); setJDForm({ company: '', position: '', content: '' }); }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" /> {showJDForm ? '取消' : '添加 JD'}
              </button>
            </div>

            <AnimatePresence>
              {showJDForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white rounded-xl border border-pink-100 p-6 space-y-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">公司名 *</label>
                        <input
                          type="text"
                          value={jdForm.company}
                          onChange={e => setJDForm({ ...jdForm, company: e.target.value })}
                          placeholder="如：字节跳动"
                          className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">职位名</label>
                        <input
                          type="text"
                          value={jdForm.position}
                          onChange={e => setJDForm({ ...jdForm, position: e.target.value })}
                          placeholder="如：高级前端工程师"
                          className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">JD 内容 *</label>
                      <textarea
                        value={jdForm.content}
                        onChange={e => setJDForm({ ...jdForm, content: e.target.value })}
                        placeholder="粘贴职位描述..."
                        className="w-full bg-white border border-slate-200 rounded p-4 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all resize-none h-40"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowJDForm(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all">取消</button>
                      <button onClick={handleSaveJD} className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2">
                        <Save className="w-3.5 h-3.5" /> {editingJD ? '保存修改' : '添加'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* JD Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={jdSearch}
                onChange={e => setJDSearch(e.target.value)}
                placeholder="搜索公司或职位..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
              />
            </div>

            {/* JD List */}
            <div className="grid grid-cols-1 gap-3">
              {filteredJDs.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">{jdSearch ? '没有匹配的JD' : '还没有保存的JD'}</p>
                  <p className="text-[10px] mt-1">点击上方按钮添加第一条JD</p>
                </div>
              ) : (
                filteredJDs.map(jd => (
                  <motion.div
                    key={jd.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-pink-200 transition-colors"
                  >
                    <div className="p-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-900">{jd.company}</span>
                          {jd.position && <span className="text-[10px] text-slate-400">· {jd.position}</span>}
                        </div>
                        <p className="text-[11px] text-slate-400">{new Date(jd.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleExpandJD(jd.id)} className="p-1.5 text-slate-400 hover:text-pink-500 transition-colors">
                          {expandedJD.has(jd.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleEditJD(jd)} className="p-1.5 text-slate-400 hover:text-pink-500 transition-colors">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteJD(jd.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {expandedJD.has(jd.id) && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                            <pre className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">{jd.content}</pre>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* Resume Tab */}
        {activeTab === 'resume' && (
          <motion.div
            key="resume"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-pink-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">简历库</h3>
                <span className="text-[10px] text-slate-400 font-bold">({resumes.length})</span>
              </div>
              <button
                onClick={() => { setShowResumeForm(!showResumeForm); setEditingResume(null); setResumeForm({ name: '', content: '' }); }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" /> {showResumeForm ? '取消' : '添加简历'}
              </button>
            </div>

            <AnimatePresence>
              {showResumeForm && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white rounded-xl border border-pink-100 p-6 space-y-4 shadow-sm">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">简历名称 *</label>
                      <input
                        type="text"
                        value={resumeForm.name}
                        onChange={e => setResumeForm({ ...resumeForm, name: e.target.value })}
                        placeholder="如：2024版简历-前端"
                        className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">简历内容 *</label>
                      <textarea
                        value={resumeForm.content}
                        onChange={e => setResumeForm({ ...resumeForm, content: e.target.value })}
                        placeholder="粘贴简历内容..."
                        className="w-full bg-white border border-slate-200 rounded p-4 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all resize-none h-40"
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowResumeForm(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all">取消</button>
                      <button onClick={handleSaveResume} className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2">
                        <Save className="w-3.5 h-3.5" /> {editingResume ? '保存修改' : '添加'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Resume Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={resumeSearch}
                onChange={e => setResumeSearch(e.target.value)}
                placeholder="搜索简历名称..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
              />
            </div>

            {/* Resume List */}
            <div className="grid grid-cols-1 gap-3">
              {filteredResumes.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                  <UserCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">{resumeSearch ? '没有匹配的简历' : '还没有保存的简历'}</p>
                  <p className="text-[10px] mt-1">点击上方按钮添加第一条简历</p>
                </div>
              ) : (
                filteredResumes.map(r => (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-lg border border-slate-200 p-4 hover:border-pink-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 mb-1">{r.name}</div>
                        <p className="text-[11px] text-slate-400">{new Date(r.updatedAt).toLocaleDateString()}</p>
                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{r.content.slice(0, 100)}...</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleEditResume(r)} className="p-1.5 text-slate-400 hover:text-pink-500 transition-colors">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteResume(r.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
