const MODEL = "qwen-plus";

export interface AnalysisResult {
  roleType: string;
  seniorityLevel: string;
  fitRating: 'A' | 'B' | 'C';
  keyReasons: string[];
  recommendation: string;
  score: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function chatCompletion(
  messages: ChatMessage[],
  stream = false,
  jsonMode = false
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    stream,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('iwaj_api_key') : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const res = await fetch(`/api/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.error || json.details || text;
    } catch {
      // use raw text
    }
    throw new Error(`API 错误 (${res.status}): ${detail}`);
  }

  return res;
}

async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content as string | undefined;
        if (content) yield content;
      } catch {
        // ignore malformed JSON
      }
    }
  }
}

export async function analyzeJobFit(
  jd: string,
  resume: string,
  extraDocs: string = ""
): Promise<AnalysisResult> {

  const systemPrompt = `你是一个专业的招聘咨询专家。请严格按照用户要求分析，并始终输出合法 JSON。`;

  const userPrompt = `
你是一个专业的招聘咨询专家。请分析以下 Job Description (JD) 和 Resume (以及可能的补充资料)。

目标：执行【Step 1：岗位适配判断（Gatekeeper）】。

识别：
1. 岗位类型（数据型/流程运营型/咨询型/产品或变革型）
2. 关键能力点（3–5项）
3. 资历要求（Junior/Early/Mid/Senior/Expert），关注"年限、行业、系统/平台"等硬门槛

判断匹配度（Fit rating）：
A. Strong fit（建议申请）
B. Stretch fit（可以申请但必须调整定位与措辞）
C. Poor fit（不建议申请）

规则：
1. 不得编造、假设、夸大或虚构任何经历。
2. 必须以 Resume 为最高优先级事实来源。
3. 严禁抬高资历或脱离 JD 进行岗位重构。

JD: ${jd}
Resume: ${resume}
补充资料: ${extraDocs}

请输出 JSON 格式，所有分析文字请使用中文：
{
  "roleType": "岗位类型",
  "seniorityLevel": "资历要求",
  "fitRating": "A/B/C",
  "keyReasons": ["理由1", "理由2", "理由3"],
  "recommendation": "最终建议",
  "score": 0-100 的匹配分数
}
`;

  const res = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    false,
    true
  );

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content as string;
  if (!text) {
    throw new Error("Empty response from DashScope");
  }

  try {
    const parsed = JSON.parse(text) as AnalysisResult;
    // validate required fields
    if (
      !parsed.roleType ||
      !parsed.seniorityLevel ||
      !parsed.fitRating ||
      !Array.isArray(parsed.keyReasons) ||
      !parsed.recommendation ||
      typeof parsed.score !== "number"
    ) {
      throw new Error("Invalid response structure");
    }
    return parsed;
  } catch (err) {
    console.error("DashScope Analysis parse error:", err, "Raw text:", text);
    throw new Error("Failed to parse analysis result");
  }
}

export async function* tailorResumeStream(
  jd: string,
  resume: string,
  extraDocs: string = ""
): AsyncGenerator<string> {

  const prompt = `
你是一个专业的简历优化专家。请根据以下 JD 和原始 Resume，输出一份针对该岗位优化后的简历内容。

规则：
1. 不得编造、虚构任何经历、技能、工具、指标或成果。
2. 输出内容不得与 Resume 冲突，严禁添加原本不存在的经历。
3. 输出请保持中文（除非原文是英文且JD要求英文）。
4.最终内容不得输出思考过程

JD: ${jd}
Resume: ${resume}
补充资料: ${extraDocs}

任务：
- 针对 JD 需求，对现有经历的描述词进行微调（前提是事实支持）。
- 优化语气，采用专业、克制、高端咨询风格。
- 突出与岗位最相关的项目。
- 保持 Markdown 格式，条目清晰。
`;

  const res = await chatCompletion(
    [
      { role: "system", content: "你是一个专业的简历优化专家。" },
      { role: "user", content: prompt },
    ],
    true
  );

  if (!res.body) {
    throw new Error("No response body from DashScope");
  }

  const reader = res.body.getReader();
  try {
    for await (const chunk of parseSSEStream(reader)) {
      yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* generateCoverLetterStream(
  jd: string,
  resume: string
): AsyncGenerator<string> {

  const prompt = `
基于以下针对岗位的简历（Tailored Resume）和 JD，撰写一份专业的求职信 (Cover Letter)。

规则：
1. 必须由 Resume 中的真实事实支撑。
2. 绝不使用空泛、过度热情的表达，通过项目和产出说话。
3. 语言风格：专业、克制。
4. 采用标准的求职信格式（中文）。
5.求职信格式：更新为六段式结构——简短的自我介绍 + 四段正文（匹配点、核心经历+成果、适合方向、入职时间+期待沟通），每段空行分隔，不输出思考过程。

JD: ${jd}
Resume: ${resume}
`;

  const res = await chatCompletion(
    [
      { role: "system", content: "你是一个专业的求职信撰写专家。" },
      { role: "user", content: prompt },
    ],
    true
  );

  if (!res.body) {
    throw new Error("No response body from DashScope");
  }

  const reader = res.body.getReader();
  try {
    for await (const chunk of parseSSEStream(reader)) {
      yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}

export interface TechnicalQuestion {
  category: string;
  question: string;
  difficulty: string;
  answerPoints: string[];
}

export interface BehavioralQuestion {
  question: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

export async function generateTechnicalQuestions(
  jd: string,
  resume: string
): Promise<TechnicalQuestion[]> {

  const prompt = `
你是一位资深技术面试官。请基于以下 Job Description 和候选人的 Resume，生成 8-12 道针对性的技术面试题。

要求：
1. 题目必须紧扣 JD 中提到的技术栈和要求。
2. 参考 Resume 中的技能和经验，确保难度匹配候选人资历。
3. 每道题包含：分类(category)、难度(difficulty: easy/medium/hard)、题目(question)、答题要点(answerPoints, 3-5个)。
4. 分类建议包括：核心技术栈、系统设计、项目经验、软技能/协作等。

JD: ${jd}
Resume: ${resume}

请输出 JSON 格式：
{
  "questions": [
    {
      "category": "分类名称",
      "question": "面试题目内容",
      "difficulty": "easy/medium/hard",
      "answerPoints": ["要点1", "要点2", "要点3"]
    }
  ]
}
`;

  const res = await chatCompletion(
    [
      { role: "system", content: "你是一位资深技术面试官，擅长根据岗位要求设计精准的技术面试题目。" },
      { role: "user", content: prompt },
    ],
    false,
    true
  );

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content as string;
  if (!text) throw new Error("Empty response from DashScope");

  try {
    const parsed = JSON.parse(text) as { questions: TechnicalQuestion[] };
    if (!Array.isArray(parsed.questions)) throw new Error("Invalid response structure");
    return parsed.questions;
  } catch (err) {
    console.error("Technical questions parse error:", err, "Raw text:", text);
    throw new Error("Failed to parse technical questions");
  }
}

export async function generateBehavioralQuestions(
  resume: string
): Promise<BehavioralQuestion[]> {

  const prompt = `
你是一位专业的人力资源顾问，擅长行为面试法（STAR 法则）。请基于以下候选人的 Resume，生成 5-8 道针对性的行为面试题。

要求：
1. 每道题基于 Resume 中的真实经历设计，不得编造。
2. 使用 STAR 法则（Situation/Task/Action/Result）提供回答框架。
3. 覆盖常见的行为面试维度：团队协作、冲突解决、领导力、抗压能力、创新思维、学习能力等。
4. 语言：中文。

Resume: ${resume}

请输出 JSON 格式：
{
  "questions": [
    {
      "question": "行为面试问题",
      "situation": "情境：基于简历经历描述的背景",
      "task": "任务：候选人当时面临的挑战/目标",
      "action": "行动：候选人应该采取的具体行动",
      "result": "结果：预期达成的成果和量化指标"
    }
  ]
}
`;

  const res = await chatCompletion(
    [
      { role: "system", content: "你是一位专业的人力资源顾问，精通 STAR 行为面试法。" },
      { role: "user", content: prompt },
    ],
    false,
    true
  );

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content as string;
  if (!text) throw new Error("Empty response from DashScope");

  try {
    const parsed = JSON.parse(text) as { questions: BehavioralQuestion[] };
    if (!Array.isArray(parsed.questions)) throw new Error("Invalid response structure");
    return parsed.questions;
  } catch (err) {
    console.error("Behavioral questions parse error:", err, "Raw text:", text);
    throw new Error("Failed to parse behavioral questions");
  }
}

export interface SimMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function* simulateInterviewStream(
  jd: string,
  resume: string,
  history: SimMessage[]
): AsyncGenerator<string> {

  const systemPrompt = `
你是一位资深技术面试官，正在为候选人进行模拟面试。

角色设定：
- 你是一位经验丰富、友善但专业的面试官。
- 你的目标是帮助候选人练习面试技巧，而非故意刁难。
- 你会根据 JD 和 Resume 提出针对性的问题。
- 每次回复 concise，一个问题或一段简短的反馈即可，不要长篇大论。
- 语言：中文。

面试流程：
1. 开场自我介绍和简短寒暄（仅第一轮）。
2. 根据 JD 和 Resume 提出技术问题。
3. 根据候选人的回答进行追问或给出改进建议。
4. 适时提出行为面试问题。
5. 最后给候选人提问的机会。

反馈规则：
- 如果候选人回答得很好，给予肯定并简要说明亮点。
- 如果回答有不足，礼貌指出并给出改进方向。
- 不要直接告诉"正确答案"，而是引导候选人思考。
`;

  const userPrompt = `
以下是目标岗位的 JD 和候选人的 Resume，请据此进行面试。

JD: ${jd}
Resume: ${resume}

请提出下一个面试问题或给出反馈。
`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const res = await chatCompletion(messages, true);

  if (!res.body) {
    throw new Error("No response body from DashScope");
  }

  const reader = res.body.getReader();
  try {
    for await (const chunk of parseSSEStream(reader)) {
      yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}
