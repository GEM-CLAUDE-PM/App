/**
 * DevChecklist.tsx — GEM&CLAUDE PM Pro · S12 Testing
 * Sticky floating widget, chỉ hiện trong DEV mode.
 * State lưu localStorage — reload giữ nguyên.
 * Thêm vào App.tsx: import DevChecklist from './DevChecklist'; rồi <DevChecklist /> cuối JSX.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
type ItemState = 'todo' | 'ok' | 'skip' | 'bug';

interface CheckItem {
  id: string;
  text: string;
  note?: string;
  state: ItemState;
  tag?: 'fixed' | 'skip';
}

interface Section {
  id: string;
  title: string;
  type: 'bug' | 'todo';
  items: CheckItem[];
}

// ─── Checklist data ───────────────────────────────────────────────────────────
const INITIAL_DATA: Section[] = [
  {
    id: 's0', title: 'Bugs đã fix session này', type: 'bug',
    items: [
      { id: 's0i0', text: 'HSEWorkspace — infinite loop useEffect', state: 'ok', tag: 'fixed' },
      { id: 's0i1', text: 'HRWorkspace — infinite loop + thiếu genAI', state: 'ok', tag: 'fixed' },
      { id: 's0i2', text: 'GiamSatDashboard — infinite loop useEffect', state: 'ok', tag: 'fixed' },
      { id: 's0i3', text: 'EquipmentDashboard — notifOk & readOnly undefined', state: 'ok', tag: 'fixed' },
      { id: 's0i4', text: 'approvalEngine — duplicate key log_${Date.now()}', state: 'ok', tag: 'fixed' },
    ]
  },
  {
    id: 's1', title: 'Console — không còn lỗi runtime', type: 'todo',
    items: [
      { id: 's1i0', text: 'Không còn Maximum update depth exceeded', state: 'todo' },
      { id: 's1i1', text: 'Không còn ReferenceError: X is not defined', state: 'todo' },
      { id: 's1i2', text: 'Không còn duplicate key warning', state: 'todo' },
    ]
  },
  {
    id: 's2', title: 'ApprovalQueue — cross-module', type: 'todo',
    items: [
      { id: 's2i0', text: 'Mở từ EquipmentDashboard — không crash', state: 'todo' },
      { id: 's2i1', text: 'Mở từ HSEWorkspace — không crash', state: 'todo' },
      { id: 's2i2', text: 'Mở từ HRWorkspace — không crash', state: 'todo' },
      { id: 's2i3', text: 'Mở từ GiamSatDashboard — không crash', state: 'todo' },
      { id: 's2i4', text: 'Duyệt 1 document — status cập nhật đúng', state: 'todo' },
    ]
  },
  {
    id: 's3', title: 'EquipmentDashboard — sau fix', type: 'todo',
    items: [
      { id: 's3i0', text: "Tab Bảo dưỡng — nút 'Gửi duyệt' hoạt động", state: 'todo' },
      { id: 's3i1', text: 'Tab Nhật ký ca — form lưu + toast hiện', state: 'todo' },
      { id: 's3i2', text: 'Tab Nhiên liệu — form lưu được', state: 'todo' },
      { id: 's3i3', text: 'Tab Sự cố — form báo cáo lưu được', state: 'todo' },
      { id: 's3i4', text: 'Modal không crash khi mở', state: 'todo' },
    ]
  },
  {
    id: 's4', title: 'MaterialsDashboard — printVoucher', type: 'todo',
    items: [
      { id: 's4i0', text: 'printVoucher không còn undefined error', state: 'todo' },
      { id: 's4i1', text: 'In phiếu nhập/xuất kho mở được cửa sổ in', state: 'todo' },
    ]
  },
  {
    id: 's5', title: 'BOQDashboard', type: 'todo',
    items: [
      { id: 's5i0', text: 'Load được — không crash', state: 'todo' },
      { id: 's5i1', text: 'Import Excel BOQ parse đúng cột', state: 'todo' },
      { id: 's5i2', text: 'Rate library hiển thị đúng danh mục', state: 'todo' },
    ]
  },
  {
    id: 's6', title: 'ProcurementDashboard', type: 'todo',
    items: [
      { id: 's6i0', text: 'Load được — không crash', state: 'todo' },
      { id: 's6i1', text: 'Tạo RFQ mới — form lưu được', state: 'todo' },
      { id: 's6i2', text: "Nút 'Gửi duyệt PO' → ApprovalQueue nhận doc", state: 'todo' },
    ]
  },
];

const STORAGE_KEY = 'gem_s12_checklist';

// ─── Helper ───────────────────────────────────────────────────────────────────
function loadState(): Section[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_DATA;
    const saved: Record<string, ItemState> = JSON.parse(raw);
    return INITIAL_DATA.map(sec => ({
      ...sec,
      items: sec.items.map(item => ({
        ...item,
        state: saved[item.id] ?? item.state,
      })),
    }));
  } catch {
    return INITIAL_DATA;
  }
}

function saveState(sections: Section[]) {
  const map: Record<string, ItemState> = {};
  sections.forEach(sec => sec.items.forEach(item => { map[item.id] = item.state; }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DevChecklist() {
  // Chỉ hiện trong dev
  if (import.meta.env.PROD) return null;

  const [sections, setSections] = useState<Section[]>(loadState);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { saveState(sections); }, [sections]);

  const toggle = useCallback((secId: string, itemId: string) => {
    setSections(prev => prev.map(sec =>
      sec.id !== secId ? sec : {
        ...sec,
        items: sec.items.map(item =>
          item.id !== itemId ? item : {
            ...item,
            state: item.state === 'ok' ? 'todo' : item.state === 'todo' ? 'ok' : item.state,
          }
        ),
      }
    ));
  }, []);

  const toggleSection = (id: string) =>
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const resetAll = () => {
    if (!confirm('Reset toàn bộ checklist S12?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setSections(INITIAL_DATA);
  };

  // Stats
  const checkable = sections.flatMap(s => s.items).filter(i => i.state !== 'skip' && i.tag !== 'skip');
  const done = checkable.filter(i => i.state === 'ok');
  const pct = checkable.length ? Math.round(done.length / checkable.length * 100) : 0;
  const allDone = pct === 100;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
    }}>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="S12 Testing Checklist"
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: allDone ? '#1D9E75' : '#1a1a2e',
            border: '2px solid ' + (allDone ? '#5DCAA5' : '#378ADD'),
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 1,
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 16 }}>{allDone ? '✓' : '⬜'}</span>
          <span style={{ fontSize: 9, opacity: 0.8, letterSpacing: '0.02em' }}>{pct}%</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{
          width: 340, maxHeight: '80vh',
          background: '#0f0f1a',
          border: '1px solid #1e3a5f',
          borderRadius: 12,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            background: '#13132a',
            borderBottom: '1px solid #1e3a5f',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 11, color: '#378ADD', letterSpacing: '0.08em', fontWeight: 500 }}>
              S12 TESTING
            </span>
            <div style={{ flex: 1, height: 4, background: '#1e3a5f', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: allDone ? '#1D9E75' : '#378ADD',
                width: pct + '%', transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 11, color: allDone ? '#5DCAA5' : '#9FE1CB', minWidth: 36, textAlign: 'right' }}>
              {done.length}/{checkable.length}
            </span>
            <button
              onClick={resetAll}
              title="Reset"
              style={{ background: 'none', border: 'none', color: '#5F5E5A', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
            >↺</button>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#5F5E5A', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
            >×</button>
          </div>

          {/* Body */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
            {sections.map(sec => {
              const secDone = sec.items.filter(i => i.state === 'ok').length;
              const secTotal = sec.items.filter(i => i.tag !== 'skip').length;
              const isCollapsed = collapsed[sec.id];
              return (
                <div key={sec.id} style={{ marginBottom: 4 }}>
                  {/* Section header */}
                  <div
                    onClick={() => toggleSection(sec.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '5px 14px', cursor: 'pointer',
                      color: secDone === secTotal ? '#5DCAA5' : '#85B7EB',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: 10, opacity: 0.6, width: 10 }}>{isCollapsed ? '▶' : '▼'}</span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em' }}>
                      {sec.title}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: secDone === secTotal ? '#085041' : '#042C53',
                      color: secDone === secTotal ? '#9FE1CB' : '#85B7EB',
                    }}>
                      {secDone}/{secTotal}
                    </span>
                  </div>

                  {/* Items */}
                  {!isCollapsed && sec.items.map(item => {
                    const isFixed = item.tag === 'fixed';
                    const isSkip = item.tag === 'skip';
                    const isOk = item.state === 'ok';
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isFixed && !isSkip && toggle(sec.id, item.id)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                          padding: '5px 14px 5px 28px',
                          cursor: isFixed || isSkip ? 'default' : 'pointer',
                          opacity: isSkip ? 0.4 : 1,
                        }}
                      >
                        {/* Checkbox visual */}
                        <div style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 1,
                          border: isFixed ? 'none' : '1.5px solid ' + (isOk ? '#1D9E75' : '#2a4a6a'),
                          background: isFixed ? '#085041' : isOk ? '#1D9E75' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#fff', transition: 'all 0.15s',
                        }}>
                          {isFixed ? '✓' : isOk ? '✓' : ''}
                        </div>
                        {/* Text */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            color: isFixed ? '#5DCAA5' : isOk ? '#9FE1CB' : '#B4B2A9',
                            textDecoration: isOk && !isFixed ? 'line-through' : 'none',
                            fontSize: 12, lineHeight: 1.4,
                          }}>
                            {item.text}
                            {isFixed && <span style={{ marginLeft: 6, fontSize: 10, color: '#1D9E75', background: '#085041', padding: '0 5px', borderRadius: 3 }}>fixed</span>}
                            {isSkip && <span style={{ marginLeft: 6, fontSize: 10, color: '#5F5E5A', background: '#2C2C2A', padding: '0 5px', borderRadius: 3 }}>→S14</span>}
                          </div>
                          {item.note && (
                            <div style={{ color: '#444441', fontSize: 10, marginTop: 1 }}>{item.note}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid #1e3a5f',
            background: '#13132a',
            color: allDone ? '#5DCAA5' : '#5F5E5A',
            fontSize: 11, textAlign: 'center',
            letterSpacing: '0.05em',
          }}>
            {allDone ? '✓ S12 READY TO PUSH' : `${pct}% — ${checkable.length - done.length} items còn lại`}
          </div>
        </div>
      )}
    </div>
  );
}
