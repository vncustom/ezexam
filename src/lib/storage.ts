import { Exam } from "../types";

export const getStoredApiKey = (): string | null => {
  return localStorage.getItem('gemini_api_key');
};

export const storeApiKey = (key: string) => {
  localStorage.setItem('gemini_api_key', key);
};

export const removeApiKey = () => {
    localStorage.removeItem('gemini_api_key');
}

export const getStoredModel = (): string => {
    return localStorage.getItem('gemini_model') || 'gemini-flash-latest';
}

export const storeModel = (modelName: string) => {
    localStorage.setItem('gemini_model', modelName);
}

export const getStoredExams = (): Exam[] => {
  const data = localStorage.getItem('ezexam_history');
  return data ? JSON.parse(data) : [];
};

export const storeExam = (exam: Exam) => {
  const exams = getStoredExams();
  // Check if exists, update it
  const existingIndex = exams.findIndex(e => e.id === exam.id);
  if (existingIndex >= 0) {
      exams[existingIndex] = exam;
  } else {
      exams.unshift(exam);
  }
  localStorage.setItem('ezexam_history', JSON.stringify(exams));
};

export const deleteStoredExam = (id: string) => {
    const exams = getStoredExams().filter(e => e.id !== id);
    localStorage.setItem('ezexam_history', JSON.stringify(exams));
}

// Ensure demo data
export const ensureDemoData = () => {
    const exams = getStoredExams();
    if (exams.length === 0) {
        const demoExam: Exam = {
            id: 'demo-123',
            title: 'Đề thi minh họa Tiếng Anh THPTQG',
            createdAt: Date.now(),
            matrix: {
                subject: 'Tiếng Anh',
                durationMinutes: 60,
                totalQuestions: 5,
                topics: [
                    { name: 'Phát âm', count: 1 },
                    { name: 'Ngữ pháp', count: 2 },
                    { name: 'Từ vựng', count: 1 },
                    { name: 'Đọc hiểu', count: 1 }
                ],
                difficulties: [
                    { level: 'Nhận biết', count: 2 },
                    { level: 'Thông hiểu', count: 2 },
                    { level: 'Vận dụng', count: 1 },
                    { level: 'Vận dụng cao', count: 0 }
                ]
            },
            questions: [
                {
                    id: 'q1',
                    originalId: '1',
                    type: 'multiple_choice',
                    topic: 'Phát âm',
                    difficulty: 'Nhận biết',
                    content: 'Mark the letter A, B, C, or D to indicate the word whose **underlined part** differs from the other three in pronunciation.',
                    options: [
                        { id: 'A', content: 'cat**s**' },
                        { id: 'B', content: 'dog**s**' },
                        { id: 'C', content: 'cup**s**' },
                        { id: 'D', content: 'bat**s**' }
                    ],
                    correctAnswer: 'B',
                    explanation: 'Phép phát âm chữ **"s"** ở cuối danh từ số nhiều:\n- **B (dogs)** phát âm là **/z/** vì "dog" kết thúc bằng phụ âm hữu thanh /g/\n- A, C, D đều phát âm là **/s/** vì kết thúc bằng phụ âm vô thanh'
                },
                {
                    id: 'q2',
                    originalId: '2',
                    type: 'multiple_choice',
                    topic: 'Ngữ pháp',
                    difficulty: 'Thông hiểu',
                    content: 'By the time she arrived at the station, the train _______ already _______.',
                    options: [
                        { id: 'A', content: 'had / left' },
                        { id: 'B', content: 'has / left' },
                        { id: 'C', content: 'was / leaving' },
                        { id: 'D', content: 'have / left' }
                    ],
                    correctAnswer: 'A',
                    explanation: 'Cấu trúc **Quá khứ hoàn thành** (Past Perfect): *had + V3/ed*\n\nHành động "tàu đã rời đi" xảy ra **trước** hành động "cô ấy đến ga" (cả hai đều trong quá khứ), nên dùng quá khứ hoàn thành: **had left**.'
                },
                {
                    id: 'q3',
                    originalId: '3',
                    type: 'multiple_choice',
                    topic: 'Từ vựng',
                    difficulty: 'Nhận biết',
                    content: 'Choose the word or phrase that is **CLOSEST in meaning** to the underlined word: "The scientist made a **remarkable** discovery last year."',
                    options: [
                        { id: 'A', content: 'ordinary' },
                        { id: 'B', content: 'extraordinary' },
                        { id: 'C', content: 'temporary' },
                        { id: 'D', content: 'secondary' }
                    ],
                    correctAnswer: 'B',
                    explanation: '**Remarkable** = đáng chú ý, xuất sắc\n\n- **extraordinary** = phi thường, xuất sắc ✅ (đồng nghĩa)\n- ordinary = bình thường (trái nghĩa)\n- temporary = tạm thời\n- secondary = thứ yếu'
                },
                {
                    id: 'q4',
                    originalId: '4',
                    type: 'multiple_choice',
                    topic: 'Ngữ pháp',
                    difficulty: 'Thông hiểu',
                    content: 'If I _______ harder, I would have passed the exam.',
                    options: [
                        { id: 'A', content: 'study' },
                        { id: 'B', content: 'studied' },
                        { id: 'C', content: 'had studied' },
                        { id: 'D', content: 'have studied' }
                    ],
                    correctAnswer: 'C',
                    explanation: '**Câu điều kiện loại 3** (Type 3 - Điều kiện không có thật trong quá khứ):\n\n- Mệnh đề If: **If + S + had + V3/ed**\n- Mệnh đề kết quả: **S + would have + V3/ed**\n\nVì vậy: "If I **had studied** harder, I would have passed." ✅'
                },
                {
                    id: 'q5',
                    originalId: '5',
                    type: 'multiple_choice',
                    topic: 'Đọc hiểu',
                    difficulty: 'Vận dụng',
                    content: 'Read the following passage and answer the question:\n\n*"Despite the heavy rain, hundreds of volunteers turned out to clean up the park. Their dedication was truly inspiring."*\n\nWhat does the word **"dedication"** in the passage most likely mean?',
                    options: [
                        { id: 'A', content: 'laziness' },
                        { id: 'B', content: 'commitment and hard work' },
                        { id: 'C', content: 'surprise' },
                        { id: 'D', content: 'celebration' }
                    ],
                    correctAnswer: 'B',
                    explanation: '**Dedication** = sự cống hiến, cam kết\n\nDựa vào ngữ cảnh: dù trời mưa to, hàng trăm tình nguyện viên vẫn đến dọn dẹp công viên → đây là hành động thể hiện **sự cam kết và chăm chỉ** (commitment and hard work) ✅\n\nCác đáp án khác:\n- A: laziness (sự lười biếng) - sai hoàn toàn\n- C: surprise (bất ngờ) - không liên quan\n- D: celebration (kỷ niệm) - không phù hợp ngữ cảnh'
                }
            ]
        };
        storeExam(demoExam);
    }
}
