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
      
      const prompt = `Phân tích chi tiết văn bản đề thi sau đây để trích xuất cấu trúc ma trận và phân chia các phần thi chi tiết.
Nhiệm vụ:
1. Xác định môn học (subject).
2. Xác định thời gian làm bài (mặc định là 45 nếu không thấy) bằng số phút.
3. Đếm tổng số câu hỏi (totalQuestions).
4. Liệt kê các chuyên đề kiến thức (topics) và phân bổ mức độ nhận thức (difficulties: "Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao") trên phạm vi toàn đề.
5. Phân chia đề thi thành các Phần thi (sections). Một phần thi đại diện cho một cụm câu hỏi cùng định dạng hoặc chung một ngữ liệu/bài đọc:
   - Các câu hỏi trắc nghiệm thông thường (chọn 1 đáp án A/B/C/D) -> questionType: "multiple_choice"
   - Các câu hỏi Đúng/Sai (có 4 ý a, b, c, d cần chọn Đúng hoặc Sai cho mỗi ý) -> questionType: "true_false"
   - Các câu hỏi điền số/trả lời ngắn -> questionType: "short_answer"
   - Các câu hỏi tự luận -> questionType: "essay"
   - Nếu có một ĐOẠN VĂN ĐỌC HIỂU (reading passage) hoặc ĐOẠN VĂN ĐIỀN TỪ (cloze passage) dùng chung cho một cụm câu hỏi, hãy tạo một section riêng cho cụm này, trích xuất đoạn văn đó vào trường "passage", và nhóm các câu hỏi liên quan vào section đó.
   - Với mỗi câu hỏi trong từng phần, hãy điền:
     + originalId: số thứ tự của câu (ví dụ: "1", "2")
     + topic: chuyên đề của câu đó
     + difficulty: mức độ khó ("Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao")
     + stemDescription: Mô tả cực kỳ ngắn gọn yêu cầu cốt lõi câu hỏi kiểm tra (ví dụ: "Tính đạo hàm hàm hợp bậc ba", "Tìm từ đồng nghĩa của từ 'remarkable'", "Tìm từ phát âm khác biệt phần gạch chân").

Trả về kết quả chuẩn JSON theo đúng định dạng sau, KHÔNG thêm bất kỳ text nào ngoài JSON:
{
  "subject": "Tên môn học",
  "durationMinutes": 60,
  "totalQuestions": 50,
  "topics": [{"name": "Tên chuyên đề", "count": 10}, ...],
  "difficulties": [
      {"level": "Nhận biết", "count": 20},
      {"level": "Thông hiểu", "count": 15},
      {"level": "Vận dụng", "count": 10},
      {"level": "Vận dụng cao", "count": 5}
  ],
  "sections": [
    {
      "id": "sec-1",
      "name": "PHẦN I: ...",
      "instruction": "Hướng dẫn làm bài...",
      "questionType": "multiple_choice",
      "passage": "Nội dung đoạn văn đọc hiểu nếu có, nếu không thì bỏ qua trường này",
      "questions": [
        {
          "originalId": "1",
          "topic": "Chuyên đề của câu",
          "difficulty": "Mức độ",
          "stemDescription": "Mô tả cốt lõi yêu cầu câu hỏi"
        }
      ]
    }
  ]
}

VĂN BẢN ĐỀ THI:
${text.substring(0, 30000)}
`;

      Swal.fire({
          title: 'Đang dùng AI phân tích cấu trúc đề...',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
      });

      try {
          const resp = await callGemini({ prompt, model: getStoredModel() }, getStoredApiKey());
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
