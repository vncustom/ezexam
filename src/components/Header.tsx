import { Settings, CheckCircle2, Menu } from "lucide-react";

export function Header({ step, openSettings, toggleSidebar }: { step: number, openSettings: () => void, toggleSidebar: () => void }) {
    
    const steps = [
        "Tải PDF",
        "Phân tích",
        "Tùy chỉnh",
        "Tạo đề & Xuất bản"
    ];

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 relative z-20">
            <div className="flex items-center gap-2.5 font-extrabold text-[22px] text-indigo-600">
                <button className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg -ml-2" onClick={toggleSidebar}>
                    <Menu size={20} />
                </button>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span className="hidden sm:block">EzExam</span>
            </div>

            <nav className="hidden md:flex gap-8 items-center justify-center flex-1 ml-8">
                {steps.map((s, i) => {
                    const isActive = step === i;
                    const isDone = step > i;
                    return (
                        <div key={i} className={`flex items-center gap-2 text-[13px] font-medium transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-600'}`}>
                            {isDone ? (
                                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                                    <CheckCircle2 size={14} />
                                </div>
                            ) : (
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                    {i + 1}
                                </div>
                            )}
                            {s}
                        </div>
                    );
                })}
            </nav>

            <div className="flex items-center gap-4">
                 <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 font-medium">
                     <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Gemini AI Sẵn sàng
                 </div>
                 <button onClick={openSettings} className="px-[12px] py-[6px] bg-white border border-slate-200 text-slate-900 rounded-lg font-semibold text-[13px] transition-all hover:bg-slate-50 whitespace-nowrap hidden sm:block">
                    Cài đặt API
                 </button>
                 <button onClick={openSettings} className="sm:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                    <Settings size={20} />
                 </button>
            </div>
        </header>
    )
}
