// ShiftScheduleView.tsx — GEM&CLAUDE PM Pro · S11
// Lịch phân ca 3 ca (Ca sáng / Ca chiều / Ca đêm) cho công trường xây dựng
// Lưu vào db.ts key 'mp_shifts'

import React, { useState, useEffect } from 'react';
import { db } from './db';
import { Sun, SunDim, Moon, Plus, Trash2, Printer, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Users } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type ShiftType = 'morning' | 'afternoon' | 'night' | 'off';
interface ShiftAssignment { personId: string; shift: ShiftType; }
interface DaySchedule { date: string; assignments: ShiftAssignment[]; }
interface Props { people: any[]; projectName: string; pid: string; }

// ── Ca config ────────────────────────────────────────────────────────────────
const SHIFTS: { id: ShiftType; label: string; time: string; icon: React.ReactNode; color: string; bg: string; dot: string }[] = [
  { id:'morning',   label:'Ca Sáng',  time:'06:00–14:00', icon:<Sun size={13}/>,    color:'text-amber-700',  bg:'bg-amber-50 border-amber-200',   dot:'bg-amber-400' },
  { id:'afternoon', label:'Ca Chiều', time:'14:00–22:00', icon:<SunDim size={13}/>, color:'text-orange-700', bg:'bg-orange-50 border-orange-200',  dot:'bg-orange-400' },
  { id:'night',     label:'Ca Đêm',   time:'22:00–06:00', icon:<Moon size={13}/>,   color:'text-indigo-700', bg:'bg-indigo-50 border-indigo-200',  dot:'bg-indigo-400' },
  { id:'off',       label:'Nghỉ',     time:'—',           icon:null,                color:'text-slate-400',  bg:'bg-slate-50 border-slate-200',    dot:'bg-slate-300' },
];
const shiftOf = (id: ShiftType) => SHIFTS.find(s => s.id === id)!;

// ── Helpers ──────────────────────────────────────────────────────────────────
const isoDate = (d: Date) => d.toISOString().split('T')[0];
const addDays  = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const fmtDate  = (iso: string) => new Date(iso+'T00:00:00').toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit'});
const weekStart = (d: Date) => { const r = new Date(d); r.setDate(r.getDate()-(r.getDay()||7)+1); return r; };

// ── Print ─────────────────────────────────────────────────────────────────────
function printSchedule(schedule: DaySchedule[], people: any[], weekLabel: string, projectName: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  const rows = people.map(p => {
    const cells = schedule.map(day => {
      const a = day.assignments.find(x => x.personId === p.id);
      const s = shiftOf(a?.shift || 'off');
      return `<td style="text-align:center;padding:4px 6px;font-size:11px;background:${
        s.id==='morning'?'#fef9c3':s.id==='afternoon'?'#ffedd5':s.id==='night'?'#e0e7ff':'#f8fafc'
      }">${s.id!=='off'?s.label:'—'}</td>`;
    }).join('');
    return `<tr><td style="padding:4px 8px;font-size:11px;white-space:nowrap">${p.name}</td><td style="padding:4px 8px;font-size:10px;color:#64748b">${p.jobTitle}</td>${cells}</tr>`;
  }).join('');
  const headers = schedule.map(d=>`<th style="padding:6px;text-align:center;font-size:10px;background:#f1f5f9;min-width:60px">${fmtDate(d.date)}</th>`).join('');
  w.document.write(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
    <title>Lịch ca ${weekLabel}</title>
    <style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:15mm 20mm}
    h2{text-align:center;font-size:14px;margin-bottom:4px}
    .sub{text-align:center;font-size:11px;color:#64748b;margin-bottom:16px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1}
    @page{size:A4 landscape;margin:15mm}</style></head><body>
    <h2>LỊCH PHÂN CA CÔNG TRƯỜNG — ${weekLabel.toUpperCase()}</h2>
    <div class="sub">${projectName}</div>
    <table><thead><tr>
      <th style="padding:6px 8px;text-align:left;font-size:10px;background:#f1f5f9">Họ tên</th>
      <th style="padding:6px 8px;text-align:left;font-size:10px;background:#f1f5f9">Chức vụ</th>
      ${headers}
    </tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-top:24px;display:flex;gap:20px;font-size:10px">
      <span style="background:#fef9c3;padding:3px 8px;border-radius:4px">■ Ca Sáng 06–14h</span>
      <span style="background:#ffedd5;padding:3px 8px;border-radius:4px">■ Ca Chiều 14–22h</span>
      <span style="background:#e0e7ff;padding:3px 8px;border-radius:4px">■ Ca Đêm 22–06h</span>
    </div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ShiftScheduleView({ people, projectName, pid }: Props) {
  const today = new Date();
  const [weekBase, setWeekBase] = useState<Date>(() => weekStart(today));
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [editCell, setEditCell] = useState<{ date: string; personId: string } | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkShift, setBulkShift] = useState<ShiftType>('morning');

  // 7 ngày của tuần hiện tại
  const weekDays = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekBase, i)));
  const weekLabel = `Tuần ${fmtDate(weekDays[0])} – ${fmtDate(weekDays[6])}`;

  // Load từ db
  useEffect(() => {
    db.get<DaySchedule[]>('mp_shifts', pid, []).then(saved => {
      // Đảm bảo 7 ngày tuần hiện tại luôn có trong schedule
      const merged: DaySchedule[] = weekDays.map(date => {
        const existing = saved.find((d: DaySchedule) => d.date === date);
        return existing || { date, assignments: people.map(p => ({ personId: p.id, shift: 'off' as ShiftType })) };
      });
      setSchedule(merged);
    });
  }, [pid, weekBase]); // eslint-disable-line

  const save = (newSchedule: DaySchedule[]) => {
    setSchedule(newSchedule);
    db.get<DaySchedule[]>('mp_shifts', pid, []).then(all => {
      const others = (all as DaySchedule[]).filter(d => !weekDays.includes(d.date));
      db.set('mp_shifts', pid, [...others, ...newSchedule]);
    });
  };

  const setShift = (date: string, personId: string, shift: ShiftType) => {
    const ns = schedule.map(d => d.date !== date ? d : {
      ...d,
      assignments: d.assignments.map(a => a.personId !== personId ? a : { ...a, shift })
    });
    save(ns);
    setEditCell(null);
  };

  const getShift = (date: string, personId: string): ShiftType => {
    const day = schedule.find(d => d.date === date);
    return day?.assignments.find(a => a.personId === personId)?.shift || 'off';
  };

  // Bulk fill: điền toàn bộ tuần cho 1 người
  const bulkFill = (personId: string) => {
    const ns = schedule.map(d => ({
      ...d,
      assignments: d.assignments.map(a => a.personId !== personId ? a : { ...a, shift: bulkShift })
    }));
    save(ns);
  };

  // Thống kê ca / người
  const stats = people.map(p => {
    const counts = { morning: 0, afternoon: 0, night: 0, off: 0 };
    weekDays.forEach(d => { counts[getShift(d, p.id)]++; });
    const nightCount = counts.night;
    return { p, counts, nightCount };
  });

  // Cảnh báo: >3 ca đêm liên tiếp
  const nightWarnings = stats.filter(s => s.nightCount >= 3).map(s => s.p.name);

  // Tổng nhân lực mỗi ca mỗi ngày
  const dayTotals = weekDays.map(date => {
    const counts = { morning: 0, afternoon: 0, night: 0 };
    people.forEach(p => {
      const sh = getShift(date, p.id);
      if (sh !== 'off') counts[sh as keyof typeof counts]++;
    });
    return { date, ...counts };
  });

  return (
    <div className="space-y-4">

      {/* Header + nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekBase(addDays(weekBase, -7))}
            className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center">
            <ChevronLeft size={15}/>
          </button>
          <span className="text-sm font-bold text-slate-700">{weekLabel}</span>
          <button onClick={() => setWeekBase(addDays(weekBase, 7))}
            className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center">
            <ChevronRight size={15}/>
          </button>
          <button onClick={() => setWeekBase(weekStart(today))}
            className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 rounded-lg font-semibold text-slate-600">
            Tuần này
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Bulk fill controls */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Điền nhanh:</span>
            {SHIFTS.filter(s=>s.id!=='off').map(s=>(
              <button key={s.id} onClick={() => setBulkShift(s.id)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${bulkShift===s.id ? s.bg+' '+s.color+' border-current' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                {s.label}
              </button>
            ))}
            <button onClick={() => setBulkShift('off')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${bulkShift==='off'?'bg-slate-100 text-slate-600 border-slate-300':'border-transparent text-slate-400'}`}>
              Nghỉ
            </button>
          </div>
          <button onClick={() => printSchedule(schedule, people, weekLabel, projectName)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-800">
            <Printer size={12}/> In lịch ca
          </button>
        </div>
      </div>

      {/* Cảnh báo ca đêm */}
      {nightWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
          <AlertTriangle size={14} className="text-amber-600 shrink-0"/>
          <p className="text-xs text-amber-800">
            <strong>{nightWarnings.length} người làm ≥3 ca đêm tuần này:</strong> {nightWarnings.join(', ')} — Kiểm tra điều khoản BLLĐ Điều 115.
          </p>
        </div>
      )}

      {/* Grid lịch ca */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide sticky left-0 bg-slate-50 min-w-[140px]">
                  Nhân viên
                </th>
                <th className="text-center px-2 py-3 text-[10px] font-bold text-slate-400 w-16">Điền nhanh</th>
                {weekDays.map(date => {
                  const isToday = date === isoDate(today);
                  const dow = new Date(date+'T00:00:00').toLocaleDateString('vi-VN',{weekday:'short'});
                  const dom = new Date(date+'T00:00:00').getDate();
                  return (
                    <th key={date} className={`text-center px-1 py-2 min-w-[72px] ${isToday?'bg-emerald-50':''}`}>
                      <div className={`text-[10px] font-semibold ${isToday?'text-emerald-700':'text-slate-500'}`}>{dow}</div>
                      <div className={`text-sm font-bold ${isToday?'text-emerald-700':'text-slate-700'}`}>{dom}</div>
                    </th>
                  );
                })}
                <th className="text-center px-2 py-3 text-[10px] font-bold text-slate-400 min-w-[80px]">Tổng tuần</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p, pi) => {
                const st = stats[pi];
                return (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/40 group">
                    {/* Tên */}
                    <td className="px-4 py-2.5 sticky left-0 bg-white group-hover:bg-slate-50/40">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {p.name?.split(' ').pop()?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 whitespace-nowrap text-[11px]">{p.name}</p>
                          <p className="text-[9px] text-slate-400">{p.jobTitle}</p>
                        </div>
                      </div>
                    </td>
                    {/* Điền nhanh cả tuần */}
                    <td className="text-center px-1 py-2">
                      <button onClick={() => bulkFill(p.id)}
                        title={`Điền ${shiftOf(bulkShift).label} cả tuần`}
                        className="w-7 h-7 mx-auto flex items-center justify-center rounded-lg bg-slate-100 hover:bg-violet-100 hover:text-violet-700 text-slate-400 transition-colors">
                        <Plus size={11}/>
                      </button>
                    </td>
                    {/* Ô ca từng ngày */}
                    {weekDays.map(date => {
                      const sh = getShift(date, p.id);
                      const cfg = shiftOf(sh);
                      const isEditing = editCell?.date === date && editCell?.personId === p.id;
                      const isToday = date === isoDate(today);
                      return (
                        <td key={date} className={`px-1 py-2 text-center relative ${isToday?'bg-emerald-50/30':''}`}>
                          <button onClick={() => setEditCell(isEditing ? null : { date, personId: p.id })}
                            className={`w-full px-1 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${cfg.bg} ${cfg.color}`}>
                            <span className="flex items-center justify-center gap-0.5">
                              {cfg.icon}
                              <span>{sh==='off'?'—':cfg.label.replace('Ca ','')}</span>
                            </span>
                          </button>
                          {isEditing && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 z-30 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 flex gap-1 whitespace-nowrap">
                              {SHIFTS.map(s => (
                                <button key={s.id} onClick={() => setShift(date, p.id, s.id)}
                                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all hover:scale-105 ${s.bg} ${s.color}`}>
                                  {s.icon}
                                  <span>{s.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Tổng tuần */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {st.counts.morning>0 && <span className="text-[9px] text-amber-700 font-bold">{st.counts.morning}S</span>}
                        {st.counts.afternoon>0 && <span className="text-[9px] text-orange-700 font-bold">{st.counts.afternoon}C</span>}
                        {st.counts.night>0 && <span className={`text-[9px] font-bold ${st.nightCount>=3?'text-red-600':'text-indigo-700'}`}>{st.counts.night}Đ{st.nightCount>=3?'⚠':''}</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer: tổng nhân lực mỗi ca */}
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              {[
                { id:'morning',   label:'Ca Sáng', cls:'text-amber-700' },
                { id:'afternoon', label:'Ca Chiều', cls:'text-orange-700' },
                { id:'night',     label:'Ca Đêm',  cls:'text-indigo-700' },
              ].map(row => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-1.5 text-[10px] font-bold sticky left-0 bg-slate-50 flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${shiftOf(row.id as ShiftType).dot}`}/>
                    <span className={row.cls}>{row.label}</span>
                  </td>
                  <td/>
                  {dayTotals.map(dt => (
                    <td key={dt.date} className="text-center py-1.5">
                      <span className={`text-[11px] font-bold ${row.cls}`}>
                        {dt[row.id as 'morning'|'afternoon'|'night'] || '—'}
                      </span>
                    </td>
                  ))}
                  <td className="text-center py-1.5">
                    <span className={`text-[11px] font-bold ${row.cls}`}>
                      {dayTotals.reduce((s,d)=>s+(d[row.id as 'morning'|'afternoon'|'night']||0),0)}
                    </span>
                  </td>
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend + chú thích */}
      <div className="flex items-center flex-wrap gap-3 text-[11px] text-slate-500">
        {SHIFTS.map(s => (
          <span key={s.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${s.bg} ${s.color} font-semibold`}>
            {s.icon} {s.label} {s.id!=='off'?<span className="font-normal opacity-70">{s.time}</span>:null}
          </span>
        ))}
        <span className="ml-auto text-slate-400">Click ô để đổi ca · Nút + điền nhanh cả tuần · Lưu tự động</span>
      </div>
    </div>
  );
}
