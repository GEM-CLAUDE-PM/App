# HANDOFF — GEM & CLAUDE PM Pro
## Session kết thúc: 19/03/2026 (S28)

---

## 1. TRẠNG THÁI HIỆN TẠI

### Codebase
- **Repo:** github.com/GEM-CLAUDE-PM/App
- **Production:** gemclaudepm.com (Vercel auto-deploy)
- **Branch:** main

### Login
- ✅ Login hoạt động — đã fix toàn bộ chain auth
- ✅ 22 users Hưng Phát Tiến seed xong, job_role đúng
- ✅ RLS profiles fix (bỏ infinite recursion)
- ✅ Trigger on_auth_user_created tạo lại

### Files đã deploy hôm nay
| File | Thay đổi |
|---|---|
| `src/components/supabase.ts` | Đồng bộ schema thật (plan, is_locked, left join) |
| `src/components/AdminPanel.tsx` | Thêm tab "Import hàng loạt" |
| `src/components/BulkUserUpload.tsx` | Upload Excel tạo users hàng loạt (FILE MỚI) |
| `src/components/BillingPage.tsx` | M4 pricing + 30 ngày trial + toggle fix |
| `public/GEM_PM_CRM_Form.html` | CRM lead form standalone |
| `supabase/functions/crm-submit/index.ts` | Edge Function nhận form data → insert crm_leads |

### Database
- ✅ `crm_leads` table tạo xong
- ✅ Edge Function `crm-submit` deploy với `--no-verify-jwt`
- ⚠️ `ma_kh` trigger đang trả về NULL — cần fix
- 3 records test trong crm_leads (2 NULL cần xóa)

---

## 2. VIỆC CẦN LÀM NGAY ĐẦU SESSION MỚI

### Bắt buộc
- [ ] Xóa 2 test records:
  ```sql
  delete from public.crm_leads where ma_kh is null;
  ```
- [ ] Fix `ma_kh` trigger trả về NULL

### Task chính session tiếp theo
**Build Review + Edit + Export PDF cho CRM Form**

Flow:
```
Submit form → Lưu DB → Màn hình Review
→ Chỉnh sửa thông tin nếu cần
→ Chọn tài liệu (HĐ / Proposal / Phiếu TĐ)
→ Xuất PDF tự động điền data KH
→ Download
```

Yêu cầu kỹ thuật:
- Dùng `jsPDF` (CDN) để generate PDF trên browser
- Không cần server/Edge Function
- 3 template: Hợp đồng SaaS, Proposal Enterprise, Phiếu tiếp cận
- Cho phép edit các field trước khi xuất

---

## 3. TÀI LIỆU KINH DOANH ĐÃ TẠO

Folder `GEM_PM_KinhDoanh/` (không đưa vào git):
```
00_Database/  GEM_PM_Database_KhachHang.xlsx  (41 cột MERGE_*, 3 sheets)
01_HopDong/   HopDong_DichVu_SaaS_GEM_PM.docx
02_BaoGia/    Proposal_Enterprise_GEM_PM.docx
03_Sales/     PhieuTiepCanKhachHang.docx
              SalesScript_PitchOutline.docx
```

---

## 4. QUYẾT ĐỊNH KIẾN TRÚC ĐÃ THỐNG NHẤT

| Hạng mục | Quyết định |
|---|---|
| Pricing M4 | Starter 1DA/5seats, Pro 5DA/15seats, Worker free |
| Trial | 30 ngày |
| CRM Backend | Supabase `crm_leads` table + Edge Function `crm-submit` |
| CRM Form | Standalone HTML tại gemclaudepm.com/GEM_PM_CRM_Form.html |
| PDF Export | jsPDF trên browser (session tiếp theo) |

---

## 5. UPLOAD KHI BẮT ĐẦU SESSION MỚI

```
src.zip                 ← toàn bộ src/ hiện tại
GemClaude_Roadmap_V9.docx
HANDOFF_S28.md          ← file này
```

---

## 6. BÀI HỌC SESSION HÔM NAY

- Seed users phải dùng Admin API, không INSERT thẳng SQL vào auth.users
- Supabase Edge Function require JWT mặc định — phải deploy với `--no-verify-jwt` qua CLI
- Supabase CLI cài qua Scoop trên Windows: `scoop install supabase`

---

*GEM & CLAUDE PM Pro · Nàng GEM Siêu Việt · github.com/GEM-CLAUDE-PM/App*
