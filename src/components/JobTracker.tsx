import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseBusiness, Plus, Trash2, Edit3, Search, X,
  Loader2, AlertCircle, ChevronDown, Star, Calendar,
  FileText, MessageSquare, ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getApplications, saveApplication, updateApplication, deleteApplication } from '../lib/storage';
import type { JobApplication } from '../types';

const STATUS_OPTIONS = [
  { value: 'interested', label: '感兴趣', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'applied', label: '已投递', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'interviewing', label: '面试中', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'offer', label: '已录用', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'rejected', label: '已拒绝', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'withdrawn', label: '已撤回', color: 'bg-slate-100 text-slate-400 border-slate-200' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'high', label: '高', color: 'text-rose-500' },
  { value: 'medium', label: '中', color: 'text-amber-500' },
  { value: 'low', label: '低', color: 'text-slate-400' },
] as const;

interface JobTrackerProps {
  userPhone: string;
}

const EMPTY_APP: Omit<JobApplication, 'id' | 'createdAt' | 'updatedAt'> = {
  company: '',
  position: '',
  jd: '',
  tailoredResume: '',
  coverLetter: '',
  status: 'interested',
  priority: 'medium',
  notes: '',
};

export default function JobTracker({ userPhone }: JobTrackerProps) {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [form, setForm] = useState(EMPTY_APP);
  const [error, setError] = useState<string | null>(null);
  const [detailApp, setDetailApp] = useState<JobApplication | null>(null);

  const loadApplications = async () => {
    const apps = await getApplications(userPhone);
    setApplications(apps);
  };

  useEffect(() => {
    loadApplications();
  }, [userPhone]);

  const filtered = applications.filter((app) => {
    const matchStatus = filter === 'all' || app.status === filter;
    const matchSearch =
      !searchQuery ||
      app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.position.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const openAdd = () => {
    setEditingApp(null);
    setForm(EMPTY_APP);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (app: JobApplication) => {
    setEditingApp(app);
    setForm({
      company: app.company,
      position: app.position,
      jd: app.jd,
      tailoredResume: app.tailoredResume,
      coverLetter: app.coverLetter,
      status: app.status,
      priority: app.priority,
      notes: app.notes,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.company.trim() || !form.position.trim()) {
      setError('公司名和职位名不能为空');
      return;
    }
    try {
      if (editingApp) {
        await updateApplication(userPhone, editingApp.id, { ...form, updatedAt: Date.now() });
      } else {
        await saveApplication(userPhone, {
          ...form,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      await loadApplications();
      setShowModal(false);
    } catch {
      setError('保存失败，请稍后重试');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条投递记录吗？')) return;
    try {
      await deleteApplication(userPhone, id);
      await loadApplications();
      if (detailApp?.id === id) setDetailApp(null);
    } catch {
      setError('删除失败');
    }
  };

  const statusInfo = (s: string) => STATUS_OPTIONS.find((o) => o.value === s) || STATUS_OPTIONS[0];
  const priorityInfo = (p: string) => PRIORITY_OPTIONS.find((o) => o.value === p) || PRIORITY_OPTIONS[1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-pink-100 shadow-sm">
        <div className="flex items-center gap-3">
          <BriefcaseBusiness className="w-6 h-6 text-pink-500" />
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">投递追踪</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">管理你的求职投递记录</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> 添加投递
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索公司或职位..."
            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
          />
        </div>
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 overflow-x-auto">
          {[{ value: 'all', label: '全部' }, ...STATUS_OPTIONS].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all",
                filter === opt.value
                  ? "bg-white text-pink-600 shadow-sm border border-pink-100"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-slate-200">
          <BriefcaseBusiness className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">{applications.length === 0 ? '还没有投递记录' : '没有匹配的投递记录'}</p>
          <p className="text-[10px] mt-1">{applications.length === 0 ? '点击上方按钮添加第一条记录' : '尝试调整筛选条件'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((app) => {
            const s = statusInfo(app.status);
            const p = priorityInfo(app.priority);
            return (
              <motion.div
                key={app.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-pink-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", s.color)}>
                      {s.label}
                    </span>
                    <Star className={cn("w-3.5 h-3.5", p.color)} fill="currentColor" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(app)}
                      className="p-1.5 text-slate-400 hover:text-pink-500 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(app.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-0.5 truncate">{app.company}</h3>
                <p className="text-[12px] text-slate-500 mb-3 truncate">{app.position}</p>

                {app.notes && (
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2">{app.notes}</p>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(app.updatedAt).toLocaleDateString()}
                  </div>
                  <button
                    onClick={() => setDetailApp(app)}
                    className="flex items-center gap-1 text-pink-500 hover:text-pink-600 font-bold uppercase tracking-widest transition-colors"
                  >
                    详情 <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  {editingApp ? '编辑投递记录' : '添加投递记录'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2 border border-rose-100">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">公司名 *</label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">职位名 *</label>
                    <input
                      type="text"
                      value={form.position}
                      onChange={(e) => setForm({ ...form, position: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">状态</label>
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as JobApplication['status'] })}
                        className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all appearance-none"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">优先级</label>
                    <div className="relative">
                      <select
                        value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: e.target.value as JobApplication['priority'] })}
                        className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all appearance-none"
                      >
                        {PRIORITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> JD 内容
                  </label>
                  <textarea
                    value={form.jd}
                    onChange={(e) => setForm({ ...form, jd: e.target.value })}
                    placeholder="粘贴职位描述..."
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none h-24"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> 简历快照
                  </label>
                  <textarea
                    value={form.tailoredResume}
                    onChange={(e) => setForm({ ...form, tailoredResume: e.target.value })}
                    placeholder="粘贴优化后的简历..."
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none h-24"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> 求职信
                  </label>
                  <textarea
                    value={form.coverLetter}
                    onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                    placeholder="粘贴求职信内容..."
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none h-24"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">备注</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="面试安排、联系人、薪资范围等备注..."
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none h-16"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] transition-all"
                  >
                    {editingApp ? '保存修改' : '添加记录'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setDetailApp(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black text-slate-900">{detailApp.company}</h3>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", statusInfo(detailApp.status).color)}>
                    {statusInfo(detailApp.status).label}
                  </span>
                </div>
                <button
                  onClick={() => setDetailApp(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">职位</span>
                  <p className="text-sm font-medium text-slate-800 mt-1">{detailApp.position}</p>
                </div>
                {detailApp.jd && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-3 h-3" /> JD
                    </span>
                    <div className="mt-2 bg-slate-50 rounded p-4 text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">{detailApp.jd}</div>
                  </div>
                )}
                {detailApp.tailoredResume && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-3 h-3" /> 简历快照
                    </span>
                    <div className="mt-2 bg-slate-50 rounded p-4 text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">{detailApp.tailoredResume}</div>
                  </div>
                )}
                {detailApp.coverLetter && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" /> 求职信
                    </span>
                    <div className="mt-2 bg-slate-50 rounded p-4 text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">{detailApp.coverLetter}</div>
                  </div>
                )}
                {detailApp.notes && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">备注</span>
                    <p className="text-[12px] text-slate-600 mt-1">{detailApp.notes}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <Calendar className="w-3 h-3" />
                  创建于 {new Date(detailApp.createdAt).toLocaleDateString()} · 更新于 {new Date(detailApp.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
