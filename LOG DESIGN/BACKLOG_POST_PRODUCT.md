# GEM & CLAUDE PM Pro — Post-Product Backlog
> Các hạng mục triển khai sau khi hoàn thiện sản phẩm

---

## 1. Mô hình Marketing & Bán hàng SaaS B2B

### Tóm tắt quyết định
- Mô hình giá: **M4 — Hybrid** (theo project + free worker L1-L2)
- Auth: **Phone OTP** lần đầu/đổi thiết bị, session 30 ngày trên thiết bị
- SMS Provider: **ESMS/SpeedSMS VN** (~300đ/SMS, brandname VN)
- Gộp SMS vào COGS — không charge riêng người dùng

### Gói dịch vụ (đã thống nhất)
| Gói | Giá | Dự án | L3+ Seats | Worker |
|---|---|---|---|---|
| Starter | 990,000đ/tháng | 1 DA | 5 seats | Unlimited |
| Pro | 2,490,000đ/tháng | 5 DA | 15 seats | Unlimited |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

### Việc cần làm
- [ ] Xây dựng chiến lược go-to-market: kênh phân phối, ICP, messaging
- [ ] Build landing page gemclaudepm.com (pricing page, features, case study)
- [ ] Onboarding flow: bulk create users bằng SĐT + role (không cần email thật)
- [ ] Phone OTP Auth: Supabase Phone Auth + ESMS proxy Edge Function
- [ ] Referral / affiliate program cho PM xây dựng VN
- [ ] Content marketing: blog kỹ thuật xây dựng, case study dự án thực
- [ ] Tích hợp Zalo OA khi có token (OTP qua Zalo thay SMS — miễn phí)

---

## 2. Pháp lý & Thuế khi vận hành

### Quyết định đã thống nhất
**Giai đoạn đầu: Đăng ký công ty TNHH tại Việt Nam**

Lý do:
- Thị trường mục tiêu là VN → thu tiền VNPay/PayOS trực tiếp, không phí forex
- Phần mềm SaaS: **VAT 0%** (không chịu thuế GTGT)
- Thuế TNDN: **10%** ưu đãi 15 năm (mã ngành 6201/6202)
- **Miễn thuế 4 năm đầu** + giảm 50% 9 năm tiếp (Nghị định 20/2026)
- Compliance đơn giản nhất, không rủi ro cross-border

**Giai đoạn scale (doanh thu > 2-3 tỷ/năm hoặc chuẩn bị gọi vốn):**
Dual structure: Công ty VN (thu tiền nội địa) + Singapore Pte. Ltd. (IP ownership, thu tiền quốc tế, VC access APAC)

### Việc cần làm
- [ ] Đăng ký công ty TNHH — mã ngành 6201 (lập trình) + 6202 (tư vấn CNTT)
- [ ] Xin Giấy chứng nhận sản xuất phần mềm — Sở TT&TT
- [ ] Đăng ký hưởng ưu đãi thuế TNDN 10% ngay từ năm đầu
- [ ] Mở tài khoản ngân hàng doanh nghiệp — tích hợp PayOS/VNPay
- [ ] Tư vấn luật sư về Nghị định 13/2023 (bảo vệ dữ liệu cá nhân)
- [ ] Theo dõi quy định data localization của Bộ TT&TT
- [ ] Khi scale: tư vấn setup entity Singapore (local director ~SGD 2,000/năm)

### Rủi ro cần theo dõi
- Nghị định 72/2013 + 13/2023: nền tảng SaaS xuyên biên giới cung cấp cho user VN có thể phải đăng ký với Bộ TT&TT khi doanh thu/user lớn
- Quy định data localization đang được xem xét — có thể ảnh hưởng Supabase Singapore

---

## Ưu tiên thực hiện
1. Đăng ký công ty VN → ngay khi có doanh thu đầu tiên
2. Phone OTP Auth → Sprint tiếp theo sau M4
3. Landing page + pricing → song song với phone auth
4. Bulk user onboarding → sau phone auth
5. Singapore entity → khi chuẩn bị gọi vốn Series A
