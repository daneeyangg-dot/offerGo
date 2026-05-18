// 用户
export interface User {
  phone: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
}

// 技术面试题
export interface TechnicalQuestion {
  category: string;
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  answerPoints: string[];
}

// 行为面试题（STAR 格式）
export interface BehavioralQuestion {
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

// 模拟面试消息
export interface InterviewMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 投递记录
export interface JobApplication {
  id: string;
  company: string;
  position: string;
  jd: string;
  tailoredResume: string;
  coverLetter: string;
  status: 'interested' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';
  priority: 'high' | 'medium' | 'low';
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// JD 条目
export interface JDEntry {
  id: string;
  company: string;
  position: string;
  content: string;
  createdAt: number;
}

// 简历条目
export interface ResumeEntry {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
}

// 视图类型
export type View = 'analyzer' | 'interview' | 'tracker' | 'materials';

// 面试 Tab 类型
export type InterviewTab = 'technical' | 'behavioral' | 'simulation';
