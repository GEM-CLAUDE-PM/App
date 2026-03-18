# GEM & CLAUDE PM Pro — Session Part 10 Handoff
**Ngày:** 2026-03-16 | **Session:** Part 10 → Part 11
**Repo:** https://github.com/GEM-CLAUDE-PM/App.git
**Stack:** React 19 + TypeScript + Vite + Tailwind + Supabase LIVE

---

## ✅ Part 10 — HOÀN THÀNH

### useRealtimeSync — 9/9 dashboards ✅ XONG HOÀN TOÀN

| Dashboard | Status | Collections |
|---|---|---|
| BOQDashboard | ✅ | `boq_items`, `rate_library` |
| ManpowerDashboard | ✅ | `mp_people`, `mp_attendance` |
| QSDashboard | ✅ | `qs_items`, `qs_acceptance`, `qs_payments` |
| ProcurementDashboard | ✅ | `procurement_rfqs`, `procurement_quotes`, `procurement_pos`, `procurement_suppliers` |
| GiamSatDashboard | ✅ | `gs_logs`, `gs_rfi`, `gs_drawings` |
| HSEWorkspace | ✅ | `hse_incidents`, `hse_trainings`, `hse_violations`, `hse_inspections`, `hse_worker_certs` |
| AccountingDashboard | ✅ | `acc_debts` + cross-sync `mat_vouchers`, `qs_payments` |
| **HRWorkspace** | ✅ **Done Part 10** | `hr_employees`, `hr_contracts`, `hr_leaves`, `hr_evaluations` |
| **EquipmentDashboard** | ✅ **Done Part 10** | `eq_maintenance` |

### HRWorkspace — migrate hoàn toàn sang db.ts
- Xóa `lsKeyHR()` / `loadHR()` (raw localStorage)
- Thêm `db.ts` import + `useRef(false)` dbLoaded
- Async load `Promise.all` 4 collections on mount
- `saveHR()` giờ gọi `db.set()` thay localStorage
- `useRealtimeSync` cho cả 4 collections

### EquipmentDashboard — migrate + fix critical bugs
- Fix `getCurrentCtx(pid)` → `getCurrentMember(pid)` + `buildCtxFromMember()` (rule bất biến)
- Lift `maintItems` state từ `TabBaoDuong` lên main component
- Wire `db.get/db.set('eq_maintenance', pid)` + `useRealtimeSync`
- Tất cả `setMaintItems` calls dùng Material pattern (prev → next → db.set → return next)
- Truyền `maintItems`, `setMaintItems`, `pid` vào `TabBaoDuong` qua props

### ProgressDashboard — data thật + Drag-drop Gantt ✅
- Thêm `projectId` prop (chuẩn DashboardProps)
- Wire `db.get('progress_wbs', pid)` + `db.get('progress_milestones', pid)` on mount
- `useRealtimeSync` cho `progress_wbs` + `progress_milestones`
- `ganttTasks` derive từ `wbs` state thật (useMemo) thay vì hardcoded array
- WBS EV% save button wire `db.set('progress_wbs', pid, next)` — Material pattern
- **GanttChart component mới** — drag-drop bằng pointer events (không cần thư viện):
  - `GripVertical` handle ở cột trái
  - `onPointerDown/onPointerEnter/onPointerUp` — reorder rows
  - Visual feedback: opacity-40 cho row đang kéo, border-t-2 blue cho row đích
  - Baseline marker (vertical line cuối planned duration)
  - `onReorder` callback → sync WBS order → `db.set`

---

## 🔴 S14 — CÒN LẠI

### Tuần 2–3 còn lại:

**1. StorageDashboard — Supabase Storage thật** (chưa làm)
- `StorageService.ts` đã có bucket structure
- Cần tạo bucket `gem-docs` trên Supabase → wire `FormFileUpload` vào forms nghiệp vụ

**2. HSE PTW — Permit-to-Work tab mới** (chưa làm)
- `PERMIT_TO_WORK` action redirect sai về tab `violations`
- Cần tab riêng: PTW workflow approve, Toolbox Talk digital, JSA checklist

**3. Inline forms migrate — 24 instances** (chưa làm)
- OfficeDashboard (4), BOQDashboard (showAddRow), AccountingDashboard, AdminPanel, GiamSatDashboard

**4. FormFileUpload wire vào forms nghiệp vụ** (sau khi Storage thật xong)
- BBNT, NCR, đề nghị thanh toán, phiếu xuất kho, incident HSE, chứng chỉ HR

---

## 📋 Rules bất biến

- `getCurrentCtx` KHÔNG tồn tại → dùng `getCurrentMember(pid)` + `buildCtxFromMember(member)`
- `dbLoaded` = `useRef(false)` KHÔNG `useState`
- `db.set` trong handler: `setX(prev => { const next=[...]; db.set(col,pid,next); return next; })`
- `useRealtimeSync` đặt SAU load useEffect + persist useEffect

---

## 📁 Files thay đổi Part 10

```
src/components/
├── HRWorkspace.tsx       ← migrate localStorage → db.ts + async load + useRealtimeSync
├── EquipmentDashboard.tsx← getCurrentCtx fix + lift maintItems + db.ts + useRealtimeSync
└── ProgressDashboard.tsx ← projectId prop + db load + GanttChart drag-drop component
```

---

*Handoff: 2026-03-16 | Next: Part 11 — StorageDashboard Supabase thật + HSE PTW tab*
