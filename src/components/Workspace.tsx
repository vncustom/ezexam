import { useState, useRef } from "react";
import { Exam } from "../types";
import { QuestionCard } from "./QuestionCard";
import { Loader2, FileDown, Shuffle, Save, FileText, Wand2 } from "lucide-react";
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
    onGenerateAnswers,
    isGeneratingAnswers = false,
}: {
    exam: Exam | null;
    onRegenerateQuestion: (qId: string) => void;
    onSave: () => void;
    isGenerating: boolean;
    onShuffleAnswers?: () => void;
    onEditQuestion?: (qId: string, updated: Partial<import('../types').Question>) => void;
    onGenerateAnswers?: () => void;
    isGeneratingAnswers?: boolean;
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
        if (!exam) return;
        
        Swal.fire({
            title: 'Đang khởi tạo PDF...',
            html: '<p style="font-size:13px;color:#64748b">Hệ thống đang chuyển đổi định dạng và tạo bản in A4...</p>',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // Tạm thời vô hiệu hóa tất cả stylesheet trên trang để tránh html2canvas quét phải thuộc tính 'oklch'
        const disabledSheets: HTMLStyleElement[] = [];
        const links = document.querySelectorAll('style, link[rel="stylesheet"]');
        links.forEach(sheet => {
            const htmlSheet = sheet as HTMLStyleElement | HTMLLinkElement;
            if (!htmlSheet.disabled) {
                try {
                    htmlSheet.disabled = true;
                    disabledSheets.push(htmlSheet as any);
                } catch (e) {
                    console.warn('Cannot disable stylesheet:', e);
                }
            }
        });

        try {
            // Tạo DOM chứa đề thi sạch hoàn toàn (Không sử dụng CSS Tailwind, không có oklch)
            const printContainer = document.createElement('div');
            printContainer.style.position = 'absolute';
            printContainer.style.left = '-9999px';
            printContainer.style.top = '-9999px';
            printContainer.style.width = '790px'; // Chiều rộng trang A4
            printContainer.style.background = '#ffffff';
            printContainer.style.color = '#000000';
            printContainer.style.padding = '40px';
            printContainer.style.fontFamily = '"Times New Roman", Times, serif';
            printContainer.style.fontSize = '14.5px';
            printContainer.style.lineHeight = '1.6';
            
            // 1. Render Header đề thi
            let htmlContent = `
                <div style="text-align: center; margin-bottom: 25px;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                        <tr>
                            <td style="width: 55%; text-align: center; vertical-align: top; font-size: 13px;">
                                SỞ GD&ĐT ________________<br/>
                                <strong style="text-transform: uppercase;">TRƯỜNG THPT ________________</strong>
                            </td>
                            <td style="width: 45%; text-align: center; vertical-align: top; font-size: 13px;">
                                <strong>ĐỀ KIỂM TRA ĐỊNH KÌ</strong><br/>
                                Môn: <strong style="text-transform: uppercase;">${exam.matrix.subject}</strong><br/>
                                <em>Thời gian làm bài: ${exam.matrix.durationMinutes} phút</em>
                            </td>
                        </tr>
                    </table>
                    <h2 style="font-size: 17px; margin: 15px 0 5px; font-weight: bold; text-transform: uppercase;">ĐỀ THI SONG SONG</h2>
                    <div style="font-style: italic; font-size: 13px; margin-bottom: 15px;">(${exam.title})</div>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; text-align: left; font-size: 13px;">
                        <tr>
                            <td style="width: 65%;">Họ và tên học sinh: ........................................................................</td>
                            <td style="width: 35%;">Số báo danh: .......................................</td>
                        </tr>
                    </table>
                    <hr style="border: none; border-top: 1px dashed #000; margin-bottom: 20px;" />
                </div>
            `;

            // Helper render từng câu hỏi
            const renderQ = (q: any) => {
                let qHtml = `
                    <div style="margin-bottom: 18px; page-break-inside: avoid;">
                        <span style="font-weight: bold;">Câu ${q.originalId}:</span> ${q.content}
                `;

                if (q.type === 'multiple_choice' && q.options) {
                    qHtml += `<div style="margin-top: 5px; margin-left: 25px;">`;
                    for (const opt of q.options) {
                        qHtml += `
                            <div style="margin-bottom: 4px;">
                                <strong style="margin-right: 5px;">${opt.id}.</strong>${opt.content}
                            </div>
                        `;
                    }
                    qHtml += `</div>`;
                } else if (q.type === 'true_false' && q.options) {
                    qHtml += `<div style="margin-top: 5px; margin-left: 25px;">`;
                    for (const opt of q.options) {
                        qHtml += `
                            <div style="margin-bottom: 4px; display: flex; justify-content: space-between; max-width: 480px;">
                                <span><strong>${opt.id.toLowerCase()})</strong> ${opt.content}</span>
                                <span style="color: #444; font-style: italic; font-size: 12px;">[ Đúng / Sai ]</span>
                            </div>
                        `;
                    }
                    qHtml += `</div>`;
                } else if (q.type === 'short_answer') {
                    qHtml += `
                        <div style="margin-top: 6px; margin-left: 25px; font-style: italic; color: #333;">
                            Đáp số: ........................................................................
                        </div>
                    `;
                } else if (q.type === 'essay') {
                    qHtml += `
                        <div style="margin-top: 8px; margin-left: 25px; font-style: italic; color: #555; line-height: 2;">
                            Bài làm:<br/>
                            ................................................................................................................................................<br/>
                            ................................................................................................................................................
                        </div>
                    `;
                }

                qHtml += `</div>`;
                return qHtml;
            };

            // 2. Render nội dung đề thi
            const sections = exam.matrix.sections;
            if (sections && sections.length > 0) {
                for (const sec of sections) {
                    const secQuestions = exam.questions.filter(q => q.sectionId === sec.id);
                    if (secQuestions.length === 0) continue;

                    htmlContent += `
                        <div style="margin-top: 25px; margin-bottom: 10px; page-break-inside: avoid;">
                            <strong style="text-transform: uppercase; font-size: 14.5px;">${sec.name}</strong>
                            <div style="font-style: italic; font-size: 12.5px; margin-top: 3px; margin-bottom: 12px;">${sec.instruction}</div>
                        </div>
                    `;

                    if (sec.passage) {
                        htmlContent += `
                            <div style="border-left: 3px solid #000; padding-left: 15px; margin: 15px 0 20px 10px; font-style: italic; font-size: 14px; white-space: pre-wrap; line-height: 1.6; background-color: #fafafa; padding-top: 8px; padding-bottom: 8px; padding-right: 8px;">
                                <strong>Đọc hiểu ngữ liệu sau đây:</strong><br/>
                                ${sec.passage}
                            </div>
                        `;
                    }

                    for (const q of secQuestions) {
                        htmlContent += renderQ(q);
                    }
                }
            } else {
                for (const q of exam.questions) {
                    htmlContent += renderQ(q);
                }
            }

            printContainer.innerHTML = htmlContent;
            document.body.appendChild(printContainer);

            const opt = {
                margin: 15,
                filename: `${exam.title.replace(/\s+/g, '_')}_DeThi.pdf`,
                image: { type: 'jpeg' as const, quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    scrollX: 0,
                    scrollY: 0
                },
                jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
            };

            await html2pdf().set(opt).from(printContainer).save();
            
            // Dọn dẹp DOM clone
            document.body.removeChild(printContainer);
            Swal.close();
        } catch (error: any) {
            console.error('PDF Export Error:', error);
            Swal.fire('Lỗi xuất PDF', error.message || 'Không thể tạo file PDF.', 'error');
        } finally {
            // Khôi phục lại các stylesheet trên trang chính
            disabledSheets.forEach(sheet => {
                try {
                    sheet.disabled = false;
                } catch (e) {}
            });
        }
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
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 shrink-0">
                        <h3 className="font-bold text-base text-slate-900">Đáp án & Giải thích</h3>
                        {onGenerateAnswers && (
                            <button
                                onClick={onGenerateAnswers}
                                disabled={isGeneratingAnswers}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-sm border-none cursor-pointer flex items-center gap-1 transition-all"
                            >
                                {isGeneratingAnswers ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin" />
                                        Đang giải đề...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={12} />
                                        Tạo Đáp Án Tự Động
                                    </>
                                )}
                            </button>
                        )}
                    </div>

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
