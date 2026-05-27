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

      const prompt = `Bạn là một giáo viên xuất sắc. Dựa vào ma trận đề thi sau, hãy tạo ra MỘT ĐỀ THI TƯƠNG TỰ (ĐỀ SONG SONG) hoàn toàn mới.
Yêu cầu:
- Tuyệt đối bám sát cấu trúc, số lượng câu, chuyên đề và độ khó của ma trận này.
- Câu hỏi mới không được giống câu gốc (nếu bạn biết đề gốc), thay đổi số liệu, nhân vật, bối cảnh.
- Cung cấp 4 đáp án (A,B,C,D) cho các câu trắc nghiệm, chỉ định đáp án đúng và giải thích chi tiết tại sao đúng.
- Trả về CHỈ JSON theo định dạng sau (đảm bảo escape JSON đúng):
{
  "questions": [
    {
      "originalId": "1",
      "type": "multiple_choice",
      "topic": "Tên chuyên đề",
      "difficulty": "Mức độ",
      "content": "Nội dung câu hỏi (có thể hỗ trợ markdown, latex $...$)",
      "options": [{"id": "A", "content": "Lựa chọn 1"}, {"id": "B", "content": "..."}],
      "correctAnswer": "A",
      "explanation": "Giải thích chi tiết các bước"
    }
  ]
}

MA TRẬN ĐỀ THI:
${JSON.stringify(matrix)}
`;
      try {
          // Force high output token limits if available, setting default in api handles this
          const resp = await callGemini({ prompt, model: getStoredModel() }, getStoredApiKey());
          
          if (resp && resp.questions) {
              const newExam: Exam = {
                  id: uuidv4(),
                  title: `Đề thi song song: ${matrix.subject} - ${new Date().toLocaleDateString('vi-VN')}`,
                  createdAt: Date.now(),
                  matrix: matrix,
                  questions: resp.questions.map((q: any) => ({...q, id: uuidv4()}))
              };
              setCurrentExam(newExam);
              storeExam(newExam);
              refreshHistory();
          } else {
              throw new Error("Dữ liệu trả về bị thiếu 'questions'");
          }
      } catch (e: any) {
          Swal.fire('Lỗi tạo đề', e.message, 'error');
          setStep(1); // Go back to matrix
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
