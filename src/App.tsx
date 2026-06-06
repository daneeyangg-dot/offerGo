/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseBusiness,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileSearch,
  ArrowRight,
  Send,
  Copy,
  Search,
  Building2,
  X,
  Save,
  LogOut,
  UserCircle,
  Settings,
  Edit3,
  Check,
  History,
  Trash2,
  Clock,
  Lock,
} from 'lucide-react';
import {
  analyzeJobFit, tailorResumeStream, generateCoverLetterStream, type AnalysisResult,
  getApiConfig, saveApiConfig,
} from './lib/gemini';
import ReactMarkdown from 'react-markdown';
import { saveApplication } from './lib/storage';
import { cn } from './lib/utils';
import InterviewPrep from './components/InterviewPrep';
import JobTracker from './components/JobTracker';
import LoginPage from './components/LoginPage';
import MaterialsPage from './components/MaterialsPage';
import {
  getSession,
  setSession,
  clearSession,
  migrateLegacyData,
  changePassword,
} from './lib/auth';
import {
  getJDs,
  getResumes,
  getDraft,
  saveDraft,
  createAnalysisHistory,
  getAnalysisHistory,
  deleteAnalysisHistory,
} from './lib/api';
import type { View, JobApplication, User } from './types';

type Step = 'input' | 'analysis' | 'tailor' | 'cl';

interface JDItem {
  id: string;
  company: string;
  position: string;
  content: string;
}

interface ResumeItem {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      setCurrentUser(session);
      migrateLegacyData(session.phone);
    }
  }, []);

  const handleLogin = (user: User) => {
    setSession(user);
    setCurrentUser(user);
    migrateLegacyData(user.phone);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    // Reset app state
    setView('analyzer');
    setStep('input');
    setJd('');
    setResume('');
    setExtraDocs('');
    setAnalysis(null);
    setOptimizedResume('');
    setCoverLetter('');
  };

  const [view, setView] = useState<View>('analyzer');
  const [step, setStep] = useState<Step>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inputs
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');
  const [extraDocs, setExtraDocs] = useState('');

  // Material selector modals
  const [showJDModal, setShowJDModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [jdSearch, setJdSearch] = useState('');
  const [resumeSearch, setResumeSearch] = useState('');

  // API config (multi-provider)
  const [apiConfig, setApiConfig] = useState(() => getApiConfig());
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Change Password state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePasswordSubmit = async () => {
    if (!newPassword.trim()) {
      setChangePasswordError('新密码不能为空');
      return;
    }
    if (newPassword.length < 6) {
      setChangePasswordError('密码长度不能小于6位');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError('两次输入的密码不一致');
      return;
    }
    setChangePasswordError(null);
    setChangePasswordSuccess(null);
    setIsChangingPassword(true);
    try {
      await changePassword(newPassword);
      setChangePasswordSuccess('密码修改成功！');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setChangePasswordSuccess(null);
      }, 1500);
    } catch (err) {
      setChangePasswordError(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // First-time onboarding: prompt for API config when a logged-in user has none.
  useEffect(() => {
    if (currentUser && !getApiConfig().apiKey) {
      setShowApiKeyModal(true);
    }
  }, [currentUser]);

  // Edit mode for Step 02 / 03
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [isEditingCL, setIsEditingCL] = useState(false);

  // Analysis history
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    id: string; company: string; position: string; fitRating: string;
    score: number; recommendation: string; createdAt: number;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Material library data (synced from server)
  const [jdList, setJDList] = useState<JDItem[]>([]);
  const [resumeList, setResumeList] = useState<ResumeItem[]>([]);

  // Load data from server when user changes
  useEffect(() => {
    if (!currentUser) {
      setJDList([]);
      setResumeList([]);
      return;
    }
    getJDs().then(setJDList).catch(() => setJDList([]));
    getResumes().then(setResumeList).catch(() => setResumeList([]));
  }, [currentUser]);

  const getJDList = (): JDItem[] => jdList;
  const getResumeList = (): ResumeItem[] => resumeList;

  // Draft persistence
  const clearDraft = async () => {
    if (!currentUser) return;
    try {
      await saveDraft('analyzer', {});
    } catch {
      // ignore
    }
  };

  // Analysis history functions
  const loadAnalysisHistory = async () => {
    setHistoryLoading(true);
    try {
      const items = await getAnalysisHistory();
      setAnalysisHistory(items);
    } catch {
      setAnalysisHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveCurrentAnalysis = async () => {
    if (!analysis || !currentUser) return;
    const lines = jd.split('\n').filter((l) => l.trim());
    const companyGuess = lines[0]?.length < 30 ? lines[0] : '';
    const positionGuess = lines.find(
      (l) => l.includes('岗位') || l.includes('职位') || l.includes('工程师') || l.includes('经理')
    ) || '';
    try {
      await createAnalysisHistory({
        id: crypto.randomUUID(),
        company: companyGuess,
        position: positionGuess,
        jd,
        resume,
        extraDocs,
        fitRating: analysis.fitRating,
        roleType: analysis.roleType,
        seniorityLevel: analysis.seniorityLevel,
        score: analysis.score,
        keyReasons: analysis.keyReasons,
        recommendation: analysis.recommendation,
        optimizedResume,
        coverLetter,
      });
      alert('已保存到分析历史');
    } catch {
      alert('保存失败');
    }
  };

  const loadHistoryItem = async (id: string) => {
    try {
      const { getAnalysisHistoryDetail } = await import('./lib/api');
      const item = await getAnalysisHistoryDetail(id);
      setJd(item.jd);
      setResume(item.resume);
      setExtraDocs(item.extraDocs);
      setAnalysis({
        roleType: item.roleType,
        seniorityLevel: item.seniorityLevel,
        fitRating: item.fitRating as 'A' | 'B' | 'C',
        keyReasons: item.keyReasons,
        recommendation: item.recommendation,
        score: item.score,
      });
      setOptimizedResume(item.optimizedResume);
      setCoverLetter(item.coverLetter);
      setStep('cl');
      setShowHistoryModal(false);
    } catch {
      alert('加载失败');
    }
  };

  const removeHistoryItem = async (id: string) => {
    if (!confirm('确定删除这条历史记录吗？')) return;
    try {
      await deleteAnalysisHistory(id);
      await loadAnalysisHistory();
    } catch {
      alert('删除失败');
    }
  };

  // Results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [optimizedResume, setOptimizedResume] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  // Load draft when user logs in
  useEffect(() => {
    if (!currentUser) return;
    getDraft('analyzer').then((draft) => {
      if (!draft?.data) return;
      try {
        const d = draft.data as Record<string, unknown>;
        if (d.jd !== undefined) setJd(d.jd as string);
        if (d.resume !== undefined) setResume(d.resume as string);
        if (d.extraDocs !== undefined) setExtraDocs(d.extraDocs as string);
        if (d.step) setStep(d.step as Step);
        if (d.analysis) setAnalysis(d.analysis as AnalysisResult);
        if (d.optimizedResume !== undefined) setOptimizedResume(d.optimizedResume as string);
        if (d.coverLetter !== undefined) setCoverLetter(d.coverLetter as string);
      } catch {
        // ignore corrupt draft
      }
    }).catch(() => {
      // ignore
    });
  }, [currentUser]);

  // Auto-save draft when inputs or results change
  useEffect(() => {
    if (!currentUser) return;
    const draft = { jd, resume, extraDocs, step, analysis, optimizedResume, coverLetter };
    const timer = setTimeout(() => {
      saveDraft('analyzer', draft).catch(() => {
        // ignore save errors
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [jd, resume, extraDocs, step, analysis, optimizedResume, coverLetter]);

  // Sample data helper
  const loadSampleData = () => {
    setJd(`岗位描述：高级前端开发工程师
要求：
- 5年以上 React 经验。
- 精通 TypeScript 和 Tailwind CSS。
- 熟悉 Vite 和组件自动化测试。
- 有团队管理或导师经验者优先。`);
    setResume(`示例用户 - 资深前端工程师
工作经历：
- 示例公司 A (2020-至今)：高级开发人员。领导了核心仪表盘的 React 18 迁移，性能提升 40%。管理 4 人前端组。
- 示例公司 B (2017-2020)：前端开发。负责设计模式系统的构建。
技能：React, TypeScript, Tailwind, Node.js。
专业经验：6 年。`);
    setExtraDocs(`个人网站：example.com
曾获得 2022 年度最佳员工奖。
参与过开源项目 shadcn/ui 的贡献。`);
  };
  // Save to tracker modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveForm, setSaveForm] = useState({
    company: '',
    position: '',
    jd: '',
    tailoredResume: '',
    coverLetter: '',
  });

  const handleStartAnalysis = async () => {
    if (!jd.trim() || !resume.trim()) {
      setError('请输入 Job Description 和 Resume');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await analyzeJobFit(jd, resume, extraDocs);
      setAnalysis(result);
      setStep('analysis');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`分析失败: ${msg}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTailorResume = async () => {
    setIsLoading(true);
    setOptimizedResume('');
    try {
      setStep('tailor');
      const stream = tailorResumeStream(jd, resume, extraDocs);
      for await (const chunk of stream) {
        setOptimizedResume((prev) => prev + chunk);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`简历优化失败: ${msg}`);
      console.error(e);
      setStep('analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCL = async () => {
    setIsLoading(true);
    setCoverLetter('');
    try {
      setStep('cl');
      const stream = generateCoverLetterStream(jd, optimizedResume || resume);
      for await (const chunk of stream) {
        setCoverLetter((prev) => prev + chunk);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Cover Letter 生成失败: ${msg}`);
      console.error(e);
      setStep('tailor');
    } finally {
      setIsLoading(false);
    }
  };

  const openSaveModal = () => {
    const lines = jd.split('\n').filter((l) => l.trim());
    const firstLine = lines[0] || '';
    const companyGuess = firstLine.length < 30 ? firstLine : '';
    const positionGuess =
      lines.find(
        (l) =>
          l.includes('岗位') ||
          l.includes('职位') ||
          l.includes('工程师') ||
          l.includes('经理')
      ) || '';
    setSaveForm({
      company: companyGuess,
      position: positionGuess,
      jd,
      tailoredResume: optimizedResume,
      coverLetter,
    });
    setShowSaveModal(true);
  };

  const handleSaveToTracker = async () => {
    if (!saveForm.company.trim() || !saveForm.position.trim()) {
      alert('公司名和职位名不能为空');
      return;
    }
    if (!currentUser) return;
    const app: JobApplication = {
      id: crypto.randomUUID(),
      company: saveForm.company,
      position: saveForm.position,
      jd: saveForm.jd,
      tailoredResume: saveForm.tailoredResume,
      coverLetter: saveForm.coverLetter,
      status: 'applied',
      priority: 'medium',
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await saveApplication(currentUser.phone, app);
      setShowSaveModal(false);
      alert('已保存到投递追踪');
    } catch {
      alert('保存失败，请稍后重试');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  // Not logged in
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-8 shrink-0 shadow-lg z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-pink-500 rounded flex items-center justify-center font-bold text-lg text-white">
            I
          </div>
          <h1 className="text-xl font-semibold tracking-tight uppercase">
            I HAVE a JOB{' '}
            <span className="text-pink-400 font-normal capitalize">
            
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            {(
              [
                { key: 'analyzer', label: '分析' },
                { key: 'interview', label: '面试准备' },
                { key: 'tracker', label: '投递追踪' },
                { key: 'materials', label: '我的资料' },
              ] as { key: View; label: string }[]
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  'px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all',
                  view === item.key
                    ? 'bg-pink-600 text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* User Info */}
          <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
            <div className="flex items-center gap-2 text-[10px] text-slate-300">
              <UserCircle className="w-4 h-4 text-pink-400" />
              <span className="font-medium">{currentUser.phone}</span>
            </div>
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="p-2 text-slate-400 hover:text-pink-400 transition-colors rounded-md hover:bg-slate-800"
              title="API 设置"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowChangePasswordModal(true)}
              className="p-2 text-slate-400 hover:text-pink-400 transition-colors rounded-md hover:bg-slate-800"
              title="修改密码"
            >
              <Lock className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 transition-colors rounded-md hover:bg-slate-800"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 lg:p-8 overflow-hidden overflow-y-auto">
        {view === 'analyzer' && (
          <AnimatePresence mode="wait">
            {step === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 max-w-4xl mx-auto w-full"
              >
                <div className="border-l-4 border-pink-500 pl-6 py-2">
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">
                    职业智能分析
                  </h2>
                  <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">
                    安全 · 准确 · 基于事实的简历优化
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileSearch className="w-4 h-4" />
                        职位描述 (JD) <span className="text-rose-500">*</span>
                      </label>
                      <button
                        onClick={() => { setShowJDModal(true); setJdSearch(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-pink-50 hover:text-pink-600 border border-slate-200 hover:border-pink-200 transition-all"
                      >
                        <Building2 className="w-3 h-3" />
                        从资料库选择
                      </button>
                    </div>
                    <textarea
                      value={jd}
                      onChange={(e) => setJd(e.target.value)}
                      placeholder="请在此粘贴目标职位的职责描述 (JD)..."
                      className="w-full bg-white border border-slate-200 rounded p-5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none shadow-sm font-sans text-sm leading-relaxed h-72"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        原始简历 <span className="text-rose-500">*</span>
                      </label>
                      <button
                        onClick={() => { setShowResumeModal(true); setResumeSearch(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-pink-50 hover:text-pink-600 border border-slate-200 hover:border-pink-200 transition-all"
                      >
                        <UserCircle className="w-3 h-3" />
                        从资料库选择
                      </button>
                    </div>
                    <textarea
                      value={resume}
                      onChange={(e) => setResume(e.target.value)}
                      placeholder="请在此粘贴您的原始简历 (最高优先级事实来源)..."
                      className="w-full bg-white border border-slate-200 rounded p-5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none shadow-sm font-sans text-sm leading-relaxed h-72"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-pink-50/50 p-6 rounded-xl border border-pink-100">
                  <div className="flex-1 space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                      <Sparkles className="w-4 h-4 text-pink-400" />
                      补充资料 (可选)
                    </label>
                    <textarea
                      value={extraDocs}
                      onChange={(e) => setExtraDocs(e.target.value)}
                      placeholder="项目文档、个人网站、或其他支持性经验说明..."
                      className="w-full bg-white border border-slate-200 rounded p-5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none shadow-sm font-sans text-sm leading-relaxed h-32"
                    />
                  </div>
                  <button
                    onClick={loadSampleData}
                    className="ml-6 px-4 py-2 border border-pink-300 text-pink-600 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-colors h-fit"
                  >
                    加载示例数据
                  </button>
                </div>

                {error && (
                  <div className="p-4 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2 border border-rose-100 uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleStartAnalysis}
                    disabled={isLoading}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded font-bold uppercase tracking-widest text-xs flex items-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-pink-100"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      '执行岗位适配分析'
                    )}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'analysis' && analysis && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-8 rounded-xl border border-pink-100 shadow-sm">
                  <div>
                    <button
                      onClick={() => setStep('input')}
                      className="text-slate-400 hover:text-pink-600 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-4 transition-colors"
                    >
                      <ChevronLeft className="w-3 h-3" /> 返回工作区
                    </button>
                    <h2 className="text-xs font-bold text-pink-600 uppercase tracking-[0.2em] mb-2">
                      Step 01
                    </h2>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                      战略适配判断
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { loadAnalysisHistory(); setShowHistoryModal(true); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-pink-600 transition-all text-[10px] font-bold uppercase tracking-widest"
                    >
                      <History className="w-4 h-4" /> 历史记录
                    </button>
                    <button
                      onClick={saveCurrentAnalysis}
                      disabled={!analysis}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 text-white hover:bg-pink-700 transition-all text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" /> 保存分析
                    </button>
                    <div className="flex items-center gap-4 bg-pink-50/30 px-6 py-4 rounded-lg border border-pink-50">
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                          适配等级
                        </div>
                        <div
                          className={cn(
                            'text-4xl font-black tabular-nums tracking-tighter leading-none',
                            analysis.fitRating === 'A'
                              ? 'text-emerald-500'
                              : analysis.fitRating === 'B'
                                ? 'text-amber-500'
                                : 'text-rose-500'
                          )}
                        >
                          {analysis.fitRating}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded border border-slate-200">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                      市场定位
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">
                          岗位类型
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {analysis.roleType}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">
                          资历级别
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {analysis.seniorityLevel}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded border border-slate-200 h-full">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                      战略性建议
                    </div>
                    <div
                      className={cn(
                        'text-sm font-medium leading-relaxed p-3 rounded',
                        analysis.fitRating === 'C'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      )}
                    >
                      {analysis.recommendation}
                    </div>
                  </div>
                </div>

                <AnalysisCard
                  title="核心决策依据"
                  items={analysis.keyReasons}
                  type={analysis.fitRating === 'C' ? 'warning' : 'success'}
                  icon={
                    analysis.fitRating === 'C' ? (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )
                  }
                />

                {analysis.fitRating === 'C' ? (
                  <div className="bg-rose-900 text-white p-8 rounded-xl shadow-xl flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 bg-rose-800 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight mb-2">
                        准入决策: 终止申请
                      </h3>
                      <p className="text-rose-200 text-sm max-w-lg leading-relaxed">
                        基于简历与 JD 的严谨对比，该岗位适配度极低。为保证资料真实性与职业信誉，Copilot
                        不建议继续进行简历改写。
                      </p>
                    </div>
                    <button
                      onClick={() => setStep('input')}
                      className="mt-4 bg-white text-rose-900 px-8 py-3 rounded font-bold uppercase tracking-widest text-xs hover:bg-rose-50 transition-all"
                    >
                      重置并尝试其他职位
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end pt-6">
                    <button
                      onClick={handleTailorResume}
                      disabled={isLoading}
                      className="bg-pink-600 hover:bg-pink-700 text-white px-10 py-4 rounded font-bold uppercase tracking-widest text-xs flex items-center gap-3 transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        '进入 Step 02: 简历美化'
                      )}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'tailor' && (
              <motion.div
                key="tailor"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-pink-100">
                  <div>
                    <button
                      onClick={() => setStep('analysis')}
                      className="text-slate-400 hover:text-pink-600 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors"
                    >
                      <ChevronLeft className="w-3 h-3" /> 返回适配评估
                    </button>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xs font-bold text-pink-600 uppercase tracking-widest px-2 py-1 bg-pink-50 rounded">
                        Step 02
                      </h2>
                      <h3 className="text-xl font-black text-slate-900 uppercase">
                        优化简历输出
                      </h3>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingResume(!isEditingResume)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded border transition-colors text-[10px] font-bold uppercase tracking-widest",
                        isEditingResume
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                          : "border-pink-200 hover:bg-pink-50 text-pink-600"
                      )}
                    >
                      {isEditingResume ? (
                        <>
                          <Check className="w-4 h-4" /> 确认修改
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-4 h-4" /> 编辑内容
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(optimizedResume)}
                      className="flex items-center gap-2 px-4 py-2 rounded border border-pink-200 hover:bg-pink-50 transition-colors text-[10px] font-bold uppercase tracking-widest text-pink-600"
                    >
                      <Copy className="w-4 h-4" /> 复制简历文本
                    </button>
                  </div>
                </div>

                <div className="bg-pink-50/30 p-1 rounded-2xl border border-pink-100">
                  <div className="bg-white rounded-xl shadow-inner p-10 max-h-[700px] overflow-y-auto custom-scrollbar border border-pink-100 mx-auto max-w-4xl min-h-[600px] font-serif">
                    {isEditingResume ? (
                      <textarea
                        value={optimizedResume}
                        onChange={(e) => setOptimizedResume(e.target.value)}
                        className="w-full h-[600px] bg-transparent border-none focus:outline-none focus:ring-0 resize-none font-serif text-[14px] leading-relaxed text-slate-800"
                        placeholder="编辑简历内容..."
                        autoFocus
                      />
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown>
                          {optimizedResume || '正在执行职业化语言对齐...'}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleGenerateCL}
                    disabled={isLoading}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded font-bold uppercase tracking-widest text-xs flex items-center gap-3 transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      '生成配套求职信'
                    )}
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'cl' && (
              <motion.div
                key="cl"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between bg-white p-6 rounded-xl border border-pink-100">
                  <div>
                    <button
                      onClick={() => setStep('tailor')}
                      className="text-slate-400 hover:text-pink-600 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors"
                    >
                      <ChevronLeft className="w-3 h-3" /> 返回简历结果
                    </button>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xs font-bold text-pink-600 uppercase tracking-widest px-2 py-1 bg-pink-50 rounded">
                        Step 03
                      </h2>
                      <h3 className="text-xl font-black text-slate-900 uppercase font-sans">
                        正式求职信 (Cover Letter)
                      </h3>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingCL(!isEditingCL)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded border transition-colors text-[10px] font-bold uppercase tracking-widest",
                        isEditingCL
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                          : "border-pink-200 hover:bg-pink-50 text-pink-600"
                      )}
                    >
                      {isEditingCL ? (
                        <>
                          <Check className="w-4 h-4" /> 确认修改
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-4 h-4" /> 编辑内容
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(coverLetter)}
                      className="flex items-center gap-2 px-4 py-2 rounded border border-pink-200 hover:bg-pink-50 transition-colors text-[10px] font-bold uppercase tracking-widest text-pink-600"
                    >
                      <Copy className="w-4 h-4" /> 复制正文
                    </button>
                  </div>
                </div>

                <div className="bg-pink-50/50 p-8 rounded-2xl border border-pink-200">
                  <div className="bg-white rounded shadow-sm p-12 max-h-[700px] overflow-y-auto custom-scrollbar leading-relaxed text-slate-800 font-serif text-[13px] border border-pink-100 mx-auto max-w-3xl min-h-[600px]">
                    {isEditingCL ? (
                      <textarea
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        className="w-full h-[550px] bg-transparent border-none focus:outline-none focus:ring-0 resize-none font-serif text-[13px] leading-relaxed text-slate-800"
                        placeholder="编辑求职信内容..."
                        autoFocus
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {coverLetter || '正在构建基于事实的叙述...'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-center pt-8 gap-4">
                  <button
                    onClick={openSaveModal}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                  >
                    <Save className="w-3 h-3" /> 保存到投递追踪
                  </button>
                  <button
                    onClick={() => {
                      setStep('input');
                      setJd('');
                      setResume('');
                      setExtraDocs('');
                      setAnalysis(null);
                      setOptimizedResume('');
                      setCoverLetter('');
                      clearDraft();
                    }}
                    className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-6 py-3 rounded text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border border-pink-200"
                  >
                    <BriefcaseBusiness className="w-3 h-3" /> 开启下一职位分析
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
        {view === 'interview' && currentUser && (
          <InterviewPrep userPhone={currentUser.phone} />
        )}
        {view === 'tracker' && currentUser && (
          <JobTracker userPhone={currentUser.phone} />
        )}
        {view === 'materials' && currentUser && (
          <MaterialsPage userPhone={currentUser.phone} />
        )}
      </main>

      <footer className="h-10 bg-pink-50 border-t border-pink-200 px-8 flex items-center justify-between text-[10px] text-pink-500 font-bold uppercase tracking-widest">
        <div className="flex gap-6">
          <span>模式: 战略招聘咨询</span>
          <span className="hidden sm:inline">框架: 你一定能成功</span>
          <span>核心: 零虚构/真实事实</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-100 font-mono">
            P0: 简历事实第一
          </span>
        </div>
      </footer>

      {/* Save to Tracker Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) =>
              e.target === e.currentTarget && setShowSaveModal(false)
            }
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  保存到投递追踪
                </h3>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">
                      公司名 *
                    </label>
                    <input
                      type="text"
                      value={saveForm.company}
                      onChange={(e) =>
                        setSaveForm({ ...saveForm, company: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">
                      职位名 *
                    </label>
                    <input
                      type="text"
                      value={saveForm.position}
                      onChange={(e) =>
                        setSaveForm({ ...saveForm, position: e.target.value })
                      }
                      className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">
                    JD 内容
                  </label>
                  <textarea
                    value={saveForm.jd}
                    onChange={(e) =>
                      setSaveForm({ ...saveForm, jd: e.target.value })
                    }
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none h-20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">
                    简历快照
                  </label>
                  <textarea
                    value={saveForm.tailoredResume}
                    onChange={(e) =>
                      setSaveForm({
                        ...saveForm,
                        tailoredResume: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none h-20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">
                    求职信
                  </label>
                  <textarea
                    value={saveForm.coverLetter}
                    onChange={(e) =>
                      setSaveForm({
                        ...saveForm,
                        coverLetter: e.target.value,
                      })
                    }
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none h-20"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveToTracker}
                    className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] transition-all"
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JD Selector Modal */}
      <AnimatePresence>
        {showJDModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowJDModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-pink-500" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    从 JD 库选择
                  </h3>
                </div>
                <button
                  onClick={() => setShowJDModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-slate-100 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={jdSearch}
                    onChange={(e) => setJdSearch(e.target.value)}
                    placeholder="搜索公司或职位..."
                    className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {(() => {
                  const list = getJDList();
                  const filtered = list.filter(j =>
                    !jdSearch ||
                    j.company.toLowerCase().includes(jdSearch.toLowerCase()) ||
                    j.position.toLowerCase().includes(jdSearch.toLowerCase())
                  );
                  if (list.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400">
                        <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">JD 库为空</p>
                        <p className="text-[10px] mt-1">请先到「我的资料」页面添加 JD</p>
                      </div>
                    );
                  }
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400">
                        <p className="text-sm font-medium">没有匹配的 JD</p>
                      </div>
                    );
                  }
                  return filtered.map(jd => (
                    <button
                      key={jd.id}
                      onClick={() => { setJd(jd.content); setShowJDModal(false); }}
                      className="w-full text-left p-4 rounded-lg hover:bg-pink-50 transition-colors border border-transparent hover:border-pink-100 mb-1 group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-800">{jd.company}</span>
                        {jd.position && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{jd.position}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{jd.content.slice(0, 120)}...</p>
                    </button>
                  ));
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resume Selector Modal */}
      <AnimatePresence>
        {showResumeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowResumeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5 text-pink-500" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    从简历库选择
                  </h3>
                </div>
                <button
                  onClick={() => setShowResumeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-slate-100 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={resumeSearch}
                    onChange={(e) => setResumeSearch(e.target.value)}
                    placeholder="搜索简历名称..."
                    className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {(() => {
                  const list = getResumeList();
                  const filtered = list.filter(r =>
                    !resumeSearch || r.name.toLowerCase().includes(resumeSearch.toLowerCase())
                  );
                  if (list.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400">
                        <UserCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">简历库为空</p>
                        <p className="text-[10px] mt-1">请先到「我的资料」页面添加简历</p>
                      </div>
                    );
                  }
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400">
                        <p className="text-sm font-medium">没有匹配的简历</p>
                      </div>
                    );
                  }
                  return filtered.map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setResume(r.content); setShowResumeModal(false); }}
                      className="w-full text-left p-4 rounded-lg hover:bg-pink-50 transition-colors border border-transparent hover:border-pink-100 mb-1 group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-slate-800">{r.name}</span>
                        <span className="text-[10px] text-slate-400">{new Date(r.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{r.content.slice(0, 120)}...</p>
                    </button>
                  ));
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-pink-500" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">分析历史记录</h3>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                {historyLoading ? (
                  <div className="text-center py-12 text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                    <p className="text-sm font-medium">加载中...</p>
                  </div>
                ) : analysisHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm font-medium">暂无分析历史</p>
                    <p className="text-[10px] mt-1">完成分析后点击"保存分析"即可记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analysisHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadHistoryItem(item.id)}
                        className="w-full text-left bg-white rounded-lg border border-slate-200 p-4 hover:border-pink-300 hover:shadow-sm hover:bg-pink-50/30 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold border",
                                item.fitRating === 'A'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : item.fitRating === 'B'
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-rose-100 text-rose-700 border-rose-200'
                              )}>
                                {item.fitRating}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">{item.score}分</span>
                              <span className="text-[10px] text-slate-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                点击加载完整分析
                              </span>
                            </div>
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {item.company || '未识别公司'} · {item.position || '未识别职位'}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                              {item.recommendation || '无摘要'}
                            </p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeHistoryItem(item.id); }}
                            className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Config Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowApiKeyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  API 设置
                </h3>
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block">
                    API Base URL
                  </label>
                  <input
                    type="text"
                    value={apiConfig.baseUrl}
                    onChange={(e) => setApiConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400">
                    支持：DashScope、OpenAI、Moonshot、DeepSeek 等任何 OpenAI 兼容接口
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiConfig.apiKey}
                    onChange={(e) => setApiConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="sk-xxxxxxxxxxxxxxxx"
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block">
                    模型名称
                  </label>
                  <input
                    type="text"
                    value={apiConfig.model}
                    onChange={(e) => setApiConfig((prev) => ({ ...prev, model: e.target.value }))}
                    placeholder="qwen-plus"
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400">
                    例：qwen-plus、gpt-4o-mini、moonshot-v1-8k、deepseek-chat
                  </p>
                </div>
                <div className="bg-slate-50 rounded p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    所有配置仅保存在本地浏览器，不会上传服务器。如果某个厂商访问不通，可切换其他厂商。
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      // Reset to defaults
                      setApiConfig(getApiConfig());
                      setShowApiKeyModal(false);
                    }}
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      saveApiConfig(apiConfig);
                      setShowApiKeyModal(false);
                    }}
                    className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] transition-all"
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowChangePasswordModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Lock className="w-4 h-4 text-pink-500" /> 修改密码
                </h3>
                <button
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setChangePasswordError(null);
                    setChangePasswordSuccess(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {changePasswordError && (
                  <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2 border border-rose-100">
                    <AlertCircle className="w-4 h-4" /> {changePasswordError}
                  </div>
                )}
                {changePasswordSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2 border border-emerald-100">
                    <Check className="w-4 h-4" /> {changePasswordSuccess}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block">
                    新密码
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="请输入新密码"
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleChangePasswordSubmit()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] block">
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleChangePasswordSubmit()}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowChangePasswordModal(false);
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setChangePasswordError(null);
                      setChangePasswordSuccess(null);
                    }}
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                    disabled={isChangingPassword}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleChangePasswordSubmit}
                    className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 disabled:opacity-50"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      '确认修改'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Loading Overlay */}
      {isLoading && step === 'input' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center text-white">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-pink-400 animate-pulse" />
            </div>
          </div>
          <div className="mt-8 text-center">
            <div className="text-sm font-black uppercase tracking-[0.3em] mb-2">
              正在执行战略适配分析
            </div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              正在扫描简历事实并与岗位需求进行高精度对齐...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({
  title,
  items,
  type,
  icon,
}: {
  title: string;
  items: string[];
  type: 'success' | 'warning' | 'info';
  icon: React.ReactNode;
}) {
  const styles = {
    success: 'bg-emerald-50/30 border-emerald-100',
    warning: 'bg-amber-50/30 border-amber-100',
    info: 'bg-pink-50/30 border-pink-100',
  };

  const textStyles = {
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    info: 'text-pink-700',
  };

  const labelStyles = {
    success: 'text-emerald-500 bg-emerald-50',
    warning: 'text-amber-500 bg-amber-50',
    info: 'text-pink-500 bg-pink-50',
  };

  return (
    <div className={cn('p-6 rounded border flex flex-col h-full', styles[type])}>
      <div className="flex items-center justify-between mb-6">
        <div
          className={cn(
            'px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest',
            labelStyles[type]
          )}
        >
          {type === 'info' ? '建议' : type === 'success' ? '通过' : '注意'}
        </div>
        {icon}
      </div>
      <h3 className="font-black text-slate-900 uppercase tracking-tight mb-4 text-sm">
        {title}
      </h3>
      <ul className="space-y-4 flex-1">
        {items.map((item, i) => (
          <li
            key={i}
            className={cn(
              'text-[13px] leading-relaxed flex gap-3',
              textStyles[type]
            )}
          >
            <span
              className={cn(
                'mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0',
                type === 'success'
                  ? 'bg-emerald-300'
                  : type === 'warning'
                    ? 'bg-amber-300'
                    : 'bg-pink-300'
              )}
            />
            <span className="opacity-90">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
