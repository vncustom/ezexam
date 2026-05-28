import { ExamMatrix } from "../types";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Settings2, Wand2 } from "lucide-react";

export function MatrixDashboard({ 
    matrix, 
    onMatrixChange, 
    onGenerate 
}: { 
    matrix: ExamMatrix, 
    onMatrixChange: (m: ExamMatrix) => void,
    onGenerate: () => void 
}) {
    // Keep it fitting into the Workspace layout
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    
    const updateTopicCount = (index: number, val: number) => {
        const newTopics = [...matrix.topics];
        newTopics[index].count = val;
        onMatrixChange({ ...matrix, topics: newTopics });
    };

    const totalTopics = matrix.topics.reduce((acc, t) => acc + t.count, 0);
    const isMatrixValid = totalTopics === matrix.totalQuestions;

    return (
        <section className="flex-1 p-6 bg-slate-100 flex flex-col overflow-y-auto items-center">
            
            <div className="w-full max-w-5xl flex flex-col gap-6 mt-4 pb-12">
               
                {/* Top: 2 column cards for metadata & topics */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: General Info */}
                    <div className="flex-1 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 rounded-xl flex flex-col overflow-hidden">
                        <div className="p-8 border-b border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Ma trận Đề thi: {matrix.subject}</h2>
                            <p className="text-sm text-slate-600">AI đã phân tích cấu trúc xong. Bạn có thể tùy chỉnh lại trọng số trước khi xuất đề mới.</p>
                            {!isMatrixValid && (
                                <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>Tổng câu theo chủ đề ({totalTopics}) ≠ Tổng câu đề thi ({matrix.totalQuestions}). Vui lòng điều chỉnh trước khi tạo đề.</span>
                                </div>
                            )}
                        </div>
                        <div className="p-8 grid grid-cols-2 gap-8">
                            <div>
                                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Thời gian làm bài</div>
                                <div className="text-3xl font-bold text-slate-900">{matrix.durationMinutes} <span className="text-base font-normal text-slate-500">phút</span></div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Tổng số câu</div>
                                <div className="text-3xl font-bold text-slate-900">{matrix.totalQuestions} <span className="text-base font-normal text-slate-500">câu</span></div>
                            </div>
                        </div>
                        
                        <div className="p-8 flex-1 border-t border-slate-100 flex flex-col">
                            <h3 className="font-bold text-base mb-4 text-slate-900">Phân bổ Mức độ Nhận thức</h3>
                            <div className="flex-1 min-h-[200px] relative">
                                 <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={matrix.difficulties}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            dataKey="count"
                                            nameKey="level"
                                            stroke="none"
                                        >
                                            {matrix.difficulties.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                {matrix.difficulties.map((d, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}}></div>
                                            <span className="text-slate-700">{d.level}</span>
                                        </div>
                                        <span className="font-bold">{d.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Topics & Action */}
                    <div className="flex-[0.8] flex flex-col gap-5">
                        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 flex-1 flex flex-col min-h-0">
                            <h3 className="font-bold text-base mb-4 text-slate-900">Chủ đề Kiến thức</h3>
                            
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[360px] lg:max-h-none">
                                {matrix.topics.map((topic, index) => {
                                    const percent = totalTopics > 0 ? (topic.count / totalTopics) * 100 : 0;
                                    return (
                                    <div key={index} className="flex flex-col">
                                        <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700">
                                            <span>{topic.name} ({percent.toFixed(0)}%)</span>
                                            <span className="flex items-center gap-2">
                                                <input 
                                                    type="number"
                                                    value={topic.count}
                                                    onChange={(e) => updateTopicCount(index, parseInt(e.target.value) || 0)}
                                                    className="w-12 text-center text-slate-900 bg-slate-50 border border-slate-200 rounded px-1 py-0.5"
                                                />
                                                câu
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                                             <div className="h-full bg-indigo-600 rounded-full" style={{width: `${percent}%`}}></div>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </div>

                        <button 
                            onClick={onGenerate} 
                            disabled={!isMatrixValid}
                            className={`px-[18px] py-[14px] w-full rounded-lg font-semibold text-sm cursor-pointer border-none transition-all duration-200 text-white shadow-md flex items-center justify-center gap-2 ${
                                isMatrixValid 
                                    ? 'bg-gradient-to-br from-indigo-600 to-blue-500 hover:opacity-90' 
                                    : 'bg-slate-300 cursor-not-allowed'
                            }`}
                        >
                            <Wand2 size={18} />
                            Tạo Đề Thi Song Song
                        </button>
                    </div>
                </div>

                {/* Bottom: Detailed Sections Layout */}
                {matrix.sections && matrix.sections.length > 0 && (
                    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100">
                        <h3 className="font-bold text-lg mb-4 text-slate-900 border-b border-slate-100 pb-2">Cấu trúc chi tiết phần thi</h3>
                        <div className="space-y-6">
                            {matrix.sections.map((section, idx) => (
                                <div key={section.id || idx} className="bg-slate-50/50 rounded-xl p-5 border border-slate-200/60">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                        <div>
                                            <h4 className="font-bold text-base text-slate-800">{section.name}</h4>
                                            <p className="text-xs text-slate-500 italic mt-0.5">{section.instruction}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                                                {section.questionType === 'multiple_choice' ? 'Trắc nghiệm (Chọn 1)' :
                                                 section.questionType === 'true_false' ? 'Trắc nghiệm Đúng/Sai' :
                                                 section.questionType === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
                                            </span>
                                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
                                                {section.questions.length} câu hỏi
                                            </span>
                                        </div>
                                    </div>

                                    {section.passage && (
                                        <div className="mb-4 p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 font-mono leading-relaxed max-h-24 overflow-y-auto">
                                            <strong>[Ngữ liệu / Bài đọc]:</strong> {section.passage}
                                        </div>
                                    )}

                                    {/* Questions grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {section.questions.map((q, qIdx) => (
                                            <div key={qIdx} className="bg-white p-3 rounded-lg border border-slate-200/80 flex items-start gap-2.5 text-xs">
                                                <span className="font-bold text-slate-700 shrink-0 bg-slate-100 w-12 text-center py-0.5 rounded">
                                                    Câu {q.originalId}
                                                </span>
                                                <div className="flex-1 space-y-1">
                                                    <div className="font-medium text-slate-800">{q.stemDescription}</div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
                                                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{q.topic}</span>
                                                        <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{q.difficulty}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
