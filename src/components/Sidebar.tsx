import { Exam } from "../types";

export function Sidebar({ exams, onSelect, currentId }: { exams: Exam[], onSelect: (id: string) => void, currentId: string | null }) {
    return (
        <aside className="w-60 bg-white border-r border-slate-200 flex flex-col p-5 shrink-0 h-full overflow-y-auto hidden lg:flex">
            <h3 className="text-[12px] uppercase tracking-[1px] text-slate-500 mb-4 font-semibold">
                Thư viện đề thi
            </h3>
            <div className="flex flex-col gap-2 flex-1">
                {exams.map(e => {
                    const isActive = currentId === e.id;
                    return (
                        <button 
                            key={e.id} 
                            onClick={() => onSelect(e.id)}
                            className={`text-left p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50/50 border-l-[4px] border-indigo-600' : 'hover:bg-slate-50 border-l-[4px] border-transparent'}`}
                        >
                            <div className="font-semibold text-sm truncate text-slate-900">{e.title}</div>
                            <div className="text-[11px] text-slate-500 mt-1">{new Date(e.createdAt).toLocaleDateString('vi-VN')} • {e.questions.length} câu</div>
                        </button>
                    );
                })}
                {exams.length === 0 && (
                     <div className="text-[13px] text-slate-400 text-center p-4">Chưa có đề thi nào.</div>
                )}
            </div>
            <div className="mt-4 shrink-0">
               <button onClick={() => window.location.reload()} className="px-[18px] py-[10px] w-full rounded-lg font-semibold text-sm cursor-pointer border-none transition-all duration-200 bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-sm hover:opacity-90">
                  + Tải đề gốc mới
               </button>
            </div>
        </aside>
    )
}
