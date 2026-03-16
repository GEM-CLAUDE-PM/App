# GEM & CLAUDE PM Pro — Session Part 7 Handoff
**Ngày:** 2026-03-15 | **Session:** Part 7 → Part 8
**Repo:** https://github.com/GEM-CLAUDE-PM/App.git
**Stack:** React + TypeScript + Vite, Tailwind, Recharts, Supabase (dev: localStorage)
**Deploy:** Vercel — gemclaudepm.com

---

## ✅ S12 — ĐÓNG SPRINT

### Tổng kết S12 đã hoàn thành

#### Phase 1 — Code Quality (từ Part 6)
- ✅ `alert()` → zero toàn codebase (16 files, 46 alerts)
- ✅ `useNotification()` wired đúng chỗ tất cả files
- ✅ localStorage keys migrate sang `gem_db__${col}__${projectId}` format
- ✅ DESIGN_SYSTEM.md tạo mới — quy tắc modal, hook, CSS, notification

#### Phase 2 — ModalForm Migration (Part 6 + Part 7)
- ✅ `ModalForm.tsx` shared component tạo mới (FormRow, FormGrid, FormSection, BtnCancel, BtnSubmit)
- ✅ 17 business forms converted sang ModalForm (8 modules)
- ✅ **Tất cả modals đặt cuối component** — sau return(), sau tab blocks, trước closing ); — đúng DS
- ✅ HSEWorkspace: ViolationForm, TrainingForm, CertForm → ModalForm
- ✅ QaQcDashboard: ChecklistForm, DefectForm, FeedbackForm → ModalForm
- ✅ `ModalForm` COLOR_MAP thêm `red`, defensive fallback cho unknown color

#### Phase 3 — WorkspaceActionBar & Triggers (Part 7)
- ✅ 33 actions kiểm tra đầy đủ — tất cả 19 MODAL_ACTIONS có handler
- ✅ `EMPLOYEE_NEW` action thêm mới với đầy đủ fields (minLevel, domains, groupLabel)
- ✅ `canAccess()` defensive: `!action.domains ||` — không crash khi thiếu field
- ✅ `onOpenChange` fix setState-during-render (2 instances WorkspaceActionBar)
- ✅ `MATERIAL_REQUEST`, `INSPECTION_REQUEST`, `MATERIAL_APPROVAL` thêm vào MODAL_ACTIONS
- ✅ TIMESHEET, OVERTIME_REQUEST → navigate đến ManpowerDashboard site view (điểm danh)

#### Phase 4 — Bug Fixes (Part 7)
- ✅ `GiamSatDashboard`: 3 modals duplicate buttons → removed inline buttons, giữ footer
- ✅ `ContractDashboard`: `setActiveTab` undefined → fixed; màn hình trắng sau lock → `onManualLock` trong ProjectDashboard thêm `setActiveTab('overview')`
- ✅ `EquipmentDashboard`: `notifOk` undefined trong TabBaoDuong, TabSuCo → thêm hook
- ✅ `HRWorkspace`: `CalendarOff` icon missing import → fixed
- ✅ `QaQcDashboard`: `color="red"` crash ModalForm → thêm red vào COLOR_MAP
- ✅ `WorkspaceActionBar`: `setState during render` → `onOpenChange` chỉ gọi trong useEffect
- ✅ `PrintService`: blank print page → `ReactDOM.createPortal` cho 12 print components + `visibility:hidden` CSS approach; fix PrintHeader wrongly given portal closing
- ✅ `QSDashboard`: ModalForm import missing → added
- ✅ `GiamSatDashboard`: ModalForm import missing → added

#### Phase 5 — ManpowerDashboard / Chấm công (Part 7)
- ✅ GPS Geofence đã có, chấm công đã build nhưng bị ẩn
- ✅ `TIMESHEET` subTab: `payroll` → `site` (đi thẳng màn hình điểm danh)
- ✅ Bỏ restriction THT-only: tất cả role thấy danh sách nhân sự
- ✅ GPS `checking` state không còn block chấm công (cho phép manual khi chưa xác định vị trí)
- ✅ gem:open-action listener thêm vào ManpowerDashboard

---

## 📋 DESIGN_SYSTEM — Quy tắc bắt buộc

### Rules
1. **Modal:** Chỉ dùng `ModalForm` — không dùng `<div className="fixed inset-0...">` cho business forms
2. **Modal placement:** Luôn ở **cuối component return**, sau tất cả tab blocks, trước `</div>  );`
3. **Input CSS:** Chỉ `inputCls`/`selectCls` từ ModalForm.tsx
4. **Notification:** Chỉ `useNotification()` — zero `alert()`
5. **Hook placement:** Hook chỉ ở top level của component body — không trong sub-functions (trừ khi sub-function là proper React component)
6. **Data:** Chỉ `db.ts` — key format `gem_db__${col}__${projectId}`
7. **Print:** Chỉ `PrintService` components — đã có `ReactDOM.createPortal` sẵn
8. **gem:open-action:** Mọi MODAL_ACTION phải có handler trong dashboard tương ứng

### ModalForm COLOR_MAP hợp lệ
`emerald | blue | violet | amber | rose | orange | teal | indigo | slate | red`

---

## 🔴 BACKLOG — Chưa làm trong S12 (scope cut)

### Inline forms còn lại (thấp ưu tiên — không có trong MODAL_ACTIONS)
| File | Form | Ghi chú |
|---|---|---|
| `OfficeDashboard.tsx` | 4 forms | Văn thư hành chính, ít dùng |
| `BOQDashboard.tsx` | showAddRow, showAddRate | Nhập liệu BOQ inline OK |
| `AccountingDashboard.tsx` | showForm | Kế toán |
| `GiamSatDashboard.tsx` | showNewRevForm | Thêm revision bản vẽ |
| `AdminPanel.tsx` | showForm | Admin only |
| `NotificationEngine.tsx` | showForm | Internal component |

### ContractDashboard
- Button "Mở QS" cần `onNavigate` prop từ ProjectDashboard — hiện dùng `notifInfo` tạm

---

## 🚀 S13 — SCOPE & PRIORITY

### Must-have S13
1. **Supabase Migration** — CRITICAL
   - Migrate toàn bộ `db.ts` từ localStorage → Supabase
   - Key format đã chuẩn `gem_db__${col}__${projectId}` → map 1:1 sang Supabase table/RLS
   - Auth: Supabase Auth (email/password)

2. **Optimistic Locking** — MANDATORY (multi-device)
   - Mỗi record có `updated_at` timestamp
   - Khi save: check `updated_at` version — nếu conflict → thông báo user
   - Lý do: user hiện tại dùng 2-3 thiết bị cùng lúc là bình thường

3. **Supabase Realtime Subscribe** — MANDATORY
   - Auto refresh UI khi thiết bị khác update
   - Subscribe theo `projectId` để tránh noise
   - Pattern: `supabase.channel('project:${pid}').on('postgres_changes'...)`

4. **Idempotency Key cho Approval** — S13
   - Chống double-approve khi bấm 2 lần hoặc 2 thiết bị
   - Key: `approve_${docId}_${userId}` — server side check

5. **ContractDashboard onNavigate prop** — S13
   - Thêm `onNavigate?: (tabId: string) => void` vào Props
   - Wiring trong ProjectDashboard
   - Button "Mở QS" hoạt động đúng

### Should-have S13
- StorageService wire đến tất cả modules (hiện `db.ts` đã abstract sẵn)
- Session management sau Supabase Auth

---

## 🗓️ S14 — ROADMAP

### ProjectDashboard Redesign — Responsive Hybrid

**Quyết định:** Kết hợp 2 phương án theo breakpoint

**Mobile (< 768px) — PA1: FAB + Bottom Nav**
- WorkspaceActionBar → Floating Action Button ⚡ góc dưới phải
- Navigation → Bottom tab bar
- Content full width

**Desktop (≥ 768px) — PA2: Master-Detail Sidebar**
- Sidebar 240px cố định: danh sách modules + badge pending
- Content area scroll độc lập
- Modal overlay toàn màn hình
- ⚡ Tác nghiệp nằm cuối sidebar

**Common:**
- Breadcrumb: luôn biết đang ở tab nào
- Modal luôn overlay — không phụ thuộc DOM position
- Badge pending visible trên navigation

### S14 khác
- Smart Sidebar: merge Taskbar + WorkspaceActionBar thành 1 component
- Context-aware: sidebar thay đổi theo dashboard đang active

---

## 📁 Files đã thay đổi trong Part 7 (cần deploy)

```
src/components/
├── ModalForm.tsx              ← thêm 'red' color + defensive fallback
├── WorkspaceActionBar.tsx     ← EMPLOYEE_NEW, MODAL_ACTIONS, canAccess fix, onOpenChange fix
├── HRWorkspace.tsx            ← LeaveForm/EmpForm modal, gem:open-action, CalendarOff import
├── HSEWorkspace.tsx           ← ViolationForm/TrainingForm/CertForm modal, HSE_INSPECTION handler
├── QaQcDashboard.tsx          ← ChecklistForm/DefectForm/FeedbackForm modal, ModalForm import
├── MaterialsDashboard.tsx     ← modals moved to end, VoucherPrint/InventoryPrint data mapping
├── GiamSatDashboard.tsx       ← duplicate buttons removed, ModalForm import, Lưu nháp/Ký buttons
├── QSDashboard.tsx            ← modal moved to end, ModalForm import
├── ProcurementDashboard.tsx   ← modals moved to end
├── EquipmentDashboard.tsx     ← notif hooks in TabBaoDuong/TabSuCo
├── ContractDashboard.tsx      ← setActiveTab removed
├── ProjectDashboard.tsx       ← onManualLock thêm setActiveTab('overview')
├── PrintService.tsx           ← ReactDOM.createPortal 12 components, CSS visibility:hidden
├── ManpowerDashboard.tsx      ← GPS fix, myPeople restriction removed, gem:open-action
├── QSVariationTab.tsx         ← VARIATION_ORDER handler
└── QSSubcontractorTab.tsx     ← notif wired
```

---

## 🔑 Key Lessons Learned — Part 7

1. **Modal placement:** Script replace tự động dễ đặt sai vị trí — phải verify `after_return AND after_tabs AND before_close`
2. **Portal vs CSS:** `display:none` trên parent không thể override bởi child — phải dùng `ReactDOM.createPortal` hoặc `visibility:hidden`
3. **ModalForm color:** Validate color prop trước khi ship — add defensive fallback
4. **Hook in sub-components:** OK nếu sub-component là proper React component (PascalCase, dùng như JSX). Vi phạm nếu trong arrow function hay regular function
5. **Artifacts cache:** Present lại cùng tên file không force refresh — phải delete + recreate file
6. **Multi-device reality:** 2-3 thiết bị/user là normal 2026 → optimistic locking là MANDATORY S13, không phải nice-to-have

---

*Handoff: 2026-03-15 | Next session: Part 8 — S13 Supabase Migration*
