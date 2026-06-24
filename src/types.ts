export type Landscape = 'Rừng rậm' | 'Hang động' | 'Thung lũng sương mù';
export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer';

export interface SubStatement {
  label: string; // "a)", "b)", "c)", "d)"
  text: string;
  subImage?: string; // Optional image URL or base64 (for complex geometries/math formulas)
  correctAnswer: 'Đúng' | 'Sai';
}

export interface Question {
  station: number; // 1 to 22
  landscape: Landscape;
  type: QuestionType;
  questionText: string;
  questionImage?: string; // Optional image URL or base64 (diagrams, space geometries, coordinate graphs)
  options?: string[]; // Only for multiple-choice
  optionsImages?: string[]; // Optional corresponding image URLs or base64s for options (same length as options)
  correctAnswer: string; // "Đúng"/"Sai" for T/F, correct option string for MC, synonym or word for SA
  explanation: string;
  explanationImage?: string; // Optional image URL or base64 for teacher explanation hints
  hint?: string;
  keywords?: string[]; // Synonyms or key phrases for short answer so NLP / fuzzy matching is robust
  subStatements?: SubStatement[]; // Used for true-false multi-statements (a, b, c, d)
}

export interface PlayerInventory {
  magicWand: number; // Helps with 50/50 help (Gậy phép)
  bowArrow: number;  // Helps with 50/50 help (Cung tên)
  divineShield: number; // Allows 1 error without losing energy (Khiên thần)
}

export interface PlayerState {
  name: string;
  className: string;
  currentStation: number; // 1 to 22, 23 means finished/beaten
  points: number;
  energy: number; // starts at 5 or 3
  inventory: PlayerInventory;
  startTime: number;
  endTime: number | null;
  history: Array<{
    station: number;
    correct: boolean;
    attempts: number;
    itemEarned?: string;
  }>;
}

export interface StudentLog {
  id: string; // unique id
  name: string;
  className: string;
  score: number;
  completed: boolean;
  timeTakenMinutes: number;
  itemsCollectedCount: number;
  wrongCountAtStation: Record<number, number>;
  timestamp: string;
}

export interface TeacherAnalytics {
  logs: StudentLog[];
  averageTime: number; // in mins
  hardestStation: number;
  topExplorers: Array<{ name: string; score: number; timeMinutes: number }>;
  aiSuggestions: string;
}
