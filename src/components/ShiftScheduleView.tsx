// ShiftScheduleView.tsx — GEM&CLAUDE PM Pro
// 3-shift scheduling: Ca sáng / Ca chiều / Ca đêm
// Props: people (danh sách nhân sự active), projectName, pid

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Sunrise, Plus, X, ChevronLeft, ChevronRight, Users, Clock, Save, RotateCcw } from 'lucide-react';
import { db } from './db';

// ─── Types ────────────────────────────────────────────────────────────────────
type ShiftType = 'morning' | 'afternoon' | 'night' | 'off';

interface ShiftAssignment {
  personId: string;
  date: string;       // YYYY-MM-DD
  shift: ShiftType;
  note?: string;
}

interface ShiftScheduleViewProps {
  people: Array<{
    id: string;
    name: string;
    jobTitle: string;
    team: string;
    type: 'staff' | 'worker';
    status: 'active' | 'leave' | 'resigned';
  }>;
  projectName: string;
  pid: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SHIFTS: { key: ShiftType; label: string; time: string; color: string; bg: string; icon: any }[] = [
  { key: 'morning',   label: 'Ca sáng',  time: '06:00–14:00', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: Sun },
  { key: 'afternoon', label: 'Ca chiều', time: '14:00–22:00', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Sunrise },
  { key: 'night',     label: 'Ca đêm',   time: '22:00–06:00', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Moon },
  { key: 'off',       label: 'Nghỉ',     time: '',            color: 'text-slate-400',  bg: 'bg-slate-50 border-slate-200',   icon: X },
];

const DAYS_OF_WEEK = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function getWeekDates(offset: number = 0): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ShiftScheduleView({ people, projectName, pid }: ShiftScheduleViewProps) {
  const [weekOffset, setWeekOffset]       = useState(0);
  const [assignments, setAssignments]     = useState<ShiftAssignment[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftType>('morning');
  const [filterTeam, setFilterTeam]       = useState<string>('all');
  const [isDirty, setIsDirty]             = useState(false);

  const weekDates = getWeekDates(weekOffset);
  const weekLabel = `${formatDate(weekDates[0])} – ${formatDate(weekDates[6])}/${weekDates[6].getFullYear()}`;

  // ── Load assignments from db ────────────────────────────────────────────────
  useEffect(() => {
    db.get<ShiftAssignment[]>('shift_schedule', pid, []).then(setAssignments);
  }, [pid]);

  // ── Save assignments to db ──────────────────────────────────────────────────
  const save = async () => {
    await db.set('shift_schedule', pid, assignments);
    setIsDirty(false);
  };

  // ── Get shift for a person on a date ───────────────────────────────────────
  const getShift = (personId: string, date: string): ShiftType => {
    return assignments.find(a => a.personId === personId && a.date === date)?.shift || 'off';
  };

  // ── Toggle shift for a person on a date ────────────────────────────────────
  const toggleShift = (personId: string, date: string) => {
    setAssignments(prev => {
      const existing = prev.find(a => a.personId === personId && a.date === date);
      if (existing) {
        if (existing.shift === selectedShift) {
          // Remove assignment (set to off)
          return prev.filter(a => !(a.personId === personId && a.date === date));
        }
        return prev.map(a =>
          a.personId === personId && a.date === date ? { ...a, shift: selectedShift } : a
        );
      }
      if (selectedShift === 'off') return prev;
      return [...prev, { personId, date, shift: selectedShift }];
    });
    setIsDirty(true);
  };

  // ── Count per shift per day ─────────────────────────────────────────────────
  const countShiftOnDate = (shift: ShiftType, date: string) =>
    assignments.filter(a => a.shift === shift && a.date === date).length;

  // ── Filter people ───────────────────────────────────────────────────────────
  const activePeople = people.filter(p => p.status === 'active');
  const teams = ['all', ...Array.from(new Set(activePeople.map(p => p.team)))];
  const filteredPeople = filterTeam === 'all'
    ? activePeople
    : activePeople.filter(p => p.team === filterTeam);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
            <ChevronLeft size={18}/>
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[160px] text-center">
            📅 Tuần: {weekLabel}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600">
            <ChevronRight size={18}/>
          </button>
          <button onClick={() => setWeekOffset(0)}
            className="text-xs text-teal-600 hover:underline font-medium">
            Tuần này
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <>
              <button onClick={() => { db.get<ShiftAssignment[]>('shift_schedule', pid, []).then(setAssignments); setIsDirty(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                <RotateCcw size={14}/> Huỷ
              </button>
              <button onClick={save}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700">
                <Save size={14}/> Lưu lịch
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Shift selector + Team filter ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500 font-medium">Gán ca:</span>
        {SHIFTS.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.key}
              onClick={() => setSelectedShift(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
                ${selectedShift === s.key ? `${s.bg} ${s.color} ring-2 ring-offset-1 ring-teal-400` : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              <Icon size={13}/> {s.label}
              {s.time && <span className="opacity-60">{s.time}</span>}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">Đội:</span>
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
            {teams.map(t => <option key={t} value={t}>{t === 'all' ? 'Tất cả' : t}</option>)}
          </select>
        </div>
      </div>

      {/* ── Summary row ── */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((d, i) => {
          const key = toKey(d);
          const isToday = key === toKey(new Date());
          return (
            <div key={key} className={`rounded-lg p-2 text-center text-xs ${isToday ? 'bg-teal-50 border border-teal-200' : 'bg-slate-50'}`}>
              <div className={`font-bold ${isToday ? 'text-teal-700' : 'text-slate-600'}`}>{DAYS_OF_WEEK[d.getDay()]}</div>
              <div className={`text-[10px] ${isToday ? 'text-teal-500' : 'text-slate-400'}`}>{formatDate(d)}</div>
              <div className="mt-1 space-y-0.5">
                {SHIFTS.filter(s => s.key !== 'off').map(s => {
                  const cnt = countShiftOnDate(s.key, key);
                  return cnt > 0 ? (
                    <div key={s.key} className={`text-[10px] font-semibold ${s.color}`}>
                      {s.label.split(' ')[1]}: {cnt}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Schedule grid ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2.5 text-left font-semibold text-slate-600 min-w-[160px]">
                <div className="flex items-center gap-1.5"><Users size={13}/> Nhân sự ({filteredPeople.length})</div>
              </th>
              {weekDates.map((d, i) => {
                const isToday = toKey(d) === toKey(new Date());
                return (
                  <th key={i} className={`px-2 py-2.5 text-center font-semibold min-w-[90px] ${isToday ? 'text-teal-700 bg-teal-50' : 'text-slate-600'}`}>
                    <div>{DAYS_OF_WEEK[d.getDay()]}</div>
                    <div className="font-normal text-[10px] opacity-70">{formatDate(d)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredPeople.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Không có nhân sự active</td></tr>
            ) : filteredPeople.map((person, idx) => (
              <tr key={person.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-800">{person.name}</div>
                  <div className="text-[10px] text-slate-400">{person.jobTitle}</div>
                  <div className="text-[10px] text-slate-400">{person.team}</div>
                </td>
                {weekDates.map(d => {
                  const key = toKey(d);
                  const shift = getShift(person.id, key);
                  const shiftDef = SHIFTS.find(s => s.key === shift)!;
                  const Icon = shiftDef.icon;
                  const isToday = key === toKey(new Date());
                  return (
                    <td key={key} className={`px-1 py-1.5 text-center ${isToday ? 'bg-teal-50/30' : ''}`}>
                      <button
                        onClick={() => toggleShift(person.id, key)}
                        className={`w-full rounded-lg px-2 py-1.5 border text-[10px] font-semibold transition-all hover:opacity-80 ${shiftDef.bg} ${shiftDef.color}`}>
                        <Icon size={11} className="mx-auto mb-0.5"/>
                        {shift === 'off' ? '–' : shiftDef.label.split(' ')[1]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="font-medium">Chú thích:</span>
        {SHIFTS.filter(s => s.key !== 'off').map(s => {
          const Icon = s.icon;
          return (
            <span key={s.key} className={`flex items-center gap-1 ${s.color}`}>
              <Icon size={11}/> {s.label} ({s.time})
            </span>
          );
        })}
        <span className="ml-auto italic">Click ô để gán ca đã chọn</span>
      </div>

    </div>
  );
}
