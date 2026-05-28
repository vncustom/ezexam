import { useState, useRef } from "react";
import { Exam } from "../types";
import { QuestionCard } from "./QuestionCard";
import { Loader2, FileDown, Shuffle, Save, FileText } from "lucide-react";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { exportExamToDocx } from "../lib/docx";
import Swal from "sweetalert2";

export function Workspace({
    exam,
    onRegenerateQuestion,
    onSave,
    isGenerating,
    onShuffleAnswers,
    onEditQuestion,
}: {
    exam: Exam | null;
    onRegenerateQuestion: (qId: string) => void;
    onSave: () => void;
    isGenerating: boolean;
    onShuffleAnswers?: () => void;
    onEditQuestion?: (qId: string, updated: Partial<import('../types').Question>) => void;
}) {
    const [viewMode, setViewMode] = useState<'both' | 'exam' | 'solution'>('both');
    const [isExportingDocx, setIsExportingDocx] = useState(false);
    const examRef = useRef<HTMLDivElement>(null);

    const renderQuestionsList = (isAnswer: boolean) => {
        const sections = exam.matrix.sections;
        if (sections && sections.length > 0) {
            return sections.map((sec) => {
                const secQuestions = exam.questions.filter(q => q.sectionId === sec.id);
                if (secQuestions.length === 0) return null;

                return (
                    <div key={sec.id} className="border-b border-slate-100 pb-4">
                        {/* Section Header */}
                        <div className="p-[20px_40px_10px] bg-slate-50/50 border-b border-slate-200/50">
                            <h4 className="font-bold text-[14px] uppercase tracking-wide text-indigo-900">{sec.name}</h4>
                            <p className="text-[12px] text-slate-600 mt-1 italic">{sec.instruction}</p>
                        </div>

                        {/* Passage - show only once per section, on the exam side */}
                        {!isAnswer && sec.passage && (
                            <div className="m-[20px_40px_10px] p-5 bg-indigo-50/30 border border-indigo-100/60 rounded-xl leading-relaxed text-[14.5px] text-slate-800 font-serif">
                                <div className="font-semibold text-xs text-indigo-700 uppercase tracking-wider mb-2">Đọc hiểu ngữ liệu sau:</div>
                                <p className="whitespace-pre-wrap">{sec.passage}</p>
                            </div>
                        )}

                        {/* Section Questions */}
                        <div className="flex flex-col">
                            {secQuestions.map(q => (
                                <QuestionCard 
                                    key={isAnswer ? `sol-${q.id}` : q.id} 
                                    question={q} 
                                    isAnswerSide={isAnswer} 
                                    onRegenerate={onRegenerateQuestion} 
                                    onEdit={onEditQuestion} 
                                />
                            ))}
                        </div>
                    </div>
                );
            });
        }

        // Fallback: flat list
        return exam.questions.map(q => (
            <QuestionCard 
                key={isAnswer ? `sol-${q.id}` : q.id} 
                question={q} 
                isAnswerSide={isAnswer} 
                onRegenerate={onRegenerateQuestion} 
                onEdit={onEditQuestion} 
            />
        ));
    };

    const handleExportPDF = async () => {
        if (!examRef.current || !exam) return;
        const opt = {
            margin: 10,
            filename: `${exam.title.replace(/\s+/g, '_')}_DeThi.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
        };
        await html2pdf().set(opt).from(examRef.current).save();
    };

    const handleExportDocx = async () => {
        if (!exam) return;
        setIsExportingDocx(true);
        try {
            await exportExamToDocx(exam);
            Swal.fire({ icon: 'success', title: 'Xuất Word thành công!', text: 'File .docx đã được tải về.', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
        } catch (e: any) {
            Swal.fire('Lỗi xuất Word', e.message || 'Không thể tạo file Word.', 'error');
        } finally {
            setIsExportingDocx(false);
        }
    };

    if (isGenerating) {
        return (
            <div className="flex-1 p-6 bg-slate-100 flex flex-col items-center justify-center overflow-hidden">
                <Loader2 size={48} className="animate-spin text-indigo-600 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900">Đang sinh đề thi...</h2>
                <p className="text-sm text-slate-600 mt-2">AI đang tạo ra các câu hỏi tương đương.</p>
            </div>
        );
    }

    if (!exam) return null;

    return (
        <section className="flex-1 p-4 lg:p-6 bg-slate-100 flex flex-col lg:flex-row gap-6 overflow-hidden">

            {/* Exam View */}
            <div className={`flex-[1.2] bg-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] rounded-lg flex flex-col overflow-hidden ${viewMode === 'solution' ? 'hidden lg:flex' : 'flex'}`}>

                {/* Paper Header */}
                <div className="p-[40px_40px_20px] text-center border-b border-dashed border-slate-300 shrink-0">
                    <h2 className="text-[18px] font-bold mb-1 uppercase">ĐỀ THI SONG SONG - {exam.matrix.subject}</h2>
                    <p className="text-[14px] font-semibold">{exam.title}</p>
                    <p className="text-[12px] text-slate-600 mt-1">Thời gian làm bài: {exam.matrix.durationMinutes} phút (Không kể thời gian phát đề)</p>
                </div>

                <div className="flex-1 overflow-y-auto" ref={examRef}>
                    {renderQuestionsList(false)}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-200 bg-white flex flex-wrap justify-end gap-2 shrink-0">
                    {onShuffleAnswers && (
                        <button
                            onClick={onShuffleAnswers}
                            title="Xáo trộn ngẫu nhiên thứ tự đáp án A/B/C/D"
                            className="px-4 py-[10px] rounded-lg font-semibold text-sm cursor-pointer transition-all duration-200 bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 flex items-center gap-1.5"
                        >
                            <Shuffle size={14} />
                            Xáo trộn đáp án
                        </button>
                    )}
                    <button
                        onClick={onSave}
                        className="px-4 py-[10px] rounded-lg font-semibold text-sm cursor-pointer transition-all duration-200 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                        <Save size={14} />
                        Lưu nháp
                    </button>
                    <button
                        onClick={handleExportDocx}
                        disabled={isExportingDocx}
                        className="px-4 py-[10px] rounded-lg font-semibold text-sm cursor-pointer border-none transition-all duration-200 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5"
                    >
                        {isExportingDocx ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        Xuất Word
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="px-4 py-[10px] rounded-lg font-semibold text-sm cursor-pointer border-none transition-all duration-200 bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-sm hover:opacity-90 flex items-center gap-1.5"
                    >
                        <FileDown size={14} />
                        Xuất PDF
                    </button>
                </div>
            </div>

            {/* Solution Panel */}
            <div className={`flex-[0.8] flex flex-col gap-5 overflow-y-auto no-scrollbar pb-10 lg:pb-0 ${viewMode === 'exam' ? 'hidden lg:flex' : 'flex'}`}>
                <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col min-h-0 h-full">
                    <h3 className="font-bold text-base mb-4 text-slate-900 pb-2 border-b border-slate-100 shrink-0">Đáp án & Giải thích</h3>

                    <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4">
                        {renderQuestionsList(true)}
                    </div>
                </div>

                {/* Mobile View Toggle */}
                <div className="flex lg:hidden bg-white rounded-xl shadow border border-slate-100 p-2 gap-2 shrink-0">
                    <button onClick={() => setViewMode('exam')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${viewMode === 'exam' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'}`}>Đề thi</button>
                    <button onClick={() => setViewMode('solution')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${viewMode === 'solution' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'}`}>Đáp án</button>
                </div>
            </div>
        </section>
    );
}
