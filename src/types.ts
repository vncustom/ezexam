export interface QuestionOption {
  id: string; // A, B, C, D
  content: string;
}

export interface Question {
  id: string;
  originalId: string; // ID of the question in the generated JSON
  content: string;
  type: 'multiple_choice' | 'essay';
  options?: QuestionOption[];
  correctAnswer?: string;
  explanation: string;
  topic: string;
  difficulty: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao';
}

export interface ExamMatrixTopic {
  name: string;
  count: number;
}

export interface ExamMatrixDifficulty {
  level: string;
  count: number;
}

export interface ExamMatrix {
  subject: string;
  durationMinutes: number;
  totalQuestions: number;
  topics: ExamMatrixTopic[];
  difficulties: ExamMatrixDifficulty[];
}

export interface Exam {
  id: string;
  title: string;
  createdAt: number;
  matrix: ExamMatrix;
  questions: Question[];
}
