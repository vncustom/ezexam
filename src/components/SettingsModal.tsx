import { useState, useEffect } from "react";
import { getStoredApiKey, storeApiKey, getStoredModel, storeModel } from "../lib/storage";
import { Zap, Brain, Feather } from "lucide-react";

const MODELS = [
    {
        id: 'gemini-flash-latest',
        name: 'Gemini Flash',
        tag: 'Mặc định',
        desc: 'Nhanh & tiết kiệm quota. Phù hợp hầu hết tác vụ.',
        icon: Zap,
        color: 'text-amber-500',
        bg: 'bg-amber-50',
        border: 'border-amber-300',
    },
    {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro',
        tag: 'Mạnh nhất',
        desc: 'Logic sâu, phù hợp đề khó. Tốn quota hơn.',
        icon: Brain,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-300',
    },
    {
        id: 'gemini-flash-lite-latest',
        name: 'Gemini Flash Lite',
        tag: 'Nhẹ nhất',
        desc: 'Siêu nhanh, quota thấp nhất. Phù hợp đề đơn giản.',
        icon: Feather,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
    },
];

export function SettingsModal({ onClose }: { onClose: () => void }) {
    const [key, setKey] = useState("");
    const [model, setModel] = useState("gemini-flash-latest");

    useEffect(() => {
        setKey(getStoredApiKey() || "");
        setModel(getStoredModel());
    }, []);

    const handleSave = () => {
        storeApiKey(key);
        storeModel(model);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col pt-6">
                <div className="px-6 pb-2">
                    <h3 className="font-bold text-slate-900 text-[18px]">Cài đặt Hệ thống</h3>
                </div>

                <div className="p-6 flex flex-col gap-5">
                    {/* API Key */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-700">Gemini API Key</label>
                        <input
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow text-slate-900 text-sm"
                        />
                        <div className="text-xs text-slate-500">
                            Lấy API Key miễn phí tại{' '}
                            <a
                                href="https://aistudio.google.com/api-keys"
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 font-semibold hover:underline"
                            >
                                Google AI Studio →
                            </a>
                        </div>
                    </div>

                    {/* Model Selection — Cards */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-700">Model AI</label>
                        <div className="flex flex-col gap-2">
                            {MODELS.map((m) => {
                                const Icon = m.icon;
                                const isSelected = model === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setModel(m.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-150 ${isSelected
                                                ? `${m.border} ${m.bg}`
                                                : 'border-slate-200 bg-white hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? m.bg : 'bg-slate-100'}`}>
                                            <Icon size={18} className={isSelected ? m.color : 'text-slate-400'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                                                    {m.name}
                                                </span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${isSelected ? `${m.color} ${m.bg}` : 'text-slate-400 bg-slate-100'}`}>
                                                    {m.tag}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{m.desc}</p>
                                        </div>
                                        {/* Radio indicator */}
                                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? `${m.border.replace('border-', 'border-')} bg-white` : 'border-slate-300'}`}>
                                            {isSelected && <div className={`w-2 h-2 rounded-full ${m.color.replace('text-', 'bg-')}`} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Fallback tự động: Pro → Flash → Flash Lite nếu gặp lỗi quota.
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <button onClick={onClose} className="px-[18px] py-[10px] rounded-lg font-semibold text-sm cursor-pointer transition-all duration-200 bg-white border border-slate-200 text-slate-900 hover:bg-slate-50">
                        Đóng
                    </button>
                    <button onClick={handleSave} className="px-[18px] py-[10px] rounded-lg font-semibold text-sm cursor-pointer border-none transition-all duration-200 bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow hover:opacity-90">
                        Lưu Cài Đặt
                    </button>
                </div>
            </div>
        </div>
    );
}
