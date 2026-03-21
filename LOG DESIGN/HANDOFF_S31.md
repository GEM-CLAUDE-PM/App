# HANDOFF S31 — GEM & CLAUDE PM Pro
**Ngày:** 21/03/2026  
**Session:** S31 (tiếp nối S30)  
**Branch:** master  
**Production:** gemclaudepm.com · Supabase Singapore

---

## 1. HOÀN THÀNH TRONG S30 (recap để S32 không bỏ sót)

### Patches S30 cần apply (thứ tự):
| File | Nội dung |
|---|---|
| `patch_s30.zip` | iOS fix + Remove SEED/MOCK 9 files + Dashboard live data |
| `patch_notif6.zip` | NotificationEngine 3 kênh (Email/Zalo/In-App) + multi-recipient |
| `patch_icons.zip` | PWA icons từ logo thật (8 sizes) + manifest.json |
| `patch_gantt_finance.zip` | Gantt PA3 financial split panel + role-based |
| `patch_s30_crm.zip` | CRM_Pipeline.html standalone + App.tsx revert |
| `patch_s30_payos.zip` | BillingPage history tab + PayOS Edge Functions + vite.config BIM fix |

### SQL cần chạy trong Supabase:
1. `supabase/inapp_notifications.sql` — table in-app notifications
2. `supabase/payment_transactions.sql` — table payment history
3. `supabase/seed_pilot_data.sql` — seed 8 modules cơ bản
4. `supabase/seed_pilot_data_2.sql` — seed 12 modules còn lại

### Edge Functions cần deploy:
```powershell
npx supabase functions deploy create-payos-link --no-verify-jwt
npx supabase functions deploy payos-webhook --no-verify-jwt
npx supabase functions deploy send-email --no-verify-jwt
```

### Commits S30 (5 commits):
```
feat(s30): remove all SEED/MOCK data + wire Supabase + Dashboard live data
feat(notif): 3-channel send + multi-user picker + external recipients + toggle CSS fix
fix(pwa): real logo icons all sizes + manifest.json
feat(gantt): PA3 financial split panel Budget/AC/CPI with role-based visibility
feat(crm): CRM Pipeline standalone HTML — NOT in React app
feat(payos): Edge Functions create-payos-link + webhook + payment history tab + vite BIM fix
```

---

## 2. HOÀN THÀNH TRONG S31

### Patches S31:
| File | Nội dung |
|---|---|
| `patch_s31_email.zip` | CRM email automation + Edge Function + SQL |
| `patch_s31_landing.zip` | Landing page marketing |

### S31.1 — Email Automation CRM
**File:** `public/CRM_Pipeline.html` (cập nhật — thêm tab 📧 Auto)
**File:** `supabase/functions/crm-followup-scheduler/index.ts` (Edge Function MỚI)
**File:** `supabase/crm_email_automation.sql` (table + cron job)

**Logic:**
- Cold ≥ 7 ngày không liên hệ → email nhắc
- Warm ≥ 3 ngày → email nhắc  
- Hot ≥ 1 ngày → email nhắc gấp
- Bất kỳ lead nào `next_followup` quá hạn → email ngay
- Hot lead có email → tự gửi thẳng cho KH
- Ghi log vào `crm_email_logs`

**Deploy:**
```powershell
npx supabase functions deploy crm-followup-scheduler --no-verify-jwt
```

**SQL cần chạy:** `supabase/crm_email_automation.sql`
- Thay `REPLACE_PROJECT_REF` và `REPLACE_ANON_KEY` trước khi chạy
- Thêm secret `NOTIFY_EMAIL` vào Supabase Dashboard

**Cron:** Chạy 8:00 AM GMT+7 mỗi ngày (01:00 UTC)

### S31.2 — Landing Page
**File:** `public/landing.html`
**URL:** `gemclaudepm.com/landing.html`

**Sections:** Nav sticky · Hero · Stats bar (counter animate) · 9 modules · AI demo chat · 3 pricing tiers · 3 testimonials · CTA · Footer
**Design:** Dark industrial, font Syne + DM Sans, teal accent
**Responsive:** Mobile 600px + 900px breakpoints

**Commit S31:**
```
feat(s31): CRM email automation — daily follow-up scheduler + log tab
feat(s31): landing page marketing — gemclaudepm.com/landing
```

---

## 3. ROADMAP V11 — ĐÃ CẬP NHẬT

File: `GemClaude_Roadmap_V11.md`

### Tổng quan sprint tiếp theo:

**S32 — Gantt hoàn thiện (10 items)**
- P0: Xóa hardcode → ngày thật + persist vào Supabase · EVM tính từ data thật (qs_acceptance + progress_wbs)
- P1: Zoom 3 cấp (week/month/quarter) · Baseline freeze
- P2: Dependency arrows (FS) · Critical path highlight · Look-ahead 2-3 tuần · Export PDF/Print A3
- P3: Resource loading histogram · Weather/delay log

**S33 — GEM AI hoàn thiện (10 items)**
- P0: Streaming (`sendMessageStream`) · Live context injection · **Gemini Function Calling** (AI tự gọi tools)
- P1: Memory per project · Proactive alerts · Action execution · Document export .docx
- P2: Dynamic chips · Multi-turn phân tích · Comparison 2 projects · Anomaly detection
- P3: Lesson learned tự động khi project complete

**S34:** SEO + Demo account + CRM Analytics
**S35:** Zalo OA live + iOS Safari fix + PayOS live (chờ dependencies)
**S36:** Resource loading + Weather log + 4D BIM link
**S37+:** Multi-language · SSO · API public · White-label

---

## 4. KIẾN TRÚC HIỆN TẠI

### Tech Stack
- React 19 + TypeScript + Vite 6 + Tailwind
- Supabase (Singapore) — Auth, DB, Realtime, Edge Functions, Storage
- Gemini AI (`gemini-3-flash-preview` — KHÔNG thay đổi)
- Vercel (branch: **master** — KHÔNG phải main)
- PWA (service worker, offline queue, push notifications)

### Critical Rules (LUÔN enforce)
- `dbLoaded` → `useRef` only, KHÔNG `useState`
- All modals → `ModalForm` only
- Persistence → `db.ts` only
- Notifications → `useNotification()` only (NO `alert()`/`confirm()`)
- Gemini model → `GEM_MODEL` constant từ `gemini.ts` (KHÔNG hardcode model string)
- Branch deploy: **master** (git push origin master)
- PowerShell: chạy lệnh tuần tự, KHÔNG dùng `&&`
- `Expand-Archive -Path file.zip -DestinationPath . -Force` để apply patch

### DB Collections quan trọng (db.ts)
```
progress_wbs, progress_milestones   ← S32 sẽ mở rộng schema
boq_items, rate_library
qs_items, qs_acceptance, qs_payments, qs_subs
qa_checklists, qa_defects, qa_feedbacks
hr_employees, hr_contracts, hr_leaves, hr_evaluations
eq_maintenance
risk_register
procurement_rfqs, procurement_pos, procurement_suppliers
gs_logs, gs_rfi
acc_debts
hse_ptws, hse_toolbox, hse_incidents, hse_trainings, hse_violations, hse_inspections
mp_people, mp_attendance
calendar_events (global), contacts (global)
contracts, rd_drawings, rd_rfis
office_congvan, office_meetings, office_minutes
```

### CRM System (standalone — KHÔNG trong React app)
- `public/CRM_Form.html` — form tiếp cận KH
- `public/CRM_Review.html` — review nội bộ (password: `gem2026crm` — ĐỔI TRƯỚC KHI SHARE)
- `public/CRM_Pipeline.html` — Kanban pipeline + email automation
- Table `crm_leads` trong Supabase
- Edge Functions: `crm-submit`, `crm-followup-scheduler`

### Supabase Secrets cần có
```
RESEND_API_KEY          = re_xxxx (email notifications)
PAYOS_CLIENT_ID         = (chờ production)
PAYOS_API_KEY           = (chờ production)
PAYOS_CHECKSUM_KEY      = (chờ production)
NOTIFY_EMAIL            = email anh Tuấn (cho CRM scheduler)
APP_URL                 = https://gemclaudepm.com
```

---

## 5. BUGS ĐANG PENDING

| Bug | Status | Cần gì để fix |
|---|---|---|
| iOS Safari white screen sau login | ⚠️ Pending | Cần Mac + cắm iPhone + Safari DevTools → chụp console errors |
| Zalo OA live | ⚠️ Pending | Cần CCCD xác thực + đăng ký doanh nghiệp |
| PayOS live | ⚠️ Pending | Cần production credentials từ PayOS Dashboard |
| VAPID keys push notification | ⚠️ Low priority | `npx web-push generate-vapid-keys` + thêm vào Vercel env |

---

## 6. SESSION MỚI S32 — CHECKLIST

Khi bắt đầu S32, upload:
1. `src.zip` — source code mới nhất sau khi apply tất cả patches S30+S31
2. `HANDOFF_S31.md` (file này)
3. `GemClaude_Roadmap_V11.md`

**Việc đầu tiên S32:**
1. Đọc HANDOFF + Roadmap
2. Unzip src.zip → verify không còn hardcode `totalDays=95`, `EVM_DATA`, `BAC=45`
3. Bắt đầu S32.1 — xóa hardcode Gantt/EVM + schema WBS mở rộng
4. Song song S33.1 — streaming AI (độc lập, không ảnh hưởng Gantt)

**Priority tuyệt đối S32:**
- Gantt P0 (ngày thật + EVM từ data thật) TRƯỚC
- AI Streaming TRƯỚC
- Rồi mới đến P1, P2...

---

## 7. NOTES KỸ THUẬT QUAN TRỌNG

### WBS Schema cần mở rộng trong S32
```typescript
// Thêm vào type WBSItem hiện tại:
gantt_start_date?: string    // ISO date "2026-01-15"
gantt_end_date?: string      // ISO date "2026-03-30"
gantt_baseline_start?: string
gantt_baseline_end?: string
depends_on?: string[]        // array of wbsId
responsible_id?: string      // profile id
resource_ids?: string[]      // equipment/people ids
delay_days?: number          // từ weather log
```

### EVM Calculation từ data thật (S32)
```typescript
// BAC = tổng budget WBS
const BAC = wbs.reduce((s, w) => s + (w.budget || 0), 0);

// EV = tổng budget × ev_pct (từ WBS hoặc map từ qs_acceptance)
const EV = wbs.reduce((s, w) => s + (w.budget || 0) * (w.ev_pct || 0) / 100, 0);

// PV = tổng budget × pv_pct (planned value đến thời điểm hiện tại)
const PV = wbs.reduce((s, w) => s + (w.budget || 0) * (w.pv_pct || 0) / 100, 0);

// AC = tổng actual cost (từ WBS.ac hoặc từ mat_vouchers + qs_payments)
const AC = wbs.reduce((s, w) => s + (w.ac || 0), 0);
```

### AI Function Calling setup (S33)
```typescript
// Định nghĩa tools cho Gemini
const tools = [{
  functionDeclarations: [
    {
      name: 'get_project_data',
      description: 'Lấy dữ liệu dự án từ database',
      parameters: {
        type: 'object',
        properties: {
          collection: { type: 'string' },
          projectId: { type: 'string' }
        }
      }
    },
    {
      name: 'create_calendar_event',
      description: 'Tạo sự kiện trong lịch',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' },
          location: { type: 'string' }
        },
        required: ['title', 'date']
      }
    }
    // ... thêm tools khác
  ]
}];

const model = genAI.getGenerativeModel({
  model: GEM_MODEL,
  systemInstruction: SYSTEM_PROMPT,
  tools,
});
```


---

## 8. MODAL FORM MIGRATION — HOÀN THÀNH

### Kết quả kiểm tra toàn bộ App

| File | Quyết định | Lý do |
|---|---|---|
| `BOQDashboard` — form thêm hạng mục | ✅ Đã ModalForm từ trước | Không cần làm |
| `BOQDashboard` — `showAddRate` (4 fields) | ✅ Giữ nguyên | Inline nhỏ trong thư viện đơn giá, context phù hợp |
| `BOQDashboard` — inline edit cell | ✅ Giữ nguyên | Spreadsheet UX — modal sẽ kém hơn |
| `QSDashboard` — `showAddRow` | ✅ **Migrated → ModalForm** | Form 6 fields, cần nhất quán |
| `QSDashboard` — inline edit cell | ✅ Giữ nguyên | Spreadsheet UX |
| `QSSubcontractorTab` — `showNewSub` | ✅ **Migrated → ModalForm** | Form 10+ fields phức tạp |
| `QSSubcontractorTab` — `showNewSubPay` | ✅ **Migrated → ModalForm** | Form với sub-tables theo cơ chế TT |
| `DelegationManager` — `CreateDelegationForm` | ✅ Giữ nguyên | Component riêng trong side panel, không phải inline form |
| `ManpowerDashboard` — inline detail edit | ✅ Giữ nguyên | Master-detail UX có chủ đích |
| Tất cả modules khác | ✅ Đã ModalForm | AccountingDashboard, ContractDashboard, GiamSatDashboard, HSEWorkspace, HRWorkspace, OfficeDashboard, ProcurementDashboard, QaQcDashboard, RecordsDashboard, RiskDashboard, EquipmentDashboard |

### Patch file
`patch_modal_migration.zip` — 2 files:
- `src/components/QSDashboard.tsx`
- `src/components/QSSubcontractorTab.tsx`

### Commit
```
refactor: migrate inline forms → ModalForm — QSDashboard + QSSubcontractorTab
```
