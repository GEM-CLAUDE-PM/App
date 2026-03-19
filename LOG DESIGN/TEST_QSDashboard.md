# Kịch bản Test — QSDashboard × ApprovalEngine
**GEM&CLAUDE PM Pro** | Phiên bản: Bước 6 | Ngày: 11/03/2026

> **Chuẩn bị:** Dự án Alpha (`p1`) | Clear localStorage trước mỗi nhóm test độc lập (`gem_approvals_p1`)

---

## BẢNG HẠN MỨC THAM CHIẾU

| Cấp | Role | Hạn mức duyệt |
|---|---|---|
| L1 | Thủ kho | Không duyệt |
| L2 | QS site | Tạo + nộp, không duyệt |
| L3 | CH Phó | ≤ 50 triệu |
| L3 | CH Trưởng | ≤ 50 triệu |
| L4 | PM | ≤ 500 triệu |
| L5 | Giám đốc | Không giới hạn |

---

## NHÓM 1 — VARIATION ORDER (VO)

### TC-VO-01: QS site nộp VO nhỏ → CH Phó duyệt thành công

**Precondition:** Role = `qs_site` (L2)
**Dữ liệu:** VO-004 — "Đẩy nhanh tiến độ tầng hầm B2" | `status: draft` | `value_change: 980,000,000đ` (980 triệu)

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Vào tab **Variation** | Thấy VO-004 badge xanh "Nháp" |
| 2 | Click **"Gửi phê duyệt"** | Badge đổi → "Chờ phê duyệt" |
| 3 | Mở DevTools → `localStorage.getItem('gem_approvals_p1')` | Tìm thấy doc `status: "SUBMITTED"`, `docType: "VARIATION_ORDER"`, `data.qsItemId: "vo4"` |
| 4 | Chuyển role → `chi_huy_pho` (L3) | — |
| 5 | Vào tab **Variation** → xem VO-004 | Nút **"Phê duyệt"** hiển thị |
| 6 | Click **"Phê duyệt"** | PIN modal xuất hiện |
| 7 | Nhập PIN sai 2 lần | Thông báo lỗi "PIN không đúng — còn X lần thử" |
| 8 | Nhập PIN đúng (mặc định: `123456`) → Enter | Badge → "Đã phê duyệt", `date_approved` hiển thị |
| 9 | Kiểm tra localStorage | `status: "APPROVED"` hoặc `"IN_REVIEW"` (nếu 980tr > 50tr → leo thang L4) |

**⚠️ Lưu ý quan trọng:** VO-004 = 980 triệu > hạn mức L3 (50tr) → **mong đợi** badge đỏ "↑ Vượt hạn mức — cần PM/GĐ" thay vì nút Phê duyệt

**Kết quả đúng cho TC-VO-01:**
- CH Phó thấy VO-004 nhưng **không có nút Phê duyệt**
- Hiển thị "↑ Vượt hạn mức — cần PM/GĐ"

---

### TC-VO-02: VO nhỏ ≤ 50tr → CH Phó duyệt được

**Precondition:** Tạo VO mới qua form | Role = `qs_site`

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Click **"Tạo VO mới"** | Form hiển thị |
| 2 | Nhập: Loại = Bổ sung, Giá trị = `30,000,000` (30 triệu), Tiêu đề = "Test VO nhỏ" | — |
| 3 | Lưu VO | VO mới badge "Nháp" |
| 4 | Click **"Gửi phê duyệt"** | Badge → "Chờ phê duyệt" |
| 5 | Chuyển role → `chi_huy_pho` | — |
| 6 | Xem VO mới | Nút **"Phê duyệt"** xanh hiển thị (30tr ≤ 50tr) |
| 7 | Click → PIN → xác nhận | Badge → "Đã phê duyệt" ✅ |

---

### TC-VO-03: VO lớn > 500tr → Chỉ Giám đốc duyệt được

**Dữ liệu:** VO-003 — "Điều chỉnh đơn giá cốt thép" | `value_change: 2,400,000,000đ` (2.4 tỷ) | `status: submitted`

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `chi_huy_pho` → xem VO-003 | Badge đỏ "↑ Vượt hạn mức — cần PM/GĐ" |
| 2 | Role = `pm` → xem VO-003 | Badge đỏ (2.4 tỷ > 500tr — vượt L4) |
| 3 | Role = `giam_doc` → xem VO-003 | Nút **"Phê duyệt"** xanh hiển thị |
| 4 | Nhập PIN → xác nhận | Badge → "Đã phê duyệt" ✅ |

---

### TC-VO-04: Từ chối VO

**Precondition:** VO-004 đang `submitted`

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `pm` → xem VO-004 | Nút "Từ chối" đỏ hiển thị |
| 2 | Click **"Từ chối"** | Badge → "Từ chối" 🔴 |
| 3 | Kiểm tra ApprovalQueue tab | Doc không còn trong "Hàng chờ duyệt" |

---

### TC-VO-05: Seed data khởi tạo đúng

**Precondition:** Clear `gem_approvals_p1` | Mở QSDashboard

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Sau khi QSDashboard load | `gem_approvals_p1` có docs cho: VO-001(COMPLETED), VO-002(COMPLETED), VO-003(SUBMITTED), VO-004(không có — draft), VO-005(COMPLETED — rejected ánh xạ thành approved vì là legacy) |
| 2 | Role = `chi_huy_pho` → tab ApprovalQueue | Thấy VO-003 trong hàng chờ (SUBMITTED, 2.4 tỷ) với badge "↑ Cần cấp cao hơn" |

---

## NHÓM 2 — BIÊN BẢN NGHIỆM THU (BBNT)

### TC-ACC-01: QS nộp BBNT → CH Phó duyệt

**Dữ liệu:** NT-003 — "Nghiệm thu tầng 3-5" | `status: submitted` | `total_value: (tính từ BOQ)`

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `qs_site` → tab **Nghiệm thu** | NT-003 badge "Chờ duyệt" |
| 2 | Kiểm tra `gem_approvals_p1` | Doc type `ACCEPTANCE`, status `SUBMITTED` cho `qsItemId: "a3"` |
| 3 | Role = `chi_huy_pho` | — |
| 4 | Tìm NT-003 | Nút "Phê duyệt" hoặc "↑ Cần cấp cao hơn" tùy `total_value` |
| 5 | Nếu hiện nút → PIN → xác nhận | Status → approved, `approved_by` = role hiện tại |

---

### TC-ACC-02: BBNT draft → QS nộp

**Precondition:** Tạo BBNT mới | Role = `qs_site`

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Click **"Lập đợt nghiệm thu mới"** | Form hiển thị |
| 2 | Chọn các hạng mục BOQ, nhập KL thực tế | — |
| 3 | Lưu | Badge "Nháp", nút "Gửi duyệt" |
| 4 | Click **"Gửi duyệt"** | Badge → "Chờ duyệt", doc SUBMITTED trong engine |
| 5 | Role = `chi_huy_truong` → tìm BBNT mới | Xử lý theo hạn mức |

---

### TC-ACC-03: Xem lịch sử BBNT đã duyệt

**Dữ liệu:** NT-001, NT-002 — `status: approved`

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `pm` → tab Nghiệm thu | NT-001, NT-002 badge xanh "Đã duyệt" |
| 2 | Mở ApprovalQueue → tab "Tất cả" | Thấy docs NT-001, NT-002 status `COMPLETED` |
| 3 | Click vào NT-001 | Audit log hiển thị: CREATE → SUBMIT → APPROVE (2 entries từ seed) |

---

## NHÓM 3 — YÊU CẦU THANH TOÁN

### TC-PAY-01: QS nộp thanh toán → PM duyệt (thường > 50tr)

**Dữ liệu:** TT-003 — "Tháng 03/2026" | `status: draft`

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `qs_site` → tab **Thanh toán** | TT-003 badge "Nháp", nút "Gửi CĐT/TVGS" |
| 2 | Click **"Gửi CĐT/TVGS"** | Badge → "Đã gửi", doc SUBMITTED trong engine |
| 3 | Role = `chi_huy_pho` | — |
| 4 | Tìm TT-003 trong tab Thanh toán | Nếu `net_payable > 50tr` → badge "↑ Cần PM/GĐ" |
| 5 | Role = `pm` → tìm TT-003 | Nút "Phê duyệt" (nếu ≤ 500tr) |
| 6 | PIN → xác nhận | Status → approved |
| 7 | Kiểm tra AccountingDashboard (role KT) | TT-003 xuất hiện trong danh sách công nợ |

---

### TC-PAY-02: Thanh toán đã được duyệt → KT xác nhận đã TT

**Dữ liệu:** TT-002 — `status: approved`

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `ke_toan` → tab Thanh toán | TT-002 nút "Xác nhận đã TT" |
| 2 | Click **"Xác nhận đã TT"** | Status → "paid", màu teal |
| 3 | Kiểm tra AccountingDashboard | TT-002 cập nhật trạng thái trong sổ công nợ |

---

## NHÓM 4 — APPROVAL QUEUE INTEGRATION

### TC-AQ-01: ApprovalQueue hiển thị đúng theo role

| Role | Tab "Hàng chờ duyệt" mong đợi |
|---|---|
| `qs_site` (L2) | Rỗng (L2 không duyệt) hoặc thấy doc mình tạo |
| `chi_huy_pho` (L3) | VO-003 với "↑ Cần cấp cao hơn" (2.4 tỷ), NT-003, TT-003 (nếu ≤ 50tr) |
| `pm` (L4) | VO-003, VO-004, TT-003 (tất cả > 50tr) |
| `giam_doc` (L5) | Tất cả docs SUBMITTED/IN_REVIEW |

**Cách test:**
1. Chuyển từng role → mở tab Phê duyệt
2. Đếm badge số đỏ góc tab = số docs có thể duyệt (không phải chỉ thấy)
3. So sánh với bảng trên

---

### TC-AQ-02: Badge count chính xác

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `pm` → xem badge tab "Phê duyệt" | Badge = số VO+BBNT+TT đang SUBMITTED mà PM duyệt được |
| 2 | PM duyệt 1 doc | Badge giảm đi 1 |
| 3 | QS nộp thêm 1 doc mới | Badge PM tăng lên 1 (nếu trong domain PM) |

---

### TC-AQ-03: Filter "Do tôi tạo"

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `qs_site` → ApprovalQueue → tab "Do tôi tạo" | Thấy tất cả docs `createdBy: "user_qs_site"` |
| 2 | Chuyển role = `chi_huy_pho` → tab "Do tôi tạo" | Thấy docs `createdBy: "user_chi_huy_pho"` (khác với qs_site) |
| 3 | Không thấy docs của nhau | ✅ Phân tách đúng |

---

## NHÓM 5 — EDGE CASES & LỖI

### TC-EDGE-01: PIN sai 3 lần → khóa tài khoản

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `chi_huy_pho`, mở PIN modal | — |
| 2 | Nhập PIN sai 3 lần liên tiếp | Thông báo "Tài khoản bị khóa 15 phút" |
| 3 | Thử nhập lại ngay | Vẫn bị khóa |
| 4 | Kiểm tra `gem_user_pins` | `lockedUntil` timestamp tương lai |

---

### TC-EDGE-02: QS nộp trùng (idempotent)

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | QS nộp VO-004 lần 1 | Doc SUBMITTED trong engine |
| 2 | Refresh trang → QS nộp VO-004 lần 2 | Thông báo "Phiếu đã được nộp duyệt (SUBMITTED)" |
| 3 | Kiểm tra engine | Chỉ có **1 doc** cho VO-004 (không bị trùng) |

---

### TC-EDGE-03: Seed chạy nhiều lần (idempotent)

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở QSDashboard lần 1 | Seed 4 docs (VO1, VO2, VO3, VO5 → không có VO4 vì draft) |
| 2 | Đóng và mở lại QSDashboard | Seed chạy lại |
| 3 | Kiểm tra `gem_approvals_p1` | Vẫn chỉ 4 docs, không bị nhân đôi |

---

### TC-EDGE-04: Xuyên module — QS duyệt → AccountingDashboard cập nhật

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | PM duyệt TT-003 (Thanh toán tháng 3) | Status COMPLETED trong engine |
| 2 | Chuyển role = `ke_toan` → AccountingDashboard | TT-003 xuất hiện trong tab Công nợ với `id: "eng-..."` |
| 3 | Giá trị công nợ = `net_payable` của TT-003 | ✅ Số khớp |

---

### TC-EDGE-05: VO bị từ chối → không xuất hiện trong queue

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | PM từ chối VO-003 | Status → REJECTED |
| 2 | Kiểm tra ApprovalQueue tất cả roles | VO-003 không còn trong "Hàng chờ duyệt" |
| 3 | Kiểm tra tab "Tất cả" | VO-003 vẫn hiển thị với badge đỏ "Từ chối" |

---

## NHÓM 6 — KIỂM TRA UI/UX

### TC-UI-01: PIN modal z-index

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở detail panel một VO | Detail panel hiển thị phía trên |
| 2 | Click **"Phê duyệt"** từ detail panel | PIN modal hiển thị **phía trên** detail panel (z-[200]) |
| 3 | Thao tác trong PIN modal không bị che | ✅ |

---

### TC-UI-02: Approval message toast

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Duyệt thành công | Toast xanh "✅ Đã phê duyệt thành công" xuất hiện |
| 2 | Chờ 3 giây | Toast tự tắt |
| 3 | Modal đóng sau 1.2 giây | ✅ |

---

### TC-UI-03: Badge role-aware trong sidebar

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Role = `qs_site` | Badge tab "Phê duyệt" = 0 (QS không duyệt) |
| 2 | Role = `pm` | Badge = số docs PM duyệt được |
| 3 | QS nộp 1 VO mới | Badge PM tăng 1 |

---

## CHECKLIST TỔNG HỢP

```
Variation Order:
  [ ] TC-VO-01: QS nộp VO-004 → CH Phó thấy "↑ Vượt hạn mức"
  [ ] TC-VO-02: VO 30tr → CH Phó duyệt được + PIN
  [ ] TC-VO-03: VO 2.4 tỷ → chỉ GĐ duyệt
  [ ] TC-VO-04: Từ chối VO hoạt động
  [ ] TC-VO-05: Seed 5 VOs đúng trạng thái

Biên bản Nghiệm thu:
  [ ] TC-ACC-01: NT-003 submitted → CH Phó xử lý
  [ ] TC-ACC-02: Tạo BBNT mới → nộp → queue
  [ ] TC-ACC-03: NT-001/002 lịch sử audit log đúng

Thanh toán:
  [ ] TC-PAY-01: TT-003 → PM duyệt → KT thấy
  [ ] TC-PAY-02: TT-002 → KT xác nhận đã TT

Approval Queue:
  [ ] TC-AQ-01: Queue đúng theo từng role
  [ ] TC-AQ-02: Badge count chính xác
  [ ] TC-AQ-03: Filter "Do tôi tạo" phân tách đúng

Edge Cases:
  [ ] TC-EDGE-01: Khóa PIN sau 3 lần sai
  [ ] TC-EDGE-02: Nộp trùng idempotent
  [ ] TC-EDGE-03: Seed nhiều lần không bị nhân đôi
  [ ] TC-EDGE-04: Xuyên module QS → Kế toán
  [ ] TC-EDGE-05: VO bị từ chối không xuất hiện queue

UI/UX:
  [ ] TC-UI-01: PIN modal không bị che
  [ ] TC-UI-02: Toast tự tắt
  [ ] TC-UI-03: Badge sidebar theo role
```

---

## LỖI ĐÃ BIẾT CẦN THEO DÕI

| # | Mô tả | Nơi có thể xảy ra | Severity |
|---|---|---|---|
| 1 | `total_value` của BBNT = 0 trong seed (chưa tính từ BOQ) | TC-ACC-01 | Medium |
| 2 | `net_payable` = 0 trong INIT_PAYMENTS (chưa tính) | TC-PAY-01 | Medium |
| 3 | VO-005 (`rejected`) bị seed thành `COMPLETED` thay vì `REJECTED` | TC-VO-05 | Low |
| 4 | PIN mặc định chưa được set → mọi PIN đều pass (cần kiểm tra `verifyPin` logic) | Tất cả PIN test | High |

---

*Generated: 11/03/2026 — GEM&CLAUDE PM Pro Test Suite v1.0*
