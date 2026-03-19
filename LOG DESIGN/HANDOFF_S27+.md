# HANDOFF — GEM & CLAUDE PM Pro
## Session kết thúc: 19/03/2026

---

## 1. TRẠNG THÁI HIỆN TẠI

### Codebase
- **Repo:** github.com/GEM-CLAUDE-PM/App
- **Production:** gemclaudepm.com (Vercel auto-deploy)
- **Branch:** main
- **File patch cuối:** `patch_s17_s27.zip` — đã apply, đã push

### TypeScript errors
- **0 lỗi** tại thời điểm kết thúc session

### Database (Supabase Singapore)
- SQL migrations đã chạy: `01`, `02`, `03`, `04`
- Seed users: 22 users `@hungphattien.com` / pass `hptSG2026!`
- Tenant: Hưng Phát Tiến SG (trial 30 ngày)
- **Vấn đề còn lại:** Login chưa test được — cần reset pass nếu seed lỗi

---

## 2. FILES ĐÃ OUTPUT TRONG SESSION NÀY

### Code (copy vào src/components/)
| File | Thay đổi |
|---|---|
| `supabase.ts` | Schema fix (plan/is_locked), Phone OTP methods, trial 30 ngày |
| `AuthProvider.tsx` | Phone OTP tab trong LoginScreen |
| `BillingPage.tsx` | M4 pricing, 30 ngày trial |

### Edge Functions (supabase/functions/)
| File | Mục đích |
|---|---|
| `send-otp/index.ts` | Proxy ESMS gửi OTP SMS |
| `stripe-webhook/index.ts` | Xử lý Stripe + PayOS webhook |
| `create-checkout-session/index.ts` | Tạo Stripe Checkout |
| `create-payos-link/index.ts` | Tạo PayOS payment link |

### SQL
| File | Mục đích |
|---|---|
| `01_base_project_data.sql` | ✅ Đã chạy |
| `02_s17_multitenant_storage.sql` | ✅ Đã chạy |
| `03_s18_portal_rls.sql` | ✅ Đã chạy |
| `04_s19_push_subscriptions.sql` | ✅ Đã chạy |
| `fix_trigger_handle_new_user.sql` | ✅ Đã chạy |
| `seed_users_hungphattien.sql` | ✅ Đã chạy |

### Tài liệu
- `BACKLOG_POST_PRODUCT.md` — Marketing B2B + Pháp lý
- `GemClaude_Roadmap_V8_2.docx` — Roadmap cập nhật

---

## 3. VIỆC CẦN LÀM TRƯỚC SESSION TIẾP THEO

### Bắt buộc (blocking)
- [ ] **Test đăng nhập** với `giamdoc@hungphattien.com` / `hptSG2026!`
  - Nếu lỗi → chạy SQL: `update auth.users set encrypted_password = crypt('hptSG2026!', gen_salt('bf')) where email like '%@hungphattien.com';`
- [ ] **Enable Phone Auth** trong Supabase: Authentication → Providers → Phone → Enable
- [ ] **Deploy Edge Function:** `supabase functions deploy send-otp`

### Cần làm để Phone OTP hoạt động
- [ ] Đăng ký tài khoản **esms.vn**
- [ ] Lấy `ApiKey` + `SecretKey` từ menu Quản lý API
- [ ] Đăng ký Brandname "GEM PM" (gọi 0901.888.484, cần GPKD)
- [ ] Set ENV vars trong Supabase Edge Functions:
  ```
  ESMS_API_KEY=...
  ESMS_SECRET_KEY=...
  ESMS_BRAND_NAME=GEM PM
  ESMS_TYPE=2
  ```

### Stripe/PayOS (khi sẵn sàng go-live)
- [ ] Tạo products trong Stripe Dashboard → lấy `price_id` thật → điền vào `BillingPage.tsx` `STRIPE_PRICES`
- [ ] Set ENV: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Deploy: `supabase functions deploy stripe-webhook create-checkout-session create-payos-link`

---

## 4. BACKLOG POST-PRODUCT (đã ghi nhận)

**Marketing B2B SaaS** — sau khi product hoàn thiện:
- Go-to-market strategy, landing page, content marketing
- Referral/affiliate program cho PM xây dựng VN

**Pháp lý & Thuế:**
- Đăng ký công ty TNHH VN (mã ngành 6201/6202)
- Hưởng ưu đãi thuế phần mềm: VAT 0% + TNDN 10% + miễn 4 năm đầu
- Khi scale: dual structure VN + Singapore

---

## 5. QUYẾT ĐỊNH KIẾN TRÚC ĐÃ THỐNG NHẤT

| Hạng mục | Quyết định |
|---|---|
| Pricing model | **M4 Hybrid** — theo project + free worker L1-L2 |
| Trial | 30 ngày (tăng từ 14) |
| Phone Auth | OTP lần đầu/đổi thiết bị, session 30 ngày |
| SMS Provider | ESMS VN (~300đ/SMS, brandname VN) |
| SMS Cost model | Gộp vào COGS, không charge riêng |
| Đăng ký công ty | VN trước, Singapore khi gọi vốn |

---

## 6. UPLOAD KHI BẮT ĐẦU SESSION MỚI

```
src.zip          ← toàn bộ src/ hiện tại
patch_s17_s27.zip (nếu chưa apply)
GemClaude_Roadmap_V8_2.docx
HANDOFF_current.md (file này)
```

---

*GEM & CLAUDE PM Pro · Nàng GEM Siêu Việt · github.com/GEM-CLAUDE-PM/App*
