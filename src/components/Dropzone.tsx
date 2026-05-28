import { useState, useCallback } from "react";
import { extractTextFromPDF } from "../lib/pdf";
import Swal from "sweetalert2";
import { FileText, ClipboardPaste, Upload } from "lucide-react";

type TabMode = 'pdf' | 'text';

export function Dropzone({ onTextExtracted }: { onTextExtracted: (text: string) => void }) {
    const [tab, setTab] = useState<TabMode>('pdf');
    const [isHovering, setIsHovering] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [textInput, setTextInput] = useState('');

    const processFile = async (file: File) => {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');

        if (!isPdf && !isTxt) {
            Swal.fire('Lỗi định dạng', 'Chỉ hỗ trợ file PDF hoặc TXT. Vui lòng chọn đúng định dạng.', 'error');
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            Swal.fire('Lỗi dung lượng', `File ${isPdf ? 'PDF' : 'TXT'} quá lớn (>15MB). Vui lòng chia nhỏ file.`, 'error');
            return;
        }

        setIsLoading(true);
        try {
            let text = '';
            if (isPdf) {
                text = await extractTextFromPDF(file);
                if (text.length < 50) {
                    throw new Error("Không thể trích xuất văn bản từ file PDF này. Có thể đây là file ảnh scan — hãy dùng tab 'Nhập văn bản' để dán thủ công.");
                }
            } else {
                // TXT file: read as plain text
                text = await file.text();
                if (text.trim().length < 50) {
                    throw new Error("File TXT quá ngắn hoặc rỗng. Vui lòng kiểm tra lại nội dung.");
                }
            }
            onTextExtracted(text.trim());
        } catch (e: any) {
            Swal.fire('Lỗi đọc file', e.message || 'Không thể đọc file', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsHovering(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    const handleTextSubmit = () => {
        const trimmed = textInput.trim();
        if (trimmed.length < 50) {
            Swal.fire('Nội dung quá ngắn', 'Vui lòng dán nội dung đề thi đầy đủ hơn (tối thiểu 50 ký tự).', 'warning');
            return;
        }
        onTextExtracted(trimmed);
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setTextInput(prev => prev + text);
            }
        } catch {
            Swal.fire('Không thể truy cập clipboard', 'Vui lòng sử dụng Ctrl+V để dán trực tiếp vào ô nhập.', 'info');
        }
    };

    return (
        <section className="flex-1 p-6 bg-slate-100 flex items-center justify-center">
            <div className="w-full max-w-2xl">
                {/* Tab Switcher */}
                <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1.5 mb-4 gap-1">
                    <button
                        onClick={() => setTab('pdf')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                            tab === 'pdf' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <FileText size={16} />
                        Tải file PDF / TXT
                    </button>
                    <button
                        onClick={() => setTab('text')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                            tab === 'text' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <ClipboardPaste size={16} />
                        Nhập văn bản
                    </button>
                </div>

                {/* PDF Upload Tab */}
                {tab === 'pdf' && (
                    <div
                        className={`bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 p-12 text-center transition-all ${isHovering ? 'ring-2 ring-indigo-500 bg-indigo-50/20 border-indigo-300' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
                        onDragLeave={() => setIsHovering(false)}
                        onDrop={handleDrop}
                    >
                        {isLoading ? (
                            <div className="py-10">
                                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <h2 className="text-xl font-bold text-slate-900">Đang đọc tài liệu...</h2>
                                <p className="text-sm text-slate-500 mt-2">Vui lòng đợi trong giây lát</p>
                            </div>
                        ) : (
                            <div className="py-10">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 transition-all ${isHovering ? 'bg-indigo-100 text-indigo-700 scale-110' : 'bg-indigo-50 text-indigo-600'}`}>
                                    <Upload size={32} />
                                </div>
                                <h2 className="text-[22px] font-bold text-slate-900 mb-2">
                                    {isHovering ? 'Thả file vào đây!' : 'Tải Đề thi lên'}
                                </h2>
                                <p className="text-sm text-slate-600 mb-8 max-w-md mx-auto leading-relaxed">
                                    Kéo thả file <strong>PDF</strong> hoặc <strong>TXT</strong> vào đây, hoặc chọn file từ thiết bị để AI phân tích ma trận bài thi.
                                </p>
                                <label className="px-[18px] py-[10px] rounded-lg font-semibold text-sm cursor-pointer border-none transition-all duration-200 bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow hover:opacity-90 inline-flex">
                                    Chọn file từ thiết bị
                                    <input type="file" className="hidden" accept=".pdf,.txt,application/pdf,text/plain" onChange={handleChange} />
                                </label>
                                <p className="text-xs text-slate-400 mt-4">Hỗ trợ PDF văn bản &amp; TXT — Tối đa 15MB</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Text Input Tab */}
                {tab === 'text' && (
                    <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 p-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-slate-900">Dán nội dung đề thi</h2>
                            <button
                                onClick={handlePasteFromClipboard}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            >
                                <ClipboardPaste size={12} />
                                Dán từ clipboard
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            Copy nội dung từ file Word, trang web, hoặc bất kỳ nguồn nào rồi dán vào đây.
                        </p>
                        <textarea
                            value={textInput}
                            onChange={e => setTextInput(e.target.value)}
                            placeholder="Dán toàn bộ nội dung đề thi vào đây (câu hỏi, đáp án, ...)&#10;&#10;Ví dụ:&#10;Câu 1: Đâu là thủ đô của Việt Nam?&#10;A. Hà Nội  B. TP.HCM  C. Đà Nẵng  D. Huế"
                            className="w-full h-64 p-4 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent font-mono leading-relaxed"
                        />
                        <div className="flex items-center justify-between mt-4">
                            <span className="text-xs text-slate-400">{textInput.length} ký tự</span>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setTextInput('')}
                                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                                >
                                    Xóa
                                </button>
                                <button
                                    onClick={handleTextSubmit}
                                    disabled={textInput.trim().length < 50}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-br from-indigo-600 to-blue-500 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all shadow-sm"
                                >
                                    Phân tích với AI →
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
