import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Settings, 
  Users, 
  HelpCircle, 
  Sparkles, 
  MapPin, 
  Tv2, 
  ShieldCheck, 
  Lock, 
  BookOpen, 
  RefreshCw,
  Check
} from 'lucide-react';
import StudentAdventure from './components/StudentAdventure';
import TeacherPanel from './components/TeacherPanel';
import { Question } from './types';

export default function App() {
  const [currentRole, setCurrentRole] = useState<'student' | 'teacher'>('student');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGameActive, setIsGameActive] = useState(false);
  const [gameTimeLimit, setGameTimeLimit] = useState<number>(30); // Default to 30 minutes, 0 means unlimited
  const [part1Count, setPart1Count] = useState<number>(12);
  const [part2Count, setPart2Count] = useState<number>(4);
  const [part3Count, setPart3Count] = useState<number>(6);
  const [loading, setLoading] = useState(true);
  const [teacherPass, setTeacherPass] = useState('');
  const [teacherAuthenticated, setTeacherAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem('gemini_api_model') || 'gemini-2.5-flash');
  const [modalKeyInput, setModalKeyInput] = useState(geminiApiKey);
  const [modalModelInput, setModalModelInput] = useState(geminiModel);

  // Sync modal inputs when states change
  useEffect(() => {
    setModalKeyInput(geminiApiKey);
  }, [geminiApiKey]);

  useEffect(() => {
    setModalModelInput(geminiModel);
  }, [geminiModel]);

  // Mandatory modal if key is missing
  useEffect(() => {
    if (!geminiApiKey) {
      setShowApiKeyModal(true);
    }
  }, [geminiApiKey]);

  // Settle question template downloads on mount
  const loadQuestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/questions');
      const text = await response.text();
      // Check if it is JSON
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        const data = JSON.parse(text);
        if (data.questions) {
          setQuestions(data.questions);
          localStorage.setItem('custom_questions', JSON.stringify(data.questions));
        }
        if (typeof data.isGameActive === 'boolean') {
          setIsGameActive(data.isGameActive);
          localStorage.setItem('game_active', String(data.isGameActive));
        }
        if (typeof data.gameTimeLimit === 'number') {
          setGameTimeLimit(data.gameTimeLimit);
          localStorage.setItem('game_time_limit', String(data.gameTimeLimit));
        }
        if (typeof data.part1Count === 'number') {
          setPart1Count(data.part1Count);
        }
        if (typeof data.part2Count === 'number') {
          setPart2Count(data.part2Count);
        }
        if (typeof data.part3Count === 'number') {
          setPart3Count(data.part3Count);
        }
      } else {
        throw new Error("Response is not JSON (Vercel SPA rewrite fallback)");
      }
    } catch (err) {
      console.warn("Express server not available or failed. Loading from localStorage/default questions:", err);
      const storedQuestions = localStorage.getItem('custom_questions');
      if (storedQuestions) {
        setQuestions(JSON.parse(storedQuestions));
      } else {
        const { defaultQuestions } = await import('./defaultQuestions');
        setQuestions(defaultQuestions);
        localStorage.setItem('custom_questions', JSON.stringify(defaultQuestions));
      }

      const storedActive = localStorage.getItem('game_active');
      setIsGameActive(storedActive === 'true');

      const storedTimeLimit = localStorage.getItem('game_time_limit');
      if (storedTimeLimit) {
        setGameTimeLimit(Number(storedTimeLimit));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const handleUpdateQuestionsInBank = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
    setIsGameActive(true); // Any new custom questions uploaded / compiled from file instantly activates the game!
    localStorage.setItem('custom_questions', JSON.stringify(newQuestions));
    localStorage.setItem('game_active', 'true');
    // Sync updated questions to server backend for full persistence and alignment
    fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: newQuestions })
    }).catch(console.error);
    syncGameStatusToBackend(true);
  };

  const syncGameStatusToBackend = async (newActive: boolean) => {
    setIsGameActive(newActive);
    localStorage.setItem('game_active', String(newActive));
    try {
      await fetch('/api/game-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newActive })
      });
    } catch (err) {
      console.warn("Express server offline. Status saved locally:", err);
    }
  };

  const syncGameTimeLimitToBackend = async (newLimit: number) => {
    setGameTimeLimit(newLimit);
    localStorage.setItem('game_time_limit', String(newLimit));
    try {
      await fetch('/api/game-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeLimit: newLimit })
      });
    } catch (err) {
      console.warn("Express server offline. Time limit saved locally:", err);
    }
  };

  const syncGameConfigToBackend = async (p1: number, p2: number, p3: number) => {
    setPart1Count(p1);
    setPart2Count(p2);
    setPart3Count(p3);
    
    // Attempt local rebuild fallback if offline
    let rebuiltLocal = false;
    try {
      const response = await fetch('/api/game-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p1, p2, p3 })
      });
      const text = await response.text();
      if (text.trim().startsWith('{')) {
        const data = JSON.parse(text);
        if (data.success) {
          if (data.questions) {
            setQuestions(data.questions);
            localStorage.setItem('custom_questions', JSON.stringify(data.questions));
          }
          rebuiltLocal = true;
        }
      }
    } catch (err) {
      console.warn("Express server offline. Processing config locally:", err);
    }

    if (!rebuiltLocal) {
      // Local rebuild simulation
      const storedQuestions = localStorage.getItem('custom_questions');
      let baseQuestions: Question[] = [];
      if (storedQuestions) {
        baseQuestions = JSON.parse(storedQuestions);
      } else {
        const { defaultQuestions } = await import('./defaultQuestions');
        baseQuestions = defaultQuestions;
      }
      
      let mcQuestions = baseQuestions.filter(q => q.type === 'multiple-choice');
      let tfQuestions = baseQuestions.filter(q => q.type === 'true-false');
      let saQuestions = baseQuestions.filter(q => q.type === 'short-answer');

      const selectedMC = [];
      for (let i = 0; i < p1; i++) {
        selectedMC.push(mcQuestions[i % mcQuestions.length] || mcQuestions[0]);
      }
      const selectedTF = [];
      for (let i = 0; i < p2; i++) {
        selectedTF.push(tfQuestions[i % tfQuestions.length] || tfQuestions[0]);
      }
      const selectedSA = [];
      for (let i = 0; i < p3; i++) {
        selectedSA.push(saQuestions[i % saQuestions.length] || saQuestions[0]);
      }

      const newBank: Question[] = [];
      let stationIndex = 1;
      selectedMC.forEach(q => newBank.push({ ...q, station: stationIndex++, landscape: 'Rừng rậm', type: 'multiple-choice' }));
      selectedTF.forEach(q => newBank.push({ ...q, station: stationIndex++, landscape: 'Hang động', type: 'true-false' }));
      selectedSA.forEach(q => newBank.push({ ...q, station: stationIndex++, landscape: 'Thung lũng sương mù', type: 'short-answer' }));

      setQuestions(newBank);
      localStorage.setItem('custom_questions', JSON.stringify(newBank));
    }
  };

  const handleTeacherLogIn = (e: React.FormEvent) => {
    e.preventDefault();
    const customStoredPass = localStorage.getItem('teacher_password');
    const entered = teacherPass.trim();
    
    let isCorrect = false;
    if (customStoredPass) {
      isCorrect = (entered === customStoredPass);
    } else {
      isCorrect = (entered.toUpperCase() === 'DUNGMATH' || entered === '123456');
    }

    if (isCorrect) {
      setTeacherAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Mật khẩu quản trị chưa chính xác! Vui lòng liên hệ Thầy Phạm Văn Dũng.');
    }
  };

  const handleSaveApiKey = (key: string, model: string) => {
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('gemini_api_model', model);
    setGeminiApiKey(key);
    setGeminiModel(model);
    setShowApiKeyModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-emerald-500 selection:text-white pb-12 transition">
      
      {/* Decorative top ambient flow */}
      <div className="w-full bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-800 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo / Title Brand area */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 text-slate-950 flex items-center justify-center rounded-xl shadow-inner font-black text-xl animate-spin-slow">
              ⭐
            </div>
            <div className="text-left">
              <h1 className="text-lg md:text-xl font-display font-black tracking-tight flex items-center gap-1.5 uppercase">
                Truy Tìm Kho Báu Toán Học
                <span className="bg-yellow-400 text-slate-950 text-[10px] font-bold py-0.5 px-2 rounded-full normal-case tracking-normal">2D Game</span>
              </h1>
              <p className="text-[10px] text-emerald-100 font-medium">Hệ Thống Phối Hợp Giáo Dục Trực Tuyến & Master AI Agent</p>
            </div>
          </div>

          {/* Quick Role switches & Settings */}
          <div className="flex flex-wrap items-center justify-end gap-4 shrink-0">
            {/* API Key settings button with red instructions label under or next to it */}
            <div className="flex flex-col items-center sm:items-end">
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-350 text-slate-950 font-black py-1.5 px-3 rounded-lg text-xs transition cursor-pointer shadow-sm select-none"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Cấu hình API Key</span>
              </button>
              <a
                href="https://aistudio.google.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-red-300 hover:text-red-200 font-extrabold underline mt-1 animate-pulse"
              >
                Lấy API key để sử dụng app
              </a>
            </div>

            <div className="flex bg-black/25 relative p-1 rounded-xl border border-white/10 select-none">
              <button
                onClick={() => setCurrentRole('student')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentRole === 'student'
                    ? 'bg-white text-slate-950 shadow font-extrabold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <span>🎮 Học Sinh Chơi</span>
              </button>
              <button
                onClick={() => setCurrentRole('teacher')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentRole === 'teacher'
                    ? 'bg-white text-slate-950 shadow font-extrabold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <span>🏫 Giáo Viên Quản Trị</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {loading ? (
        /* Global Fallback Loader spinner */
        <div className="flex flex-col items-center justify-center py-32 gap-3 max-w-sm mx-auto">
          <RefreshCw className="w-10 h-10 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-mono italic">Đang tải cấu phông ngân hàng 22 trạm toán học từ máy chủ...</p>
        </div>
      ) : (
        /* Dynamic Screen Router */
        <main className="transition duration-150">
          {currentRole === 'student' ? (
            /* Student play screen area */
            <StudentAdventure 
              questions={questions}
              isGameActive={isGameActive}
              gameTimeLimit={gameTimeLimit}
              onGameFinished={(score, state) => {
                console.log("Game finished callback received:", score, state);
              }}
              onRefreshGameStatus={loadQuestions}
            />
          ) : (
            /* Teacher dashboard guard screen or authenticated board */
            <div className="max-w-6xl mx-auto px-4 mt-6">
              {!teacherAuthenticated ? (
                /* Authenticated lock gateway */
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border p-8 max-w-md mx-auto shadow-lg text-center mt-12 space-y-6"
                >
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <Lock className="w-8 h-8" />
                  </div>

                  <div>
                    <h3 className="text-xl font-display font-bold text-slate-950">Xác Minh Danh Tính Giáo Viên</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Vui lòng nhập mật khẩu quản lý học liệu của <b>Thầy Phạm Văn Dũng</b> để tiếp tục.
                    </p>
                  </div>

                  <form onSubmit={handleTeacherLogIn} className="space-y-4 text-left">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mật khẩu giáo viên</label>
                      <input
                        type="password"
                        placeholder="Nhập DUNGMATH hoặc mật khẩu mới của Thầy"
                        value={teacherPass}
                        onChange={(e) => setTeacherPass(e.target.value)}
                        className="w-full border rounded-xl py-2.5 px-4 text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                        autoFocus
                      />
                    </div>

                    {authError && (
                      <p className="text-red-600 text-xs font-semibold bg-red-50 p-2.5 rounded-lg border border-red-100">
                        {authError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      Bảo mộc đăng nhập
                    </button>
                  </form>

                  <div className="pt-4 border-t border-slate-100 text-[10px] text-rose-500 font-bold bg-rose-50 p-2.5 rounded-lg">
                    🔒 Khu vực hạn chế: Chỉ dành riêng cho Giáo viên Phạm Văn Dũng quản trị chuyên môn. Học sinh không được phép truy cập vào mục này.
                  </div>
                </motion.div>
              ) : (
                /* Authenticated Teacher Panel board content */
                <TeacherPanel 
                  questions={questions}
                  isGameActive={isGameActive}
                  gameTimeLimit={gameTimeLimit}
                  part1Count={part1Count}
                  part2Count={part2Count}
                  part3Count={part3Count}
                  onUpdateQuestions={handleUpdateQuestionsInBank}
                  onChangeGameActive={syncGameStatusToBackend}
                  onChangeGameTimeLimit={syncGameTimeLimitToBackend}
                  onChangeGameConfig={syncGameConfigToBackend}
                />
              )}
            </div>
          )}
        </main>
      )}

      {/* Shared human footer */}
      <footer className="mt-16 text-center text-[11px] text-slate-400 space-y-1 font-medium select-none">
        <p>© 2026 Bản quyền phân hiệu thuộc về Giáo viên Toán học: <b>Phạm Văn Dũng</b></p>
        <p className="text-slate-300">Vận hành đồng bộ bởi AI Game Master Central Gateway • Server Fullstack Ready</p>
      </footer>

      {/* Modal Cấu hình API Key & Model Selection */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-6 relative overflow-hidden"
            >
              {/* Force header message if key is missing */}
              {!geminiApiKey && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-rose-800 text-[11.5px] font-semibold leading-relaxed flex items-start gap-2">
                  <span className="text-base leading-none">⚠️</span>
                  <div>
                    <span className="font-extrabold uppercase text-[10px] block mb-0.5 text-rose-950">Chưa cấu hình API Key</span>
                    Vui lòng nhập API Key để bắt đầu sử dụng các tính năng thông minh của ứng dụng. Bạn có thể lấy khóa miễn phí tại Google AI Studio.
                  </div>
                </div>
              )}

              {/* Close Button - Only show if already have an API Key configured */}
              {geminiApiKey && (
                <button
                  onClick={() => {
                    setModalKeyInput(geminiApiKey);
                    setModalModelInput(geminiModel);
                    setShowApiKeyModal(false);
                  }}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition font-bold text-lg p-1.5 cursor-pointer"
                >
                  ✕
                </button>
              )}

              <div className="space-y-1">
                <h3 className="text-lg font-display font-black text-slate-950 flex items-center gap-1.5 uppercase">
                  ⚙️ Thiết lập Gemini AI Key & Model
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Cấu hình này sẽ được lưu ở localStorage của trình duyệt và dùng trực tiếp cho các tác vụ AI.
                </p>
              </div>

              {/* Model Cards */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">1. Chọn Model AI</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash', note: 'Flash (Default)' },
                    { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', note: 'Pro (Stable)' },
                    { id: 'gemini-3.5-flash', label: 'gemini-3.5-flash', note: 'Flash 3.5 (Preview)' }
                  ].map(m => {
                    const isSelected = modalModelInput === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModalModelInput(m.id)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition cursor-pointer select-none ${
                          isSelected 
                            ? 'border-slate-950 bg-slate-950 text-white shadow-md' 
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="text-[11px] font-extrabold">{m.label}</span>
                        <span className={`text-[8.5px] font-semibold mt-0.5 ${isSelected ? 'text-yellow-400' : 'text-slate-400'}`}>
                          {m.note}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* API Key Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">2. Nhập API Key</label>
                  <a
                    href="https://aistudio.google.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10.5px] text-emerald-600 hover:text-emerald-700 font-extrabold underline flex items-center gap-0.5"
                  >
                    Lấy API key tại đây ↗
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={modalKeyInput}
                  onChange={(e) => setModalKeyInput(e.target.value.trim())}
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!modalKeyInput) {
                    alert('Vui lòng nhập API Key để sử dụng.');
                    return;
                  }
                  handleSaveApiKey(modalKeyInput, modalModelInput);
                }}
                className="w-full bg-slate-950 hover:bg-slate-850 text-white font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Lưu cấu hình & Bắt đầu</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
