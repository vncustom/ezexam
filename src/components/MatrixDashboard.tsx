import { ExamMatrix, ExamMatrixCell } from "../types";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Settings2, Wand2, Table2 } from "lucide-react";

const QUESTION_TYPES = [
    { type: 'multiple_choice' as const, label: 'Nhiều lựa chọn', shortLabel: 'TNKQ NLC' },
    { type: 'true_false' as const, label: 'Đúng – Sai', shortLabel: 'TNKQ ĐS' },
    { type: 'short_answer' as const, label: 'Trả lời ngắn', shortLabel: 'TNKQ TLN' },
    { type: 'essay' as const, label: 'Tự luận', shortLabel: 'Tự luận' },
] as const;

const DIFFICULTIES = ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'] as const;

const DIFF_SHORT: Record<string, string> = {
    'Nhận biết': 'Biết',
    'Thông hiểu': 'Hiểu',
    'Vận dụng': 'VD',
    'Vận dụng cao': 'VDC',
};

export function MatrixDashboard({ 
    matrix, 
    onMatrixChange, 
    onGenerate 
}: { 
    matrix: ExamMatrix, 
    onMatrixChange: (m: ExamMatrix) => void,
    onGenerate: () => void 
}) {
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const TYPE_COLORS: Record<string, string> = {
        'multiple_choice': '#6366f1',
        'true_false': '#0ea5e9',
        'short_answer': '#f97316',
        'essay': '#8b5cf6',
    };
    
    const updateTopicCount = (index: number, val: number) => {
        const newTopics = [...matrix.topics];
        newTopics[index].count = val;
        onMatrixChange({ ...matrix, topics: newTopics });
    };

    const totalTopics = matrix.topics.reduce((acc, t) => acc + t.count, 0);
    const isMatrixValid = totalTopics === matrix.totalQuestions;

    // Helper: get cell count from matrixCells
    const getCellCount = (topicName: string, qType: string, diff: string): number => {
        if (!matrix.matrixCells) return 0;
        const cell = matrix.matrixCells.find(c => 
            c.topicName === topicName && c.questionType === qType && c.difficulty === diff
        );
        return cell?.questionCount || 0;
    };

    // Helper: get cell question IDs
    const getCellIds = (topicName: string, qType: string, diff: string): string[] => {
        if (!matrix.matrixCells) return [];
        const cell = matrix.matrixCells.find(c => 
            c.topicName === topicName && c.questionType === qType && c.difficulty === diff
        );
        return cell?.questionIds || [];
    };

    // Topic row totals
    const getTopicTotal = (topicName: string): number => {
        if (!matrix.matrixCells) return 0;
        return matrix.matrixCells
            .filter(c => c.topicName === topicName)
            .reduce((acc, c) => acc + c.questionCount, 0);
    };

    // Column totals (qType × diff)
    const getColTotal = (qType: string, diff: string): number => {
        if (!matrix.matrixCells) return 0;
        return matrix.matrixCells
            .filter(c => c.questionType === qType && c.difficulty === diff)
            .reduce((acc, c) => acc + c.questionCount, 0);
    };

    // Question type totals
    const getQTypeTotal = (qType: string): number => {
        if (!matrix.matrixCells) return 0;
        return matrix.matrixCells
            .filter(c => c.questionType === qType)
            .reduce((acc, c) => acc + c.questionCount, 0);
    };

    // Determine which question types actually have questions
    const activeQTypes = QUESTION_TYPES.filter(qt => {
        if (!matrix.matrixCells) return true;
        return matrix.matrixCells.some(c => c.questionType === qt.type && c.questionCount > 0) ||
               (matrix.questionTypeAllocations?.some(a => a.type === qt.type && (a.totalPoints > 0 || a.percentage > 0)));
    });

    // Determine which difficulties to show (collapse VD + VDC if either exists)
    const activeDifficulties = DIFFICULTIES.filter(d => {
        if (!matrix.matrixCells) return true;
        return matrix.matrixCells.some(c => c.difficulty === d && c.questionCount > 0);
    });

    // Use 3-level grouping for compact display: Biết, Hiểu, VD (merge VD + VDC)
    const showVDC = activeDifficulties.includes('Vận dụng cao');
    const displayDifficulties = showVDC 
        ? activeDifficulties 
        : activeDifficulties.filter(d => d !== 'Vận dụng cao');

    const hasMatrixData = matrix.matrixCells && matrix.matrixCells.length > 0;

    return (
        <section className="flex-1 p-6 bg-slate-100 flex flex-col overflow-y-auto items-center">
            
            <div className="w-full max-w-6xl flex flex-col gap-6 mt-4 pb-12">
               
                {/* Top: 2 column cards for metadata & topics */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: General Info */}
                    <div className="flex-1 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100 rounded-xl flex flex-col overflow-hidden">
                        <div className="p-8 border-b border-slate-100">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Ma trận Đề thi: {matrix.subject}</h2>
                            <p className="text-sm text-slate-600">AI đã phân tích cấu trúc theo mẫu CV 7991/BGDĐT-GDTrH. Bạn có thể tùy chỉnh trước khi xuất đề mới.</p>
                            {!isMatrixValid && (
                                <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>Tổng câu theo chủ đề ({totalTopics}) ≠ Tổng câu đề thi ({matrix.totalQuestions}). Vui lòng điều chỉnh trước khi tạo đề.</span>
                                </div>
                            )}
                        </div>
                        <div className="p-8 grid grid-cols-3 gap-6">
                            <div>
                                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Thời gian</div>
                                <div className="text-2xl font-bold text-slate-900">{matrix.durationMinutes} <span className="text-sm font-normal text-slate-500">phút</span></div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Tổng câu</div>
                                <div className="text-2xl font-bold text-slate-900">{matrix.totalQuestions} <span className="text-sm font-normal text-slate-500">câu</span></div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Tổng điểm</div>
                                <div className="text-2xl font-bold text-slate-900">{matrix.totalPoints || 10} <span className="text-sm font-normal text-slate-500">điểm</span></div>
                            </div>
                        </div>
                        
                        {/* Question Type Allocation Cards */}
                        {matrix.questionTypeAllocations && matrix.questionTypeAllocations.length > 0 && (
                            <div className="px-8 pb-6 border-t border-slate-100 pt-5">
                                <h3 className="font-bold text-sm mb-3 text-slate-700 uppercase tracking-wider">Phân bổ theo Dạng câu hỏi</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {matrix.questionTypeAllocations.map((alloc, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200/60">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: TYPE_COLORS[alloc.type] || '#94a3b8'}}></div>
                                                <span className="text-xs font-medium text-slate-700">{alloc.label}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-slate-900">{alloc.totalPoints}</span>
                                                <span className="text-[10px] text-slate-500 ml-1">đ ({alloc.percentage}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Difficulty Allocation with PieChart */}
                        <div className="p-8 flex-1 border-t border-slate-100 flex flex-col">
                            <h3 className="font-bold text-sm mb-3 text-slate-700 uppercase tracking-wider">Phân bổ Mức độ Nhận thức</h3>
                            
                            {matrix.difficultyAllocations && matrix.difficultyAllocations.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {matrix.difficultyAllocations.map((alloc, i) => (
                                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-200/60">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[i]}}></div>
                                                <span className="text-xs font-medium text-slate-700">{alloc.level}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-slate-900">{alloc.totalPoints}</span>
                                                <span className="text-[10px] text-slate-500 ml-1">đ ({alloc.percentage}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* Fallback: use old difficulties array */
                                <div className="grid grid-cols-2 gap-4 mb-4">
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
                            )}

                            <div className="flex-1 min-h-[180px] relative">
                                 <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={matrix.difficultyAllocations || matrix.difficulties}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={80}
                                            paddingAngle={2}
                                            dataKey={matrix.difficultyAllocations ? "totalPoints" : "count"}
                                            nameKey="level"
                                            stroke="none"
                                        >
                                            {(matrix.difficultyAllocations || matrix.difficulties).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                                    </PieChart>
                                </ResponsiveContainer>
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

                {/* === MA TRẬN 2 CHIỀU THEO CV 7991 === */}
                {hasMatrixData && (
                    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-slate-100">
                        <div className="flex items-center gap-2 mb-5">
                            <Table2 size={20} className="text-indigo-600" />
                            <h3 className="font-bold text-lg text-slate-900">Ma trận đề kiểm tra (CV 7991)</h3>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                {/* Header Row 1: Question Types */}
                                <thead>
                                    <tr className="bg-indigo-50">
                                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700 min-w-[32px]">TT</th>
                                        <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-700 min-w-[100px]">Chủ đề / Chương</th>
                                        {activeQTypes.map(qt => (
                                            <th 
                                                key={qt.type} 
                                                colSpan={displayDifficulties.length} 
                                                className="border border-slate-300 px-2 py-2 text-center font-bold"
                                                style={{ color: TYPE_COLORS[qt.type] }}
                                            >
                                                {qt.label}
                                            </th>
                                        ))}
                                        <th rowSpan={2} className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700 bg-slate-100 min-w-[50px]">Tổng</th>
                                    </tr>
                                    {/* Header Row 2: Difficulties */}
                                    <tr className="bg-slate-50">
                                        {activeQTypes.map(qt => (
                                            displayDifficulties.map(diff => (
                                                <th key={`${qt.type}-${diff}`} className="border border-slate-300 px-1.5 py-1.5 text-center font-semibold text-slate-600 min-w-[36px]">
                                                    {DIFF_SHORT[diff] || diff}
                                                </th>
                                            ))
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Topic Rows */}
                                    {matrix.topics.map((topic, idx) => (
                                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                            <td className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-600">{idx + 1}</td>
                                            <td className="border border-slate-300 px-3 py-2 text-slate-800 font-medium">{topic.name}</td>
                                            {activeQTypes.map(qt => (
                                                displayDifficulties.map(diff => {
                                                    const count = getCellCount(topic.name, qt.type, diff);
                                                    const ids = getCellIds(topic.name, qt.type, diff);
                                                    return (
                                                        <td 
                                                            key={`${qt.type}-${diff}`} 
                                                            className={`border border-slate-300 px-1.5 py-2 text-center ${count > 0 ? 'font-bold text-slate-800' : 'text-slate-300'}`}
                                                            title={ids.length > 0 ? `Câu: ${ids.join(', ')}` : ''}
                                                        >
                                                            {count > 0 ? count : ''}
                                                        </td>
                                                    );
                                                })
                                            ))}
                                            <td className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-900 bg-slate-50">
                                                {getTopicTotal(topic.name) || topic.count}
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Totals Row: Tổng số câu */}
                                    <tr className="bg-indigo-50/50 font-bold">
                                        <td colSpan={2} className="border border-slate-300 px-3 py-2 text-right text-slate-700">Tổng số câu</td>
                                        {activeQTypes.map(qt => (
                                            displayDifficulties.map(diff => (
                                                <td key={`total-${qt.type}-${diff}`} className="border border-slate-300 px-1.5 py-2 text-center text-slate-800">
                                                    {getColTotal(qt.type, diff) || ''}
                                                </td>
                                            ))
                                        ))}
                                        <td className="border border-slate-300 px-2 py-2 text-center text-indigo-700 bg-indigo-100/50">
                                            {matrix.totalQuestions}
                                        </td>
                                    </tr>

                                    {/* Tổng điểm row */}
                                    {matrix.questionTypeAllocations && (
                                        <tr className="bg-amber-50/50 font-bold">
                                            <td colSpan={2} className="border border-slate-300 px-3 py-2 text-right text-slate-700">Tổng số điểm</td>
                                            {activeQTypes.map(qt => {
                                                const alloc = matrix.questionTypeAllocations!.find(a => a.type === qt.type);
                                                return (
                                                    <td 
                                                        key={`pts-${qt.type}`} 
                                                        colSpan={displayDifficulties.length} 
                                                        className="border border-slate-300 px-1.5 py-2 text-center text-slate-800"
                                                    >
                                                        {alloc ? alloc.totalPoints.toFixed(1) : '0'}
                                                    </td>
                                                );
                                            })}
                                            <td className="border border-slate-300 px-2 py-2 text-center text-amber-700 bg-amber-100/50">
                                                {matrix.totalPoints || 10}
                                            </td>
                                        </tr>
                                    )}

                                    {/* Tỷ lệ % row */}
                                    {matrix.questionTypeAllocations && (
                                        <tr className="bg-emerald-50/50 font-bold">
                                            <td colSpan={2} className="border border-slate-300 px-3 py-2 text-right text-slate-700">Tỉ lệ %</td>
                                            {activeQTypes.map(qt => {
                                                const alloc = matrix.questionTypeAllocations!.find(a => a.type === qt.type);
                                                return (
                                                    <td 
                                                        key={`pct-${qt.type}`} 
                                                        colSpan={displayDifficulties.length} 
                                                        className="border border-slate-300 px-1.5 py-2 text-center text-slate-800"
                                                    >
                                                        {alloc ? `${alloc.percentage}%` : '0%'}
                                                    </td>
                                                );
                                            })}
                                            <td className="border border-slate-300 px-2 py-2 text-center text-emerald-700 bg-emerald-100/50">
                                                100%
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Difficulty allocation footer */}
                        {matrix.difficultyAllocations && (
                            <div className="mt-4 pt-3 border-t border-slate-200">
                                <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Tỷ lệ mức độ nhận thức tổng thể</div>
                                <div className="flex flex-wrap gap-3">
                                    {matrix.difficultyAllocations.map((alloc, i) => (
                                        <div key={i} className="flex items-center gap-1.5 bg-slate-50 rounded-full px-3 py-1.5 border border-slate-200/60">
                                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i]}}></div>
                                            <span className="text-xs text-slate-600">{alloc.level}:</span>
                                            <span className="text-xs font-bold text-slate-800">{alloc.totalPoints}đ</span>
                                            <span className="text-[10px] text-slate-500">({alloc.percentage}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom: Detailed Sections Layout (kept from original) */}
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
