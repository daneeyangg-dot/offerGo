import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, MessageSquare, Target, Loader2, Send, ChevronDown,
  ChevronUp, BookOpen, BrainCircuit, User, Bot, Sparkles, FileSearch, FileText, AlertCircle,
  Search, Building2, UserCircle, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  generateTechnicalQuestions,
  generateBehavioralQuestions,
  simulateInterviewStream,
  type TechnicalQuestion,
  type BehavioralQuestion,
  type SimMessage,
} from '../lib/gemini';
import { getUserStorageKey } from '../lib/auth';
import type { InterviewTab } from '../types';

interface InterviewPrepProps {
  userPhone: string;
}

const TAB_CONFIG: { key: InterviewTab; label: string; icon: React.ReactNode }[] = [
  { key: 'technical', label: '技术面试', icon: <Code2 className="w-4 h-4" /> },
  { key: 'behavioral', label: '行为面试', icon: <Target className="w-4 h-4" /> },
  { key: 'simulation', label: '模拟面试', icon: <MessageSquare className="w-4 h-4" /> },
];

const DIFFICULTY_MAP: Record<string, { label: string; color: string }> = {
  easy: { label: '简单', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  medium: { label: '中等', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  hard: { label: '困难', color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export default function InterviewPrep({ userPhone }: InterviewPrepProps) {
  const [activeTab, setActiveTab] = useState<InterviewTab>('technical');
  const [jd, setJd] = useState('');
  const [resume, setResume] = useState('');

  // Material library data
  const [jdList, setJDList] = useState<{ id: string; company: string; position: string; content: string }[]>([]);
  const [resumeList, setResumeList] = useState<{ id: string; name: string; content: string }[]>([]);

  // Technical
  const [techQuestions, setTechQuestions] = useState<TechnicalQuestion[]>([]);
  const [techLoading, setTechLoading] = useState(false);
  const [expandedTech, setExpandedTech] = useState<Set<number>>(new Set());

  // Behavioral
  const [behavioralQuestions, setBehavioralQuestions] = useState<BehavioralQuestion[]>([]);
  const [behavioralLoading, setBehavioralLoading] = useState(false);
  const [expandedBehavioral, setExpandedBehavioral] = useState<Set<number>>(new Set());

  // Simulation
  const [simMessages, setSimMessages] = useState<SimMessage[]>([]);
  const [simInput, setSimInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simStarted, setSimStarted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showJDModal, setShowJDModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [jdSearch, setJdSearch] = useState('');
  const [resumeSearch, setResumeSearch] = useState('');

  // Draft persistence
  const draftKey = getUserStorageKey(userPhone, 'interview-draft');

  useEffect(() => {
    // Load draft
    const draftRaw = localStorage.getItem(draftKey);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        if (draft.jd !== undefined) setJd(draft.jd);
        if (draft.resume !== undefined) setResume(draft.resume);
        if (Array.isArray(draft.techQuestions)) setTechQuestions(draft.techQuestions);
        if (Array.isArray(draft.behavioralQuestions)) setBehavioralQuestions(draft.behavioralQuestions);
        if (Array.isArray(draft.simMessages)) setSimMessages(draft.simMessages);
        if (typeof draft.simStarted === 'boolean') setSimStarted(draft.simStarted);
        if (typeof draft.activeTab === 'string') setActiveTab(draft.activeTab as InterviewTab);
      } catch {
        // ignore corrupt draft
      }
    }

    // Load material library
    const jdKey = getUserStorageKey(userPhone, 'jds');
    const resumeKey = getUserStorageKey(userPhone, 'resumes');
    const jdRaw = localStorage.getItem(jdKey);
    const resumeRaw = localStorage.getItem(resumeKey);
    if (jdRaw) {
      try { setJDList(JSON.parse(jdRaw)); } catch { setJDList([]); }
    }
    if (resumeRaw) {
      try { setResumeList(JSON.parse(resumeRaw)); } catch { setResumeList([]); }
    }
  }, [userPhone]);

  // Auto-save draft (including all interview state)
  useEffect(() => {
    const draft = {
      jd,
      resume,
      techQuestions,
      behavioralQuestions,
      simMessages,
      simStarted,
      activeTab,
      updatedAt: Date.now(),
    };
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }, 500);
    return () => clearTimeout(timer);
  }, [jd, resume, techQuestions, behavioralQuestions, simMessages, simStarted, activeTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages, simLoading]);

  const handleGenerateTechnical = async () => {
    if (!jd.trim() || !resume.trim()) {
      setError('请输入 JD 和 Resume');
      return;
    }
    setError(null);
    setTechLoading(true);
    try {
      const questions = await generateTechnicalQuestions(jd, resume);
      setTechQuestions(questions);
      setExpandedTech(new Set());
    } catch (e) {
      setError('技术面试题生成失败');
      console.error(e);
    } finally {
      setTechLoading(false);
    }
  };

  const handleGenerateBehavioral = async () => {
    if (!resume.trim()) {
      setError('请输入 Resume');
      return;
    }
    setError(null);
    setBehavioralLoading(true);
    try {
      const questions = await generateBehavioralQuestions(resume);
      setBehavioralQuestions(questions);
      setExpandedBehavioral(new Set());
    } catch (e) {
      setError('行为面试题生成失败');
      console.error(e);
    } finally {
      setBehavioralLoading(false);
    }
  };

  const handleStartSimulation = async () => {
    if (!jd.trim() || !resume.trim()) {
      setError('请输入 JD 和 Resume');
      return;
    }
    setError(null);
    setSimStarted(true);
    setSimLoading(true);
    setSimMessages([]);

    try {
      let content = '';
      const stream = simulateInterviewStream(jd, resume, []);
      for await (const chunk of stream) {
        content += chunk;
        setSimMessages([{ role: 'assistant', content }]);
      }
    } catch (e) {
      setError('模拟面试启动失败');
      console.error(e);
      setSimStarted(false);
    } finally {
      setSimLoading(false);
    }
  };

  const handleSendSimMessage = async () => {
    if (!simInput.trim() || simLoading) return;

    const userMsg = simInput.trim();
    const newHistory: SimMessage[] = [
      ...simMessages,
      { role: 'user', content: userMsg },
    ];
    setSimMessages(newHistory);
    setSimInput('');
    setSimLoading(true);

    try {
      let content = '';
      const stream = simulateInterviewStream(jd, resume, newHistory);
      for await (const chunk of stream) {
        content += chunk;
        setSimMessages([...newHistory, { role: 'assistant', content }]);
      }
    } catch (e) {
      setError('AI 回复失败');
      console.error(e);
    } finally {
      setSimLoading(false);
    }
  };

  const toggleExpand = (index: number, type: 'tech' | 'behavioral') => {
    const set = type === 'tech' ? new Set(expandedTech) : new Set(expandedBehavioral);
    if (set.has(index)) set.delete(index);
    else set.add(index);
    type === 'tech' ? setExpandedTech(set) : setExpandedBehavioral(set);
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white p-6 rounded-xl border border-pink-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FileSearch className="w-4 h-4 text-pink-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">面试准备素材</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <FileSearch className="w-3 h-3" /> 职位描述 (JD)
              </label>
              <button
                onClick={() => { setShowJDModal(true); setJdSearch(''); }}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-pink-50 hover:text-pink-600 border border-slate-200 hover:border-pink-200 transition-all"
              >
                <Building2 className="w-3 h-3" />
                从资料库选择
              </button>
            </div>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="粘贴目标职位 JD..."
              className="w-full bg-white border border-slate-200 rounded p-4 text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none shadow-sm font-sans text-sm leading-relaxed h-40"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <FileText className="w-3 h-3" /> 简历 (Resume)
              </label>
              <button
                onClick={() => { setShowResumeModal(true); setResumeSearch(''); }}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-pink-50 hover:text-pink-600 border border-slate-200 hover:border-pink-200 transition-all"
              >
                <UserCircle className="w-3 h-3" />
                从资料库选择
              </button>
            </div>
            <textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="粘贴你的简历..."
              className="w-full bg-white border border-slate-200 rounded p-4 text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all resize-none shadow-sm font-sans text-sm leading-relaxed h-40"
            />
          </div>
        </div>
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2 border border-rose-100">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
        {TAB_CONFIG.map((tab) => (
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
        {/* Technical Tab */}
        {activeTab === 'technical' && (
          <motion.div
            key="technical"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-pink-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">技术面试题库</h3>
              </div>
              <button
                onClick={handleGenerateTechnical}
                disabled={techLoading}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {techLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                生成技术题
              </button>
            </div>

            {techQuestions.length === 0 && !techLoading && (
              <div className="text-center py-16 text-slate-400">
                <Code2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm font-medium">输入 JD 和 Resume 后点击生成</p>
                <p className="text-[10px] mt-1">AI 将根据岗位要求和你的经历生成针对性技术面试题</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {techQuestions.map((q, i) => {
                const diff = DIFFICULTY_MAP[q.difficulty?.toLowerCase()] || DIFFICULTY_MAP.easy;
                const isExpanded = expandedTech.has(i);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", diff.color)}>
                              {diff.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {q.category}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 leading-relaxed">{q.question}</p>
                        </div>
                        <button
                          onClick={() => toggleExpand(i, 'tech')}
                          className="p-1.5 text-slate-400 hover:text-pink-500 transition-colors shrink-0"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <BookOpen className="w-3 h-3" /> 答题要点
                            </div>
                            <ul className="space-y-2">
                              {q.answerPoints.map((point, j) => (
                                <li key={j} className="text-[13px] text-slate-600 leading-relaxed flex gap-3">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-pink-300 flex-shrink-0" />
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Behavioral Tab */}
        {activeTab === 'behavioral' && (
          <motion.div
            key="behavioral"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-pink-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">行为面试题库 (STAR)</h3>
              </div>
              <button
                onClick={handleGenerateBehavioral}
                disabled={behavioralLoading}
                className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {behavioralLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                生成行为题
              </button>
            </div>

            {behavioralQuestions.length === 0 && !behavioralLoading && (
              <div className="text-center py-16 text-slate-400">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm font-medium">输入 Resume 后点击生成</p>
                <p className="text-[10px] mt-1">AI 将基于你的经历生成 STAR 格式行为面试题</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {behavioralQuestions.map((q, i) => {
                const isExpanded = expandedBehavioral.has(i);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-1 block">
                            问题 {i + 1}
                          </span>
                          <p className="text-sm font-medium text-slate-800 leading-relaxed">{q.question}</p>
                        </div>
                        <button
                          onClick={() => toggleExpand(i, 'behavioral')}
                          className="p-1.5 text-slate-400 hover:text-pink-500 transition-colors shrink-0"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {[
                                { key: 'situation', label: 'Situation 情境', value: q.situation },
                                { key: 'task', label: 'Task 任务', value: q.task },
                                { key: 'action', label: 'Action 行动', value: q.action },
                                { key: 'result', label: 'Result 结果', value: q.result },
                              ].map((item) => (
                                <div key={item.key} className="bg-slate-50 rounded p-3 border border-slate-100">
                                  <div className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-1.5">
                                    {item.label}
                                  </div>
                                  <p className="text-[12px] text-slate-600 leading-relaxed">{item.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Simulation Tab */}
        {activeTab === 'simulation' && (
          <motion.div
            key="simulation"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-pink-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">模拟面试对话</h3>
              </div>
              {!simStarted && (
                <button
                  onClick={handleStartSimulation}
                  disabled={simLoading}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2.5 rounded font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {simLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  开始面试
                </button>
              )}
            </div>

            {!simStarted ? (
              <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm font-medium">输入 JD 和 Resume 后点击开始面试</p>
                <p className="text-[10px] mt-1">AI 面试官将根据你的背景提出针对性问题</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col" style={{ height: '600px' }}>
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                  {simMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-3",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-pink-600" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[70%] rounded-xl px-4 py-3 text-[13px] leading-relaxed",
                          msg.role === 'user'
                            ? "bg-slate-900 text-white"
                            : "bg-pink-50 text-slate-800 border border-pink-100"
                        )}
                      >
                        {msg.content}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  {simLoading && simMessages[simMessages.length - 1]?.role === 'user' && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-pink-600 animate-pulse" />
                      </div>
                      <div className="bg-pink-50 border border-pink-100 rounded-xl px-4 py-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-slate-200 p-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={simInput}
                      onChange={(e) => setSimInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendSimMessage()}
                      placeholder="输入你的回答..."
                      disabled={simLoading}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendSimMessage}
                      disabled={!simInput.trim() || simLoading}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-lg font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">从 JD 库选择</h3>
                </div>
                <button onClick={() => setShowJDModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
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
                  const filtered = jdList.filter(j =>
                    !jdSearch ||
                    j.company.toLowerCase().includes(jdSearch.toLowerCase()) ||
                    j.position.toLowerCase().includes(jdSearch.toLowerCase())
                  );
                  if (jdList.length === 0) {
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
                        {jd.position && <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{jd.position}</span>}
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
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">从简历库选择</h3>
                </div>
                <button onClick={() => setShowResumeModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
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
                  const filtered = resumeList.filter(r =>
                    !resumeSearch || r.name.toLowerCase().includes(resumeSearch.toLowerCase())
                  );
                  if (resumeList.length === 0) {
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
    </div>
  );
}
