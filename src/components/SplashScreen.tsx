import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export default function SplashScreen({ onComplete, duration = 3500 }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => { if (p >= 100) { clearInterval(interval); return 100; } return p + 2; });
    }, duration / 55);
    const holdTimer = setTimeout(() => setPhase('hold'), 100);
    const exitTimer = setTimeout(() => setPhase('exit'), duration - 600);
    const doneTimer = setTimeout(() => onComplete(), duration);
    return () => { clearInterval(interval); clearTimeout(holdTimer); clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [duration, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center
        transition-opacity duration-500 select-none
        ${phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ background: 'linear-gradient(135deg, #dde2e6 0%, #e8eaec 50%, #d8dfe6 100%)' }}
    >
      <div className={`relative flex flex-col items-center gap-6 transition-all duration-700
        ${phase === 'enter' ? 'scale-90 opacity-0 translate-y-4' : 'scale-100 opacity-100 translate-y-0'}`}>

        {/* Icon container */}
        <div className="relative">
          <div className="absolute inset-0 rounded-[28px] animate-pulse"
            style={{ boxShadow: '0 0 60px 20px rgba(26,138,122,0.15)' }} />

          <div className="w-28 h-28 rounded-[28px] overflow-hidden shadow-2xl"
            style={{ boxShadow: '0 20px 60px rgba(26,138,122,0.25), 0 8px 24px rgba(0,0,0,0.15)', background: 'linear-gradient(135deg, #1a8a7a, #c47a5a)' }}>
            <img
              src="/icon/icon_app.png"
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full
            bg-gradient-to-br from-teal-400 to-teal-600
            flex items-center justify-center shadow-lg animate-bounce"
            style={{ animationDuration: '1.5s' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
            </svg>
          </div>
        </div>

        {/* Brand text */}
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight" style={{ color: '#c47a5a' }}>
            GEM & CLAUDE PM Pro
          </h1>
          <p className="text-sm font-semibold mt-1" style={{ color: '#1a8a7a' }}>
            AI-Powered Construction ERP
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            Quản lý dự án xây dựng với sức mạnh AI
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-100"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #1a8a7a, #c47a5a)' }} />
        </div>

        {/* Loading dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: i % 2 === 0 ? '#1a8a7a' : '#c47a5a', animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }} />
          ))}
          <span className="text-[10px] text-slate-400 ml-2 font-medium">Đang khởi động...</span>
        </div>
      </div>

      <div className="absolute bottom-8 flex flex-col items-center gap-1">
        <p className="text-[10px] text-slate-400 font-medium">
          Powered by <span style={{ color: '#1a8a7a' }} className="font-bold">Gemini AI</span>
          {' & '}
          <span style={{ color: '#6366f1' }} className="font-bold">Claude AI</span>
        </p>
        <p className="text-[9px] text-slate-300">v4.0 · © 2026 GEM&CLAUDE PM Pro</p>
      </div>
    </div>
  );
}


