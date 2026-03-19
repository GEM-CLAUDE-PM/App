# GEM & CLAUDE PM Pro — Session Part 8 Handoff
**Ngày:** 2026-03-16 | **Session:** Part 8 → Part 9
**Repo:** https://github.com/GEM-CLAUDE-PM/App.git
**Stack:** React 19 + TypeScript + Vite + Tailwind + Supabase LIVE
**Deploy:** Vercel — gemclaudepm.com (auto-deploy từ GitHub)

---

## ✅ S13 — ĐÓNG HOÀN TOÀN

### Infrastructure
- ✅ Supabase production LIVE — `vbjnycvowylsuwdjjzfp.supabase.co` (Singapore)
- ✅ `.env` production: `VITE_USE_SUPABASE=true` trên Vercel
- ✅ `.env.local`: `VITE_USE_SUPABASE=false` — local dev dùng mock users
- ✅ SQL migration: `project_data` table + RLS policy `project_data_all` + Realtime + trigger
- ✅ `profiles` table + trigger auto-create khi signup
- ✅ Auth email/password Supabase thật hoạt động trên production

### Data Layer (db.ts)
- ✅ `sbGet` sync server data về localStorage sau mỗi lần đọc
- ✅ `useRealtimeSync` hook — subscribe Supabase Realtime, debounce 300ms, auto-cleanup
- ✅ Optimistic locking **DEFER S15** — client timestamp ≠ Postgres trigger, cần `SELECT FOR UPDATE`

### Pattern fixes (6 dashboards)
- ✅ `QaQcDashboard` — **Material pattern**: `db.set` trong handler với `prev` array đầy đủ, bỏ useEffect auto-save
- ✅ `QaQcDashboard` — `useRealtimeSync` wired cho 3 collections
- ✅ `BOQDashboard`, `ManpowerDashboard`, `ProcurementDashboard`, `QSSubcontractorTab`, `QSDashboard` — `dbLoaded = useRef(false)` guard

### Features
- ✅ **Realtime Sync** — Case 1 PASS: Material + QaQc tự refresh khi thiết bị khác update
- ✅ **Idempotency Key** — Case 3 PASS (single-device): `processing` state + `processedKeys` ref trong ApprovalQueue
- ✅ `ContractDashboard` — `onNavigate` prop, button "Mở QS" hoạt động đúng
- ✅ `ProjectDashboard` — wire `onNavigate={(tab) => setActiveTab(tab as any)}`

### Design System & ModalForm
- ✅ `ModalForm.tsx` — thêm `FormFileUpload` component (PDF/Word/Excel/ảnh, multi-file, preview, xóa)
- ✅ `DESIGN_SYSTEM.md` — section 2.1a: quy tắc FormFileUpload cho forms có hồ sơ pháp lý
- ✅ `DESIGN_SYSTEM.md` — section 2.4: dbLoaded useRef rule, Material pattern rule

### Roadmap
- ✅ `GemClaude_Roadmap_V5.docx` — cập nhật sau Part 8
- ✅ Kiến trúc Multi-tier chốt: Starter/Pro (Model A) + Enterprise (Model D — single-tenant dedicated)
- ✅ S15 cập nhật: hỗ trợ cả multi-tenant RLS lẫn single-tenant provisioning
- ✅ S17 Billing: 3 gói Starter/Pro/Enterprise rõ ràng

---

## 🔴 Key Lessons — KHÔNG được quên

### 1. project_data table structure
**1 row per (project_id, collection)** — payload là toàn bộ JSON array. Số row không tăng khi thêm item. Đây là thiết kế đúng, không phải bug.

### 2. Material pattern — chuẩn duy nhất cho db.set
```tsx
// ✅ ĐÚNG — db.set trong handler với next array đầy đủ
setItems(prev => {
  const next = [newItem, ...prev];
  db.set('collection', projectId, next);
  return next;
});

// ❌ SAI — useEffect auto-save có thể chạy trước khi load xong
useEffect(() => { db.set('collection', projectId, items); }, [items]);
```

### 3. dbLoaded = useRef, KHÔNG useState
```tsx
// ✅ ĐÚNG — useRef không bị React 18 batch render issue
const dbLoaded = useRef(false);
// load xong: dbLoaded.current = true;
// guard: if (dbLoaded.current) db.set(...)

// ❌ SAI — useState bị batch, dbLoaded vẫn false khi useEffect chạy
const [dbLoaded, setDbLoaded] = useState(false);
```

### 4. Optimistic locking KHÔNG làm ở client
Client `Date.now()` ≠ Postgres trigger `now()` → false conflict mọi lần. Defer S15 với `SELECT FOR UPDATE`.

### 5. Dashboards chưa wire useRealtimeSync
Hiện chỉ `QaQcDashboard` + `MaterialsDashboard`. Còn lại wire S14:
```tsx
import { db, useRealtimeSync } from './db';
useRealtimeSync(projectId, ['collection_name'], async () => {
  const data = await db.get('collection_name', projectId, []);
  setState(data as any);
});
```

---

## 🚀 S14 — SCOPE (Theo Roadmap V5)

### Must-have S14 (ưu tiên thứ tự)

**1. 🔴 Zalo OA production token** — Priority 1
- `ZaloService.ts` còn `mockSend()` — cần `VITE_ZALO_OA_ID` production
- Không có Zalo thật thì S16 SubconPortal/ClientPortal không có notification

**2. ProgressDashboard — Drag-drop Gantt** — CRITICAL
- Hiện chỉ có Gantt static. Cần: drag-drop (react-beautiful-dnd hoặc dnd-kit), baseline vs actual, S-curve từ data thật, EVM thật

**3. HSE PTW (Permit-to-Work)**
- Chưa có workflow PTW, Toolbox Talk digital, JSA, leading indicators

**4. StorageDashboard + File Upload thật**
- `StorageService.ts` đã có bucket structure `gem-docs/{projectId}/{category}/`
- Cần: tạo bucket trên Supabase → wire `FormFileUpload` vào forms nghiệp vụ → upload/preview thật

**5. Accounting auto-sync**
- QS payments + Materials cost → AccountingDashboard tự động

**6. useRealtimeSync wire đủ 9 dashboards còn lại**

**7. Inline forms còn lại (24 instances) → ModalForm**
- OfficeDashboard (4 forms), BOQDashboard (showAddRow), AccountingDashboard, AdminPanel, GiamSatDashboard

**8. FormFileUpload wire vào forms nghiệp vụ**
- BBNT, NCR, đề nghị thanh toán, phiếu xuất kho, incident HSE, chứng chỉ HR

### Should-have S14
- Accounting auto-sync: QS payments + Materials cost → AccountingDashboard
- BOQ vs QS comparison realtime
- Procurement → Materials auto-update khi PO approved
- ProjectDashboard Responsive Hybrid (Mobile FAB + Desktop sidebar 240px)
- GiamSatDashboard: camera inline + geotagging hoàn chỉnh
- EquipmentDashboard: QR code, smart maintenance alert
- QaQcDashboard: BBNT chain hoàn chỉnh, photo inline
- ContractDashboard: Performance bond, LAD calculator, EOT timeline

---

## 📋 DESIGN_SYSTEM Rules bổ sung S13

### Pre-commit checklist đầy đủ
- [ ] Không có `alert()` / `confirm()` — dùng `notifErr/notifOk`
- [ ] Không có `localStorage.getItem/setItem` trực tiếp — dùng `db.ts`
- [ ] Không có `<div className="fixed inset-0...">` custom — dùng `ModalForm`
- [ ] Tất cả form có đủ trường: `nguoiLap`, `chucVu`, `nguoiNhan`, `ngay`
- [ ] Modal đặt ở cuối component return, không trong tab block
- [ ] Form state naming: `showXxxForm`, `xxxForm`, `xxxList`
- [ ] Input dùng `inputCls` / `selectCls` từ ModalForm.tsx
- [ ] Màu sắc dùng Tailwind tokens, không hard-code hex
- [ ] Collection key đăng ký trong `db.ts` registry
- [ ] AI model dùng `GEM_MODEL` / `GEM_MODEL_QUALITY` constants
- [ ] **[MỚI S13]** Nếu có `useEffect` auto-save → `dbLoaded = useRef(false)` guard
- [ ] **[MỚI S13]** `db.set` trong handler luôn dùng `next` array (prev pattern)
- [ ] **[MỚI S13]** Forms có hồ sơ pháp lý → dùng `FormFileUpload` từ ModalForm.tsx

---

## 🗄️ Supabase Production State

**Project:** `gemclaude-prod` (`vbjnycvowylsuwdjjzfp`)
**Region:** Southeast Asia (Singapore)
**Tables:**
- `project_data` — RLS: `project_data_all` (authenticated, true/true)
- `profiles` — RLS enabled, auto-created on signup
**Realtime:** Enabled trên `project_data`
**Test user:** `testuser01@gemclaudepm.com`

---

## 📁 Files thay đổi Part 8 (đã push)

```
src/components/
├── db.ts                    ← sbGet sync localStorage + useRealtimeSync hook
├── QaQcDashboard.tsx        ← Material pattern + useRealtimeSync + FormFileUpload ready
├── BOQDashboard.tsx         ← dbLoaded useRef guard
├── ManpowerDashboard.tsx    ← dbLoaded useRef guard
├── ProcurementDashboard.tsx ← dbLoaded useRef guard
├── QSSubcontractorTab.tsx   ← dbLoaded useRef guard
├── QSDashboard.tsx          ← dbLoaded useRef guard
├── ApprovalQueue.tsx        ← idempotency key + processing state
├── ContractDashboard.tsx    ← onNavigate prop
├── ModalForm.tsx            ← FormFileUpload component mới
└── ProjectDashboard.tsx     ← wire onNavigate

Root:
├── .env                     ← VITE_USE_SUPABASE=true (production Vercel)
├── .env.local               ← VITE_USE_SUPABASE=false (local dev)
└── DESIGN_SYSTEM.md         ← sections 2.1a + 2.4 bổ sung

Docs:
└── GemClaude_Roadmap_V5.docx ← Roadmap mới nhất
```

---

## 🏗️ Kiến trúc Multi-tier (chốt Part 8)

| Gói | Model | Data | Users | Sprint |
|-----|-------|------|-------|--------|
| Starter | Multi-tenant (A) | Server chung | ≤10 | S17 |
| Pro | Multi-tenant (A) | Server chung | Unlimited | S17 |
| Enterprise | Single-tenant (D) | Server riêng GEM&CLAUDE host | 50+ | S15+S17 |

**Enterprise value prop:** "Phòng VIP riêng — chìa riêng, không ai vào được, GEM&CLAUDE lo kỹ thuật, cam kết xuất data khi cần"

---

*Handoff: 2026-03-16 | Next session: Part 9 — S14 Zalo OA + ProgressDashboard Gantt + HSE PTW + Storage thật*
