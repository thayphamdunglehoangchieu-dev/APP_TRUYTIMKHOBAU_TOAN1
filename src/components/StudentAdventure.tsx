import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  ShieldAlert, 
  Heart, 
  MapPin, 
  Sparkles, 
  Wand2, 
  Sword, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw, 
  Clock, 
  Flame, 
  User, 
  Award, 
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Volume2,
  VolumeX,
  Music
} from 'lucide-react';
import { Question, PlayerInventory, PlayerState } from '../types';
import { callGeminiDirectly } from '../utils/geminiClient';
import { MathAndImageRenderer } from './MathAndImageRenderer';

// Web Audio API Synthesizer specifically crafted for a 2D Retro Treasure Hunt Game
class TreasureSynthPlayer {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private intervalId: any = null;
  private currentStep: number = 0;
  
  // Pirate Adventure Swing Melody - Yo Ho Ho melody in A minor (A, B, C, D, E, F...)
  private melody = [57, 60, 60, 60, 64, 60, 64, 60, 65, 64, 62, 59, 57, 60, 60, 60];

  start() {
    if (this.isPlaying) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isPlaying = true;
      this.currentStep = 0;
      this.playLoop();
    } catch (e) {
      console.warn("Web Audio API is not supported or blocked: ", e);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
    }
  }

  private mtof(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  private playLoop() {
    const tick = () => {
      if (!this.isPlaying || !this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const note = this.melody[this.currentStep % this.melody.length];
      const time = this.ctx.currentTime;
      
      // Plucked string synthesizer
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.mtof(note), time);
      
      // Lowpass resonant sweep for underwater sound feel
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, time);
      filter.frequency.exponentialRampToValueAtTime(150, time + 0.35);

      gain.gain.setValueAtTime(0.05, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.45);

      // Sea wind noise sweep simulation
      if (this.currentStep % 8 === 0) {
        this.playWindSweep();
      }

      this.currentStep++;
    };

    tick();
    this.intervalId = setInterval(tick, 450); // 133 BPM
  }

  private playWindSweep() {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
      noiseFilter.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.6);
      noiseFilter.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 1.3);
      noiseFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      noiseGain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.3);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start();
      noise.stop(this.ctx.currentTime + 1.4);
    } catch (e) {}
  }

  // Interactive SFX hits
  playVictory() {
    if (!this.ctx) return;
    try {
      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, time); // C5
      osc.frequency.setValueAtTime(659.25, time + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, time + 0.16); // G5
      osc.frequency.setValueAtTime(1046.50, time + 0.24); // C6
      
      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + 0.65);
    } catch (e) {}
  }

  playDefeat() {
    if (!this.ctx) return;
    try {
      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240.00, time); // B3
      osc.frequency.linearRampToValueAtTime(110.00, time + 0.4); // slide down
      
      gain.gain.setValueAtTime(0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + 0.5);
    } catch (e) {}
  }
}

interface StudentAdventureProps {
  questions: Question[];
  isGameActive: boolean;
  gameTimeLimit?: number;
  onGameFinished: (finalScore: number, finalState: PlayerState) => void;
  onRefreshGameStatus?: () => void;
}

export default function StudentAdventure({ 
  questions, 
  isGameActive, 
  gameTimeLimit = 30,
  onGameFinished, 
  onRefreshGameStatus 
}: StudentAdventureProps) {
  // Define dynamic total stations based on question bank size
  const totalStations = questions.length > 0 ? questions.length : 22;

  // 1. Initial State Setup
  const [isPlaying, setIsPlaying] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [gameState, setGameState] = useState<PlayerState>({
    name: '',
    className: '',
    currentStation: 1,
    points: 0,
    energy: 5,
    inventory: {
      magicWand: 2,
      bowArrow: 1,
      divineShield: 1
    },
    startTime: 0,
    endTime: null,
    history: []
  });

  // Current Question state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [tfAnswers, setTfAnswers] = useState<Record<string, 'Đúng' | 'Sai'>>({});
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [glowingRayEffect, setGlowingRayEffect] = useState(false);

  // Help State
  const [fiftyFiftyUsed, setFiftyFiftyUsed] = useState(false);
  const [eliminatedIndexes, setEliminatedIndexes] = useState<number[]>([]);

  // AI Hint state
  const [aiHintText, setAiHintText] = useState('');
  const [loadingHint, setLoadingHint] = useState(false);

  // Sparkles / Battles trigger
  const [battleAnimation, setBattleAnimation] = useState<'idle' | 'attack' | 'hit' | 'victory'>('idle');
  const [chestOpened, setChestOpened] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer run effect
  useEffect(() => {
    let timerId: any;
    if (isPlaying && gameState.currentStation <= totalStations && gameState.energy > 0) {
      timerId = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - gameState.startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [isPlaying, gameState.startTime, gameState.currentStation, gameState.energy, totalStations]);

  // Current stage details
  const [localQuestions, setLocalQuestions] = useState<Question[]>([]);
  const activeQuestions = localQuestions.length > 0 ? localQuestions : questions;
  const currentQuestionIndex = activeQuestions.findIndex(q => q.station === gameState.currentStation);
  const currentQuestion = currentQuestionIndex !== -1 ? activeQuestions[currentQuestionIndex] : null;

  // Track station specific failures
  const [attemptsThisStation, setAttemptsThisStation] = useState(0);

  // Treasure audio variables
  const synthRef = useRef<TreasureSynthPlayer | null>(null);
  const [retroMusicOn, setRetroMusicOn] = useState(false);
  const [sfxOn, setSfxOn] = useState(true);

  // Initialize synth player and safely clean it up on unmount
  useEffect(() => {
    synthRef.current = new TreasureSynthPlayer();
    return () => {
      synthRef.current?.stop();
    };
  }, []);

  // Control start/stop based on music toggle state
  useEffect(() => {
    if (retroMusicOn) {
      synthRef.current?.start();
    } else {
      synthRef.current?.stop();
    }
  }, [retroMusicOn]);

  // Initialize gameplay
  const handleStartGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên của bạn.');
      return;
    }
    if (!studentClass.trim()) {
      setErrorMsg('Vui lòng nhập tên lớp của bạn.');
      return;
    }
    setErrorMsg('');

    // Shuffling helper
    const shuffleArray = <T,>(array: T[]): T[] => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // Segregate questions to keep progression balanced based on their landscape / part types
    const rungRam = questions.filter(q => q.landscape === 'Rừng rậm' || q.type === 'multiple-choice');
    const hangDong = questions.filter(q => q.landscape === 'Hang động' || q.type === 'true-false');
    const suongMu = questions.filter(q => q.landscape === 'Thung lũng sương mù' || q.type === 'short-answer');

    const shuffledRungRam = shuffleArray(rungRam);
    const shuffledHangDong = shuffleArray(hangDong);
    const shuffledSuongMu = shuffleArray(suongMu);

    // Shuffle multiple choice option positions to prevent neighbor-based cheating - DISABLED BY USER REQUEST
    const processQuestion = (q: Question) => {
      return q;
    };

    const readyRungRam = shuffledRungRam.map(processQuestion);
    const readyHangDong = shuffledHangDong.map(processQuestion);
    const readySuongMu = shuffledSuongMu.map(processQuestion);

    // Re-assign stations sequentially starting from 1 up to total stations
    let nextStation = 1;
    const finalShuffledList: Question[] = [];
    readyRungRam.forEach((q) => {
      finalShuffledList.push({ ...q, station: nextStation++ });
    });
    readyHangDong.forEach((q) => {
      finalShuffledList.push({ ...q, station: nextStation++ });
    });
    readySuongMu.forEach((q) => {
      finalShuffledList.push({ ...q, station: nextStation++ });
    });

    setLocalQuestions(finalShuffledList);

    setGameState({
      name: studentName.trim(),
      className: studentClass.trim(),
      currentStation: 1,
      points: 0,
      energy: 5,
      inventory: {
        magicWand: 2,
        bowArrow: 1,
        divineShield: 1
      },
      startTime: Date.now(),
      endTime: null,
      history: []
    });
    setElapsedTime(0);
    setAttemptsThisStation(0);
    setFiftyFiftyUsed(false);
    setEliminatedIndexes([]);
    setSelectedOption(null);
    setShortAnswerInput('');
    setTfAnswers({});
    setIsAnswered(false);
    setAiHintText('');
    setBattleAnimation('idle');
    setIsPlaying(true);
  };

  // Skip options check / help logic
  const handleFiftyFifty = () => {
    if (!currentQuestion || currentQuestion.type !== 'multiple-choice') return;
    if (gameState.inventory.magicWand <= 0 && gameState.inventory.bowArrow <= 0) return;

    // Expend item
    const nextInventory = { ...gameState.inventory };
    if (nextInventory.magicWand > 0) {
      nextInventory.magicWand -= 1;
    } else {
      nextInventory.bowArrow -= 1;
    }

    setGameState(prev => ({ ...prev, inventory: nextInventory }));
    setFiftyFiftyUsed(true);

    // Filter to find 2 wrong options to eliminate
    const wrongIndexes: number[] = [];
    currentQuestion.options?.forEach((opt, idx) => {
      if (opt !== currentQuestion.correctAnswer) {
        wrongIndexes.push(idx);
      }
    });

    // Pick 2 random wrong options
    const toEliminate = wrongIndexes.sort(() => 0.5 - Math.random()).slice(0, 2);
    setEliminatedIndexes(toEliminate);
  };

  // Submit Answer
  const handleAnswerSubmit = async () => {
    if (!currentQuestion || isAnswered) return;

    let studentAnswer = '';
    let isAnswerCorrect = false;

    if (currentQuestion.type === 'multiple-choice') {
      if (!selectedOption) return;
      studentAnswer = selectedOption;
      isAnswerCorrect = selectedOption === currentQuestion.correctAnswer;
    } else if (currentQuestion.type === 'true-false') {
      if (currentQuestion.subStatements && currentQuestion.subStatements.length > 0) {
        // Need to answer all subStatements
        const unresolved = currentQuestion.subStatements.some(sub => !tfAnswers[sub.label]);
        if (unresolved) return;

        isAnswerCorrect = currentQuestion.subStatements.every(sub => tfAnswers[sub.label] === sub.correctAnswer);
        const correctCount = currentQuestion.subStatements.filter(sub => tfAnswers[sub.label] === sub.correctAnswer).length;
        
        studentAnswer = currentQuestion.subStatements.map(sub => `${sub.label}: ${tfAnswers[sub.label]}`).join(', ');
        
        if (isAnswerCorrect) {
          setFeedbackMsg(`Xuất sắc! Bạn đã xác định chính xác tất cả ${currentQuestion.subStatements.length} phán đoán.`);
        } else {
          setFeedbackMsg(`Rất tiếc! Bạn mới chỉ xác định đúng ${correctCount}/${currentQuestion.subStatements.length} phán đoán.`);
        }
      } else {
        if (!selectedOption) return;
        studentAnswer = selectedOption;
        isAnswerCorrect = selectedOption.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
      }
    } else {
      if (!shortAnswerInput.trim()) return;
      studentAnswer = shortAnswerInput.trim();
      
      const isNumericEqual = (val1: string, val2: string): boolean => {
        const norm1 = val1.replace(',', '.').replace(/\s+/g, '');
        const norm2 = val2.replace(',', '.').replace(/\s+/g, '');
        const num1 = parseFloat(norm1);
        const num2 = parseFloat(norm2);
        if (!isNaN(num1) && !isNaN(num2)) {
          return num1 === num2;
        }
        return false;
      };

      // Numeric comparison
      const isNumericMatch = isNumericEqual(studentAnswer, currentQuestion.correctAnswer) ||
        (currentQuestion.keywords || []).some(kw => isNumericEqual(studentAnswer, kw));

      // Fuzzy word matching
      const cleanAnswer = studentAnswer.toLowerCase().replace(/\s+/g, '');
      const cleanCorrectAnswer = currentQuestion.correctAnswer.toLowerCase().replace(/\s+/g, '');
      
      const matchedKeyword = currentQuestion.keywords?.some(kw => {
        return cleanAnswer.includes(kw.toLowerCase().replace(/\s+/g, '')) ||
               kw.toLowerCase().replace(/\s+/g, '').includes(cleanAnswer);
      });

      isAnswerCorrect = cleanAnswer === cleanCorrectAnswer || !!matchedKeyword || isNumericMatch;
    }

    setIsAnswered(true);
    setIsCorrect(isAnswerCorrect);

    if (isAnswerCorrect) {
      if (sfxOn) synthRef.current?.playVictory();
      // 1. Correct behavior
      const pointsEarned = 10;
      let rewardItem: keyof PlayerInventory | null = null;
      
      // Every correct station rewards a random item
      const itemRoll = Math.random();
      if (itemRoll < 0.4) {
        rewardItem = 'magicWand';
      } else if (itemRoll < 0.7) {
        rewardItem = 'bowArrow';
      } else {
        rewardItem = 'divineShield';
      }

      setGameState(prev => {
        const updatedInventory = { ...prev.inventory };
        if (rewardItem) {
          updatedInventory[rewardItem] += 1;
        }
        return {
          ...prev,
          points: prev.points + pointsEarned,
          inventory: updatedInventory,
        };
      });

      setFeedbackMsg(`Xuất sắc! Bạn đã trả lời hoàn toàn chính xác.`);
      
      // Landscape effects triggers
      if (currentQuestion.landscape === 'Rừng rậm') {
        setBattleAnimation('attack');
        setTimeout(() => setBattleAnimation('hit'), 400);
        setTimeout(() => setBattleAnimation('victory'), 1000);
      } else if (currentQuestion.landscape === 'Hang động') {
        setGlowingRayEffect(true);
      }

      setAttemptsThisStation(0);
    } else {
      if (sfxOn) synthRef.current?.playDefeat();
      // 2. Incorrect behavior
      setAttemptsThisStation(prev => prev + 1);
      
      // Divine Shield consumption check
      let energyDeducted = 1;
      let shieldAbsorbed = false;

      if (gameState.inventory.divineShield > 0) {
        // Divine Shield protects player
        setGameState(prev => ({
          ...prev,
          inventory: {
            ...prev.inventory,
            divineShield: prev.inventory.divineShield - 1
          }
        }));
        energyDeducted = 0;
        shieldAbsorbed = true;
      }

      setGameState(prev => ({
        ...prev,
        energy: Math.max(0, prev.energy - energyDeducted)
      }));

      const shieldText = shieldAbsorbed 
        ? "🛡️ [KHIÊN THẦN] đã kích hoạt! Bạn không bị tổn hao sinh lực." 
        : "💔 Bạn đã bị mất 1 Năng lượng sinh tồn.";

      setFeedbackMsg(`Câu trả lời chưa chính xác. ${shieldText}`);

      // Call Gemini Game Master API to fetch custom hint
      setLoadingHint(true);
      try {
        const userKey = localStorage.getItem('gemini_api_key') || '';
        const userModel = localStorage.getItem('gemini_api_model') || 'gemini-3-flash-preview';

        let hintText = '';
        let fetchedFromServer = false;

        try {
          const response = await fetch('/api/gemini/get-hint', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-gemini-key': userKey,
              'x-gemini-model': userModel
            },
            body: JSON.stringify({
              questionText: currentQuestion.questionText,
              studentAnswer,
              category: currentQuestion.landscape,
              station: currentQuestion.station
            })
          });
          const text = await response.text();
          if (text.trim().startsWith('{')) {
            const data = JSON.parse(text);
            hintText = data.hint || '';
            fetchedFromServer = true;
          }
        } catch (e) {
          console.warn("Express server hint failed, calling Gemini directly:", e);
        }

        if (!fetchedFromServer && userKey) {
          const directPrompt = `Bạn là Hệ thống Trí tuệ Nhân tạo Trung tâm (Game Master AI) dẫn dắt trò chơi "Truy tìm kho báu" do giáo viên Phạm Văn Dũng quản trị. 
Học sinh trong vai "Nhà thám hiểm" đã trả lời SAI câu hỏi toán học tại Trạm ${currentQuestion.station} (${currentQuestion.landscape || 'Kiến thức chung'}).

Câu hỏi: "${currentQuestion.questionText}"
Học sinh trả lời sai là: "${studentAnswer}"

Nhiệm vụ của bạn:
1. Đưa ra gợi ý thông minh (AI Hint), khích lệ, khơi dậy suy nghĩ, tuyệt đối không đưa ra đáp án trực tiếp.
2. Viết bằng tiếng Việt trong sáng, đầy cảm hứng, gần gũi với học sinh tiểu học/trung học (Ví dụ xưng hô: "Nhà thám hiểm ơi...", "Đừng nản chí nhé...").
3. Hãy ngắn gọn, súc tích (tầm 2-3 câu). Giữ bản quyền ghi nhận "Giáo viên: Phạm Văn Dũng" nếu phù hợp một cách tế nhị.`;

          hintText = await callGeminiDirectly({
            contents: directPrompt,
            userKey,
            userModel,
            temperature: 0.8
          });
        }

        setAiHintText(hintText || "Mẹo từ Dũng: Hãy sử dụng nháp để tính từng vế của phép tính trước nhé!");
      } catch (err) {
        setAiHintText("Mẹo từ Dũng: Hãy sử dụng nháp để tính từng vế của phép tính trước nhé!");
      } finally {
        setLoadingHint(false);
      }
    }
  };

  // Next Station handler
  const handleNextStation = () => {
    const isLastStation = gameState.currentStation === totalStations;

    if (isLastStation) {
      // End game
      const endTimeValue = Date.now();
      const updatedState = {
        ...gameState,
        currentStation: totalStations + 1,
        endTime: endTimeValue
      };
      setGameState(updatedState);
      
      // Save student log back to dashboard list
      saveStudentLog(updatedState);
    } else {
      // Advance station
      setGameState(prev => ({
        ...prev,
        currentStation: prev.currentStation + 1
      }));
      // Reset state for new question
      setFiftyFiftyUsed(false);
      setEliminatedIndexes([]);
      setSelectedOption(null);
      setShortAnswerInput('');
      setTfAnswers({});
      setIsAnswered(false);
      setIsCorrect(false);
      setFeedbackMsg('');
      setAiHintText('');
      setGlowingRayEffect(false);
      setBattleAnimation('idle');
    }
  };

  // Save log endpoint call
  const saveStudentLog = async (finalState: PlayerState) => {
    try {
      const minutesTaken = Number(((Date.now() - finalState.startTime) / 60000).toFixed(1));
      const totalCollected = finalState.inventory.magicWand + finalState.inventory.bowArrow + finalState.inventory.divineShield;
      
      const wrongCountAtStation: Record<number, number> = {};
      if (Array.isArray(finalState.history)) {
        finalState.history.forEach(item => {
          const wrongs = item.attempts - (item.correct ? 1 : 0);
          if (wrongs > 0) {
            wrongCountAtStation[item.station] = wrongs;
          }
        });
      }

      const newLog = {
        id: Math.random().toString(36).substring(2, 9),
        name: finalState.name,
        className: finalState.className,
        score: finalState.points,
        completed: true,
        timeTakenMinutes: minutesTaken,
        itemsCollectedCount: totalCollected,
        wrongCountAtStation,
        timestamp: new Date().toISOString()
      };

      // Save to localStorage
      try {
        const existingLogsStr = localStorage.getItem('student_logs');
        const logs = existingLogsStr ? JSON.parse(existingLogsStr) : [];
        logs.push(newLog);
        localStorage.setItem('student_logs', JSON.stringify(logs));
      } catch (err) {
        console.error("Failed to save student log locally:", err);
      }

      await fetch('/api/student/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLog)
      });
    } catch (e) {
      console.error("Failed to persist student record on database:", e);
    }
  };

  // Submit and finalize when time runs out
  const handleTimeOverSubmit = () => {
    const endTimeValue = Date.now();
    const updatedState = {
      ...gameState,
      currentStation: 23, // Force transition to certificate screen
      endTime: endTimeValue
    };
    setGameState(updatedState);
    saveStudentLog(updatedState);
  };

  // Give up or Die - restart game
  const handleReviveOrRetry = () => {
    // Revive option (costs 0 points, restores energy to 5)
    setGameState(prev => ({
      ...prev,
      energy: 5,
    }));
    setFeedbackMsg('Đồng ý nạp lại năng lượng! Hãy cẩn thận tiếp tục thám hiểm nhé.');
    setIsAnswered(false);
    setAiHintText('');
    setShortAnswerInput('');
    setSelectedOption(null);
  };

  // Render station path helper
  const stationColors = (stNum: number): string => {
    if (stNum === gameState.currentStation) return 'bg-yellow-400 border-yellow-200 ring-4 ring-yellow-400 text-slate-900 border-white font-bold scale-110';
    if (stNum < gameState.currentStation) return 'bg-emerald-600 text-white border-emerald-400';
    return 'bg-slate-200 text-slate-500 border-slate-300';
  };

  const getDistrictName = (stNumber: number): string => {
    if (questions.length === 0) {
      if (stNumber <= 12) return 'Rừng rậm';
      if (stNumber <= 16) return 'Hang động';
      return 'Thung lũng sương mù';
    }
    const p1Count = questions.filter(q => q.landscape === 'Rừng rậm').length;
    const p2Count = questions.filter(q => q.landscape === 'Hang động').length;

    if (stNumber <= p1Count) return 'Rừng rậm';
    if (stNumber <= p1Count + p2Count) return 'Hang động';
    return 'Thung lũng sương mù';
  };

  if (!isGameActive) {
    return (
      <div className="w-full max-w-6xl mx-auto py-4 px-2 select-none relative font-sans">
        {/* Floating Educator Stamp License - STRICT RULE REQUIREMENT 3.3 */}
        <div className="fixed top-4 right-4 z-40 bg-slate-900/90 text-yellow-400 border border-yellow-500/30 font-display font-medium text-xs py-1.5 px-3 rounded-full backdrop-blur shadow-lg flex items-center gap-1.5 animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
          <span>Giáo viên: <b>Phạm Văn Dũng</b></span>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-amber-200/80 rounded-2xl p-10 shadow-xl max-w-xl mx-auto mt-12 text-center space-y-6"
        >
          <div className="relative w-24 h-24 mx-auto mb-2 flex items-center justify-center">
            {/* Spinning decorative compass/lock frame */}
            <div className="absolute inset-0 border-4 border-dashed border-amber-400 rounded-full animate-spin"></div>
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center shadow-md">
              <ShieldCheck className="w-8 h-8 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-display font-black text-slate-900 uppercase tracking-tight">🗺️ Bản Đồ Đang Khóa Sương Mù</h2>
            <div className="h-0.5 w-16 bg-amber-400 mx-auto rounded"></div>
            <p className="text-amber-700 text-xs font-bold bg-amber-50 py-1.5 px-3 rounded-lg inline-block">Chờ Thầy Dựng Đề • Trận Đấu Chưa Khởi Chạy</p>
          </div>

          <p className="text-slate-600 text-sm leading-relaxed font-semibold">
            Rương gió và {totalStations} Trạm thám hiểm sinh cảnh hiện đang bị sương mù che phủ. 
            Thầy <b>Phạm Văn Dũng</b> cần đăng nhập vào mục <span className="font-extrabold text-indigo-600">🏫 Giáo Viên Quản Trị</span> và thực hiện <b>Tải tệp bộ câu hỏi đề thi ôn tập</b> (.docx, .pdf, hoặc ảnh chụp điện thoại) hoặc sinh tự động bằng AI để khai mở trận đấu!
          </p>

          <div className="bg-slate-50 border rounded-xl p-4 text-xs text-left space-y-1.5 text-slate-500">
            <span className="font-bold text-slate-700 block">💡 Hướng dẫn dành cho học sinh:</span>
            <p>1. Hãy nhanh chóng nhắc Thầy Cô tải tài liệu đề hoặc đề thi lên hệ thống.</p>
            <p>2. Ngay sau khi Thầy Cô tải thành công, trò chơi sẽ tự động được khai mở!</p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => onRefreshGameStatus?.()}
              className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              Làm Mới Bản Đồ Thám Hiểm
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-4 px-2 select-none relative font-sans">
      
      {/* Floating Educator Stamp License - STRICT RULE REQUIREMENT 3.3 */}
      <div className="fixed top-4 right-4 z-40 bg-slate-900/90 text-yellow-400 border border-yellow-500/30 font-display font-medium text-xs py-1.5 px-3 rounded-full backdrop-blur shadow-lg flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-400" />
        <span>Giáo viên: <b>Phạm Văn Dũng</b></span>
      </div>

      {!isPlaying ? (
        /* Welcome Onboard / Entry Login */
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 border border-slate-200 backdrop-blur-md rounded-2xl p-8 shadow-xl max-w-xl mx-auto mt-10 md:mt-16 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-700 flex items-center justify-center rounded-3xl mx-auto mb-6 shadow-inner">
            <Trophy className="w-10 h-10" />
          </div>

          <h2 className="text-3xl font-display font-bold text-slate-950 mb-2">Truy Tìm Kho Báu Toán Học</h2>
          <p className="text-slate-600 text-sm mb-6 font-sans">
            Chào mừng Nhà thám hiểm đến với hành trình chinh phục {totalStations} trạm toán học kì bí chia làm 3 phân khu sinh cảnh đầy thách thức.
          </p>

          <form onSubmit={handleStartGame} className="space-y-4 max-w-sm mx-auto text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Tên Nhà Thám Hiểm (Họ & Tên)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 font-bold text-slate-400" />
                <input
                  type="text"
                  placeholder="Ví dụ: Lê Anh Khoa"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Lớp Danh Nghĩa
              </label>
              <div className="relative">
                <ChevronRight className="absolute left-3.5 top-3.5 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ví dụ: 6A1"
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-red-100">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition text-white font-medium py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 "
            >
              <span>BẮT ĐẦU THÁM HIỂM</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <footer className="mt-8 border-t border-slate-100 pt-4 text-[11px] text-slate-400 font-medium">
            Thiết kế & Bản quyền học liệu thuộc về Giáo viên Phạm Văn Dũng • Hỗ trợ bởi AI Game Master
          </footer>
        </motion.div>
      ) : gameState.currentStation > totalStations ? (
        /* Winner Screen / Treasure Unlocked / Interactive Certificate */
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl mx-auto mt-10 md:mt-16 text-center space-y-6"
        >
          {/* Wooden Chest interactive animation */}
          {!chestOpened ? (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl flex flex-col items-center">
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, -1, 1, -1, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: "easeInOut"
                }}
                className="cursor-pointer mb-6 transform hover:scale-105 transition"
                onClick={() => setChestOpened(true)}
              >
                <div className="w-40 h-40 relative flex items-center justify-center">
                  <span className="absolute -inset-2 bg-yellow-500/20 blur-xl rounded-full"></span>
                  <span className="text-8xl">📦</span>
                </div>
              </motion.div>
              
              <h3 className="text-2xl font-display font-semibold text-yellow-400 mb-1">Đã Tìm Thấy Rương Kho Báu!</h3>
              <p className="text-slate-300 text-xs max-w-sm mb-6">
                Bạn đã xuất sắc vượt qua cả {totalStations} thử thách sinh cảnh. Hãy nhấn vào chiếc rương để nhận chứng chỉ danh hiệu toán học hoàng kim!
              </p>

              <button
                onClick={() => setChestOpened(true)}
                className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-semibold px-6 py-2.5 rounded-lg flex items-center gap-1.5 transition text-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                MỞ RƯƠNG KHO BÁU
              </button>
            </div>
          ) : (
            /* Officially Styled Explorer Certificate - REQUIREMENT 3.3 / FORMAT C */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Golden sparkles effect wrapper */}
              <div className="p-8 bg-gradient-to-br from-amber-500 via-amber-100 to-yellow-600 rounded-2xl shadow-2xl relative border-4 border-yellow-400 text-slate-900 mx-auto max-w-lg shadow-yellow-500/20">
                {/* Vintage vintage borders */}
                <div className="absolute inset-2 border-2 border-dashed border-amber-800/40 rounded-lg pointer-events-none"></div>
                
                {/* Seal Ornament */}
                <span className="absolute right-6 top-6 text-5xl opacity-40">⭐</span>

                <div className="space-y-4 relative z-10">
                  <header>
                    <div className="flex justify-center mb-1">
                      <Award className="w-12 h-12 text-amber-700 font-black animate-bounce" />
                    </div>
                    <h1 className="text-2xl font-display font-black tracking-tight text-amber-900 uppercase">
                      CHỨNG NHẬN
                    </h1>
                    <h2 className="text-lg font-sans font-bold tracking-widest text-amber-800 uppercase mt-[-4px]">
                      NHÀ THÁM HIỂM TOÁN HỌC
                    </h2>
                  </header>

                  <div className="border-t border-amber-900/10 my-4 py-4 space-y-3">
                    <p className="text-xs text-amber-800 font-medium">Trân trọng trao tặng cho nhà phiêu lưu dũng cảm:</p>
                    <h3 className="text-3xl font-display font-extrabold text-amber-950 underline decoration-amber-500/50">
                      {gameState.name}
                    </h3>
                    <p className="text-sm font-semibold text-amber-900">
                      Học sinh lớp: {gameState.className}
                    </p>
                  </div>

                  <div className="bg-amber-900/5 border border-amber-900/10 rounded-xl p-4 text-left grid grid-cols-3 gap-2">
                    <div className="text-center border-r border-amber-900/10 last:border-0">
                      <span className="block text-[10px] uppercase font-bold text-amber-800">Thành tích</span>
                      <strong className="text-lg text-amber-950">{gameState.points} Điểm</strong>
                    </div>
                    <div className="text-center border-r border-amber-900/10 last:border-0">
                      <span className="block text-[10px] uppercase font-bold text-amber-800">Túi đồ</span>
                      <strong className="text-lg text-amber-950">
                        {gameState.inventory.magicWand + gameState.inventory.bowArrow + gameState.inventory.divineShield} Cái
                      </strong>
                    </div>
                    <div className="text-center last:border-0">
                      <span className="block text-[10px] uppercase font-bold text-amber-800 font-sans">Thời gian</span>
                      <strong className="text-base text-amber-950 font-mono">
                        {Math.floor(elapsedTime / 60)}p {elapsedTime % 60}s
                      </strong>
                    </div>
                  </div>

                  <p className="text-xs text-amber-900 italic font-medium px-4">
                    "Bạn đã xuất sắc vượt qua các thử thách của Thung lũng sương mù, mở khóa rương thần thoại, chứng minh bản thân trước AI Game Master!"
                  </p>

                  <div className="pt-6 border-t border-amber-900/10 flex justify-between items-end text-left text-xs text-amber-900">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-amber-800">Trình giám sát:</p>
                      <strong>AI Game Master Central</strong>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-amber-800">Ký tên giám khảo:</p>
                      <strong className="text-sm font-display text-amber-950 block border-b border-amber-900/30 pb-0.5 font-bold">
                        Giáo viên: Phạm Văn Dũng
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setIsPlaying(false)}
                  className="bg-slate-900 hover:bg-slate-800 active:bg-slate-950 transition text-white px-5 py-2.5 rounded-xl font-medium text-xs flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-4 h-4" />
                  Kính yêu làm lại cuộc chơi
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium text-xs transition shadow shadow-emerald-500/20"
                >
                  🖨️ In chứng nhận / Lưu PDF
                </button>
              </div>
            </motion.div>
          )}

        </motion.div>
      ) : (
        /* Real-Time Interactive Game Stage */
        <div className="space-y-4 relative">
          
          {/* Countdown / Timeout lockout overlay */}
          {gameTimeLimit > 0 && elapsedTime >= gameTimeLimit * 60 && (
            <div className="absolute inset-x-0 -top-4 -bottom-4 bg-slate-950/85 backdrop-blur-md z-50 rounded-2xl flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white border rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-6"
              >
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-display font-black text-slate-900 uppercase">HẾT GIỜ THÁM HIỂM!</h3>
                  <div className="h-0.5 w-12 bg-red-500 mx-auto rounded"></div>
                  <p className="text-xs text-red-600 font-bold bg-red-50 py-1 px-2.5 rounded-md inline-block">Thời gian giới hạn: {gameTimeLimit} phút</p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  Đã hết sạch thời gian do Thầy <b>Phạm Văn Dũng</b> thiết lập cho trận thám hiểm truy tìm kho báu này! Hãy nộp bài ngay để hệ thống ghi nhận thành tích {gameState.points} điểm của bạn.
                </p>

                <button
                  onClick={handleTimeOverSubmit}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  🚀 NỘP BÀI THÁM HIỂM & XEM CHỨNG NHẬN
                </button>
              </motion.div>
            </div>
          )}
          
          {/* Top Panel stats metrics */}
          <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 text-emerald-700 py-1.5 px-3 rounded-lg flex items-center gap-1">
                <User className="w-4 h-4" />
                <span className="text-xs font-semibold">{gameState.name} ({gameState.className})</span>
              </div>
              <div className="bg-yellow-50 text-amber-700 py-1.5 px-3 rounded-lg flex items-center gap-1 font-mono">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-bold">{gameState.points} ĐIỂM</span>
              </div>
              <div className={`py-1.5 px-3 rounded-lg flex items-center gap-1 font-mono ${
                gameTimeLimit > 0 && (gameTimeLimit * 60 - elapsedTime) <= 120 
                  ? 'bg-rose-50 text-rose-700 animate-pulse border border-rose-200' 
                  : 'bg-blue-50 text-blue-700'
              }`}>
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold">
                  {gameTimeLimit > 0 ? (
                    (() => {
                      const remain = Math.max(0, gameTimeLimit * 60 - elapsedTime);
                      const mm = Math.floor(remain / 60);
                      const ss = remain % 60;
                      return `Còn ${mm}:${ss.toString().padStart(2, '0')}`;
                    })()
                  ) : (
                    `${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, '0')}`
                  )}
                </span>
              </div>
            </div>

            {/* Lives / Energy metrics */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Năng Lượng Sinh Tồn:</span>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Heart
                      key={i}
                      className={`w-4 h-4 shrink-0 transition ${
                        i < gameState.energy ? 'fill-red-500 text-red-500 animate-pulse' : 'text-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Seafaring Pirate Adventure Synth Controllers */}
              <div className="flex items-center gap-2 border-l border-slate-200 pl-4 py-0.5">
                <button
                  type="button"
                  onClick={() => setRetroMusicOn(prev => !prev)}
                  className={`py-1.5 px-3 rounded-lg border-2 flex items-center gap-1.5 transition-all text-[11px] font-black cursor-pointer ${
                    retroMusicOn 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/85'
                  }`}
                  title="Nhạc thám hiểm rương báu (Hệ thống Retro Synth)"
                >
                  <Music className={`w-3.5 h-3.5 ${retroMusicOn ? 'animate-bounce' : ''}`} />
                  <span>{retroMusicOn ? 'Tắt Nhạc' : 'Bật Nhạc Nền'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSfxOn(prev => !prev)}
                  className={`py-1.5 px-3 rounded-lg border-2 flex items-center gap-1.5 transition-all text-[11px] font-black cursor-pointer ${
                    sfxOn 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                      : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100/85'
                  }`}
                  title="Hiệu ứng bíp khi đoán Đúng/Sai"
                >
                  {sfxOn ? <Volume2 className="w-3.5 h-3.5 font-bold" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{sfxOn ? 'Tắt Âm SFX' : 'Bật Âm SFX'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive continuous stations bar */}
          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-inner">
            <div className="flex justify-between items-center mb-1 bg-slate-50 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              <span>Đường đi {totalStations} Trạm</span>
              <span className="text-emerald-600">Phân khu: <b>{getDistrictName(gameState.currentStation)}</b></span>
            </div>
            
            {/* Scrollable track of stations */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 px-1 scrollbar-thin">
              {Array.from({ length: totalStations }).map((_, idx) => {
                const num = idx + 1;
                return (
                  <div key={idx} className="flex items-center shrink-0">
                    <button
                      onClick={() => {
                        // Allow exploring but keep security boundaries or allow viewing previous questions
                        if (num <= gameState.currentStation) {
                          setGameState(prev => ({ ...prev, currentStation: num }));
                          setFiftyFiftyUsed(false);
                          setEliminatedIndexes([]);
                          setSelectedOption(null);
                          setShortAnswerInput('');
                          setTfAnswers({});
                          setIsAnswered(false);
                          setAiHintText('');
                          setGlowingRayEffect(false);
                        }
                      }}
                      className={`w-8 h-8 rounded-full border text-xs flex items-center justify-center transition-all cursor-pointer ${stationColors(num)}`}
                    >
                      {num}
                    </button>
                    {num < totalStations && (
                      <span className={`w-3 h-0.5 ${num < gameState.currentStation ? 'bg-emerald-500' : 'bg-slate-200'}`}></span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Core play board based on landscape structure */}
          {currentQuestion && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* Question card (Left 8 columns) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                
                {/* Adventure scenery banner and question */}
                <div className={`p-6 rounded-2xl border transition-all ${
                  currentQuestion.landscape === 'Rừng rậm' 
                    ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/90 border-emerald-100' 
                    : currentQuestion.landscape === 'Hang động'
                    ? 'bg-gradient-to-br from-purple-50/90 to-indigo-50/90 border-purple-100'
                    : 'bg-gradient-to-br from-slate-100 to-sky-100 border-slate-200'
                } shadow-sm relative overflow-hidden min-h-[220px] flex flex-col justify-between`}>
                  
                  {/* Decorative background visual elements */}
                  {currentQuestion.landscape === 'Rừng rậm' && (
                    <span className="absolute bottom-1 right-2 text-8xl opacity-10 pointer-events-none md:scale-125">🌴</span>
                  )}
                  {currentQuestion.landscape === 'Hang động' && (
                    <span className="absolute bottom-1 right-2 text-8xl opacity-10 pointer-events-none md:scale-125">🪨</span>
                  )}
                  {currentQuestion.landscape === 'Thung lũng sương mù' && (
                    <span className="absolute bottom-1 right-2 text-8xl opacity-15 pointer-events-none md:scale-125 font-sans">🌫️</span>
                  )}

                  {/* Sparkling Glowing leaf rays visual effect for CAVE complete */}
                  {glowingRayEffect && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 bg-radial-gradient from-yellow-300 via-transparent to-transparent pointer-events-none"
                    />
                  )}

                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold tracking-wider py-1 px-2.5 rounded-full ${
                        currentQuestion.landscape === 'Rừng rậm'
                          ? 'bg-emerald-100 text-emerald-800'
                          : currentQuestion.landscape === 'Hang động'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}>
                        🌋 Trạm {currentQuestion.station}: {currentQuestion.landscape}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">• Thử thách {currentQuestion.type === 'multiple-choice' ? 'Trắc nghiệm' : currentQuestion.type === 'true-false' ? 'Đúng / Sai' : 'Trả lời ngắn'}</span>
                    </div>

                    <div className="pt-2">
                      <MathAndImageRenderer 
                        text={currentQuestion.questionText} 
                        image={currentQuestion.questionImage} 
                        className="text-lg md:text-xl font-display font-bold text-slate-900"
                        imageMaxHeight="max-h-80"
                      />
                    </div>
                  </div>

                  {/* Subtitle / Battle simulation animation inline screen */}
                  {currentQuestion.landscape === 'Rừng rậm' && (
                    <div className="mt-4 border-t border-emerald-900/10 pt-3 relative flex items-center justify-between z-10 bg-emerald-900/5 px-4 py-2 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl animate-bounce">🧑‍🚀</span>
                        <div className="text-left text-xs">
                          <p className="font-bold text-slate-800">Nhà thám hiểm</p>
                          <p className="text-[10px] text-emerald-700">LV.{gameState.points / 10 + 1}</p>
                        </div>
                      </div>

                      <div className="text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">VS</div>

                      <div className="flex items-center gap-2">
                        <div className="text-right text-xs">
                          <p className="font-bold text-slate-800">Quái Vật Rừng</p>
                          <p className={`text-[10px] ${battleAnimation === 'hit' ? 'text-red-500 font-black' : 'text-emerald-700'}`}>
                            {battleAnimation === 'hit' ? 'HP -999!' : 'HP 100/100'}
                          </p>
                        </div>
                        <motion.span 
                          animate={battleAnimation === 'attack' ? { x: [-10, 10, -5, 0] } : {}}
                          className={`text-2xl transform ${battleAnimation === 'hit' ? 'grayscale opacity-50 duration-75' : ''}`}
                        >
                          👾
                        </motion.span>
                      </div>
                    </div>
                  )}

                  {/* Sparkling trees overlay for Cave completed */}
                  {currentQuestion.landscape === 'Hang động' && glowingRayEffect && (
                    <div className="mt-4 bg-yellow-500/10 text-amber-800 text-xs font-semibold py-2 px-3 rounded-xl border border-yellow-500/30 flex items-center gap-1.5 animate-pulse z-10">
                      <Sparkles className="w-4 h-4 text-yellow-600 animate-spin" />
                      <span>Hiệu ứng ánh sáng tán lá huyền bí rọi chiếu thành công!</span>
                    </div>
                  )}
                </div>

                {/* Question choices control UI */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  {currentQuestion.type === 'multiple-choice' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentQuestion.options?.map((opt, idx) => {
                        const isEliminated = eliminatedIndexes.includes(idx);
                        return (
                          <button
                            key={idx}
                            disabled={isAnswered || isEliminated}
                            onClick={() => setSelectedOption(opt)}
                            className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer flex justify-between items-center ${
                              isEliminated 
                                ? 'bg-slate-50 border-slate-100 text-slate-300 pointer-events-none line-through' 
                                : selectedOption === opt
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-100 text-slate-800 active:bg-slate-100'
                            }`}
                          >
                            <div className="flex flex-col items-start gap-1 w-full text-sm font-semibold text-slate-800">
                              <MathAndImageRenderer 
                                text={opt} 
                                image={currentQuestion.optionsImages?.[idx]} 
                                imageMaxHeight="max-h-24"
                                className="w-full text-slate-800 font-semibold"
                              />
                            </div>
                            {!isAnswered && !isEliminated && (
                              <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedOption === opt ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                                {selectedOption === opt && <span className="w-2 h-2 bg-white rounded-full"></span>}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentQuestion.type === 'true-false' && (
                    <div className="space-y-3 pt-2">
                      {currentQuestion.subStatements && currentQuestion.subStatements.length > 0 ? (
                        <div className="space-y-3.5 text-left">
                          {currentQuestion.subStatements.map((sub, idx) => {
                            const studentSel = tfAnswers[sub.label];
                            return (
                              <div key={idx} className="bg-slate-50/70 border border-slate-100 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                                <div className="font-medium text-slate-800 text-sm flex-1">
                                  <div className="flex items-start gap-1">
                                    <span className="text-indigo-600 font-black mr-2 text-md shrink-0">{sub.label}</span>
                                    <div className="flex-1 text-slate-800">
                                      <MathAndImageRenderer 
                                        text={sub.text} 
                                        image={sub.subImage} 
                                        imageMaxHeight="max-h-24"
                                        className="w-full"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 shrink-0 self-end md:self-center">
                                  {['Đúng', 'Sai'].map((val) => {
                                    const isSelected = studentSel === val;
                                    return (
                                      <button
                                        key={val}
                                        type="button"
                                        disabled={isAnswered}
                                        onClick={() => setTfAnswers(prev => ({ ...prev, [sub.label]: val as 'Đúng' | 'Sai' }))}
                                        className={`px-4 py-1.5 rounded-lg border-2 text-xs font-bold transition-all cursor-pointer ${
                                          isSelected
                                            ? val === 'Đúng'
                                              ? 'bg-emerald-600 border-emerald-600 text-white'
                                              : 'bg-rose-600 border-rose-600 text-white'
                                            : 'bg-white hover:bg-slate-100/80 border-slate-200 text-slate-700'
                                        }`}
                                      >
                                        {val}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {['Đúng', 'Sai'].map((val) => (
                            <button
                              key={val}
                              disabled={isAnswered}
                              onClick={() => setSelectedOption(val)}
                              className={`p-4 rounded-xl border-2 text-center text-sm font-bold transition cursor-pointer ${
                                selectedOption === val
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-950'
                                  : 'bg-slate-50 hover:bg-slate-100/80 border-slate-100 text-slate-800'
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {currentQuestion.type === 'short-answer' && (
                    <div className="space-y-2 text-left">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        Nhập Câu Trả Lời Ngắn (Hệ thống AI NLP so khớp thông minh)
                      </label>
                      <input
                        type="text"
                        disabled={isAnswered}
                        placeholder="Ví dụ: 36 hoặc vô số..."
                        value={shortAnswerInput}
                        onChange={(e) => setShortAnswerInput(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50 rounded-xl py-3 px-4 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      />
                    </div>
                  )}

                  {/* Feedback on answer and hints block */}
                  <AnimatePresence>
                    {isAnswered && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-xl border ${
                          isCorrect 
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                            : 'bg-rose-50 border-rose-100 text-rose-800'
                        } text-left text-xs gap-3 space-y-2`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-lg">{isCorrect ? '✅' : '❌'}</span>
                          <div>
                            <p className="font-bold text-sm">
                              {isCorrect ? 'Chúc mừng bạn đã trả lời đúng!' : 'Phép toán chưa chính xác!'}
                            </p>
                            <p className="mt-1 font-medium leading-relaxed">{feedbackMsg}</p>
                          </div>
                        </div>

                        {/* Explanation toggle */}
                        {isCorrect && (
                          <div className="pt-2 border-t border-slate-200/40 text-slate-600">
                            <p className="font-bold text-[10px] uppercase text-slate-500 tracking-wider mb-1">Giải nghĩa từ Game Master:</p>
                            <MathAndImageRenderer 
                              text={currentQuestion.explanation} 
                              image={currentQuestion.explanationImage} 
                              imageMaxHeight="max-h-56"
                              className="mt-1 text-slate-700"
                            />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action navigation triggers - CONTINUE or REVIVE */}
                  <div className="flex gap-3 justify-end">
                    {/* Revive / Restart control if they lost energy */}
                    {gameState.energy <= 0 ? (
                      <button
                        onClick={handleReviveOrRetry}
                        className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-lg shadow-rose-600/20"
                      >
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Hết sinh lực! Nạp đầy năng lượng để thám hiểm tiếp
                      </button>
                    ) : !isAnswered ? (
                      <button
                        onClick={handleAnswerSubmit}
                        disabled={
                          currentQuestion.type === 'multiple-choice'
                            ? !selectedOption
                            : currentQuestion.type === 'true-false'
                            ? (currentQuestion.subStatements && currentQuestion.subStatements.length > 0)
                              ? currentQuestion.subStatements.some(sub => !tfAnswers[sub.label])
                              : !selectedOption
                            : !shortAnswerInput.trim()
                        }
                        className="bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white disabled:opacity-50 py-2.5 px-6 rounded-xl font-bold text-xs tracking-wider uppercase transition cursor-pointer"
                      >
                        Xác Nhận Đáp Án
                      </button>
                    ) : isCorrect ? (
                      <button
                        onClick={handleNextStation}
                        className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-2.5 px-6 rounded-xl font-bold text-xs tracking-wider uppercase transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>{gameState.currentStation === totalStations ? 'Mở Kho Báu' : 'Đi tiếp Trạm kế'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsAnswered(false);
                          if (currentQuestion.type === 'multiple-choice') {
                            setSelectedOption(null);
                          }
                          // Keep shortAnswerInput and tfAnswers for easy editing by the student
                        }}
                        className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white py-2.5 px-6 rounded-xl font-bold text-xs tracking-wider uppercase transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Thử lại Trạm này</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* Sidebar (Right 4 columns - Inventory Items & AI Hints Master Assistant) */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* Inventory pocket card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-left">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
                    <span>Túi Đồ Thám Hiểm</span>
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                  </h3>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Item 1: Magic Wand */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center flex flex-col justify-between relative last:border-0">
                      <span className="text-2xl block animate-pulse">🪄</span>
                      <p className="text-[10px] font-bold text-slate-700 mt-1 uppercase">Gậy Phép</p>
                      <span className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {gameState.inventory.magicWand}
                      </span>
                    </div>

                    {/* Item 2: Bow Arrow */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center flex flex-col justify-between relative">
                      <span className="text-2xl block animate-pulse">🏹</span>
                      <p className="text-[10px] font-bold text-slate-700 mt-1 uppercase">Cung Tên</p>
                      <span className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {gameState.inventory.bowArrow}
                      </span>
                    </div>

                    {/* Item 3: Divine Shield */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center flex flex-col justify-between relative">
                      <span className="text-2xl block animate-pulse">🛡️</span>
                      <p className="text-[10px] font-bold text-slate-700 mt-1 uppercase">Khiên Thần</p>
                      <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {gameState.inventory.divineShield}
                      </span>
                    </div>
                  </div>

                  {/* Active Help assistance trigger */}
                  {currentQuestion.type === 'multiple-choice' && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <button
                        onClick={handleFiftyFifty}
                        disabled={isAnswered || fiftyFiftyUsed || (gameState.inventory.magicWand <= 0 && gameState.inventory.bowArrow <= 0)}
                        className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                        Trợ giúp 50/50 (-2 đáp án sai)
                      </button>
                      <p className="text-[10px] text-slate-400 mt-1 text-center font-medium">Bơm tốn 1 Gậy Phép hoặc 1 Cung Tên trong túi đồ</p>
                    </div>
                  )}

                  {gameState.inventory.divineShield > 0 && (
                    <div className="mt-3 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-left flex items-start gap-1.5 text-emerald-800 text-[10px]">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>KHIÊN THẦN ĐANG HOẠT ĐỘNG:</strong>
                        <p className="mt-0.5 text-slate-600">Cho phép sai 01 lần tại trạm này mà không tốn sinh lực.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Game Master central assistant (DYNAMIC AI HINTS) - RULES SECTION 3.2 */}
                <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-sm text-left relative overflow-hidden">
                  <div className="absolute top-1 right-2 text-7xl opacity-5">🧙</div>

                  <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-widest border-b border-slate-800 pb-2 mb-3 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    <span>Lớp Ý Kiến: Game Master AI</span>
                  </h3>

                  <div className="space-y-3 relative z-10 text-xs text-slate-300">
                    {loadingHint ? (
                      <div className="flex flex-col items-center justify-center py-6 gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-yellow-500" />
                        <span className="text-[11px] text-slate-400 italic">AI đang tính toán gợi ý kiến thức tối ưu...</span>
                      </div>
                    ) : aiHintText ? (
                      <div className="space-y-2">
                        <p className="leading-relaxed bg-slate-800/60 p-3 rounded-xl border border-slate-700 italic">
                          "{aiHintText}"
                        </p>
                        <p className="text-[10px] text-slate-400 text-right">• Hỗ trợ bởi Giáo viên Phạm Văn Dũng</p>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-slate-500 font-medium">
                        <HelpCircle className="w-8 h-8 text-slate-700 mx-auto mb-2 animate-bounce" />
                        <p>Chưa có câu hỏi sai nào. Hãy bấm "Xác Nhận Đáp Án" để thử sức thám hiểm!</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>
      )}

    </div>
  );
}
