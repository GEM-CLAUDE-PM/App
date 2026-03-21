# GEM & CLAUDE PM Pro — ROADMAP V11
**Nàng GEM Siêu Việt · Post S31 · Core Value Completion Phase**
Cập nhật: 21/03/2026

---

## TRẠNG THÁI HIỆN TẠI

| Hạng mục | Status |
|---|---|
| S11–S29 Product Complete | ✅ DONE |
| S30 Mock removal + Live data + CRM Pipeline + PayOS | ✅ DONE |
| S31 Email automation + Landing page | ✅ DONE |
| iOS Safari bug | ⚠️ Pending — cần Mac |
| Zalo OA live | ⚠️ Pending — cần đăng ký doanh nghiệp |
| PayOS live credentials | ⚠️ Pending — cần production key |

---

## S32 — GANTT HOÀN THIỆN (Phase 1)
**Mục tiêu:** Gantt chart production-ready — PM dùng được thực tế

### S32.1 — Nền tảng dữ liệu (P0 — làm trước)
- [ ] Xóa toàn bộ hardcode: `totalDays=95`, `today=58`, `starts[]`, `durs[]`, `EVM_DATA`, `BAC`, `SPI`, `CPI`
- [ ] WBS schema mở rộng: thêm `gantt_start_date`, `gantt_end_date`, `gantt_baseline_start`, `gantt_baseline_end`, `depends_on[]`, `responsible_id`, `resource_ids[]`
- [ ] `totalDays` tính từ `project.start_date → project.end_date`
- [ ] `today` tính từ `new Date()` so với `project.start_date`
- [ ] Drag bar/resize → cập nhật `gantt_start_date`/`gantt_end_date` → `db.set('progress_wbs')` ngay lập tức
- [ ] Header hiện tuần thật: "03/3 · 10/3 · 17/3 · 24/3..."

### S32.2 — EVM + S-Curve từ data thật (P0)
- [ ] Xóa hardcode `EVM_DATA`, `BAC`, `SPI`, `CPI`, `EV_NOW`, `PV_NOW`, `AC_NOW`
- [ ] `BAC` = tổng `budget` từ WBS thật
- [ ] `EV` = tổng `budget × ev_pct` từ WBS thật
- [ ] `PV` = tổng `budget × pv_pct` từ WBS thật
- [ ] `AC` = tổng `ac` từ WBS thật hoặc từ `mat_vouchers + qs_payments`
- [ ] S-Curve tính từ snapshot weekly (lưu vào `progress_snapshots` table)
- [ ] 3 phương pháp EAC: `BAC/CPI`, `AC+(BAC-EV)`, `AC+(BAC-EV)/SPI`
- [ ] % complete từ QS thật: map `qs_acceptance.items` → WBS chapter → tự tính `ev_pct`

### S32.3 — Zoom 3 cấp (P1)
- [ ] **Week** (default): 1 ô = 1 ngày, hiện tên ngày
- [ ] **Month**: 1 ô = 1 tuần, hiện "T1/3, T2/3..."
- [ ] **Quarter**: 1 ô = 1 tháng, hiện "T3/2026, T4/2026..."
- [ ] Toggle button trong Gantt header

### S32.4 — Baseline freeze (P1)
- [ ] Nút "Chụp baseline" → lưu snapshot `gantt_start_date`/`gantt_end_date` hiện tại vào `gantt_baseline_start`/`gantt_baseline_end`
- [ ] Hiện đường baseline màu xám mờ bên dưới bar thật
- [ ] Hiển thị delta (chậm/sớm bao nhiêu ngày so với baseline)
- [ ] Chỉ được freeze 1 lần — có confirm dialog

### S32.5 — Dependency arrows (P2)
- [ ] Mỗi WBS item có `depends_on: string[]` (list wbsId — Finish-to-Start)
- [ ] SVG overlay vẽ mũi tên từ end của predecessor → start của successor
- [ ] UI: click phải vào task → "Thêm liên kết" → chọn task phụ thuộc
- [ ] Validation: không cho tạo circular dependency

### S32.6 — Critical Path (P2)
- [ ] Tính critical path từ dependency graph (longest path algorithm)
- [ ] Task trên critical path: bar màu đỏ, tên bold, icon ⚠️
- [ ] Toggle "Hiện đường găng" trong header
- [ ] Float/slack hiển thị khi hover: "Free float: 3 ngày"

### S32.7 — Look-ahead 2-3 tuần (P2)
- [ ] Tab "Look-ahead" trong Gantt: chỉ hiện task bắt đầu trong 21 ngày tới
- [ ] Nhóm theo tuần: "Tuần này", "Tuần tới", "Tuần sau nữa"
- [ ] In được ra 1 trang A4 — dùng cho họp giao ban

### S32.8 — Export (P2)
- [ ] Print CSS @media print: Gantt in được ra A3 landscape
- [ ] Export PDF via html2canvas + jsPDF
- [ ] Export Excel: bảng WBS + start date + end date + %done

### S32.9 — Resource loading (P3)
- [ ] Mỗi WBS task link với `mp_people` (responsible_id) và `eq_maintenance` (resource_ids)
- [ ] Resource histogram: cột chart bên dưới Gantt hiện số người/ngày
- [ ] Cảnh báo overload: tuần nào tổng > capacity thì highlight đỏ

### S32.10 — Weather & delay log (P3)
- [ ] Nút "Ghi ngày dừng": chọn ngày, lý do (mưa/nghỉ lễ/sự cố) → tự cộng vào duration
- [ ] Badge "X ngày dừng" trên mỗi task
- [ ] Tự tính ngày hoàn thành mới sau khi có delay

---

## S33 — GEM AI HOÀN THIỆN
**Mục tiêu:** AI từ chatbot → thực sự là assistant hành động được

### S33.1 — Streaming (P0 — ưu tiên số 1)
- [ ] Thay `sendMessage` → `sendMessageStream`
- [ ] Chữ xuất hiện từng token realtime như ChatGPT
- [ ] Typing indicator ẩn ngay khi stream bắt đầu

### S33.2 — Live context injection (P0)
- [ ] Trước mỗi message, load data thật từ Supabase:
  - WBS: SPI, CPI, EAC, tasks chậm
  - NCR đang mở (số lượng + nghiêm trọng nhất)
  - HSE vi phạm chưa đóng
  - Vật tư dưới threshold
  - Payments pending
  - Risks đang mở
  - Milestone sắp đến / đã trễ
- [ ] Inject vào system prompt dưới dạng structured block
- [ ] AI trả lời dựa trên số liệu THẬT, không bịa

### S33.3 — Gemini Function Calling (P0 — kiến trúc đúng nhất)
- [ ] Định nghĩa tools cho AI:
  - `get_project_data(collection, projectId)` → AI tự gọi khi cần
  - `create_calendar_event(title, date, time)` → tạo event thật
  - `create_task(title, assignee, deadline)` → thêm vào task list
  - `send_notification(message, recipients)` → trigger NotificationEngine
  - `get_weather_forecast(location)` → gọi weather API
- [ ] AI tự quyết định khi nào cần gọi tool
- [ ] Không cần inject thủ công — AI biết cần data gì tự fetch

### S33.4 — Persistent memory per project (P1)
- [ ] Lưu conversation summary vào `ai_memory` table (project_id, summary, updated_at)
- [ ] Mỗi project có memory riêng
- [ ] AI nhớ: quyết định quan trọng, vấn đề đang theo dõi, preferences của PM
- [ ] Inject memory vào đầu mỗi session: "Tuần trước anh quyết định tăng ca tổ sắt..."
- [ ] UI: xem và xóa memory per project

### S33.5 — Proactive alerts (P1)
- [ ] useEffect chạy khi app load: scan toàn bộ data
- [ ] Trigger cảnh báo khi:
  - SPI < 0.85 lần đầu → "⚠️ Dự án X vừa vào vùng nguy hiểm"
  - NCR > 7 ngày chưa đóng → nhắc PM
  - Chứng chỉ ATLĐ hết hạn trong 7 ngày → nhắc tên người
  - Milestone trễ → cảnh báo ngay khi qua ngày
  - Vật tư < threshold → "Thép CB300 chỉ còn 3 ngày"
- [ ] Hiện trong GEM bubble + in-app notification
- [ ] Không alert lặp lại nếu đã alert trong 24h (dùng localStorage timestamp)

### S33.6 — Action execution (P1)
- [ ] AI nhận dạng intent từ response của function calling
- [ ] Thực thi được:
  - Tạo event lịch: "Đặt họp kỹ thuật thứ 6 này 9h" → insert `calendar_events`
  - Tạo NCR: "Ghi lỗi cột C1 tầng 3 bị rỗ" → insert `qa_defects`
  - Ghi vi phạm HSE → insert `hse_violations`
  - Gửi thông báo → trigger NotificationEngine
- [ ] Confirm dialog trước khi execute: "GEM sẽ tạo event họp 27/03 lúc 9:00. Xác nhận?"
- [ ] Undo được trong 30 giây sau khi thực thi

### S33.7 — Document generation thật (P1)
- [ ] Soạn văn bản trong chat → nút "Tải về .docx"
- [ ] Dùng skill docx để tạo file Word đúng mẫu Nhà nước
- [ ] Templates hỗ trợ:
  - Biên bản nghiệm thu (đúng mẫu TCVN)
  - Báo cáo tiến độ tuần
  - Nhật ký công trình
  - Biên bản vi phạm ATLĐ
  - Phiếu RFI
  - Biên bản họp
- [ ] Logo + tiêu đề công ty từ `project_config`

### S33.8 — Multi-turn phân tích (P2)
- [ ] Quick chips dynamic: thay đổi theo context hiện tại
  - Nếu SPI < 0.85 → hiện "Phân tích nguyên nhân chậm"
  - Nếu có NCR → hiện "Xem lỗi chưa xử lý"
  - Nếu milestone sắp đến → hiện "Kế hoạch tuần tới"
- [ ] Flow phân tích EVM: AI hỏi "Anh muốn phân tích theo scenario nào?" → PM chọn → AI đào sâu
- [ ] Comparison mode: "So sánh dự án A và B" → inject context 2 projects

### S33.9 — Anomaly detection (P2)
- [ ] Background scan (mỗi lần app focus):
  - Vật tư xuất nhiều đột biến (>150% trung bình tuần trước)
  - Nhân công giảm >30% so với tuần trước
  - Chi phí thực tế vượt kế hoạch >10% đột ngột
- [ ] GEM proactively báo: "Em phát hiện tuần này xuất thép nhiều gấp đôi — có phải đẩy tiến độ tầng 5 không?"

### S33.10 — Lesson learned (P3)
- [ ] Khi project status → completed: AI tự tổng hợp
  - Timeline: chậm nhất ở giai đoạn nào, bao nhiêu ngày
  - Chi phí: hạng mục nào vượt ngân sách, bao nhiêu %
  - HSE: tổng sự cố, vi phạm, tỷ lệ/1000 công
  - QA: tổng NCR, tỷ lệ lỗi theo hạng mục
- [ ] Lưu vào `lesson_learned` table
- [ ] Inject vào context dự án mới cùng loại: "Dự án nhà phố trước của anh bị chậm ở tầng hầm — cần lưu ý"

---

## S34 — SEO + Demo + CRM Analytics
**Mục tiêu:** Go-to-Market hoàn chỉnh

- [ ] SEO: meta tags đầy đủ, sitemap.xml, robots.txt, Open Graph
- [ ] Google Analytics GA4 + Search Console cho landing page
- [ ] Demo account tự reset mỗi 24h
- [ ] CRM Dashboard: conversion rate, source ROI, funnel visualization
- [ ] Content marketing: 3 blog posts đầu tiên

---

## S35 — Zalo OA + iOS + PayOS live
**Mục tiêu:** Unblock các dependencies bên ngoài

- [ ] Zalo OA live — khi có CCCD xác thực + doanh nghiệp
- [ ] iOS Safari fix — khi có Mac + Safari DevTools
- [ ] PayOS live — khi có production credentials
- [ ] VAPID keys cho push notification đúng chuẩn

---

## S36 — Gantt Hoàn thiện Phase 2 + 4D BIM
**Mục tiêu:** Enterprise-grade features

- [ ] Resource loading histogram
- [ ] Weather & delay log
- [ ] 4D BIM link: Gantt task → BIM object
- [ ] Multi-project portfolio Gantt
- [ ] Affiliate/referral program

---

## S37+ — Scale
- [ ] Multi-language (EN)
- [ ] SSO / LDAP cho Enterprise
- [ ] API public cho tích hợp bên thứ 3
- [ ] White-label cho các tổng thầu lớn

---

## MILESTONE TỔNG QUAN

| Milestone | Sprint | Ý nghĩa |
|---|---|---|
| 🏆 Product Complete | S21–S27 | Đã đạt |
| 🏆 Go-to-Market Ready | S31 | Đã đạt |
| 🎯 **Core Value Complete** | **S32–S33** | Gantt + AI thật sự hoàn thiện |
| 🎯 GTM Optimized | S34 | SEO + Demo → tự kiếm khách |
| 🎯 Full Channels | S35 | Zalo + iOS + PayOS |
| 🎯 Enterprise Ready | S36+ | BIM 4D + Resource + Scale |

