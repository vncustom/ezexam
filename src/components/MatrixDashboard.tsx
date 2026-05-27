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
        <section className="flex-1 p-6 bg-slate-100 flex flex-col overflow-hidden items-center justify-center">
            
            <div className="w-full max-w-5xl flex gap-6 h-full mt-4 pb-12">
               
                {/* Left: General Info */}
                <div className="flex-1 bg-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] rounded-lg flex flex-col overflow-hidden">
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
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
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
        </section>
    )
}
