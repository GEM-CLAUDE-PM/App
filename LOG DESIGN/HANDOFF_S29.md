# HANDOFF — GEM & CLAUDE PM Pro
## Session kết thúc: 20/03/2026 (S29)

---

## 1. TRẠNG THÁI HIỆN TẠI

### Codebase
- **Repo:** github.com/GEM-CLAUDE-PM/App
- **Production:** gemclaudepm.com (Vercel auto-deploy)
- **Branch:** main

### Hoàn thành trong S29
| File | Thay đổi |
|---|---|
| `public/CRM_Form.html` | Form tiếp cận KH standalone (đổi tên từ GEM_PM_CRM_Form.html) |
| `public/CRM_Review.html` | Tool review CRM nội bộ, có password gate |
| `public/sw.js` | Bump cache v1→v2 |
| `supabase/patch_s29_crm_makh.sql` | Fix trigger ma_kh + xóa records NULL |
| `src/components/WorkspaceActionBar.tsx` | Fix dropdown tràn lề trái trên mobile |
| `src/components/AuthProvider.tsx` | Fix .catch() restoreSession + localStorage sync trong useEffect |
| `src/components/supabase.ts` | Thêm tenant_name field + try/catch localStorage |
| `src/components/TrialBanner.tsx` | Hiển thị tên công ty trong banner |
| `src/App.tsx` | Hiển thị tenant name sidebar/mobile + safeLS helper + useEffect splash fallback |
| `src/components/SplashScreen.tsx` | Giảm duration 3500→2000ms, thêm invisible khi exit |
| `vite.config.ts` | Thêm build target es2020/safari14 + manualChunks (KHÔNG dùng plugin-legacy) |

---

## 2. BUG iOS CHƯA FIX ⚠️

### Triệu chứng
- Sau login trên iPhone: có màn trắng/tím che main view
- Scroll xuống thấy main view bên dưới
- Android và Desktop bình thường

### Đã thử (không hiệu quả)
- SW cache bump v1→v2
- localStorage try/catch
- build target es2020/safari14
- @vitejs/plugin-legacy (gây crash thêm → đã xóa)
- renderModernChunks: false
- AuthProvider .catch()
- localStorage sync chuyển vào useEffect

### Nghi ngờ hiện tại
- `AuthProvider` nội bộ có `SplashScreen` tím (from-slate-900 via-violet-950) render khi `loading=true`
- Có thể có race condition sau login khiến `loading` flip lại true momentarily
- Cần xem console Safari thực sự để xác định

### Bước tiếp theo BẮT BUỘC
**Ra tiệm sửa máy có Mac** → cắm iPhone → Safari → Develop → tên iPhone → gemclaudepm.com → chụp ảnh Console errors → gửi cho Claude session tiếp theo

---

## 3. CRM SYSTEM

### URLs
- Form tiếp cận KH: `gemclaudepm.com/CRM_Form.html`
- Tool review nội bộ: `gemclaudepm.com/CRM_Review.html` (password: `gem2026crm` — đổi trước khi share)

### Supabase
- Table `crm_leads` đã có
- Edge Function `crm-submit` đã deploy với `--no-verify-jwt`
- Trigger `ma_kh` đã fix (sequence KH-YYYY-NNNN)
- Chạy `supabase/patch_s29_crm_makh.sql` nếu chưa chạy

### Config CRM_Review.html
Điền vào đầu file trước khi dùng:
```js
const SUPABASE_URL      = 'REPLACE_WITH_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'REPLACE_WITH_SUPABASE_ANON_KEY';
const ACCESS_PASSWORD   = 'gem2026crm'; // đổi mật khẩu thực
```

---

## 4. TENANT NAME

Tên công ty hiện hiển thị ở 4 vị trí:
- Sidebar desktop (box teal dưới slogan)
- Mobile header (dòng nhỏ dưới PM Pro)
- TrialBanner (🏢 TênCôngTy · Còn X ngày)
- UserMenu dropdown

Nguồn: `tenants.name` → `user.tenant_name` khi login → cache `localStorage('gem_company_name')`

---

## 5. QUYẾT ĐỊNH KIẾN TRÚC

| Hạng mục | Quyết định |
|---|---|
| CRM tool | Standalone HTML trong public/ — KHÔNG đưa vào React app |
| vite.config | Không dùng @vitejs/plugin-legacy — iOS 18 không cần |
| Build target | es2020 + safari14 |
| Bundle split | manualChunks: react, supabase, ui, markdown |

---

## 6. BÀI HỌC SESSION HÔM NAY

- Không có Mac = không debug được iOS Safari — phải ra tiệm hoặc mượn Mac
- `localStorage.setItem` trong render body gây re-render loop trên iOS → luôn dùng useEffect
- Plugin legacy inject `import.meta.resolve` check — crash silent trên iOS Safari
- CRM tool phải tách hoàn toàn khỏi React app — tư duy product vs business
- Chỉ xuất file đã thay đổi, không zip toàn bộ src
- 1 file thì xuất trực tiếp, không cần zip

---

## 7. UPLOAD KHI BẮT ĐẦU SESSION MỚI

```
src.zip                 ← toàn bộ src/ hiện tại
GemClaude_Roadmap_V9.docx
HANDOFF_S29.md          ← file này
```

---

*GEM & CLAUDE PM Pro · Nàng GEM Siêu Việt · github.com/GEM-CLAUDE-PM/App*
