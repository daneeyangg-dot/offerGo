# OfferGo

> 基于真实简历、拒绝编造的 AI 求职 Copilot。
> 不帮你写假经历，只帮你把真本事说清楚。

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)

## 这是什么

市面上大部分 AI 简历工具都在教你"怎么编一段经历去匹配 JD"。OfferGo 反着来——它把你的真实简历作为**最高事实来源**，先严肃判断你和岗位的匹配度（A/B/C 三级），匹配度太低会直接劝退你别投，**不会**帮你硬凑。匹配上了，它再帮你把已经存在的事实重新组织、对齐 JD 的语言。

> **核心信条：P0 简历事实第一 · 零虚构 · 真实事实**

适合：不想撒谎、但又想让简历看起来更专业的人。

## 核心功能

- 🎯 **岗位适配判断** — 基于事实给出 A/B/C 评级 + 关键决策依据。C 级直接终止流程，不浪费你的时间
- 📝 **简历对齐重写** — 用 JD 的语言重写你已有的事实，**不会**虚构新经历或业绩
- ✉️ **Cover Letter 生成** — 配套生成基于真实事实的求职信
- 💬 **面试准备** — 技术面 / 行为面（STAR 框架）题库 + 模拟面试对话
- 📊 **投递追踪** — 公司 / 职位 / 状态（感兴趣 → 已投递 → 面试中 → Offer / 拒信）一站式管理
- 📚 **资料库** — JD 和简历多版本管理，下次直接复用
- 💾 **本地优先** — 所有数据存浏览器 localStorage，不上传服务器

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | React 19 + TypeScript 5.8 |
| 构建工具 | Vite 6 |
| 样式 | Tailwind CSS v4 |
| 动效 | Framer Motion |
| 大模型 | 阿里云百炼 DashScope · `qwen-plus` |
| 后端 | Express（本地开发）/ Vercel Serverless Functions（生产）|
| 存储 | localStorage（无后端账户系统）|

## 快速开始

**前置要求**：Node.js 18+，[DashScope API Key](https://dashscope.aliyun.com)

```bash
# 1. 克隆并安装依赖
git clone <your-repo-url>
cd offergo
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，把 DASHSCOPE_API_KEY 改成你自己的 Key

# 3. 启动开发服务器
npm run dev
# 默认运行在 http://localhost:5001
```

启动后用任意手机号 + 密码注册登录（数据存浏览器本地），或者在右上角「⚙️ API 设置」里临时配 Key 试用。

## 部署到 Vercel

项目已经配好了 `vercel.json`，直接连仓库一键部署即可：

1. 把仓库推送到 GitHub
2. 在 Vercel 导入项目
3. 在 Vercel 项目设置 → Environment Variables 里添加 `DASHSCOPE_API_KEY`
4. Deploy

## 项目结构

```
offergo/
├── api/                # Vercel Serverless Functions
├── server/             # Express 本地开发服务器
├── src/
│   ├── components/     # 页面组件（面试准备 / 投递追踪 / 登录 / 资料库）
│   ├── lib/            # 核心逻辑（AI 调用 / 鉴权 / 存储 / 工具函数）
│   ├── types/          # TypeScript 类型定义
│   └── App.tsx         # 主入口（岗位适配分析流程）
├── public/             # 静态资源
└── vite.config.ts
```

## 设计哲学

这不是一个"帮你找工作"的魔法工具，是一个**让你自己更好地呈现自己**的副驾驶。

所有产出都可以追溯到你的真实简历，**没有任何凭空生成的"项目经历"或"业绩数字"**。如果你的简历和岗位差距过大，OfferGo 会诚实地告诉你"别投了"，而不是帮你包装出一个假人格。

> 战略招聘咨询模式 · 框架：你一定能成功 · 核心：零虚构 / 真实事实

## License

[Apache-2.0](LICENSE)
