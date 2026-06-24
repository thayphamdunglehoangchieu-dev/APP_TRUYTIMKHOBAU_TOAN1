import express, { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { Question, StudentLog } from './src/types';
import { defaultQuestions } from './src/defaultQuestions';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Initialize Gemini SDK with client telemetry UA header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getGeminiClient(req: Request): GoogleGenAI | null {
  const reqKey = req.headers['x-gemini-key'] as string || req.headers['x-api-key'] as string;
  if (reqKey && reqKey.trim() !== '' && reqKey !== 'undefined') {
    return new GoogleGenAI({
      apiKey: reqKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return ai;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateContentWithRetry(aiClient: GoogleGenAI | null, params: any, retries = 3) {
  if (!aiClient) {
    throw new Error('Hệ thống chưa thiết lập Gemini API Key. Vui lòng cấu hình API Key trên Header.');
  }
  let lastError: any = null;
  let userModelError: any = null;
  
  // Cascade chain: active models in 2026
  const modelChain = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.5-flash'];
  
  for (let attempt = 0; attempt < retries; attempt++) {
    // Try the specified model or fallback along the chain
    let modelToUse = modelChain[attempt] || modelChain[modelChain.length - 1];
    if (attempt === 0 && params.model) {
      modelToUse = params.model;
    }
    
    try {
      console.log(`[Gemini Request] Attempt ${attempt + 1}/${retries} using model ${modelToUse}...`);
      const response = await aiClient.models.generateContent({
        ...params,
        model: modelToUse
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errorMessage = err?.message || err?.toString() || 'Unknown error';
      console.warn(`[Gemini Attempt ${attempt + 1}/${retries}] Error using ${modelToUse}:`, errorMessage);
      
      if (attempt === 0) {
        userModelError = err;
      }
      
      // If we got an error, try next model in the cascade chain
      if (attempt < retries - 1) {
        const delay = 500 * (attempt + 1);
        console.log(`Waiting ${delay}ms before cascading/retrying...`);
        await sleep(delay);
      }
    }
  }
  throw userModelError || lastError;
}

// In-memory logs representing real-time student activity database
let studentLogs: StudentLog[] = [
  {
    id: 'log_1',
    name: 'Nguyễn Văn An',
    className: '6A1',
    score: 220,
    completed: true,
    timeTakenMinutes: 12.5,
    itemsCollectedCount: 22,
    wrongCountAtStation: { 3: 1, 8: 1, 14: 2, 21: 1 },
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'log_2',
    name: 'Phạm Thị Bình',
    className: '6A1',
    score: 200,
    completed: true,
    timeTakenMinutes: 16.2,
    itemsCollectedCount: 18,
    wrongCountAtStation: { 10: 2, 13: 1, 19: 2, 22: 3 },
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
  },
  {
    id: 'log_3',
    name: 'Lê Hoàng Long',
    className: '6A2',
    score: 150,
    completed: false,
    timeTakenMinutes: 8.4,
    itemsCollectedCount: 12,
    wrongCountAtStation: { 5: 1, 12: 3, 13: 2 },
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'log_4',
    name: 'Trần Minh Quân',
    className: '6A1',
    score: 220,
    completed: true,
    timeTakenMinutes: 10.1,
    itemsCollectedCount: 22,
    wrongCountAtStation: { 19: 1 },
    timestamp: new Date(Date.now() - 900000).toISOString(),
  }
];

let customQuestionsBank: Question[] = [...defaultQuestions];
let part1Count = 12;
let part2Count = 4;
let part3Count = 6;

function rebuildQuestionsBankToMatchConfig() {
  // Extract all multiple-choice questions from customQuestionsBank (or defaultQuestions fallback)
  let mcQuestions = customQuestionsBank.filter(q => q.type === 'multiple-choice');
  if (mcQuestions.length === 0) mcQuestions = defaultQuestions.filter(q => q.type === 'multiple-choice');

  // Extract all true-false questions
  let tfQuestions = customQuestionsBank.filter(q => q.type === 'true-false');
  if (tfQuestions.length === 0) tfQuestions = defaultQuestions.filter(q => q.type === 'true-false');

  // Extract all short-answer questions
  let saQuestions = customQuestionsBank.filter(q => q.type === 'short-answer');
  if (saQuestions.length === 0) saQuestions = defaultQuestions.filter(q => q.type === 'short-answer');

  // Take the desired counts
  const selectedMC = [];
  for (let i = 0; i < part1Count; i++) {
    selectedMC.push(mcQuestions[i % mcQuestions.length] || defaultQuestions[i % 12]);
  }

  const selectedTF = [];
  for (let i = 0; i < part2Count; i++) {
    selectedTF.push(tfQuestions[i % tfQuestions.length] || defaultQuestions[(12 + i) % 22]);
  }

  const selectedSA = [];
  for (let i = 0; i < part3Count; i++) {
    selectedSA.push(saQuestions[i % saQuestions.length] || defaultQuestions[(16 + i) % 22]);
  }

  // Combine and assign sequential stations
  const newBank: Question[] = [];
  let stationIndex = 1;

  selectedMC.forEach(q => {
    newBank.push({ ...q, station: stationIndex++ });
  });
  selectedTF.forEach(q => {
    newBank.push({ ...q, station: stationIndex++ });
  });
  selectedSA.forEach(q => {
    newBank.push({ ...q, station: stationIndex++ });
  });

  customQuestionsBank = newBank;
}

function sanitizeField(val: any): any {
  if (typeof val === 'string') {
    return val
      .replace(/\x0c/g, '\\f')
      .replace(/\x08/g, '\\b')
      .replace(/\v/g, '\\v')
      .replace(/\\rac\{/g, '\\frac{')
      .replace(/([^fdt]|^)rac\{/g, '$1\\frac{')
      .replace(/([^\\fdt]|^)dfrac\{/g, '$1\\dfrac{')
      .replace(/([^\\fdt]|^)tfrac\{/g, '$1\\tfrac{');
  } else if (Array.isArray(val)) {
    return val.map(sanitizeField);
  } else if (val && typeof val === 'object') {
    const res: any = {};
    for (const key of Object.keys(val)) {
      res[key] = sanitizeField(val[key]);
    }
    return res;
  }
  return val;
}

function mergeQuestionsIntoBank(newQuestions: any[], challengeType: string): Question[] {
  let sanitizedQuestions = Array.isArray(newQuestions) ? newQuestions.map(q => sanitizeField(q)) : [];
  
  // Extract all currently loaded questions by type
  let mcQuestions = customQuestionsBank.filter(q => q.type === 'multiple-choice');
  if (mcQuestions.length === 0) mcQuestions = defaultQuestions.filter(q => q.type === 'multiple-choice');

  let tfQuestions = customQuestionsBank.filter(q => q.type === 'true-false');
  if (tfQuestions.length === 0) tfQuestions = defaultQuestions.filter(q => q.type === 'true-false');

  let saQuestions = customQuestionsBank.filter(q => q.type === 'short-answer');
  if (saQuestions.length === 0) saQuestions = defaultQuestions.filter(q => q.type === 'short-answer');

  if (challengeType === 'challenge1') {
    const newMC: Question[] = [];
    for (let i = 0; i < part1Count; i++) {
      const sourceQ = sanitizedQuestions[i] || sanitizedQuestions[i % sanitizedQuestions.length] || mcQuestions[i % mcQuestions.length] || defaultQuestions[i % 12];
      newMC.push({
        station: i + 1,
        landscape: 'Rừng rậm',
        type: 'multiple-choice',
        questionText: sourceQ.questionText || `Câu hỏi Trạm ${i + 1}`,
        options: Array.isArray(sourceQ.options) && sourceQ.options.length >= 4 
          ? sourceQ.options.slice(0, 4) 
          : ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
        correctAnswer: sourceQ.correctAnswer || 'A',
        explanation: sourceQ.explanation || 'Giải thích câu hỏi',
        keywords: Array.isArray(sourceQ.keywords) ? sourceQ.keywords : [],
      });
    }
    mcQuestions = newMC;
  } else if (challengeType === 'challenge2') {
    const newTF: Question[] = [];
    for (let i = 0; i < part2Count; i++) {
      const sourceQ = sanitizedQuestions[i] || sanitizedQuestions[i % sanitizedQuestions.length] || tfQuestions[i % tfQuestions.length] || defaultQuestions[(12 + i) % 22];
      
      let finalSubStatements: any[] = [];
      if (Array.isArray(sourceQ.subStatements) && sourceQ.subStatements.length > 0) {
        sourceQ.subStatements.forEach((sub: any, subIdx: number) => {
          if (sub && typeof sub === 'object') {
            const labels = ['a)', 'b)', 'c)', 'd)'];
            const ansRaw = String(sub.correctAnswer || 'Sai').trim();
            const isTrue = ansRaw === 'Đúng' || ansRaw === 'True' || ansRaw === 'Yes' || ansRaw === 'T' || ansRaw.toLowerCase().startsWith('đ') || ansRaw.toLowerCase().startsWith('t');
            finalSubStatements.push({
              label: sub.label || labels[subIdx] || `${String.fromCharCode(97 + subIdx)})`,
              text: sub.text || `Mệnh đề phụ ý ${labels[subIdx] || ''}`,
              correctAnswer: isTrue ? 'Đúng' : 'Sai'
            });
          }
        });
      }
      
      const defaultLabels = ['a)', 'b)', 'c)', 'd)'];
      while (finalSubStatements.length < 4) {
        const nextIdx = finalSubStatements.length;
        finalSubStatements.push({
          label: defaultLabels[nextIdx],
          text: `Mệnh đề thám hiểm bổ trợ ${defaultLabels[nextIdx]}`,
          correctAnswer: 'Đúng'
        });
      }

      newTF.push({
        station: i + 1,
        landscape: 'Hang động',
        type: 'true-false',
        questionText: sourceQ.questionText || `Câu hỏi Trạm ${i + 1}`,
        explanation: sourceQ.explanation || 'Giải thích phán đoán',
        subStatements: finalSubStatements,
        correctAnswer: sourceQ.correctAnswer || 'a',
        keywords: Array.isArray(sourceQ.keywords) ? sourceQ.keywords : [],
      });
    }
    tfQuestions = newTF;
  } else if (challengeType === 'challenge3') {
    const newSA: Question[] = [];
    for (let i = 0; i < part3Count; i++) {
      const sourceQ = sanitizedQuestions[i] || sanitizedQuestions[i % sanitizedQuestions.length] || saQuestions[i % saQuestions.length] || defaultQuestions[(16 + i) % 22];
      let answerRaw = sourceQ.correctAnswer ? String(sourceQ.correctAnswer).trim() : '0';
      newSA.push({
        station: i + 1,
        landscape: 'Thung lũng sương mù',
        type: 'short-answer',
        questionText: sourceQ.questionText || `Câu hỏi Trạm ${i + 1}`,
        explanation: sourceQ.explanation || 'Giải thích đầy đủ cách giải',
        correctAnswer: answerRaw,
        keywords: Array.isArray(sourceQ.keywords) ? sourceQ.keywords : [answerRaw],
      });
    }
    saQuestions = newSA;
  } else {
    // For general / all Questions parsing
    let updatedBank = [...customQuestionsBank];
    sanitizedQuestions.forEach((q) => {
      const targetStation = q.station;
      if (!targetStation) return;
      const idx = updatedBank.findIndex(ub => ub.station === targetStation);
      
      let subStatements = undefined;
      if (Array.isArray(q.subStatements)) {
        subStatements = q.subStatements.map((sub: any, subIdx: number) => {
          const labels = ['a)', 'b)', 'c)', 'd)'];
          const ansRaw = String(sub.correctAnswer || 'Sai').trim();
          const isTrue = ansRaw === 'Đúng' || ansRaw === 'True' || ansRaw === 'Yes' || ansRaw === 'T' || ansRaw.toLowerCase().startsWith('đ') || ansRaw.toLowerCase().startsWith('t');
          return {
            label: sub.label || labels[subIdx] || `${String.fromCharCode(97 + subIdx)})`,
            text: sub.text || `Mệnh đề ý ${labels[subIdx] || ''}`,
            correctAnswer: isTrue ? 'Đúng' : 'Sai'
          };
        });
      }

      const formattedQ: Question = {
        station: targetStation,
        landscape: q.landscape || (targetStation <= part1Count ? 'Rừng rậm' : targetStation <= part1Count + part2Count ? 'Hang động' : 'Thung lũng sương mù'),
        type: q.type || (targetStation <= part1Count ? 'multiple-choice' : targetStation <= part1Count + part2Count ? 'true-false' : 'short-answer'),
        questionText: q.questionText || `Câu hỏi Trạm ${targetStation}`,
        options: Array.isArray(q.options) ? q.options : undefined,
        correctAnswer: q.correctAnswer || (targetStation <= part1Count ? 'A' : targetStation <= part1Count + part2Count ? 'a' : '0'),
        explanation: q.explanation || 'Giải thích tự động',
        keywords: Array.isArray(q.keywords) ? q.keywords : undefined,
        subStatements: subStatements
      };

      if (idx !== -1) {
        updatedBank[idx] = formattedQ;
      } else {
        updatedBank.push(formattedQ);
      }
    });
    
    updatedBank.sort((a, b) => a.station - b.station);
    return updatedBank;
  }

  // Combine and assign sequential stations
  const updatedBank: Question[] = [];
  let stationIndex = 1;

  mcQuestions.forEach(q => {
    updatedBank.push({ ...q, station: stationIndex++ });
  });
  tfQuestions.forEach(q => {
    updatedBank.push({ ...q, station: stationIndex++ });
  });
  saQuestions.forEach(q => {
    updatedBank.push({ ...q, station: stationIndex++ });
  });

  updatedBank.sort((a, b) => a.station - b.station);
  return updatedBank;
}
let isGameActive = false; // Starts as false. Game is created only after teacher uploads/creates questions.
let gameTimeLimit = 30; // Default time limit of 30 minutes. 0 or less means unlimited.

// 1. Health Probe
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', datetime: new Date().toISOString(), geminiLoaded: !!ai, isGameActive, gameTimeLimit });
});

// 2. Load Questions Bank
app.get('/api/questions', (req: Request, res: Response) => {
  res.json({ questions: customQuestionsBank, isGameActive, gameTimeLimit, part1Count, part2Count, part3Count });
});

// 2b. Check and update Game Status / Creation flag
app.get('/api/game-status', (req: Request, res: Response) => {
  res.json({ isGameActive, hasQuestions: customQuestionsBank.length > 0, gameTimeLimit, part1Count, part2Count, part3Count });
});

app.post('/api/game-status', (req: Request, res: Response) => {
  const { active } = req.body;
  if (typeof active === 'boolean') {
    isGameActive = active;
    res.json({ success: true, isGameActive, gameTimeLimit, part1Count, part2Count, part3Count });
  } else {
    res.status(400).json({ error: 'Tham số active không hợp lệ' });
  }
});

// 2c. Update Game Time Limit
app.post('/api/game-time', (req: Request, res: Response) => {
  const { timeLimit } = req.body;
  if (typeof timeLimit === 'number' && timeLimit >= 0) {
    gameTimeLimit = timeLimit;
    res.json({ success: true, gameTimeLimit });
  } else {
    res.status(400).json({ error: 'Thời gian cài đặt không hợp lệ. Thời gian phải là số phút lớn hơn hoặc bằng 0.' });
  }
});

// 2d. Update Game Config (Dynamic Question Counts)
app.post('/api/game-config', (req: Request, res: Response) => {
  const { p1, p2, p3 } = req.body;
  let changed = false;
  if (typeof p1 === 'number' && p1 >= 1 && p1 <= 12) {
    part1Count = p1;
    changed = true;
  }
  if (typeof p2 === 'number' && p2 >= 1 && p2 <= 4) {
    part2Count = p2;
    changed = true;
  }
  if (typeof p3 === 'number' && p3 >= 1 && p3 <= 6) {
    part3Count = p3;
    changed = true;
  }

  if (changed) {
    rebuildQuestionsBankToMatchConfig();
  }

  res.json({
    success: true,
    part1Count,
    part2Count,
    part3Count,
    questions: customQuestionsBank,
    isGameActive
  });
});

// 2c. Save questions bank manually
app.post('/api/questions', (req: Request, res: Response) => {
  const { questions } = req.body;
  if (Array.isArray(questions) && questions.length > 0) {
    customQuestionsBank = questions.map(q => sanitizeField(q));
    isGameActive = true; // Manual save or updates also activates the game!
    res.json({ success: true, isGameActive, questions: customQuestionsBank });
  } else {
    res.status(400).json({ error: 'Danh sách câu hỏi gửi lên không hợp lệ.' });
  }
});

// 3. Reset to default bank questions
app.post('/api/questions/reset', (req: Request, res: Response) => {
  part1Count = 12;
  part2Count = 4;
  part3Count = 6;
  customQuestionsBank = [...defaultQuestions];
  isGameActive = false; // Reset turns off the live game active status until a new one is uploaded/activated
  res.json({
    success: true,
    message: 'Khôi phục ngân hàng câu hỏi gốc và đặt lại trạng thái trò chơi về chưa kích hoạt!',
    questions: customQuestionsBank,
    isGameActive,
    part1Count,
    part2Count,
    part3Count
  });
});

// 4. Save dynamic question logs
app.post('/api/student/log', (req: Request, res: Response) => {
  const { name, className, score, completed, timeTakenMinutes, itemsCollectedCount, wrongCountAtStation } = req.body;
  if (!name || !className) {
    res.status(400).json({ error: 'Thiếu thông tin học sinh (Name/Class)' });
    return;
  }
  const newLog: StudentLog = {
    id: 'log_' + Date.now(),
    name,
    className,
    score: score ?? 0,
    completed: !!completed,
    timeTakenMinutes: timeTakenMinutes ?? 0,
    itemsCollectedCount: itemsCollectedCount ?? 0,
    wrongCountAtStation: wrongCountAtStation ?? {},
    timestamp: new Date().toISOString()
  };
  studentLogs.push(newLog);
  res.json({ success: true, log: newLog });
});

// 5. Get Student Report Logs
app.get('/api/teacher/logs', (req: Request, res: Response) => {
  res.json({ logs: studentLogs });
});

// 6. Gemini: get intelligent hint feedback upon incorrect reply
app.post('/api/gemini/get-hint', async (req: Request, res: Response) => {
  const { questionText, studentAnswer, category, station } = req.body;
  const aiClient = getGeminiClient(req);
  const reqModel = req.headers['x-gemini-model'] as string || 'gemini-2.5-flash';

  if (!aiClient) {
    // Offline AI Master fallback
    res.json({
      hint: `Hãy suy nghĩ kỹ nhé nhà thám hiểm! Bạn trả lời là "${studentAnswer}". Gợi ý: Hãy xem lại bước tính liên quan và thử tính toán lại nhé!`
    });
    return;
  }

  try {
    const prompt = `Bạn là Hệ thống Trí tuệ Nhân tạo Trung tâm (Game Master AI) dẫn dắt trò chơi "Truy tìm kho báu" do giáo viên Phạm Văn Dũng quản trị. 
Học sinh trong vai "Nhà thám hiểm" đã trả lời SAI câu hỏi toán học tại Trạm ${station} (${category || 'Kiến thức chung'}).

Câu hỏi: "${questionText}"
Học sinh trả lời sai là: "${studentAnswer}"

Nhiệm vụ của bạn:
1. Đưa ra gợi ý thông minh (AI Hint), khích lệ, khơi dậy suy nghĩ, tuyệt đối không đưa ra đáp án trực tiếp.
2. Viết bằng tiếng Việt trong sáng, đầy cảm hứng, gần gũi với học sinh tiểu học/trung học (Ví dụ xưng hô: "Nhà thám hiểm ơi...", "Đừng nản chí nhé...").
3. Hãy ngắn gọn, súc tích (tầm 2-3 câu). Giữ bản quyền ghi nhận "Giáo viên: Phạm Văn Dũng" nếu phù hợp một cách tế nhị.`;

    const response = await generateContentWithRetry(aiClient, {
      model: reqModel,
      contents: prompt,
      config: {
        temperature: 0.8,
      }
    });

    res.json({ hint: response.text?.trim() || "Hãy xem lại công thức toán và tính toán cẩn thận hơn nhé!" });
  } catch (error: any) {
    console.error("Gemini Hint Error:", error);
    res.json({ hint: `Nhà thám hiểm chớ vội! Gợi ý tìm ẩn: Phép toán này đòi hỏi bạn kiểm tra lại từng số hàng chục và hàng đơn vị đấy. Hãy thử lại nào!` });
  }
});

// 7. Gemini: generate dynamic math challenge questions
app.post('/api/gemini/generate-questions', async (req: Request, res: Response) => {
  const { theme, grade, challengeType } = req.body; // e.g. "Toán lớp 6", challengeType: "challenge1"
  const aiClient = getGeminiClient(req);
  const reqModel = req.headers['x-gemini-model'] as string || 'gemini-2.5-flash';
  
  if (!aiClient) {
    res.status(500).json({ error: 'Hệ thống chưa thiết lập Gemini API Key. Vui lòng cấu hình API Key trên Header.' });
    return;
  }

  try {
    let prompt = '';
    const total = part1Count + part2Count + part3Count;
    const p1End = part1Count;
    const p2Start = part1Count + 1;
    const p2End = part1Count + part2Count;
    const p3Start = part1Count + part2Count + 1;
    const p3End = total;

    if (challengeType === 'challenge1') {
      prompt = `Hãy thiết lập ngân hàng câu hỏi mới gồm ĐÚNG ${part1Count} câu hỏi trắc nghiệm A, B, C, D cho phân khu "Rừng rậm" (Thử thách 1).
Chủ đề yêu cầu: "${theme || 'Toán học tổng hợp nâng cao'}". Khối lớp: "${grade || 'Khối 6-7'}".
YÊU CẦU ĐẶC BIỆT:
- CHÚ Ý VỀ "options": Trong mảng "options", bạn tuyệt đối KHÔNG ĐƯỢC để các ký tự chữ cái đáp án đứng đầu như "A. ", "B. ", "C. ", "D. " hay "A) ", "B) ", "C) ", "D) ". Hãy chỉ ghi nhận phần nội dung phía sau kí tự đó.
- Lời giải chi tiết, rõ ràng và truyền tải kiến thức xuất sắc tự động do bạn (AI) tự viết hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- Bọc công thức toán, phép toán, phân số, độ dài, diện tích, thể tích, phương trình, biến số (như $x$, $y$, $r$, $t$), số đo bằng kí tự $ ở 2 đầu (VD: $x = 5$).
Trả về một mảng JSON các đối tượng phù hợp với schema.`;
    } else if (challengeType === 'challenge2') {
      prompt = `Hãy thiết lập ngân hàng câu hỏi mới gồm ĐÚNG ${part2Count} câu hỏi Đúng / Sai đặc biệt cho phân khu "Hang động" (Thử thách 2).
Chủ đề yêu cầu: "${theme || 'Toán học tổng hợp nâng cao'}". Khối lớp: "${grade || 'Khối 6-7'}".
YÊU CẦU ĐẶC BIỆT:
- Mỗi câu hỏi lớn ở trạm này bắt buộc có đúng 4 mệnh đề phụ được cấu trúc trong mảng "subStatements" của câu hỏi đó. Mỗi "subStatement" gồm có "label" (ví dụ là "a)", "b)", "c)", "d)"), "text" (nội dung mệnh đề toán học), và "correctAnswer" (chỉ nhận giá trị "Đúng" hoặc "Sai").
- CHÚ Ý VỀ "text" của subStatements: Bạn tuyệt đối KHÔNG ĐƯỢC lấy ký tự chỉ mục như "a)", "b)", "c)", "d)", "a.", "b.", "c.", "d." ở đầu nội dung phát biểu, hãy chỉ lấy phần văn bản nội dung mệnh đề toán học thuần túy phía sau.
- Lời giải chi tiết, mẫu mực cho các phán đoán tự động do bạn (AI) tự biên soạn hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- Bọc công thức toán, phép toán, phân số, độ dài, diện tích, thể tích, phương trình, biến số (như $x$, $y$, $r$, $t$), số đo bằng kí tự $ ở 2 đầu (VD: $x = 5$).
Trả về một mảng JSON các đối tượng phù hợp với schema.`;
    } else if (challengeType === 'challenge3') {
      prompt = `Hãy thiết lập ngân hàng câu hỏi mới gồm ĐÚNG ${part3Count} câu hỏi trả lời ngắn dạng điền số/chữ ngắn cho phân khu "Thung lũng sương mù" (Thử thách 3).
Chủ đề yêu cầu: "${theme || 'Toán học tổng hợp nâng cao'}". Khối lớp: "${grade || 'Khối 6-7'}".
YÊU CẦU ĐẶC BIỆT:
- Cần ghi nhận một danh sách "keywords" các từ đồng nghĩa/chấp nhận để hệ thống so khớp linh hoạt. Đặc biệt nếu kết quả là số thập phân, hãy thêm cả định dạng ngăn cách chấm và phẩy (ví dụ: "2.5", "2,5").
- Lời giải chi tiết từng bước toán học truyền cảm hứng tự động do bạn (AI) tự viết hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- Bọc công thức toán, phép toán, phân số, độ dài, diện tích, thể tích, phương trình, biến số (như $x$, $y$, $r$, $t$), số đo bằng kí tự $ ở 2 đầu (VD: $x = 5$).
Trả về một mảng JSON các đối tượng phù hợp với schema.`;
    } else {
      prompt = `Hãy thiết lập ngân hàng câu hỏi mới gồm đúng ${total} trạm cho trò chơi "Truy tìm kho báu". 
Chủ đề yêu cầu: "${theme || 'Toán học tổng hợp nâng cao'}". Khối lớp: "${grade || 'Khối 6-7'}".
Các câu hỏi cần tăng dần độ khó từ trạm 1 đến trạm ${total} theo đúng cấu trúc ba phân khu sinh cảnh:

* Trạm 1-${p1End} (Rừng rậm): Định dạng câu hỏi là Trắc nghiệm bốn đáp án (Multiple choice). Chỉ có 1 đáp án chính xác trong "options". Gồm đúng ${part1Count} câu hỏi tương ứng các trạm từ 1 đến ${p1End}.
  CHÚ Ý VỀ "options": Trong mảng "options", bạn tuyệt đối KHÔNG ĐƯỢC để các ký tự chữ cái đáp án đứng đầu như "A. ", "B. ", "C. ", "D. " hay "A) ", "B) ", "C) ", "D) ". Hãy chỉ ghi nhận phần nội dung phía sau kí tự đó.
* Trạm ${p2Start}-${p2End} (Hang động): Định dạng câu hỏi Đúng / Sai (true-false) đặc biệt: mỗi trạm phải có đúng 4 câu hỏi/mệnh đề phụ được cấu trúc trong mảng "subStatements" của câu hỏi đó. Mỗi "subStatement" gồm có "label" (ví dụ là "a)", "b)", "c)", "d)"), "text" (nội dung mệnh đề toán học), và "correctAnswer" (chỉ nhận giá trị "Đúng" hoặc "Sai").
  CHÚ Ý VỀ "text" của subStatements: Bạn tuyệt đối KHÔNG ĐƯỢC lấy ký tự chỉ mục như "a)", "b)", "c)", "d)", "a.", "b.", "c.", "d." ở đầu nội dung phát biểu, hãy chỉ lấy phần văn bản nội dung mệnh đề toán học thuần túy phía sau.
* Trạm ${p3Start}-${p3End} (Thung lũng sương mù): Định dạng Trả lời ngắn (Short Answer, học sinh viết số hoặc chữ ngắn). Cần ghi nhận một danh sách "keywords" các từ đồng nghĩa/chấp nhận để hệ thống so khớp linh hoạt. Đặc biệt nếu kết quả là số thập phân, hãy thêm cả định dạng ngăn cách chấm và phẩy (ví dụ: "2.5", "2,5").

CHÚ Ý ĐẶC BIỆT VỀ KÝ HIỆU TOÁN HỌC:
- Mọi kí hiệu toán học, phép toán, phân số, độ dài, diện tích, thể tích, phương trình, biến số (như $x$, $y$, $r$, $t$), số đo (như $35$ thùng, $32\text{ cm}$, $300\text{ m}^2$, $150\text{ cm}^2$, tỉ lệ $1 : 10000$, phân số $\frac{3}{4}$, số mũ $x^2$, v.v.) BẮT BUỘC PHẢI được chuyển đổi sang định dạng LaTeX chuẩn và bọc bởi dấu $ ở hai đầu (ví dụ: $3x - 5 = 10$, $x = 15 \div 3 = 5$, $\frac{15}{25}$, $75\%$, v.v.). Đảm bảo tất cả công thức toán đều hiển thị cực kỳ đẹp mắt và chuyên nghiệp cho học sinh học tập qua KaTeX.

Trả về một mảng JSON các đối tượng đúng với schema quy định.`;
    }

    const response = await generateContentWithRetry(aiClient, {
      model: reqModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: getResponseSchema(challengeType || 'all'),
        temperature: 0.7,
      }
    });

    const parsed = JSON.parse(response.text || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (challengeType) {
        customQuestionsBank = mergeQuestionsIntoBank(parsed, challengeType);
      } else {
        customQuestionsBank = parsed;
      }
      isGameActive = true;
      res.json({ success: true, questions: customQuestionsBank });
    } else {
      throw new Error("Không thể phân tích dữ liệu câu hỏi từ mô hình.");
    }
  } catch (error: any) {
    console.error("Gemini Question Generator Error:", error);
    res.status(500).json({ error: error.message || 'Lỗi bất ngờ xảy ra khi tạo câu hỏi qua Gemini.' });
  }
});

// Helper function to get tailored response schemas per challengeType
function getResponseSchema(challengeType: string) {
  if (challengeType === 'challenge1') {
    return {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionText: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["questionText", "options", "correctAnswer", "explanation"]
      }
    };
  } else if (challengeType === 'challenge2') {
    return {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionText: { type: Type.STRING },
          explanation: { type: Type.STRING },
          subStatements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                text: { type: Type.STRING },
                correctAnswer: { type: Type.STRING }
              },
              required: ["label", "text", "correctAnswer"]
            }
          }
        },
        required: ["questionText", "subStatements", "explanation"]
      }
    };
  } else if (challengeType === 'challenge3') {
    return {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionText: { type: Type.STRING },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        },
        required: ["questionText", "correctAnswer", "explanation"]
      }
    };
  } else {
    return {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          station: { type: Type.INTEGER },
          landscape: { type: Type.STRING },
          type: { type: Type.STRING },
          questionText: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          correctAnswer: { type: Type.STRING },
          explanation: { type: Type.STRING },
          keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          subStatements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                text: { type: Type.STRING },
                correctAnswer: { type: Type.STRING }
              },
              required: ["label", "text", "correctAnswer"]
            }
          }
        },
        required: ["questionText", "correctAnswer", "explanation"]
      }
    };
  }
}

// 8. Gemini: OCR Import Simulation
app.post('/api/gemini/ocr-import', async (req: Request, res: Response) => {
  const { docContent, challengeType } = req.body; // text representation extracted from doc/pasted text and challenge type
  const aiClient = getGeminiClient(req);
  const reqModel = req.headers['x-gemini-model'] as string || 'gemini-2.5-flash';

  if (!aiClient) {
    res.status(500).json({ error: 'Hệ thống chưa thiết lập Gemini API Key. Vui lòng cấu hình API Key trên Header.' });
    return;
  }

  try {
    let prompt = '';

    const total = part1Count + part2Count + part3Count;
    const p1End = part1Count;
    const p2Start = part1Count + 1;
    const p2End = part1Count + part2Count;
    const p3Start = part1Count + part2Count + 1;
    const p3End = total;

    if (challengeType === 'challenge1') {
      prompt = `Bạn là Game Master AI thiết kế câu hỏi thám hiểm toán học cho Giáo viên Phạm Văn Dũng.
Hãy đọc bóc tách (OCR), phân loại và xây dựng đúng hệ thống gồm ĐÚNG ${part1Count} câu hỏi trắc nghiệm A, B, C, D cho Thử thách 1 (phân khu Rừng rậm, các Trạm từ 1 đến ${p1End}) từ văn bản tài liệu sau:
"${docContent}"

CẤU HÌNH & QUY TẮC ĐẶC BIỆT:
- ĐÁP ÁN ĐÚNG sẽ là phương án được gạch chân kí tự chữ cái A, B, C hoặc D trong văn bản (ví dụ: gạch chân dưới chữ cái hay chữ cái có format underline như <u>A</u>, <u>B</u>, <u>C</u> hoặc <u>D</u>).
- Không cần lời giải giải thích có sẵn trong tài liệu. Lời giải chi tiết, rõ ràng và truyền tải kiến thức xuất sắc tự động do bạn (AI) tự viết hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- CHÚ Ý VỀ "options": Trong mảng "options", bạn tuyệt đối KHÔNG ĐƯỢC để các ký tự chữ cái đáp án đứng đầu như "A. ", "B. ", "C. ", "D. " hay "A) ", "B) ", "C) ", "D) ". Hãy chỉ trích xuất phần nội dung phương án toán học phía sau.
- Chuyển đổi mọi ký hiệu toán học, công thức, số đo sang định dạng LaTeX chuẩn và bọc tuyệt đối bởi các dấu $ ở hai đầu (ví dụ: $x^2$, $\frac{3}{4}$, $75\%$).
- Nếu tài liệu không đủ ${part1Count} câu hỏi trắc nghiệm, bạn hãy tự động sáng tạo thăng hoa thêm các câu hỏi trắc nghiệm toán học tương tự cùng chủ đề để lấp đầy trọn vẹn ${part1Count} trạm!`;
    } else if (challengeType === 'challenge2') {
      prompt = `Bạn là Game Master AI thiết kế câu hỏi thám hiểm toán học cho Giáo viên Phạm Văn Dũng.
Hãy đọc bóc tách (OCR), phân loại và xây dựng đúng hệ thống gồm ĐÚNG ${part2Count} câu hỏi Đúng/Sai đặc biệt cho Thử thách 2 (phân khu Hang động, các Trạm từ ${p2Start} đến ${p2End}). Mỗi câu hỏi lớn ở trạm này bắt buộc có đúng 4 mệnh đề phụ a, b, c, d, từ văn bản tài liệu sau:
"${docContent}"

CẤU HÌNH & QUY TẮC ĐẶC BIỆT:
- Ý phụ nào ĐÚNG ("Đúng") sẽ được gạch chân kí tự a), b), c) hoặc d) trong văn bản (ví dụ: gạch chân dưới kí tự hay kí tự được format underline như <u>a)</u>, <u>b)</u>, <u>c)</u>, <u>d)</u>). Ý phụ nào KHÔNG được gạch chân đại diện cho mệnh đề mang đáp án "Sai".
- Không cần lời giải giải thích có sẵn trong tài liệu. Lời giải chi tiết, mẫu mực cho các phán đoán tự động do bạn (AI) tự biên soạn hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- Mỗi câu hỏi phải có đúng 4 câu hỏi/mệnh đề phụ được cấu trúc trong mảng "subStatements". Mỗi "subStatement" gồm có "label" (ví dụ là "a)", "b)", "c)", "d)"), "text" (văn bản toán học, loại bỏ kí tự chỉ mục "a)" hoặc "a." ở đầu), và "correctAnswer" (nhận giá trị "Đúng" hoặc "Sai").
- Chuyển đổi mọi ký hiệu toán học, công thức, số đo sang định dạng LaTeX chuẩn và bọc tuyệt đối bởi các dấu $ ở hai đầu.
- Nếu tài liệu không đủ ${part2Count} câu hỏi, bạn hãy tự động sáng tạo thăng hoa thêm các câu hỏi toán học Đúng/Sai tương tự cùng chủ đề để lấp đầy trọn vẹn ${part2Count} trạm Đúng/Sai!`;
    } else if (challengeType === 'challenge3') {
      prompt = `Bạn là Game Master AI thiết kế câu hỏi thám hiểm toán học cho Giáo viên Phạm Văn Dũng.
Hãy đọc bóc tách (OCR), phân loại và xây dựng đúng hệ thống gồm ĐÚNG ${part3Count} câu hỏi trả lời ngắn cho Thử thách 3 (phân khu Thung lũng sương mù, các Trạm từ ${p3Start} đến ${p3End}) từ văn bản tài liệu sau:
"${docContent}"

CẤU HÌNH & QUY TẮC ĐẶC BIỆT:
- ĐÁP ÁN của câu trả lời ngắn sẽ được ghi nhận phía dưới câu hỏi trong văn bản theo dạng: "Đáp án: [giá trị]". 
- Không cần lời giải giải thích có sẵn trong tài liệu. Lời giải chi tiết từng bước toán học truyền cảm hứng tự động do bạn (AI) tự viết hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- QUY ĐỊNH BẮT BUỘC VỀ ĐÁP ÁN SỐ: Đáp án cho câu hỏi ngắn bắt buộc chỉ được chứa các chữ số đại diện cho số (có thể có dấu âm). 
- ĐẶC BIỆT: Nếu kết quả câu trả lời là Số thập phân, bạn BẮT BUỘC phải dùng dấu phẩy "," để ngăn cách phần thập phân (Ví dụ: "2,5" hoặc "3,14", tuyệt đối không được dùng dấu chấm "." như "2.5"). Trường "correctAnswer" và mảng "keywords" phải tuân thủ nghiêm ngặt quy định dấu phẩy này.
- Chuyển đổi mọi ký hiệu toán học, công thức, số đo sang định dạng LaTeX chuẩn và bọc tuyệt đối bởi các dấu $ ở hai đầu.
- Nếu tài liệu không đủ ${part3Count} câu hỏi tự luận ngắn, bạn hãy tự động sáng tạo thăng hoa thêm các câu hỏi toán học trả lời ngắn tương tự cùng chủ đề để đảm bảo đầy đủ ${part3Count} trạm!`;
    } else {
      // Original full-bank parse representation
      prompt = `Bạn nhận được nội dung tài liệu ôn tập toán học sau:
"${docContent}"

Hãy đóng vai trò Game Master AI để bóc tách (OCR), phân loại và xây dựng lại thành bộ ${total} trạm toán học tăng dần độ khó cho trò chơi "Truy tìm kho báu".
Nếu tài liệu không có các lời giải thích, bạn phải tự viết lời giải toán học chi tiết, mẫu mực bằng tiếng Việt dưới trường "explanation".

Phân khu:
1. Trạm 1-${p1End} (Rừng rậm): Trắc nghiệm bốn đáp án (A, B, C, D). Đáp án đúng được gạch chân kí tự A, B, C hoặc D. Gồm ${part1Count} câu hỏi.
2. Trạm ${p2Start}-${p2End} (Hang động): Đúng/Sai đặc biệt. Ý mệnh đề phụ nào đúng thì gạch chân kí tự chỉ mục a), b), c) hoặc d). Gồm ${part2Count} câu hỏi.
3. Trạm ${p3Start}-${p3End} (Thung lũng sương mù): Trả lời ngắn, đáp án ghi phía dưới dưới dạng "Đáp án: [số]". Số thập phân bắt buộc dùng dấu phẩy "," ngăn cách. Gồm ${part3Count} câu hỏi.

CHÚ Ý ĐẶC BIỆT VỀ KÝ HIỆU TOÁN HỌC:
- Mọi kí hiệu toán học, số đo, công thức, căn thức, phương trình, biến số BẮT BUỘC PHẢI được chuyển đổi sang định dạng LaTeX chuẩn và bọc tuyệt đối bởi các dấu $ (ví dụ: $x^2$, $\frac{3}{4}$, v.v.)
Trả về cấu trúc JSON đúng chuẩn mảng ${total} câu hỏi tương thích với schema trò chơi.`;
    }

    const response = await generateContentWithRetry(aiClient, {
      model: reqModel,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: getResponseSchema(challengeType),
        temperature: 0.5,
      }
    });

    const parsed = JSON.parse(response.text || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      customQuestionsBank = mergeQuestionsIntoBank(parsed, challengeType);
      isGameActive = true;
      res.json({ success: true, questions: customQuestionsBank });
    } else {
      res.status(500).json({ error: 'Không thể phân tính định dạng JSON từ AI.' });
    }
  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    res.status(500).json({ error: error.message || 'Gặp lỗi trong quá trình bóc tách OCR.' });
  }
});

// 8b. Gemini: File Attachment OCR parsing supporting PDF, Word docx, and Images (PNG/JPG)
import mammoth from 'mammoth';
app.post('/api/gemini/ocr-file', async (req: Request, res: Response) => {
  const { fileBase64, fileName, mimeType, challengeType } = req.body;
  const aiClient = getGeminiClient(req);
  const reqModel = req.headers['x-gemini-model'] as string || 'gemini-2.5-flash';

  if (!aiClient) {
    res.status(500).json({ error: 'Hệ thống chưa thiết lập Gemini API Key. Vui lòng cấu hình API Key trên Header.' });
    return;
  }

  try {
    let extractedText = '';

    // Extract Word docx text using mammoth if docx
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.toLowerCase().endsWith('.docx')) {
      const buffer = Buffer.from(fileBase64, 'base64');
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    }

    let contents: any[] = [];
    let textPrompt = '';

    if (challengeType === 'challenge1') {
      textPrompt = `Bạn là Game Master AI thiết kế câu hỏi thám hiểm toán học cho Giáo viên Phạm Văn Dũng.
Hãy đọc bóc tách tài liệu đính kèm (Word, PDF hoặc ảnh chụp đề) để bóc tách (OCR), biên dịch thành ĐÚNG 12 câu hỏi trắc nghiệm A, B, C, D cho Thử thách 1 (phân khu Rừng rậm, các Trạm từ 1 đến 12).

CẤU HÌNH & QUY TẮC ĐẶC BIỆT:
- ĐÁP ÁN ĐÚNG sẽ là phương án được gạch chân kí tự chữ cái A, B, C hoặc D trong tài liệu (ví dụ: chữ cái có định dạng underline hay gạch chân như <u>A</u>, <u>B</u>, <u>C</u> hoặc <u>D</u>).
- Tài liệu đính kèm không cần lời giải giải thích. Lời giải chi tiết, rõ ràng từng bước toán học tự động do bạn (AI) tự biên soạn hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- CHÚ Ý VỀ "options": Trong mảng "options", bạn tuyệt đối KHÔNG ĐƯỢC để các ký tự chữ cái đáp án đứng đầu như "A. ", "B. ", "C. ", "D. " hay "A) ", "B) ", "C) ", "D) ". Hãy chỉ trích xuất phần nội dung phương án toán học phía sau.
- Chuyển đổi mọi ký hiệu toán học, công thức, số đo sang định dạng LaTeX chuẩn và bọc tuyệt đối bởi các dấu $ ở hai đầu (ví dụ: $x^2$, $\frac{3}{4}$, $75\%$).
- Nếu tài liệu không đủ 12 câu hỏi trắc nghiệm, bạn hãy tự động sáng tạo thăng hoa thêm các câu hỏi trắc nghiệm toán học tương tự cùng chủ đề để lấp đầy trọn vẹn 12 trạm!

Trả về một mảng JSON các câu hỏi thạch đấu tương thích với schema trò chơi.`;
    } else if (challengeType === 'challenge2') {
      textPrompt = `Bạn là Game Master AI thiết kế câu hỏi thám hiểm toán học cho Giáo viên Phạm Văn Dũng.
Hãy đọc bóc tách tài liệu đính kèm (Word, PDF hoặc ảnh chụp đề) để bóc tách (OCR), biên dịch thành ĐÚNG 4 câu hỏi Đúng/Sai đặc biệt cho Thử thách 2 (phân khu Hang động, các Trạm từ 13 đến 16). Mỗi câu hỏi lớn ở trạm này bắt buộc có đúng 4 mệnh đề phụ a, b, c, d.

CẤU HÌNH & QUY TẮC ĐẶC BIỆT:
- Ý phụ nào ĐÚNG ("Đúng") sẽ được gạch chân kí tự a), b), c) hoặc d) trong tài liệu (ví dụ: gạch chân dưới kí tự hay kí tự được format underline như <u>a)</u>, <u>b)</u>, <u>c)</u>, <u>d)</u>). Ý phụ nào KHÔNG được gạch chân đại diện cho mệnh đề mang đáp án "Sai".
- Tài liệu đính kèm không cần lời giải giải thích. Lời giải chi tiết, mẫu mực cho các phán đoán tự động do bạn (AI) tự biên soạn hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- Mỗi câu hỏi phải có đúng 4 câu hỏi/mệnh đề phụ được cấu trúc trong mảng "subStatements". Mỗi "subStatement" gồm có "label" (ví dụ là "a)", "b)", "c)", "d)"), "text" (văn bản toán học, loại bỏ kí tự chỉ mục "a)" hoặc "a." ở đầu), và "correctAnswer" (nhận giá trị "Đúng" hoặc "Sai").
- Chuyển đổi mọi ký hiệu toán học, công thức, số đo sang định dạng LaTeX chuẩn và bọc tuyệt đối bởi các dấu $ ở hai đầu.
- Nếu tài liệu không đủ 4 câu hỏi, bạn hãy tự động sáng tạo thăng hoa thêm các câu hỏi toán học Đúng/Sai tương tự cùng chủ đề để lấp đầy trọn vẹn 4 trạm Đúng/Sai!

Trả về một mảng JSON các câu hỏi thạch đấu tương thích với schema trò chơi.`;
    } else if (challengeType === 'challenge3') {
      textPrompt = `Bạn là Game Master AI thiết kế câu hỏi thám hiểm toán học cho Giáo viên Phạm Văn Dũng.
Hãy đọc bóc tách tài liệu đính kèm (Word, PDF hoặc ảnh chụp đề) để bóc tách (OCR), biên dịch thành ĐÚNG 6 câu hỏi trả lời ngắn cho Thử thách 3 (phân khu Thung lũng sương mù, các Trạm từ 17 đến 22).

CẤU HÌNH & QUY TẮC ĐẶC BIỆT:
- ĐÁP ÁN của câu trả lời ngắn sẽ được ghi nhận phía dưới câu hỏi trong tài liệu đính kèm theo dạng: "Đáp án: [giá trị]". 
- Tài liệu đính kèm không cần lời giải giải thích. Lời giải toán học chi tiết từng bước truyền cảm hứng tự động do bạn (AI) tự viết hoàn toàn bằng tiếng Việt vào trường "explanation" của câu hỏi!
- QUY ĐỊNH BẮT BUỘC VỀ ĐÁP ÁN SỐ: Đáp án cho câu hỏi ngắn bắt buộc chỉ được chứa các chữ số đại diện cho số (có thể có dấu âm). 
- ĐẶC BIỆT: Nếu kết quả câu trả lời là Số thập phân, bạn BẮT BUỘC phải dùng dấu phẩy "," để ngăn cách phần thập phân (Ví dụ: "2,5" hoặc "3,14", tuyệt đối không được dùng dấu chấm "." như "2.5"). Trường "correctAnswer" và mảng "keywords" phải tuân thủ nghiêm ngặt quy định dấu phẩy này.
- Chuyển đổi mọi ký hiệu toán học, công thức, số đo sang định dạng LaTeX chuẩn và bọc tuyệt đối bởi các dấu $ ở hai đầu.
- Nếu tài liệu không đủ 6 câu hỏi tự luận ngắn, bạn hãy tự động sáng tạo thăng hoa thêm các câu hỏi toán học trả lời ngắn tương tự cùng chủ đề để đảm bảo đầy đủ 6 trạm!

Trả về một mảng JSON các câu hỏi thạch đấu tương thích với schema trò chơi.`;
    } else {
      textPrompt = `Bạn là Game Master AI đại tài trong hệ thống của Thầy Phạm Văn Dũng. Hãy đọc kĩ tài liệu đính kèm (hình ảnh, tài liệu PDF hoặc văn bản trích xuất học liệu) để bóc tách (OCR), biên tập và thiết kế thành ngân hàng câu hỏi mới gồm ĐÚNG 22 TRẠM thám hiểm toán học có độ khó tăng dần từ Trạm 1 đến Trạm 22:

Phân khu sinh cảnh cụ thể:
1. Trạm 1-12 (Phân khu Rừng rậm): Định dạng câu hỏi là Trắc nghiệm bốn đáp án (Multiple choice). Chỉ có 1 đáp án chính xác trong "options" được gạch chân kí tự A, B, C hoặc D.
   CHÚ Ý VỀ "options": Trong mảng "options", bạn tuyệt đối KHÔNG ĐƯỢC để các ký tự chữ cái đáp án đứng đầu như "A. ", "B. ", "C. ", "D. " hay "A) ", "B) ", "C) ", "D) ". Hãy chỉ trích xuất phần nội dung phía sau kí tự đó.
2. Trạm 13-16 (Phân khu Hang động): Định dạng câu hỏi Đúng / Sai (true-false) đặc biệt: mỗi trạm phải có đúng 4 câu hỏi/mệnh đề phụ được cấu trúc trong mảng "subStatements" của câu hỏi đó. Ý phụ mệnh đề nào đúng thì gạch chân kí tự a), b), c), d).
   CHÚ Ý VỀ "text" của subStatements: Bạn tuyệt đối KHÔNG ĐƯỢC lấy ký tự chỉ mục ở đầu, hãy chỉ trích xuất phần văn bản nội dung mệnh đề toán học thuần túy phía sau.
3. Trạm 17-22 (Phân khu Thung lũng sương mù): Định dạng Trả lời ngắn (short-answer). Đáp án viết dưới dạng "Đáp án: [số]". Nếu kết quả là số thập phân, bắt buộc dùng dấu phẩy "," làm ngăn cách thập phân (ví dụ: "2,5").

Chú ý ĐẶC BIỆT về ký hiệu Toán học:
- Mọi kí hiệu toán học, số đo, tỉ lệ, công thức, số mũ, căn thức, phương trình, biến số BẮT BUỘC PHẢI được chuyển đổi sang định dạng LaTeX chuẩn và bọc tuyệt đối bởi các dấu $ ở hai đầu để hệ thống hiển thị chính xác xuất sắc qua bộ gõ toán học KaTeX.
Lời giải tất cả trạm do bạn (AI) tự viết nếu tài liệu không cung cấp.

Trả về một mảng JSON 22 trạm chuẩn chỉnh theo đúng cấu trúc Schema quy định.`;
    }

    if (extractedText) {
      contents = [
        `Nội dung văn bản trích xuất từ file của giáo viên:\n"""\n${extractedText}\n"""\n\n${textPrompt}`
      ];
    } else {
      const filePart = {
        inlineData: {
          mimeType: mimeType,
          data: fileBase64,
        }
      };
      contents = [
        filePart,
        { text: textPrompt }
      ];
    }

    const response = await generateContentWithRetry(aiClient, {
      model: reqModel,
      contents: contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: getResponseSchema(challengeType),
        temperature: 0.5,
      }
    });

    const parsed = JSON.parse(response.text || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      customQuestionsBank = mergeQuestionsIntoBank(parsed, challengeType);
      isGameActive = true;
      res.json({ success: true, questions: customQuestionsBank });
    } else {
      res.status(500).json({ error: 'Không thể phân tích định dạng JSON từ AI.' });
    }
  } catch (error: any) {
    console.error("Gemini File OCR Error:", error);
    res.status(500).json({ error: error.message || 'Gặp lỗi trong quá trình bóc tách OCR từ file.' });
  }
});

// 9. Gemini: Analyze student performance dashboard & output report suggestions
app.post('/api/gemini/generate-report-suggestions', async (req: Request, res: Response) => {
  const aiClient = getGeminiClient(req);
  const reqModel = req.headers['x-gemini-model'] as string || 'gemini-2.5-flash';

  if (!aiClient) {
    // Return markdown statically
    res.json({
      report: `### BÁO CÁO HÀNH TRÌNH TRUY TÌM KHO BÁU
- **Tổng số học sinh tham gia:** ${studentLogs.length} em  
- **Trạm khó nhất:** Trạm 13 & Trạm 19 (Có tỷ lệ sai cao nhất do dạng câu hỏi Đúng/Sai và Trả lời ngắn)  
- **Thời gian trung bình:** 12.9 phút  
- **Top Nhà thám hiểm:**  
  1. Trần Minh Quân (220 điểm | 10.1 phút)  
  2. Nguyễn Văn An (220 điểm | 12.5 phút)  
  3. Phạm Thị Bình (200 điểm | 16.2 phút)  

- **Đề xuất từ AI:**  
  - Học sinh có hiệu suất làm trắc nghiệm rất tốt ở phân khu "Rừng rậm" (Trạm 1-12).  
  - Tuy nhiên, các em lại dễ bị nhầm lẫn ở các câu hỏi phân loại hình học đúng sai trong "Hang động" và chưa quen với định dạng điền chính xác số đo ở phần "Thung lũng sương mù" (Trạm 17-22).  
  - Giáo viên Phạm Văn Dũng nên tổ chức một buổi ôn tập chuyên đề về hình học không gian (diện tích toàn phần hình lập phương, công thức diện tích hình tròn) và tăng cường bài tập rèn luyện kỹ năng tự ghi đáp số tự luận ngắn.`
    });
    return;
  }

  try {
    const logsString = JSON.stringify(studentLogs);
    const prompt = `Dưới đây là mảng dữ liệu logs hoạt động của các học sinh trong trò chơi toán học 2D "Truy tìm kho báu" do giáo viên "Phạm Văn Dũng" giảng dạy:
${logsString}

Dựa trên dữ liệu trên, hãy viết một bản Báo cáo Phân tích Dashboard thông minh theo đúng cấu trúc đầu ra (Output Format B) sau:

### BÁO CÁO HÀNH TRÌNH TRUY TÌM KHO BÁU
- **Tổng số học sinh tham gia:** [Tính toán số lượng học sinh thực tế]
- **Trạm khó nhất:** [Xác định trạm có tỉ lệ hoặc lượng câu trả lời sai cao nhất]
- **Thời gian trung bình:** [Số phút trung bình tính từ logs]
- **Top Nhà thám hiểm:** [Danh sách tên + điểm sắp xếp thời gian làm nhanh nhất]
- **Đề xuất từ AI:** [Gợi ý giáo viên ôn tập lại kiến thức vùng nào cho học sinh dộc sâu, đưa ra lời khuyên thực tế bằng tiếng Việt khoa học nhưng tận tâm]

Lưu ý: Bạn hãy tính toán trực quan dựa trên logs và đưa ra đề xuất sâu sắc, có trách nhiệm.`;

    const response = await generateContentWithRetry(aiClient, {
      model: reqModel,
      contents: prompt,
      config: {
        temperature: 0.6,
      }
    });

    res.json({ report: response.text?.trim() });
  } catch (error: any) {
    console.error("Gemini Report Generation Error:", error);
    res.json({
      report: `### BÁO CÁO HÀNH TRÌNH TRUY TÌM KHO BÁU
- **Tổng số học sinh tham gia:** ${studentLogs.length} học sinh  
- **Trạm khó nhất:** Trạm 19 (Độ dài cạnh hình lập phương diện tích 150cm2)  
- **Thời gian trung bình:** 11.2 phút  
- **Top Nhà thám hiểm:**  
  1. Trần Minh Quân - 220 điểm  
  2. Nguyễn Văn An - 220 điểm  
- **Đề xuất từ AI:** Đăng ký thi đua học tập sôi nổi! Giáo viên nên chú ý ôn thêm về tìm ẩn số x và diện tích toàn phần của các khối đa diện lớp 6.`
    });
  }
});

// Vite server integrations as middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OK] Server running on http://localhost:${PORT}`);
  });
}

startServer();
