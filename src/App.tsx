import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { Dropzone } from './components/Dropzone';
import { MatrixDashboard } from './components/MatrixDashboard';
import { Workspace } from './components/Workspace';
import { Exam, ExamMatrix, Question } from './types';
import { getStoredExams, ensureDemoData, getStoredApiKey, getStoredModel, storeExam, deleteStoredExam } from './lib/storage';
import { callGemini } from './lib/api';
import Swal from 'sweetalert2';

export default function App() {
  const [step, setStep] = useState(0); // 0: Upload, 1: Matrix, 2: Workspace
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const [pdfText, setPdfText] = useState("");
  const [matrix, setMatrix] = useState<ExamMatrix | null>(null);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [history, setHistory] = useState<Exam[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    ensureDemoData();
    setHistory(getStoredExams());
    
    // Auto show settings if no API key
    if (!getStoredApiKey()) {
      setShowSettings(true);
    }
  }, []);

  const refreshHistory = () => {
      setHistory(getStoredExams());
  }

  const handleSelectHistory = (id: string) => {
      const exam = history.find(e => e.id === id);
      if (exam) {
          setCurrentExam(exam);
          setMatrix(exam.matrix);
          setStep(2); // Go to workspace
          // On mobile, auto hide sidebar
          if (window.innerWidth < 1024) setShowSidebar(false);
      }
  }

  const handleTextExtracted = async (text: string) => {
      setPdfText(text);
      setStep(1); // Moving to Matrix state, but we need to analyze first

      const systemInstruction = `Bạn là chuyên gia phân tích đề thi giáo dục Việt Nam, am hiểu Công văn 7991/BGDĐT-GDTrH ngày 17/12/2024 về cấu trúc ma trận đề kiểm tra định kì. Bạn có khả năng:
- Nhận diện chính xác 4 dạng câu hỏi: Nhiều lựa chọn (TNKQ 4 phương án A/B/C/D), Đúng-Sai (4 ý nhỏ a/b/c/d chọn Đúng hoặc Sai), Trả lời ngắn (điền số/kết quả ngắn), Tự luận (viết bài giải).
- Phân loại mức độ nhận thức: Nhận biết (nhớ, nhận ra), Thông hiểu (giải thích, so sánh), Vận dụng (áp dụng vào tình huống quen), Vận dụng cao (phân tích, đánh giá, sáng tạo trong tình huống mới).
- Xây dựng ma trận 2 chiều: Chủ đề (hàng) × Dạng câu hỏi × Mức độ (cột).
Luôn trả về JSON hợp lệ, không bao giờ thêm text ngoài JSON.`;
      
      const prompt = `NHIỆM VỤ: Phân tích chi tiết văn bản đề thi/kiểm tra sau để trích xuất cấu trúc MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ theo đúng mẫu Công văn 7991/BGDĐT-GDTrH.

=== HƯỚNG DẪN PHÂN TÍCH ===

**BƯỚC 1: Nhận diện thông tin chung**
- Xác định môn học (subject)
- Xác định thời gian làm bài (mặc định 45 phút nếu không rõ)
- Đếm tổng số câu hỏi
- Tổng điểm (mặc định 10 điểm nếu không rõ)

**BƯỚC 2: Phân loại từng câu hỏi theo 4 dạng TNKQ + Tự luận**
Xác định CHÍNH XÁC dạng câu hỏi cho từng câu:
1. "multiple_choice" (Nhiều lựa chọn): Câu hỏi có 4 phương án A/B/C/D, chọn 1 đáp án đúng
2. "true_false" (Đúng – Sai): Câu hỏi có 4 ý nhỏ a/b/c/d, mỗi ý phải xác định Đúng hoặc Sai
3. "short_answer" (Trả lời ngắn): Câu hỏi yêu cầu điền số, kết quả ngắn (không có đáp án cho sẵn)
4. "essay" (Tự luận): Câu hỏi yêu cầu trình bày, chứng minh, giải bài toán dài

**BƯỚC 3: Phân loại mức độ nhận thức cho từng câu**
- "Nhận biết": Nhớ, nhận ra kiến thức cơ bản (định nghĩa, công thức, khái niệm)
- "Thông hiểu": Giải thích, so sánh, diễn đạt lại, chuyển đổi dạng
- "Vận dụng": Áp dụng kiến thức vào tình huống quen thuộc, giải bài tập cơ bản
- "Vận dụng cao": Phân tích, đánh giá, tổng hợp, sáng tạo trong tình huống mới/phức tạp

**BƯỚC 4: Xác định chủ đề kiến thức (topics) của từng câu**
- Nhóm các câu hỏi theo chủ đề/chương
- Mỗi chủ đề phải có tên rõ ràng

**BƯỚC 5: Xây dựng ma trận 2 chiều**
- Tạo mảng matrixCells: mỗi phần tử là 1 ô trong bảng ma trận (chủ đề × dạng × mức độ)
- Tính phân bổ điểm theo dạng câu hỏi (questionTypeAllocations)
- Tính phân bổ điểm theo mức độ nhận thức (difficultyAllocations)
- Quy tắc tính điểm mặc định (nếu đề không ghi rõ):
  + TNKQ Nhiều lựa chọn: mỗi câu 0.25 điểm
  + TNKQ Đúng-Sai: mỗi câu 1 điểm (0.25/ý × 4 ý; hoặc 0.1 điểm nếu đúng 1 ý, 0.25 điểm nếu đúng 2 ý, 0.5 điểm nếu đúng 3-4 ý — tùy đề)
  + TNKQ Trả lời ngắn: mỗi câu 0.5 điểm
  + Tự luận: điểm ghi trong đề (nếu không rõ thì chia đều)

**BƯỚC 6: Phân chia sections (các phần thi)**
- Nhóm câu hỏi thành các phần thi cùng dạng (giống logic cũ)
- Nếu có bài đọc hiểu/ngữ liệu chung → tạo section riêng với trường passage

=== QUY TẮC TỶ LỆ CHUẨN CV 7991 (tham khảo, có thể điều chỉnh theo đề thực tế) ===
- TNKQ Nhiều lựa chọn: ~30% (3,0 điểm / 10)
- TNKQ Đúng – Sai: ~20% (2,0 điểm / 10)  
- TNKQ Trả lời ngắn: ~20% (2,0 điểm / 10)
- Tự luận: ~30% (3,0 điểm / 10)
- Mức độ Nhận biết: ~40% (4,0 điểm)
- Mức độ Thông hiểu: ~30% (3,0 điểm)
- Mức độ Vận dụng + Vận dụng cao: ~30% (3,0 điểm)
LƯU Ý: Đây là tỷ lệ tham khảo. Nếu đề thực tế có tỷ lệ khác thì hãy dùng tỷ lệ thực tế. Nếu đề không có một dạng nào (VD: không có Trả lời ngắn) thì đặt phần đó = 0.

=== ĐỊNH DẠNG JSON OUTPUT ===
Trả về CHỈ JSON hợp lệ, KHÔNG thêm markdown hay text nào ngoài JSON:
{
  "subject": "Tên môn học",
  "durationMinutes": 45,
  "totalQuestions": 40,
  "totalPoints": 10,
  "topics": [
    {"name": "Chủ đề 1", "count": 10},
    {"name": "Chủ đề 2", "count": 8}
  ],
  "difficulties": [
    {"level": "Nhận biết", "count": 16},
    {"level": "Thông hiểu", "count": 12},
    {"level": "Vận dụng", "count": 8},
    {"level": "Vận dụng cao", "count": 4}
  ],
  "matrixCells": [
    {"topicName": "Chủ đề 1", "questionType": "multiple_choice", "difficulty": "Nhận biết", "questionCount": 3, "questionIds": ["1","2","3"]},
    {"topicName": "Chủ đề 1", "questionType": "multiple_choice", "difficulty": "Thông hiểu", "questionCount": 2, "questionIds": ["4","5"]},
    {"topicName": "Chủ đề 1", "questionType": "true_false", "difficulty": "Vận dụng", "questionCount": 1, "questionIds": ["25"]},
    {"topicName": "Chủ đề 2", "questionType": "essay", "difficulty": "Vận dụng cao", "questionCount": 1, "questionIds": ["39"]}
  ],
  "questionTypeAllocations": [
    {"type": "multiple_choice", "label": "Nhiều lựa chọn", "totalPoints": 3.0, "percentage": 30},
    {"type": "true_false", "label": "Đúng – Sai", "totalPoints": 2.0, "percentage": 20},
    {"type": "short_answer", "label": "Trả lời ngắn", "totalPoints": 2.0, "percentage": 20},
    {"type": "essay", "label": "Tự luận", "totalPoints": 3.0, "percentage": 30}
  ],
  "difficultyAllocations": [
    {"level": "Nhận biết", "totalPoints": 4.0, "percentage": 40},
    {"level": "Thông hiểu", "totalPoints": 3.0, "percentage": 30},
    {"level": "Vận dụng", "totalPoints": 2.0, "percentage": 20},
    {"level": "Vận dụng cao", "totalPoints": 1.0, "percentage": 10}
  ],
  "sections": [
    {
      "id": "sec-1",
      "name": "PHẦN I: Trắc nghiệm nhiều lựa chọn",
      "instruction": "Chọn 1 đáp án đúng trong 4 phương án A, B, C, D",
      "questionType": "multiple_choice",
      "questions": [
        {
          "originalId": "1",
          "topic": "Chủ đề 1",
          "difficulty": "Nhận biết",
          "stemDescription": "Mô tả ngắn gọn yêu cầu cốt lõi của câu hỏi"
        }
      ]
    },
    {
      "id": "sec-2",
      "name": "PHẦN II: Trắc nghiệm Đúng – Sai",
      "instruction": "Mỗi câu có 4 ý a, b, c, d. Với mỗi ý, chọn Đúng hoặc Sai",
      "questionType": "true_false",
      "questions": [...]
    },
    {
      "id": "sec-3",
      "name": "PHẦN III: Trả lời ngắn",
      "instruction": "Trả lời ngắn gọn (điền số hoặc kết quả)",
      "questionType": "short_answer",
      "questions": [...]
    },
    {
      "id": "sec-4",
      "name": "PHẦN IV: Tự luận",
      "instruction": "Trình bày lời giải chi tiết",
      "questionType": "essay",
      "questions": [...]
    }
  ]
}

=== QUY TẮC QUAN TRỌNG ===
1. Mảng "matrixCells" phải bao phủ TẤT CẢ các câu hỏi. Tổng questionCount trong matrixCells phải = totalQuestions.
2. Chỉ tạo matrixCells cho các ô có questionCount > 0. Không tạo ô rỗng.
3. Nếu đề không có dạng Đúng-Sai hoặc Trả lời ngắn, vẫn phải có phần tử trong questionTypeAllocations nhưng totalPoints = 0, percentage = 0.
4. "sections" phải chứa ĐẦY ĐỦ tất cả câu hỏi với stemDescription rõ ràng.
5. Mảng "topics" chỉ chứa các chủ đề CÓ câu hỏi, count = tổng số câu theo chủ đề đó.
6. Nếu đề có bài đọc hiểu/ngữ liệu chung cho nhiều câu → tạo section riêng + trường "passage".

VĂN BẢN ĐỀ THI CẦN PHÂN TÍCH:
${text.substring(0, 30000)}
`;

      Swal.fire({
          title: 'Đang dùng AI phân tích cấu trúc đề theo CV 7991...',
          html: '<p style="font-size:13px;color:#64748b">Xây dựng ma trận 2 chiều: Chủ đề × Dạng câu hỏi × Mức độ nhận thức</p>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
      });

      try {
          const resp = await callGemini({ prompt, model: getStoredModel(), systemInstruction }, getStoredApiKey());
          setMatrix(resp);
          Swal.close();
      } catch (e: any) {
          Swal.fire('Lỗi phân tích', e.message, 'error');
          setStep(0); // Go back
      }
  };

  const handleGenerateExam = async () => {
      if (!matrix) return;
      setStep(2);
      setIsGenerating(true);

      const allQuestions: any[] = [];
      const sections = matrix.sections || [];

      try {
          if (sections.length > 0) {
              // Generate section-by-section to respect exam structure
              for (const section of sections) {
                  // If section has too many questions and NO passage, chunk it
                  const BATCH_SIZE = 20;
                  const questionSlices: any[][] = [];
                  
                  if (section.passage || section.questions.length <= BATCH_SIZE) {
                      questionSlices.push(section.questions);
                  } else {
                      for (let i = 0; i < section.questions.length; i += BATCH_SIZE) {
                          questionSlices.push(section.questions.slice(i, i + BATCH_SIZE));
                      }
                  }

                  let generatedPassage = '';

                  for (let sIdx = 0; sIdx < questionSlices.length; sIdx++) {
                      const slice = questionSlices[sIdx];
                      const totalInSlice = slice.length;

                      const prompt = `Bạn là một giáo viên xuất sắc. Nhiệm vụ của bạn là tạo các câu hỏi mới cho đề thi môn ${matrix.subject} dựa trên cấu trúc mô tả dưới đây.

Yêu cầu chung:
- KHÔNG dùng lại câu hỏi cũ. Tạo câu hỏi MỚI hoàn toàn, thay đổi số liệu, bối cảnh, câu chữ nhưng giữ nguyên độ khó, chuyên đề và kiểu hỏi.
- Đảm bảo câu hỏi có tính chất tương đồng về mặt sư phạm (ví dụ: nếu mô tả yêu cầu tính cực trị hàm số bậc ba thì tạo câu mới cũng tính cực trị hàm số bậc ba nhưng có phương trình khác).

Yêu cầu cho phần thi này:
- Tên phần: "${section.name}"
- Chỉ dẫn làm bài: "${section.instruction}"
- Loại câu hỏi: "${section.questionType}"
${section.passage ? `- BÀI ĐỌC GỐC (để tham khảo chủ đề/độ khó): "${section.passage}"\n=> Hãy tạo ra một BÀI ĐỌC MỚI hoàn toàn tương đương (cùng chủ đề, cùng số chữ, cùng độ khó từ vựng/ngữ pháp). Sau đó đặt các câu hỏi dựa theo bài đọc mới này.` : ''}
${generatedPassage ? `- BÀI ĐỌC MỚI ĐÃ TẠO (phải dùng bài đọc này để đặt câu hỏi tiếp theo): "${generatedPassage}"` : ''}

Định dạng câu hỏi theo loại "${section.questionType}":
1. Nếu loại là "multiple_choice" (Trắc nghiệm 4 lựa chọn):
   - Trả về 4 đáp án A, B, C, D. Chỉ rõ đáp án đúng (ví dụ: "A").
2. Nếu loại là "true_false" (Trắc nghiệm Đúng/Sai):
   - Thường gồm 1 câu hỏi dẫn/tình huống chính, kèm theo 4 mệnh đề con a, b, c, d.
   - Điền 4 mệnh đề con vào trường "options" dưới dạng: [{"id":"A","content":"a) Nội dung mệnh đề a"},{"id":"B","content":"b) Nội dung mệnh đề b"},{"id":"C","content":"c) Nội dung mệnh đề c"},{"id":"D","content":"d) Nội dung mệnh đề d"}].
   - Trường "correctAnswer" phải ghi rõ kết quả của từng ý theo định dạng: "a: Đúng, b: Sai, c: Đúng, d: Sai".
3. Nếu loại là "short_answer" (Trắc nghiệm trả lời ngắn/điền số):
   - KHÔNG có trường "options".
   - Trường "correctAnswer" là đáp số/kết quả ngắn gọn (ví dụ: "5" hoặc "3.5" hoặc "-12").
4. Nếu loại là "essay" (Tự luận):
   - KHÔNG có trường "options".
   - Trường "correctAnswer" là hướng dẫn chấm/đáp án tóm tắt.

Trả về CHỈ JSON theo cấu trúc sau (không chứa markdown ngoài khối code json):
{
  "passage": "Nội dung bài đọc mới vừa tạo (nếu phần này có bài đọc, hãy điền văn bản bài đọc mới vào đây; nếu không có hãy bỏ qua trường này)",
  "questions": [
    {
      "originalId": "Số câu (ví dụ: '1')",
      "type": "${section.questionType}",
      "topic": "Tên chuyên đề",
      "difficulty": "Mức độ khó",
      "content": "Nội dung câu hỏi mới (sử dụng Markdown/LaTeX nếu cần)",
      "options": [{"id": "A", "content": "..."}, {"id": "B", "content": "..."}],
      "correctAnswer": "Đáp án đúng theo mô tả ở trên",
      "explanation": "Lời giải thích chi tiết vì sao đáp án đó đúng"
    }
  ]
}

DANH SÁCH CÂU HỎI CẦN TẠO:
${JSON.stringify(slice, null, 2)}
`;
                      
                      const resp = await callGemini({ prompt, model: getStoredModel() }, getStoredApiKey());
                      
                      let questionsList: any[] = [];
                      if (resp && Array.isArray(resp.questions)) {
                          questionsList = resp.questions;
                          if (resp.passage) {
                              generatedPassage = resp.passage;
                          }
                      } else if (Array.isArray(resp)) {
                          questionsList = resp;
                      } else {
                          const preview = JSON.stringify(resp)?.substring(0, 300) ?? '(null)';
                          throw new Error(`Phần "${section.name}" trả về sai định dạng.\nNhận được: ${preview}`);
                      }

                      // Map the questions back to their section
                      for (const q of questionsList) {
                          allQuestions.push({
                              ...q,
                              sectionId: section.id,
                              passage: generatedPassage || undefined
                          });
                      }
                  }
              }
          } else {
              // Fallback legacy mode if no sections parsed
              const BATCH_SIZE = 25;
              const topics = matrix.topics || [];
              const batches: Array<Array<{name: string; count: number}>> = [];
              let currentBatch: Array<{name: string; count: number}> = [];
              let currentBatchTotal = 0;

              for (const topic of topics) {
                  let remaining = topic.count;
                  while (remaining > 0) {
                      const canFit = BATCH_SIZE - currentBatchTotal;
                      if (canFit <= 0) {
                          batches.push(currentBatch);
                          currentBatch = [];
                          currentBatchTotal = 0;
                          continue;
                      }
                      const take = Math.min(remaining, canFit);
                      currentBatch.push({ name: topic.name, count: take });
                      currentBatchTotal += take;
                      remaining -= take;
                  }
                  if (currentBatchTotal >= BATCH_SIZE) {
                      batches.push(currentBatch);
                      currentBatch = [];
                      currentBatchTotal = 0;
                  }
              }
              if (currentBatch.length > 0) batches.push(currentBatch);

              if (batches.length === 0) {
                  batches.push([{ name: matrix.subject || 'Tổng hợp', count: Math.min(matrix.totalQuestions || 20, BATCH_SIZE) }]);
              }

              for (let i = 0; i < batches.length; i++) {
                  const totalInBatch = batches[i].reduce((s, t) => s + t.count, 0);
                  const prompt = `Bạn là giáo viên xuất sắc. Hãy tạo ra ĐÚNG ${totalInBatch} câu hỏi trắc nghiệm MỚI cho môn ${matrix.subject}.
Yêu cầu:
- Mỗi câu đúng chủ đề, số lượng trong bảng bên dưới.
- 4 đáp án A/B/C/D, chỉ rõ đáp án đúng, giải thích ngắn gọn.
- Trả về CHỈ JSON hợp lệ:
{"questions":[{"originalId":"1","type":"multiple_choice","topic":"...","difficulty":"Nhận biết","content":"...","options":[{"id":"A","content":"..."},{"id":"B","content":"..."},{"id":"C","content":"..."},{"id":"D","content":"..."}],"correctAnswer":"A","explanation":"..."}]}

CHỦ ĐỀ CẦN TẠO:
${JSON.stringify(batches[i])}`;

                  const resp = await callGemini({ prompt, model: getStoredModel() }, getStoredApiKey());
                  if (resp && Array.isArray(resp.questions)) {
                      allQuestions.push(...resp.questions);
                  } else if (Array.isArray(resp)) {
                      allQuestions.push(...resp);
                  } else {
                      const preview = JSON.stringify(resp)?.substring(0, 300) ?? '(null)';
                      throw new Error(`Batch ${i + 1}/${batches.length} trả về sai định dạng.\nNhận được: ${preview}`);
                  }
              }
          }

          if (allQuestions.length === 0) {
              throw new Error('AI không tạo được câu hỏi nào. Vui lòng thử lại.');
          }

          const newExam: Exam = {
              id: uuidv4(),
              title: `Đề thi song song: ${matrix.subject} - ${new Date().toLocaleDateString('vi-VN')}`,
              createdAt: Date.now(),
              matrix: matrix,
              questions: allQuestions.map((q: any) => ({...q, id: uuidv4()}))
          };
          setCurrentExam(newExam);
          storeExam(newExam);
          refreshHistory();
      } catch (e: any) {
          Swal.fire('Lỗi tạo đề', e.message, 'error');
          setStep(1);
      } finally {
          setIsGenerating(false);
      }
  }

  const handleRegenerateQuestion = async (qId: string) => {
       if (!currentExam) return;
       const qIndex = currentExam.questions.findIndex(q => q.id === qId);
       if (qIndex < 0) return;
       const oldQ = currentExam.questions[qIndex];

       const prompt = `Sinh ra 1 câu hỏi tương đương thay thế cho câu hỏi dưới đây. Yêu cầu cùng dạng, cùng mức độ khó (${oldQ.difficulty}), cùng chuyên đề (${oldQ.topic}) nhưng nội dung hoàn toàn khác.
Trả về 1 JSON object y hệt định dạng gốc:
{
  "originalId": "${oldQ.originalId}",
  "type": "${oldQ.type}",
  "topic": "${oldQ.topic}",
  "difficulty": "${oldQ.difficulty}",
  "content": "...",
  "options": [...],
  "correctAnswer": "A",
  "explanation": "..."
}

Câu hỏi gốc (để tránh trùng lặp):
${oldQ.content}
`;
       Swal.fire({ title: 'Đang tạo câu hỏi mới...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
       
       try {
           const resp = await callGemini({ prompt, model: getStoredModel() }, getStoredApiKey());
           if (resp && resp.content) {
               const newExam = {...currentExam};
               newExam.questions[qIndex] = { ...resp, id: uuidv4() };
               setCurrentExam(newExam);
               storeExam(newExam);
               Swal.close();
           } else {
              throw new Error("Không thể map câu hỏi");
           }
       } catch (e: any) {
           Swal.fire('Lỗi đổi câu', 'Không thể tạo lại câu hỏi. Thiếu token hoặc lỗi định dạng.', 'error');
       }
  }

  const handleSave = () => {
      if (currentExam) {
          storeExam(currentExam);
          refreshHistory();
          Swal.fire({ icon:'success', title: 'Đã lưu đề thi!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false});
      }
  }

  const handleShuffleAnswers = () => {
      if (!currentExam) return;
      const shuffled = {
          ...currentExam,
          questions: currentExam.questions.map(q => {
              if (q.type !== 'multiple_choice' || !q.options) return q;
              // Shuffle options array
              const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
              // Re-label as A, B, C, D
              const labels = ['A', 'B', 'C', 'D'];
              const relabeledOptions = shuffledOptions.map((opt, i) => ({ ...opt, id: labels[i] }));
              // Find new position of correct answer
              const oldCorrectContent = q.options.find(o => o.id === q.correctAnswer)?.content;
              const newCorrectId = relabeledOptions.find(o => o.content === oldCorrectContent)?.id || q.correctAnswer;
              return { ...q, options: relabeledOptions, correctAnswer: newCorrectId };
          })
      };
      setCurrentExam(shuffled);
      storeExam(shuffled);
      Swal.fire({ icon: 'success', title: 'Đã xáo trộn đáp án!', text: 'Đáp án đúng được cập nhật tự động.', toast: true, position: 'top-end', timer: 2500, showConfirmButton: false });
  }

  const handleEditQuestion = (qId: string, updated: Partial<Question>) => {
      if (!currentExam) return;
      const newExam = {
          ...currentExam,
          questions: currentExam.questions.map(q => q.id === qId ? { ...q, ...updated } : q)
      };
      setCurrentExam(newExam);
      storeExam(newExam);
  }

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-900 flex flex-col font-sans overflow-hidden">
      <Header 
         step={step} 
         openSettings={() => setShowSettings(true)}
         toggleSidebar={() => setShowSidebar(!showSidebar)} 
      />
      
      <main className="flex flex-1 overflow-hidden">
          {showSidebar && (
              <Sidebar 
                 exams={history} 
                 onSelect={handleSelectHistory} 
                 currentId={currentExam?.id || null} 
              />
          )}
          
          <div className="flex-1 flex flex-col overflow-hidden relative">
             {step === 0 && (
                 <Dropzone onTextExtracted={handleTextExtracted} />
             )}
             {step === 1 && matrix && (
                 <MatrixDashboard matrix={matrix} onMatrixChange={setMatrix} onGenerate={handleGenerateExam} />
             )}
             {step === 2 && (
                 <Workspace 
                     isGenerating={isGenerating}
                     exam={currentExam}
                     onRegenerateQuestion={handleRegenerateQuestion}
                     onSave={handleSave}
                     onShuffleAnswers={handleShuffleAnswers}
                     onEditQuestion={handleEditQuestion}
                 />
             )}
          </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
