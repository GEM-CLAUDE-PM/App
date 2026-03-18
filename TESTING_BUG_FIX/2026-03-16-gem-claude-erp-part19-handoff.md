# GEM & CLAUDE PM Pro — Handoff Part 19
**Ngày:** 2026-03-16 | **Repo:** github.com/GEM-CLAUDE-PM/App.git

---

## ✅ S16 — MILESTONE 2 HOÀN THÀNH

### 3 loại user login độc lập ✅

| User type | Role | Portal | Tính năng |
|-----------|------|--------|-----------|
| Ban QLDA (PM, GĐ...) | giam_doc, pm, cht... | App đầy đủ | Toàn bộ tính năng |
| Nhà thầu phụ | `ntp` | **SubconPortal** | Xem phạm vi, nộp hồ sơ, nhận PO, xác nhận |
| Chủ đầu tư | `chu_dau_tu` | **ClientPortal** | Dashboard read-only, S-Curve, tài chính, GEM report |

### SubconPortal (437 lines) — `ntp@phucthanh.vn`
- 5 tabs: Tổng quan, Phạm vi công việc, Hồ sơ, Thanh toán, Lệnh mua PO
- Nộp hồ sơ mới → ModalForm chuẩn DS → `db.set(collKey, projectId, next)`
- Xác nhận PO → ModalForm → status `sent` → `acknowledged`
- GEM phân tích tình trạng hợp đồng
- Read/write chỉ collection `subcon_docs_{userId}` + `subcon_pos_{userId}` — RLS-ready

### ClientPortal (347 lines) — `cdt@villaphat.vn`
- 4 tabs: Dashboard KPI, Tiến độ EVM, Tài chính/giải ngân, Báo cáo
- **Read-only hoàn toàn** — không có write action nào
- S-Curve AreaChart (recharts), Bar chart giải ngân
- GEM tự động tạo báo cáo tuần cho CĐT (narrative, không phải tech)
- Lịch sử báo cáo tuần với SPI/CPI badges

### App.tsx routing
```tsx
if (user?.job_role === 'ntp') return <SubconPortal />;
if (user?.job_role === 'chu_dau_tu') return <ClientPortal />;
// else: full app for PM/GĐ/CHT...
```

### supabase.ts
- Thêm `chu_dau_tu` vào `JobRole` type
- Thêm vào `JOB_TO_TIER` (worker) + `JOB_LABELS`
- MOCK_USERS: `ntp@phucthanh.vn` + `cdt@villaphat.vn` cho dev testing

---

## 🚀 S17 — SCOPE TIẾP THEO

| Hạng mục | Mô tả |
|----------|-------|
| Billing — 3 gói | Starter / Pro / Enterprise · VNPay · trial 14 ngày |
| Onboarding | Setup <10 phút: tạo công ty → dự án → mời team |
| GemAI RAG | Upload tài liệu → AI trả lời specs/contract/drawing |
| Domain gemclaudepm.vn | Đăng ký + DNS khi chuẩn bị launch |

**S15 còn defer:**
- Multi-tenant RLS (company_id) — cần Supabase SQL Editor
- Optimistic locking (SELECT FOR UPDATE) — cần Supabase
- Audit Log

---

## 🔑 Dev test accounts (VITE_USE_SUPABASE=false)

| Email | Password | Portal |
|-------|----------|--------|
| `gdda@villaphat.vn` | bất kỳ | App đầy đủ (GĐ) |
| `cht@villaphat.vn` | bất kỳ | App đầy đủ (CHT) |
| `ntp@phucthanh.vn` | bất kỳ | SubconPortal |
| `cdt@villaphat.vn` | bất kỳ | ClientPortal |

---

## 📁 Files thay đổi

```
src/
├── App.tsx                    ← import + routing ntp/chu_dau_tu
├── components/
│   ├── SubconPortal.tsx       ← NEW (437 lines)
│   ├── ClientPortal.tsx       ← NEW (347 lines)
│   ├── supabase.ts            ← chu_dau_tu role + 2 MOCK_USERS
│   └── OfficeDashboard.tsx    ← db.ts + useRealtimeSync + lifted state
```

*Handoff: 2026-03-16 | Next: S17 Billing + Onboarding*
