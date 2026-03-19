# GEM & CLAUDE PM Pro — Session Part 8 Handoff
**Ngày:** 2026-03-16 | **Session:** Part 8 → Part 9
**Repo:** https://github.com/GEM-CLAUDE-PM/App.git
**Stack:** React 19 + TypeScript + Vite + Tailwind + Supabase (PRODUCTION LIVE)
**Deploy:** Vercel — gemclaudepm.com

---

## ✅ S13 — ĐÓNG SPRINT

### Tổng kết S13 đã hoàn thành

#### Phase 1 — Infrastructure & Auth
- ✅ Supabase production live — `vbjnycvowylsuwdjjzfp.supabase.co` (Singapore)
- ✅ Vercel env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_USE_SUPABASE=true`
- ✅ `.env.local` với `VITE_USE_SUPABASE=false` cho local dev (mock users)
- ✅ SQL migration chạy thành công: `project_data` table + RLS + Realtime + trigger
- ✅ `profiles` table + trigger auto-create profile khi signup
- ✅ Auth email/password qua Supabase Auth — login production hoạt động
- ✅ RLS policy `project_data_all`: `for all to authenticated using(true)`

#### Phase 2 — Data Layer (db.ts)
- ✅ `sbGet` sync server data về localStorage sau mỗi lần đọc
- ✅ `useRealtimeSync` hook — subscribe Supabase Realtime theo projectId, debounce 300ms
- ✅ **Optimistic locking DEFER sang S15** — client timestamp ≠ Postgres trigger timestamp, cần `SELECT FOR UPDATE` server-side
- ✅ `isConflictError` + `ConflictError` type export (giữ cho S15)

#### Phase 3 — dbLoaded Pattern (6 dashboards)
- ✅ `QaQcDashboard` — **Material pattern**: db.set trong handler, không useEffect auto-save
- ✅ `BOQDashboard` — `dbLoaded = useRef(false)` guard
- ✅ `ManpowerDashboard` — `dbLoaded = useRef(false)` guard
- ✅ `ProcurementDashboard` — `dbLoaded = useRef(false)` guard
- ✅ `QSSubcontractorTab` — `dbLoaded = useRef(false)` guard
- ✅ `QSDashboard` — `dbLoaded = useRef(false)` guard

#### Phase 4 — Features
- ✅ **Realtime Sync** — Case 1 PASS: Material + QaQcDashboard tự refresh khi thiết bị khác update
- ✅ **Idempotency Key** — Case 3 PASS (single-device): `processing` state + `processedKeys` ref chặn double-approve
- ✅ `ContractDashboard` — thêm `onNavigate` prop, button "Mở QS" hoạt động đúng
- ✅ `ProjectDashboard` — wire `onNavigate={(tab) => setActiveTab(tab as any)}`

#### Phase 5 — Design System Update
- ✅ `DESIGN_SYSTEM.md` section 2.4 bổ sung: Load/Save pattern, `dbLoaded` useRef rule
- ✅ Pre-commit checklist thêm: "Nếu có useEffect auto-save → bắt buộc `dbLoaded` guard"

---

## 🔴 Root Cause Lessons — quan trọng cho session sau

### 1. useRef vs useState cho dbLoaded
```tsx
// ✅ ĐÚNG — useRef không bị React 18 batch render issue
const dbLoaded = useRef(false);
// Trong load: dbLoaded.current = true;
// Trong auto-save: if (dbLoaded.current) db.set(...)

// ❌ SAI — useState bị batch với setState(serverData), dbLoaded vẫn false khi useEffect chạy
const [dbLoaded, setDbLoaded] = useState(false);
```

### 2. Material pattern > useEffect auto-save
```tsx
// ✅ ĐÚNG — Material pattern: db.set trong handler với prev array đầy đủ
const saveItem = () => {
  setItems(prev => {
    const next = [newItem, ...prev];
    db.set('collection', projectId, next); // next có đủ data
    return next;
  });
};

// ❌ SAI — useEffect auto-save: có thể chạy trước khi server data load xong
useEffect(() => { db.set('collection', projectId, items); }, [items]);
```

### 3. Optimistic locking không làm ở client
- Client `Date.now()` ≠ Postgres trigger `now()` → mọi save thứ 2 đều bị false conflict
- Cần Postgres `SELECT FOR UPDATE` hoặc ETag → defer S15

### 4. project_data table structure
- **1 row per (project_id, collection)** — payload là toàn bộ JSON array
- Số row không tăng khi thêm item — chỉ payload thay đổi
- Đây là thiết kế đúng, không phải bug

---

## 📋 DESIGN_SYSTEM — Rules bổ sung S13

### Rule mới: Data Load/Save Pattern
```
Nếu dùng useEffect auto-save → BẮT BUỘC dbLoaded = useRef(false)
Nếu save trong handler → dùng setX(prev => { const next = [...]; db.set(col,pid,next); return next; })
Ưu tiên Material pattern (handler) hơn useEffect pattern
```

### Pre-commit checklist bổ sung
- [ ] Nếu có `useEffect` auto-save → `dbLoaded = useRef(false)` guard
- [ ] `db.set` trong handler luôn dùng `next` array (không dùng state snapshot)

---

## 🚀 S14 — SCOPE & PRIORITY

### Theo Roadmap V2 (S14 = Contract + Office + Risk + Realtime)

**Supabase Realtime đã xong** — S13 done. S14 scope còn lại:

#### Must-have S14
1. **ContractDashboard** — Performance bond tracking, Liquidated Damages calculator, EOT log
2. **OfficeDashboard** — Approval workflow công văn, biên bản họp digital
3. **RiskDashboard** — Risk register, ma trận 5×5, Early Warning Indicators
4. **ProjectDashboard Responsive Hybrid** — Mobile FAB + Desktop Master-Detail sidebar (từ backlog S13-14)

#### ProjectDashboard Responsive Hybrid (đã thiết kế)
- Mobile < 768px: FAB ⚡ + bottom nav
- Desktop ≥ 768px: Sidebar 240px cố định + content scroll độc lập
- Badge pending visible trên navigation
- Modal luôn overlay toàn màn hình

#### Should-have S14
- Wire `useRealtimeSync` vào tất cả dashboards còn lại (hiện chỉ QaQc + Material)
- Smart Sidebar: merge Taskbar + WorkspaceActionBar

---

## 📁 Files thay đổi trong Part 8

```
src/components/
├── db.ts                  ← sbGet sync localStorage + useRealtimeSync hook
├── QaQcDashboard.tsx      ← Material pattern + useRealtimeSync wired
├── BOQDashboard.tsx       ← dbLoaded useRef guard
├── ManpowerDashboard.tsx  ← dbLoaded useRef guard
├── ProcurementDashboard.tsx ← dbLoaded useRef guard
├── QSSubcontractorTab.tsx ← dbLoaded useRef guard
├── QSDashboard.tsx        ← dbLoaded useRef guard
├── ApprovalQueue.tsx      ← idempotency key + processing state
├── ContractDashboard.tsx  ← onNavigate prop
└── ProjectDashboard.tsx   ← wire onNavigate

Root:
├── .env                   ← VITE_USE_SUPABASE=true (production)
├── .env.local             ← VITE_USE_SUPABASE=false (local dev)
├── DESIGN_SYSTEM.md       ← section 2.4 bổ sung + checklist update

Supabase:
├── S13_migration.sql      ← project_data + RLS + Realtime + trigger
└── profiles table         ← auto-create trigger on signup
```

---

## 🗄️ Supabase Production State

**Project:** `gemclaude-prod` (vbjnycvowylsuwdjjzfp)
**Region:** Southeast Asia (Singapore)
**Tables:**
- `project_data` — RLS enabled, policy `project_data_all` (authenticated)
- `profiles` — RLS enabled, auto-created on signup

**Test users:**
- `testuser01@gemclaudepm.com` (password đã set trên Supabase dashboard)

**Realtime:** Enabled trên `project_data` table

---

## 🔑 Key Decisions Part 8

1. **Optimistic locking defer S15** — không làm ở client, cần Postgres transaction
2. **dbLoaded = useRef** — không useState, tránh React 18 batch issue
3. **Material pattern chuẩn** — db.set trong handler, không useEffect auto-save
4. **1 row per collection** — đây là thiết kế đúng của project_data table
5. **Local dev = mock users** — `.env.local` tắt Supabase, dev nhanh hơn
6. **Idempotency single-device done** — multi-device defer S15 với Supabase transaction

---

## ⚠️ Dashboards chưa wire useRealtimeSync

Hiện chỉ `QaQcDashboard` và `MaterialsDashboard` có Realtime. Các dashboard sau cần wire S14:
- QSDashboard, BOQDashboard, ManpowerDashboard, HSEWorkspace, HRWorkspace
- GiamSatDashboard, EquipmentDashboard, ProcurementDashboard

Pattern chuẩn (copy từ QaQcDashboard):
```tsx
import { db, useRealtimeSync } from './db';

// Sau load useEffect:
useRealtimeSync(projectId, ['collection_name'], async () => {
  const data = await db.get('collection_name', projectId, []);
  setState(data as any);
});
```

---

*Handoff: 2026-03-16 | Next session: Part 9 — S14 Contract + Office + Risk + ProjectDashboard Responsive*
