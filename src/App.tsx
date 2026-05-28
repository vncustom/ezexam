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
      
      const prompt = `Phân tích văn bản đề thi sau đây.
Nhiệm vụ:
1. Xác định môn học (subject).
2. Xác định thời gian làm bài (nếu có, mặc định là 45 nếu không thấy) bằng số phút.
3. Đếm tổng số câu hỏi.
4. Lên danh sách các "chuyên đề kiến thức" (topics) xuất hiện trong đề và đếm số câu của mỗi chuyên đề.
5. Phân loại mức độ nhận thức (difficulties) cho các câu hỏi theo 4 mức chuẩn của Việt Nam: "Nhận biết", "Thông hiểu", "Vận dụng", "Vận dụng cao" và đếm số lượng.

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
  ]
}

Văn bản đề thi:
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

      // Build batch prompt for a subset of topics
      const buildBatchPrompt = (topicSlice: Array<{name: string; count: number}>, batchIdx: number, totalBatches: number) => {
          const totalInBatch = topicSlice.reduce((s, t) => s + t.count, 0);
          return `Bạn là giáo viên xuất sắc. Hãy tạo ra ĐÚNG ${totalInBatch} câu hỏi trắc nghiệm MỚI cho môn ${matrix!.subject}.
Yêu cầu:
- Mỗi câu đúng chủ đề, số lượng trong bảng bên dưới.
- 4 đáp án A/B/C/D, chỉ rõ đáp án đúng, giải thích ngắn gọn.
- Trả về CHỈ JSON hợp lệ (batch ${batchIdx + 1}/${totalBatches}), KHÔNG có text ngoài JSON:
{"questions":[{"originalId":"1","type":"multiple_choice","topic":"...","difficulty":"Nhận biết","content":"...","options":[{"id":"A","content":"..."},{"id":"B","content":"..."},{"id":"C","content":"..."},{"id":"D","content":"..."}],"correctAnswer":"A","explanation":"..."}]}

CHỦ ĐỀ CẦN TẠO:
${JSON.stringify(topicSlice)}`;
      };

      try {
          const BATCH_SIZE = 25; // questions per API call to stay well within token/time limits
          const topics: Array<{name: string; count: number}> = matrix.topics || [];

          // Split topics into batches where each batch has at most BATCH_SIZE questions
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

          // Fallback: if no topics parsed, use a single simple prompt
          if (batches.length === 0) {
              const fallbackCount = Math.min(matrix.totalQuestions || 20, BATCH_SIZE);
              batches.push([{ name: matrix.subject || 'Tổng hợp', count: fallbackCount }]);
          }

          const allQuestions: any[] = [];

          for (let i = 0; i < batches.length; i++) {
              const prompt = buildBatchPrompt(batches[i], i, batches.length);
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
