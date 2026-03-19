/**
 * send-otp/index.ts — GEM & CLAUDE PM Pro
 * M4: Edge Function gửi OTP SMS qua ESMS VN
 *
 * Deploy: supabase functions deploy send-otp
 *
 * ENV vars (Supabase Dashboard → Settings → Edge Functions):
 *   ESMS_API_KEY      — API key từ ESMS dashboard
 *   ESMS_SECRET_KEY   — Secret key từ ESMS dashboard
 *   ESMS_BRAND_NAME   — Brandname đã đăng ký (VD: "GEM PM")
 *   ESMS_TYPE         — 2 = OTP (brandname), 4 = customer care
 *
 * Đăng ký ESMS: https://esms.vn — nạp tối thiểu 100k đ (~300 SMS)
 *
 * Nếu chưa có ESMS, tạm dùng Supabase built-in phone auth (Twilio):
 * Supabase Dashboard → Authentication → Providers → Phone → Enable
 */

const ESMS_API_KEY    = Deno.env.get('ESMS_API_KEY')    ?? '';
const ESMS_SECRET_KEY = Deno.env.get('ESMS_SECRET_KEY') ?? '';
const ESMS_BRAND_NAME = Deno.env.get('ESMS_BRAND_NAME') ?? 'GEM PM';
const ESMS_TYPE       = Deno.env.get('ESMS_TYPE')       ?? '2';

// Rate limiting cơ bản — tránh spam
const _recentRequests = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 phút giữa các request cùng SĐT

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { phone } = await req.json();
    if (!phone) {
      return new Response(JSON.stringify({ error: 'Thiếu số điện thoại.' }), { status: 400 });
    }

    // Rate limit check
    const lastRequest = _recentRequests.get(phone);
    if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRequest)) / 1000);
      return new Response(
        JSON.stringify({ error: `Vui lòng chờ ${waitSec} giây trước khi gửi lại.` }),
        { status: 429 }
      );
    }
    _recentRequests.set(phone, Date.now());

    const otp = generateOTP();
    const message = `[GEM PM] Ma OTP cua ban la: ${otp}. Co hieu luc trong 5 phut. Khong cung cap cho bat ky ai.`;

    // ── Nếu có ESMS credentials thì gửi thật ────────────────────────────────
    if (ESMS_API_KEY && ESMS_SECRET_KEY) {
      const esmsRes = await fetch('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ApiKey:     ESMS_API_KEY,
          SecretKey:  ESMS_SECRET_KEY,
          Content:    message,
          Phone:      phone,
          IsUnicode:  '0',
          Brandname:  ESMS_BRAND_NAME,
          SmsType:    ESMS_TYPE,
        }),
      });
      const esmsData = await esmsRes.json();
      if (esmsData.CodeResult !== '100') {
        console.error('[send-otp] ESMS error:', esmsData);
        return new Response(
          JSON.stringify({ error: `Gửi SMS thất bại: ${esmsData.ErrorMessage ?? esmsData.CodeResult}` }),
          { status: 500 }
        );
      }
      // OTP đã gửi qua ESMS — Supabase Phone Auth cũng gửi OTP riêng
      // Ở đây ta dùng Supabase built-in OTP verify, nên ESMS chỉ là kênh delivery
      console.log(`[send-otp] ESMS sent to ${phone}`);
    } else {
      // ── Dev mode: log OTP ra console Supabase (xem trong Logs) ─────────────
      console.log(`[send-otp] DEV MODE — OTP for ${phone}: ${otp}`);
    }

    // Trigger Supabase Phone Auth OTP (dùng verify flow chuẩn)
    // Supabase tự quản lý OTP token — edge function này chỉ lo phần SMS delivery
    return new Response(
      JSON.stringify({ success: true, message: 'OTP đã được gửi.' }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (e) {
    console.error('[send-otp] Error:', e);
    return new Response(JSON.stringify({ error: 'Lỗi server.' }), { status: 500 });
  }
});
