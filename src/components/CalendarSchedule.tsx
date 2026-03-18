import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, MapPin, Clock,
  AlertCircle, CheckCircle2, Trash2, Edit3, CalendarDays,
  LayoutGrid, List, CloudRain, Sun, Cloud, CloudSun,
  Filter, Tag, Save, Loader2, Wind, Droplets,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type EventType = 'meeting' | 'inspection' | 'construction' | 'payment' | 'other';
type EventStatus = 'upcoming' | 'in-progress' | 'completed';

interface CalEvent {
  id: string;
  date: string;       // 'YYYY-MM-DD'
  time: string;       // 'HH:MM'
  endTime: string;
  title: string;
  type: EventType;
  status: EventStatus;
  location: string;
  projectId: string;
  note?: string;
  alert?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'gem_calendar_events';

const EVENT_TYPES: { value: EventType; label: string; color: string; bg: string; dot: string }[] = [
  { value: 'meeting',      label: 'Họp',           color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   dot: 'bg-blue-500'    },
  { value: 'inspection',   label: 'Nghiệm thu',    color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  { value: 'construction', label: 'Thi công',      color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500'   },
  { value: 'payment',      label: 'Thanh toán',    color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200',dot: 'bg-violet-500'  },
  { value: 'other',        label: 'Khác',          color: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200', dot: 'bg-slate-400'   },
];

const DEFAULT_EVENTS: CalEvent[] = [
  { id:'e1', date: getTodayStr(), time:'07:30', endTime:'08:30', title:'Họp giao ban công trường',         type:'meeting',      status:'completed',  location:'VP Ban QLDA',  projectId:'p1' },
  { id:'e2', date: getTodayStr(), time:'09:00', endTime:'11:00', title:'Nghiệm thu cốt thép móng M1-M5',  type:'inspection',   status:'in-progress',location:'Khu A',        projectId:'p1', attendees: true } as any,
  { id:'e3', date: getTodayStr(), time:'13:30', endTime:'17:30', title:'Đổ bê tông móng khối lớn',        type:'construction', status:'upcoming',   location:'Khu A',        projectId:'p1', alert:'Cần theo dõi thời tiết chiều nay' },
  { id:'e4', date: getTodayStr(), time:'16:00', endTime:'17:30', title:'Chốt khối lượng tuần với thầu phụ',type:'meeting',     status:'upcoming',   location:'Phòng họp 2',  projectId:'p2' },
  { id:'e5', date: getOffsetDay(1), time:'08:00', endTime:'09:00', title:'Duyệt hồ sơ thanh toán đợt 3', type:'payment',      status:'upcoming',   location:'Văn phòng',    projectId:'p2' },
  { id:'e6', date: getOffsetDay(2), time:'10:00', endTime:'12:00', title:'Kiểm tra tiến độ TN Delta',     type:'inspection',   status:'upcoming',   location:'Tầng 5',       projectId:'p3' },
  { id:'e7', date: getOffsetDay(-1), time:'14:00', endTime:'15:30', title:'Ký biên bản nghiệm thu phần ngầm', type:'inspection', status:'completed', location:'Khu B',       projectId:'p1' },
];

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}
function getOffsetDay(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function getTypeStyle(type: EventType) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[4];
}
function formatVNDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('vi-VN', { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' });
}
function getWeekDays(anchor: Date): Date[] {
  const d = new Date(anchor);
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
}
function dateStr(d: Date) { return d.toISOString().slice(0, 10); }
const DAYS_VN = ['T2','T3','T4','T5','T6','T7','CN'];

// ── Weather badge (mock — thực tế cần API) ────────────────────────────────────
const WEATHER_MOCK = { temp: 28, desc: 'Mưa rào', humidity: 85, wind: 12, icon: 'rain' };
function WeatherIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  if (icon === 'rain') return <CloudRain size={size} />;
  if (icon === 'sun')  return <Sun size={size} />;
  if (icon === 'cloud') return <Cloud size={size} />;
  return <CloudSun size={size} />;
}

// ── Month grid helpers ────────────────────────────────────────────────────────
function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const cells: (Date | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── Modal form ────────────────────────────────────────────────────────────────
interface ModalProps {
  event?: CalEvent | null;
  defaultDate?: string;
  onSave: (e: CalEvent) => void;
  onClose: () => void;
}
function EventModal({ event, defaultDate, onSave, onClose }: ModalProps) {
  const isEdit = !!event;
  const [form, setForm] = useState<Omit<CalEvent,'id'>>({
    date:      event?.date      || defaultDate || getTodayStr(),
    time:      event?.time      || '08:00',
    endTime:   event?.endTime   || '09:00',
    title:     event?.title     || '',
    type:      event?.type      || 'meeting',
    status:    event?.status    || 'upcoming',
    location:  event?.location  || '',
    projectId: event?.projectId || (projects?.[0] as any)?.id || '',
    note:      event?.note      || '',
    alert:     event?.alert     || '',
  });

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title.trim().length > 0 && form.date && form.time;

  function handleSave() {
    if (!valid) return;
    onSave({ ...form, id: event?.id || `e${Date.now()}` });
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <h3 className="font-bold text-slate-800 text-base">
            {isEdit ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện mới'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Tiêu đề *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800
                focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-slate-300"
              placeholder="Tên sự kiện..." />
          </div>

          {/* Type + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Loại</label>
              <select value={form.type} onChange={e => set('type', e.target.value as EventType)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Dự án</label>
              <select value={form.projectId} onChange={e => set('projectId', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
                <option value="">— Chung —</option>
                {(projects || []).filter((p:any) => p.type === 'in_progress').map((p:any) =>
                  <option key={p.id} value={p.id}>{p.name}</option>
                )}
              </select>
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Ngày *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Từ *</label>
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Đến</label>
              <input type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800
                  focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Địa điểm</label>
            <input value={form.location} onChange={e => set('location', e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800
                focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
              placeholder="Tên địa điểm / phòng họp..." />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Trạng thái</label>
            <div className="flex gap-2">
              {(['upcoming','in-progress','completed'] as EventStatus[]).map(s => (
                <button key={s} onClick={() => set('status', s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    form.status === s
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}>
                  {s === 'upcoming' ? '○ Sắp tới' : s === 'in-progress' ? '⏳ Đang diễn' : '✓ Hoàn thành'}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Ghi chú</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800
                focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300 resize-none"
              placeholder="Ghi chú thêm..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600
              hover:bg-slate-100 transition-colors">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={!valid}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold
              hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2">
            <Save size={14} />
            {isEdit ? 'Lưu thay đổi' : 'Thêm sự kiện'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══ MAIN ══════════════════════════════════════════════════════════════════════
import { db } from './db';

export default function CalendarSchedule({ projects = [] }: { projects?: any[] }) {
  const [events, setEvents]           = useState<CalEvent[]>([]);
  const [viewMode, setViewMode]       = useState<'timeline'|'month'>('timeline');
  const [anchorDate, setAnchorDate]   = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [filterProject, setFilterProject] = useState<string>('all');
  const [showModal, setShowModal]     = useState(false);
  const [editEvent, setEditEvent]     = useState<CalEvent | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [modalDate, setModalDate]     = useState<string | undefined>();
  const timelineRef = useRef<HTMLDivElement>(null);

  // ── Load / save via db.ts ─────────────────────────────────────────────────
  useEffect(() => {
    db.get<CalEvent[]>('calendar_events', 'global', DEFAULT_EVENTS).then(setEvents);
  }, []);

  useEffect(() => {
    if (events.length > 0) db.set('calendar_events', 'global', events);
  }, [events]);

  // ── Live clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── Listen for Taskbar quick-add ────────────────────────────────────────────
  useEffect(() => {
    const handler = () => openAdd();
    window.addEventListener('gem:add-event', handler);
    return () => window.removeEventListener('gem:add-event', handler);
  }, []);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  function saveEvent(e: CalEvent) {
    setEvents(prev => prev.find(x => x.id === e.id)
      ? prev.map(x => x.id === e.id ? e : x)
      : [...prev, e]
    );
    setShowModal(false); setEditEvent(null);
  }
  function deleteEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id));
  }
  function openAdd(date?: string) {
    setEditEvent(null); setModalDate(date); setShowModal(true);
  }
  function openEdit(e: CalEvent) {
    setEditEvent(e); setShowModal(true);
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const weekDays   = getWeekDays(anchorDate);
  const weekStart  = weekDays[0]; const weekEnd = weekDays[6];

  function inRange(d: Date) {
    return d >= weekStart && d <= weekEnd;
  }

  const filteredEvents = events.filter(e =>
    filterProject === 'all' || e.projectId === filterProject
  );

  const dayEvents = filteredEvents
    .filter(e => e.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const todayStr    = getTodayStr();
  const todayEvents = filteredEvents.filter(e => e.date === todayStr);

  // ── Red-line position ───────────────────────────────────────────────────────
  function getRedLineTop(): number | null {
    if (selectedDate !== todayStr) return null;
    if (dayEvents.length === 0) return null;
    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    const first = dayEvents[0];
    const last  = dayEvents[dayEvents.length - 1];
    const [fh, fm] = first.time.split(':').map(Number);
    const [lh, lm] = last.endTime.split(':').map(Number);
    const startMin = fh * 60 + fm;
    const endMin   = lh * 60 + lm;
    if (now < startMin || now > endMin) return null;
    return ((now - startMin) / (endMin - startMin)) * 100;
  }
  const redLineTop = getRedLineTop();

  // ── Month navigation ────────────────────────────────────────────────────────
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const monthGrid = getMonthGrid(monthAnchor.getFullYear(), monthAnchor.getMonth());
  const monthName = monthAnchor.toLocaleDateString('vi-VN', { month:'long', year:'numeric' });

  function prevWeek()  { const d = new Date(anchorDate); d.setDate(d.getDate() - 7); setAnchorDate(d); }
  function nextWeek()  { const d = new Date(anchorDate); d.setDate(d.getDate() + 7); setAnchorDate(d); }
  function prevMonth() { const d = new Date(monthAnchor); d.setMonth(d.getMonth() - 1); setMonthAnchor(d); }
  function nextMonth() { const d = new Date(monthAnchor); d.setMonth(d.getMonth() + 1); setMonthAnchor(d); }
  function goToday()   { setAnchorDate(new Date()); setSelectedDate(todayStr); setMonthAnchor(new Date()); }

  // ── Stat counts ─────────────────────────────────────────────────────────────
  const weekEventsCount = filteredEvents.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d >= weekStart && d <= weekEnd;
  }).length;

  // project name helper
  function projName(id: string) {
    return (projects || []).find((p:any) => p.id === id)?.name || 'Chung';
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-10">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-slate-800 leading-tight">Lịch công trường</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Weather badge */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 border border-sky-200 rounded-xl text-xs font-medium text-sky-700">
            <WeatherIcon icon={WEATHER_MOCK.icon} size={13} />
            <span>{WEATHER_MOCK.temp}°</span>
            <span className="text-sky-500">{WEATHER_MOCK.desc}</span>
            <span className="text-sky-400 flex items-center gap-0.5"><Droplets size={11}/>{WEATHER_MOCK.humidity}%</span>
            <span className="text-sky-400 flex items-center gap-0.5"><Wind size={11}/>{WEATHER_MOCK.wind}km/h</span>
          </div>

          {/* Filter dự án */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl">
            <Filter size={12} className="text-slate-400" />
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer">
              <option value="all">Tất cả dự án</option>
              {(projects || []).filter((p:any) => p.type === 'in_progress').map((p:any) =>
                <option key={p.id} value={p.id}>{p.name}</option>
              )}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode==='timeline' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <List size={13}/> Timeline
            </button>
            <button onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode==='month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <LayoutGrid size={13}/> Tháng
            </button>
          </div>

          {/* Add button */}
          <button onClick={() => openAdd(selectedDate)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl
              text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus size={13}/> Thêm sự kiện
          </button>
        </div>
      </div>

      {/* ── STATS BAR ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Sự kiện tuần này', value: weekEventsCount,             color:'text-emerald-600', bg:'bg-emerald-50' },
          { label:'Sự kiện hôm nay',  value: todayEvents.length,          color:'text-blue-600',    bg:'bg-blue-50'    },
          { label:'Chưa hoàn thành',  value: todayEvents.filter(e=>e.status!=='completed').length, color:'text-amber-600', bg:'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 flex items-center justify-between`}>
            <span className="text-xs text-slate-500 font-medium">{s.label}</span>
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ══ VIEW: TIMELINE ════════════════════════════════════════════════════ */}
      {viewMode === 'timeline' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Week strip */}
          <div className="border-b border-slate-100 bg-slate-50/50 p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button onClick={prevWeek}
                  className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors border border-slate-200 bg-white">
                  <ChevronLeft size={16}/>
                </button>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm md:text-base">
                    {weekStart.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})} –{' '}
                    {weekEnd.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{weekEventsCount} sự kiện trong tuần</p>
                </div>
                <button onClick={nextWeek}
                  className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors border border-slate-200 bg-white">
                  <ChevronRight size={16}/>
                </button>
              </div>
              <button onClick={goToday}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-3 py-1.5
                  border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors">
                Hôm nay
              </button>
            </div>

            {/* Day pills */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {weekDays.map((d, i) => {
                const ds = dateStr(d);
                const isToday = ds === todayStr;
                const isSelected = ds === selectedDate;
                const count = filteredEvents.filter(e => e.date === ds).length;
                return (
                  <button key={i} onClick={() => setSelectedDate(ds)}
                    className={`flex flex-col items-center min-w-[3rem] md:min-w-[4rem] py-2.5 px-2 rounded-xl
                      transition-all flex-1 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md'
                        : isToday
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}>
                    <span className={`text-[10px] font-semibold mb-1 ${isSelected ? 'text-emerald-100' : isToday ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {DAYS_VN[i]}
                    </span>
                    <span className="text-base md:text-lg font-bold leading-none">{d.getDate()}</span>
                    {count > 0 && (
                      <div className={`mt-1.5 flex gap-0.5`}>
                        {Array.from({length: Math.min(count, 3)}).map((_,ci) => (
                          <div key={ci} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-emerald-200' : 'bg-emerald-400'}`}/>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeline body */}
          <div className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-700 text-sm">
                {formatVNDate(selectedDate)}
              </h4>
              <button onClick={() => openAdd(selectedDate)}
                className="flex items-center gap-1 text-xs text-emerald-600 font-semibold
                  hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors">
                <Plus size={12}/> Thêm
              </button>
            </div>

            {dayEvents.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
                <CalendarDays size={36} className="text-slate-200"/>
                <p className="text-sm font-medium">Không có sự kiện nào</p>
                <button onClick={() => openAdd(selectedDate)}
                  className="text-xs text-emerald-600 font-semibold hover:underline">
                  + Thêm sự kiện cho ngày này
                </button>
              </div>
            ) : (
              <div className="relative" ref={timelineRef}>
                {/* Red line current time */}
                {redLineTop !== null && (
                  <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: `${redLineTop}%` }}>
                    <span className="text-[10px] font-bold text-rose-500 w-14 text-right pr-2 shrink-0">
                      {currentTime.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}
                    </span>
                    <div className="flex-1 h-[2px] bg-rose-500 relative">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-rose-500"/>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {dayEvents.map((ev, idx) => {
                    const ts = getTypeStyle(ev.type);
                    const isDone = ev.status === 'completed';
                    const proj = (projects || []).find((p:any) => p.id === ev.projectId);
                    return (
                      <div key={ev.id} className="flex gap-3 group">
                        {/* Time */}
                        <div className="w-14 shrink-0 text-right pt-1">
                          <div className="text-xs font-bold text-slate-700">{ev.time}</div>
                          <div className="text-[10px] text-slate-400">{ev.endTime}</div>
                        </div>

                        {/* Dot + line */}
                        <div className="flex flex-col items-center relative pt-1.5">
                          <div className={`w-2.5 h-2.5 rounded-full z-10 ring-4 ring-white shrink-0 ${
                            isDone ? 'bg-slate-300' : ts.dot
                          }`}/>
                          {idx < dayEvents.length - 1 && (
                            <div className="w-px flex-1 bg-slate-100 mt-1 min-h-[1.5rem]"/>
                          )}
                        </div>

                        {/* Card */}
                        <div className={`flex-1 rounded-xl p-3.5 border transition-all hover:shadow-md mb-1 ${
                          isDone ? 'bg-slate-50 border-slate-200 opacity-60' : `${ts.bg}`
                        }`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className={`font-semibold text-sm leading-snug ${
                                  isDone ? 'text-slate-500 line-through' : 'text-slate-800'
                                }`}>{ev.title}</h4>
                                {isDone && <CheckCircle2 size={14} className="text-slate-400 shrink-0"/>}
                                {ev.status === 'in-progress' && (
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700
                                    px-1.5 py-0.5 rounded-full">Đang diễn</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 mt-2 text-xs font-medium text-slate-500">
                                {ev.location && (
                                  <span className="flex items-center gap-1"><MapPin size={11}/>{ev.location}</span>
                                )}
                                {proj && (
                                  <span className="flex items-center gap-1">
                                    <Tag size={11}/>
                                    <span className={ts.color}>{proj.name}</span>
                                  </span>
                                )}
                              </div>
                              {ev.alert && (
                                <div className="mt-2.5 flex items-start gap-1.5 text-xs font-medium text-amber-700
                                  bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                                  <AlertCircle size={12} className="shrink-0 mt-0.5"/>
                                  {ev.alert}
                                </div>
                              )}
                              {ev.note && (
                                <p className="mt-2 text-xs text-slate-400 italic">{ev.note}</p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button onClick={() => openEdit(ev)}
                                className="p-1.5 rounded-lg hover:bg-white/70 text-slate-400 hover:text-slate-600 transition-colors">
                                <Edit3 size={13}/>
                              </button>
                              <button onClick={() => deleteEvent(ev.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors">
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ VIEW: MONTH GRID ══════════════════════════════════════════════════ */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Month header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 border border-slate-200 bg-white transition-colors">
                <ChevronLeft size={16}/>
              </button>
              <h3 className="font-bold text-slate-800 text-base capitalize">{monthName}</h3>
              <button onClick={nextMonth}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 border border-slate-200 bg-white transition-colors">
                <ChevronRight size={16}/>
              </button>
            </div>
            <button onClick={goToday}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-3 py-1.5
                border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors">
              Hôm nay
            </button>
          </div>

          {/* Day-of-week labels */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {DAYS_VN.map(d => (
              <div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7">
            {monthGrid.map((cell, i) => {
              if (!cell) return (
                <div key={`empty-${i}`} className="min-h-[5.5rem] bg-slate-50/40 border-r border-b border-slate-100"/>
              );
              const ds = dateStr(cell);
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              const cellEvents = filteredEvents.filter(e => e.date === ds);
              return (
                <div key={ds}
                  onClick={() => { setSelectedDate(ds); setViewMode('timeline'); }}
                  className={`min-h-[5.5rem] p-2 border-r border-b border-slate-100 cursor-pointer
                    hover:bg-emerald-50/40 transition-colors group ${
                    isToday ? 'bg-emerald-50/60' : ''
                  }`}>
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold mb-1.5 ${
                    isToday
                      ? 'bg-emerald-600 text-white'
                      : isSelected
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                  }`}>
                    {cell.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {cellEvents.slice(0, 3).map(ev => {
                      const ts = getTypeStyle(ev.type);
                      return (
                        <div key={ev.id}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate border ${ts.bg} ${ts.color}`}>
                          {ev.time} {ev.title}
                        </div>
                      );
                    })}
                    {cellEvents.length > 3 && (
                      <div className="text-[10px] text-slate-400 font-medium pl-1">
                        +{cellEvents.length - 3} nữa
                      </div>
                    )}
                  </div>
                  {/* Quick add on hover */}
                  <button
                    onClick={e => { e.stopPropagation(); openAdd(ds); }}
                    className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity
                      text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                    <Plus size={9}/> Thêm
                  </button>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-4">
            {EVENT_TYPES.map(t => (
              <span key={t.value} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${t.dot}`}/>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <EventModal
          event={editEvent}
          defaultDate={modalDate}
          onSave={saveEvent}
          onClose={() => { setShowModal(false); setEditEvent(null); }}
        />
      )}
    </div>
  );
}
