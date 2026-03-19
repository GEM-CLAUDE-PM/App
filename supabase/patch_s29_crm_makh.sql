-- ═══════════════════════════════════════════════════════════════════
-- PATCH S29 — CRM ma_kh trigger fix
-- Chạy trong: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- 1. Xóa 2 test records có ma_kh IS NULL
DELETE FROM public.crm_leads WHERE ma_kh IS NULL;

-- 2. Kiểm tra records còn lại
SELECT id, ma_kh, ten_cong_ty, created_at FROM public.crm_leads ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────────
-- 3. Fix trigger generate ma_kh
--    Format: KH-YYYY-NNNN  (ví dụ: KH-2026-0001)
--    Vấn đề cũ: trigger dùng RETURNING nhưng không có sequence riêng
--    Fix: dùng sequence + to_char
-- ─────────────────────────────────────────────────────────────────

-- Tạo sequence nếu chưa có
CREATE SEQUENCE IF NOT EXISTS crm_leads_ma_kh_seq START 1;

-- Drop trigger cũ nếu có
DROP TRIGGER IF EXISTS set_ma_kh_on_insert ON public.crm_leads;
DROP FUNCTION IF EXISTS generate_ma_kh();

-- Tạo function mới
CREATE OR REPLACE FUNCTION generate_ma_kh()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT;
  v_seq  INT;
BEGIN
  -- Chỉ generate khi ma_kh chưa có
  IF NEW.ma_kh IS NULL OR NEW.ma_kh = '' THEN
    v_year := to_char(NOW(), 'YYYY');
    v_seq  := nextval('crm_leads_ma_kh_seq');
    NEW.ma_kh := 'KH-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Gắn trigger BEFORE INSERT
CREATE TRIGGER set_ma_kh_on_insert
  BEFORE INSERT ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION generate_ma_kh();

-- ─────────────────────────────────────────────────────────────────
-- 4. Backfill ma_kh cho records hiện có đang NULL (nếu còn)
-- ─────────────────────────────────────────────────────────────────
UPDATE public.crm_leads
SET ma_kh = 'KH-' || to_char(created_at, 'YYYY') || '-' || LPAD(nextval('crm_leads_ma_kh_seq')::TEXT, 4, '0')
WHERE ma_kh IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- 5. Verify
-- ─────────────────────────────────────────────────────────────────
SELECT id, ma_kh, ten_cong_ty, trang_thai, created_at
FROM public.crm_leads
ORDER BY created_at DESC
LIMIT 20;
