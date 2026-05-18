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
} from 'lucide-react';
import { analyzeJobFit, tailorResumeStream, generateCoverLetterStream, type AnalysisResult } from './lib/gemini';
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
  getUserStorageKey,
} from './lib/auth';
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

  // API Key config
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('iwaj_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // First-time onboarding: prompt for API key when a logged-in user has none.
  useEffect(() => {
    if (currentUser && !localStorage.getItem('iwaj_api_key')) {
      setShowApiKeyModal(true);
    }
  }, [currentUser]);

  // Edit mode for Step 02 / 03
  const [isEditingResume, setIsEditingResume] = useState(false);
  const [isEditingCL, setIsEditingCL] = useState(false);

  // Load data from material library
  const getJDList = (): JDItem[] => {
    if (!currentUser) return [];
    const jdKey = getUserStorageKey(currentUser.phone, 'jds');
    const saved = localStorage.getItem(jdKey);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  };

  const getResumeList = (): ResumeItem[] => {
    if (!currentUser) return [];
    const resumeKey = getUserStorageKey(currentUser.phone, 'resumes');
    const saved = localStorage.getItem(resumeKey);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  };

  // Draft persistence
  const getDraftKey = () => currentUser ? getUserStorageKey(currentUser.phone, 'analyzer-draft') : '';

  const clearDraft = () => {
    if (!currentUser) return;
    localStorage.removeItem(getDraftKey());
  };

  // Results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [optimizedResume, setOptimizedResume] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  // Load draft when user logs in
  useEffect(() => {
    if (!currentUser) return;
    const key = getDraftKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.jd !== undefined) setJd(draft.jd);
        if (draft.resume !== undefined) setResume(draft.resume);
        if (draft.extraDocs !== undefined) setExtraDocs(draft.extraDocs);
        if (draft.step) setStep(draft.step);
        if (draft.analysis) setAnalysis(draft.analysis);
        if (draft.optimizedResume !== undefined) setOptimizedResume(draft.optimizedResume);
        if (draft.coverLetter !== undefined) setCoverLetter(draft.coverLetter);
      } catch {
        // ignore corrupt draft
      }
    }
  }, [currentUser]);

  // Auto-save draft when inputs or results change
  useEffect(() => {
    if (!currentUser) return;
    const key = getDraftKey();
    const draft = { jd, resume, extraDocs, step, analysis, optimizedResume, coverLetter, updatedAt: Date.now() };
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify(draft));
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
      setError('分析失败，请稍后重试');
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
      setError('简历优化失败');
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
      setError('Cover Letter 生成失败');
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

  const handleSaveToTracker = () => {
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
    saveApplication(currentUser.phone, app);
    setShowSaveModal(false);
    alert('已保存到投递追踪');
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
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5 block">
                    DashScope API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-xxxxxxxxxxxxxxxx"
                    className="w-full bg-white border border-slate-200 rounded p-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">
                    使用 AI 功能前请先配置你的 DashScope Key — 从 <a href="https://dashscope.aliyun.com" target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline">DashScope 控制台</a> 获取（新用户有免费额度）。Key 仅存储在本地浏览器中，不会上传服务器。
                  </p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowApiKeyModal(false)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      if (apiKey.trim()) {
                        localStorage.setItem('iwaj_api_key', apiKey.trim());
                      } else {
                        localStorage.removeItem('iwaj_api_key');
                      }
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
