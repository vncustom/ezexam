import { useState } from "react";
import { Question } from "../types";
import Markdown from "react-markdown";
import { Pencil, Check, X, RefreshCw } from "lucide-react";

interface QuestionCardProps {
    question: Question;
    isAnswerSide: boolean;
    onRegenerate?: (qId: string) => void;
    onEdit?: (qId: string, updated: Partial<Question>) => void;
}

export function QuestionCard({ question, isAnswerSide, onRegenerate, onEdit }: QuestionCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(question.content);
    const [editExplanation, setEditExplanation] = useState(question.explanation);

    let diffClass = "bg-[#dcfce7] text-[#166534]";
    if (question.difficulty === 'Vận dụng') diffClass = "bg-[#fef9c3] text-[#854d0e]";
    if (question.difficulty === 'Vận dụng cao') diffClass = "bg-[#fee2e2] text-[#991b1b]";
    if (question.difficulty === 'Thông hiểu') diffClass = "bg-[#fef9c3] text-[#854d0e]";

    const handleSaveEdit = () => {
        if (onEdit) {
            onEdit(question.id, {
                content: editContent,
                explanation: editExplanation,
            });
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditContent(question.content);
        setEditExplanation(question.explanation);
        setIsEditing(false);
    };

    if (isAnswerSide) {
        return (
            <div className="p-4 border-b border-slate-100 relative bg-slate-50/50 rounded-lg group">
                <div className="font-bold text-sm mb-2 text-slate-900 flex items-center justify-between">
                    <span>Câu {question.originalId} — Hướng dẫn giải</span>
                    {onEdit && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-indigo-600 rounded"
                            title="Chỉnh sửa giải thích"
                        >
                            <Pencil size={12} />
                        </button>
                    )}
                </div>
                <div className="text-[13px] text-slate-700">
                    <div className="mb-2 font-semibold">
                        Đáp án đúng: <span className="text-emerald-600">{question.correctAnswer || '-'}</span>
                    </div>
                    {isEditing ? (
                        <div>
                            <textarea
                                value={editExplanation}
                                onChange={e => setEditExplanation(e.target.value)}
                                className="w-full h-32 text-sm p-2 border border-indigo-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
                                autoFocus
                            />
                            <div className="flex gap-2 mt-2">
                                <button onClick={handleSaveEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                                    <Check size={12} /> Lưu
                                </button>
                                <button onClick={handleCancelEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                                    <X size={12} /> Hủy
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="prose prose-sm prose-slate max-w-none">
                            <Markdown>{question.explanation}</Markdown>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="p-[20px_40px] border-b border-slate-100 relative hover:bg-slate-50 group">
            {/* Action buttons */}
            <div className="absolute right-5 top-5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && !isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-slate-400 hover:text-indigo-600 text-[12px] flex items-center gap-1 cursor-pointer p-2 hover:bg-indigo-50 rounded"
                        title="Chỉnh sửa câu hỏi"
                    >
                        <Pencil size={12} />
                    </button>
                )}
                {onRegenerate && !isEditing && (
                    <button
                        onClick={() => onRegenerate(question.id)}
                        className="text-indigo-600 text-[12px] flex items-center gap-1 cursor-pointer p-2 hover:bg-indigo-50 rounded"
                        title="Tạo lại câu hỏi với AI"
                    >
                        <RefreshCw size={12} /> Đổi câu
                    </button>
                )}
                {isEditing && (
                    <>
                        <button onClick={handleSaveEdit} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700">
                            <Check size={11} /> Lưu
                        </button>
                        <button onClick={handleCancelEdit} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50">
                            <X size={11} /> Hủy
                        </button>
                    </>
                )}
            </div>

            {/* Question content */}
            <div className="mb-[10px] text-[15px] text-slate-900 leading-relaxed">
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold mr-2 ${diffClass}`}>
                    {question.difficulty}
                </span>
                <span className="font-bold mr-2">Câu {question.originalId}:</span>
                {isEditing ? (
                    <div className="mt-3">
                        <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            className="w-full h-24 text-sm p-3 border border-indigo-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono text-slate-800 bg-white"
                            autoFocus
                            placeholder="Nội dung câu hỏi (hỗ trợ markdown)"
                        />
                        <p className="text-xs text-slate-400 mt-1">Hỗ trợ markdown: **in đậm**, *nghiêng*, `code`</p>
                    </div>
                ) : (
                    <Markdown>{question.content}</Markdown>
                )}
            </div>

            {/* Options */}
            {!isEditing && question.type === 'multiple_choice' && question.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px] text-[14px] mt-3">
                    {question.options.map(opt => (
                        <div key={opt.id} className="flex items-start gap-2 text-slate-800">
                            <span className="font-semibold w-5 shrink-0">{opt.id}.</span>
                            <div className="pt-0.5">
                                <Markdown>{opt.content}</Markdown>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
