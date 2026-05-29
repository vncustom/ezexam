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
  const [isGeneratingAnswers, setIsGeneratingAnswers] = useState(false);

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

**BƯỚC 6: Phân chia sections (các phần thi & bài đọc hiểu)**
- Nhóm câu hỏi thành các phần thi cùng dạng hoặc theo bài đọc hiểu (ngữ liệu chung).
- Nếu đề thi có các đoạn văn đọc hiểu/ngữ liệu riêng biệt (ví dụ: các PASSAGE 1, 2, 3, 4 hoặc bài đọc 1, 2...), bạn phải phân chia thành từng section riêng biệt cho từng bài đọc đó (ví dụ: sec-1 cho bài đọc 1, sec-2 cho bài đọc 2).
- TRONG MỖI SECTION CÓ BÀI ĐỌC, TRƯỜNG "passage" CHỈ CẦN CHỨA TIÊU ĐỀ HOẶC ĐOẠN THAM CHIẾU NGẮN (ví dụ: "PASSAGE 1 - Bill Gates" hoặc "Bài đọc từ dòng 1 đến dòng 50"), TUYỆT ĐỐI KHÔNG COPY LẠI TOÀN BỘ VĂN BẢN BÀI ĐỌC CỦA ĐỀ THI GỐC để tiết kiệm token đầu ra và tránh việc JSON bị cắt cụt. Nội dung đầy đủ sẽ được AI tra cứu ở Bước 2.

=== BẮT BUỘC NGHIÊM NGẶT ===
1. BẮT BUỘC liệt kê ĐẦY ĐỦ 100% tất cả câu hỏi xuất hiện trong đề thi gốc vào danh sách "questions" của các "sections".
   Ví dụ: Nếu đề gốc có 40 câu hỏi, thì tổng số phần tử câu hỏi trong danh sách "questions" của toàn bộ các section cộng lại phải đúng bằng 40 câu. Tuyệt đối không được bỏ sót câu nào hoặc dùng dấu ba chấm "...".
2. Trường "stemDescription" của mỗi câu hỏi chỉ cần mô tả cực ngắn gọn yêu cầu cốt lõi (dưới 10 từ, ví dụ: "Hỏi về từ đồng nghĩa 'jeopardy'" hoặc "Tính đạo hàm hàm mũ").

=== QUY TẮC TỶ LỆ CHUẨN CV 7991 (tham khảo, có thể điều chỉnh theo đề thực tế) ===
- TNKQ Nhiều lựa chọn: ~30% (3,0 điểm / 10)
- TNKQ Đúng – Sai: ~20% (2,0 điểm / 10)  
- TNKQ Trả lời ngắn: ~20% (2,0 điểm / 10)
- Tự luận: ~30% (3,0 điểm / 10)
- Mức độ Nhận biết: ~40% (4,0 điểm)
- Mức độ Thông hiểu: ~30% (3,0 điểm)
- Mức độ Vận dụng + Vận dụng cao: ~30% (3,0 điểm)
LƯU Ý: Nếu đề thực tế có tỷ lệ khác thì hãy dùng tỷ lệ thực tế. Nếu đề không có một dạng nào thì đặt phần đó = 0.

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
    {"topicName": "Chủ đề 1", "questionType": "multiple_choice", "difficulty": "Nhận biết", "questionCount": 2, "questionIds": ["1","2"]},
    {"topicName": "Chủ đề 1", "questionType": "multiple_choice", "difficulty": "Thông hiểu", "questionCount": 1, "questionIds": ["3"]}
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
      "name": "PHẦN I: Bài đọc hiểu số 1 - Bill Gates",
      "instruction": "Đọc đoạn văn và chọn đáp án đúng nhất A, B, C hoặc D",
      "questionType": "multiple_choice",
      "passage": "PASSAGE 1 - Bill Gates (câu 1-10)",
      "questions": [
        {
          "originalId": "1",
          "topic": "Chủ đề 1",
          "difficulty": "Nhận biết",
          "stemDescription": "Hỏi về nơi sinh Bill Gates"
        },
        {
          "originalId": "2",
          "topic": "Chủ đề 1",
          "difficulty": "Thông hiểu",
          "stemDescription": "Hỏi về lý do bỏ học"
        }
      ]
    }
  ]
}

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

                      const prompt = `Bạn là một giáo viên xuất sắc. Nhiệm vụ của bạn là tạo các câu hỏi mới cho đề thi môn ${matrix.subject} dựa trên cấu trúc mô tả dưới đây.

ĐỀ THI GỐC BAN ĐẦU (chứa toàn bộ nội dung đề gốc để tra cứu bài đọc và đối chiếu câu hỏi):
"""
${pdfText}
"""

Yêu cầu chung:
- KHÔNG dùng lại câu hỏi cũ. Tạo câu hỏi MỚI hoàn toàn, thay đổi số liệu, bối cảnh, câu chữ nhưng giữ nguyên độ khó, chuyên đề và kiểu hỏi.
- Đảm bảo câu hỏi có tính chất tương đồng về mặt sư phạm.

Yêu cầu cho phần thi này:
- Tên phần: "${section.name}"
- Chỉ dẫn làm bài: "${section.instruction}"
- Loại câu hỏi: "${section.questionType}"
${section.passage ? `- THAM CHIẾU BÀI ĐỌC GỐC: "${section.passage}"\n=> Hãy tìm bài đọc gốc này trong phần "ĐỀ THI GỐC BAN ĐẦU" ở trên (dựa theo tiêu đề, tham chiếu hoặc nội dung tương ứng). Sau đó, hãy tạo ra một BÀI ĐỌC MỚI hoàn toàn tương đương (cùng chủ đề rộng, cùng độ dài khoảng cách từ, cùng độ khó về từ vựng và cấu trúc ngữ pháp). Cuối cùng, đặt các câu hỏi mới dựa theo nội dung của bài đọc mới này.` : ''}
${generatedPassage ? `- BÀI ĐỌC MỚI ĐÃ TẠO (bắt buộc phải dùng bài đọc mới này để đặt câu hỏi tiếp theo): "${generatedPassage}"` : ''}

Định dạng câu hỏi theo loại "${section.questionType}":
1. Nếu loại là "multiple_choice" (Trắc nghiệm 4 lựa chọn):
   - Trả về 4 đáp án A, B, C, D trong mảng options.
2. Nếu loại là "true_false" (Trắc nghiệm Đúng/Sai):
   - Thường gồm 1 câu hỏi dẫn/tình huống chính, kèm theo 4 mệnh đề con a, b, c, d.
   - Điền 4 mệnh đề con vào trường "options" dưới dạng: [{"id":"A","content":"a) Nội dung mệnh đề a"},{"id":"B","content":"b) Nội dung mệnh đề b"},{"id":"C","content":"c) Nội dung mệnh đề c"},{"id":"D","content":"d) Nội dung mệnh đề d"}].
3. Nếu loại là "short_answer" (Trắc nghiệm trả lời ngắn/điền số):
   - KHÔNG có trường "options".
4. Nếu loại là "essay" (Tự luận):
   - KHÔNG có trường "options".

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
      "options": [{"id": "A", "content": "..."}, {"id": "B", "content": "..."}]
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
- 4 đáp án A/B/C/D.
- Trả về CHỈ JSON hợp lệ:
{"questions":[{"originalId":"1","type":"multiple_choice","topic":"...","difficulty":"Nhận biết","content":"...","options":[{"id":"A","content":"..."},{"id":"B","content":"..."},{"id":"C","content":"..."},{"id":"D","content":"..."}]}]}

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

          // Cập nhật lại bài đọc mới được tạo vào các section trong matrix để hiển thị lên Workspace
          const updatedSections = sections.map(sec => {
              const matchingQ = allQuestions.find(q => q.sectionId === sec.id && q.passage);
              return {
                  ...sec,
                  passage: matchingQ ? matchingQ.passage : sec.passage
              };
          });

          const newExam: Exam = {
              id: uuidv4(),
              title: `Đề thi song song: ${matrix.subject} - ${new Date().toLocaleDateString('vi-VN')}`,
              createdAt: Date.now(),
              matrix: {
                  ...matrix,
                  sections: updatedSections
              },
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

  const handleGenerateAnswers = async () => {
      if (!currentExam) return;
      setIsGeneratingAnswers(true);

      Swal.fire({
          title: 'Đang giải đề & tạo đáp án...',
          html: '<p style="font-size:13px;color:#64748b">AI đang phân tích câu hỏi và viết lời giải chi tiết</p>',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
      });

      try {
          const questionsToSolve = currentExam.questions.map(q => ({
              id: q.id,
              originalId: q.originalId,
              type: q.type,
              content: q.content,
              options: q.options,
              passage: q.passage
          }));

          const prompt = `Bạn là một giáo viên xuất sắc. Nhiệm vụ của bạn là giải các câu hỏi trong đề thi dưới đây, chỉ ra đáp án đúng và viết lời giải thích ngắn gọn, rõ ràng cho từng câu.

ĐỀ THI CẦN GIẢI:
${JSON.stringify(questionsToSolve, null, 2)}

Yêu cầu:
1. Đối với câu hỏi trắc nghiệm (multiple_choice): correctAnswer là chữ cái đáp án đúng (Ví dụ: "A").
2. Đối với câu hỏi Đúng/Sai (true_false): correctAnswer có định dạng "a: Đúng, b: Sai, c: Đúng, d: Sai" (hoặc True/False).
3. Đối với trả lời ngắn (short_answer): correctAnswer là đáp số/chữ cụ thể ngắn gọn.
4. Đối với tự luận (essay): correctAnswer là đáp án tóm tắt hoặc hướng dẫn chấm.
5. Trường explanation là lời giải thích chi tiết vì sao đáp án đó đúng.

Trả về CHỈ JSON theo định dạng dưới đây, không kèm theo bất kỳ văn bản giải thích nào ngoài khối JSON:
{
  "solutions": [
    {
      "id": "ID câu hỏi (giữ nguyên id truyền vào từ đề thi)",
      "correctAnswer": "Đáp án đúng tương ứng",
      "explanation": "Lời giải thích chi tiết, rõ ràng"
    }
  ]
}
`;

          const resp = await callGemini({ prompt, model: getStoredModel() }, getStoredApiKey());
          
          if (resp && Array.isArray(resp.solutions)) {
              const solutionsMap = new Map<string, { correctAnswer: string, explanation: string }>();
              for (const sol of resp.solutions) {
                  solutionsMap.set(sol.id, {
                      correctAnswer: sol.correctAnswer,
                      explanation: sol.explanation
                  });
              }

              const updatedQuestions = currentExam.questions.map(q => {
                  const sol = solutionsMap.get(q.id);
                  if (sol) {
                      return {
                          ...q,
                          correctAnswer: sol.correctAnswer,
                          explanation: sol.explanation
                      };
                  }
                  return q;
              });

              const updatedExam = {
                  ...currentExam,
                  questions: updatedQuestions
              };
              setCurrentExam(updatedExam);
              storeExam(updatedExam);
              refreshHistory();
              Swal.fire({
                  icon: 'success',
                  title: 'Tạo đáp án thành công!',
                  toast: true,
                  position: 'top-end',
                  timer: 3000,
                  showConfirmButton: false
              });
          } else {
              throw new Error("Dữ liệu phản hồi từ AI không đúng định dạng solutions.");
          }
      } catch (e: any) {
          Swal.fire('Lỗi tạo đáp án', e.message, 'error');
      } finally {
          setIsGeneratingAnswers(false);
      }
  };

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
                     onGenerateAnswers={handleGenerateAnswers}
                     isGeneratingAnswers={isGeneratingAnswers}
                 />
             )}
          </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
