# GEM PM — CRM Lead Form

## Bước 1: Chạy SQL migration
Vào Supabase Dashboard → SQL Editor → paste nội dung file `crm_leads_migration.sql` → Run

## Bước 2: Deploy form
Chọn 1 trong 2 cách:

### Cách A — Vercel (recommend)
1. Copy file `GEM_PM_CRM_Form.html` vào thư mục `public/` của project
2. git add . → commit → push
3. Truy cập: gemclaudepm.com/GEM_PM_CRM_Form.html

### Cách B — Mở trực tiếp trên máy
Double-click file HTML → mở trong Chrome → dùng được ngay

## Bước 3: Xem data
Supabase Dashboard → Table Editor → crm_leads
Hoặc vào Admin Panel trong app → (sẽ tích hợp thêm sau)

## Anon key đã nhúng sẵn
File HTML dùng anon key — chỉ INSERT được, không READ được data người khác.
Admin đọc data qua authenticated session trong app.
