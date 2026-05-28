export interface QuestionOption {
  id: string; // A, B, C, D (hoặc a, b, c, d với Đúng/Sai)
  content: string;
}

export interface Question {
  id: string;
  originalId: string; // ID câu hỏi trong JSON trả về
  content: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  sectionId?: string; // ID của phần thi chứa câu hỏi này
  passage?: string; // Văn bản đọc hiểu hoặc ngữ liệu đi kèm (nếu có)
  options?: QuestionOption[];
  correctAnswer?: string; // Ví dụ: "A" hoặc "a: Đúng, b: Sai, c: Đúng, d: Sai" hoặc số/chữ cụ thể
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

export interface ExamMatrixQuestionSkeleton {
  originalId: string;
  topic: string;
  difficulty: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao';
  stemDescription: string; // Mô tả ngắn gọn yêu cầu cốt lõi (VD: "Tìm nguyên hàm hàm số cơ bản")
}

export interface ExamMatrixSection {
  id: string;
  name: string; // VD: "PHẦN I: Trắc nghiệm khách quan"
  instruction: string; // Chỉ dẫn làm bài của phần này
  passage?: string; // Bài đọc hiểu hoặc đoạn văn điền từ (nếu có)
  questionType: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  questions: ExamMatrixQuestionSkeleton[];
}

export interface ExamMatrix {
  subject: string;
  durationMinutes: number;
  totalQuestions: number;
  topics: ExamMatrixTopic[];
  difficulties: ExamMatrixDifficulty[];
  sections?: ExamMatrixSection[]; // Cấu trúc chi tiết các phần thi
}

export interface Exam {
  id: string;
  title: string;
  createdAt: number;
  matrix: ExamMatrix;
  questions: Question[];
}
