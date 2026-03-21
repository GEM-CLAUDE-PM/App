-- ═══════════════════════════════════════════════════════════════════════════
-- GEM & CLAUDE PM Pro — Seed Data S30
-- Chạy trong: Supabase Dashboard → SQL Editor → New Query
--
-- ⚠️  Cách dùng:
--   1. Chạy câu SELECT bên dưới để xem danh sách project IDs thật:
--      SELECT id, name FROM public.projects ORDER BY created_at;
--   2. Script tự lookup project_id theo thứ tự (project đầu tiên, thứ 2, thứ 3...)
--   Seed cho: p1=Sunrise Tower, p2=KĐT Gamma, p3=Delta Office
--   Thay 'p1'/'p2'/'p3' nếu muốn seed project khác.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Xóa seed cũ nếu có (idempotent) ──────────────────────────────────────────
DELETE FROM public.project_data
WHERE collection IN (
  'mp_people','mat_items','mat_vouchers','mat_kiemke',
  'hse_incidents','hse_trainings','hse_violations','hse_inspections',
  'office_congvan','office_meetings','office_minutes',
  'calendar_events','contacts',
  'rd_drawings','rd_rfis'
)
AND project_id IN ('p1', 'p2', 'p3');

-- Xóa contracts (lưu theo project_id riêng trong ContractDashboard)
DELETE FROM public.project_data
WHERE collection = 'contracts'
AND project_id = 'p1';

-- ════════════════════════════════════════════════════════════════════════════
-- 1. MANPOWER — Nhân sự mẫu (project đầu tiên)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1',
  'mp_people',
  '[
    {"id":"p1","type":"staff","name":"Trần Văn Bình","jobTitle":"Chỉ huy trưởng","team":"Ban Chỉ huy","contractor":"Nội bộ","phone":"0901234567","cccd":"079012345678","dob":"20/08/1980","address":"12 Lê Lợi, Q1, TP.HCM","joinDate":"01/01/2024","contractType":"khong_xac_dinh","contractNo":"HĐLĐ-2024-001","contractExpiry":"","bhxh":"BH-001-2024","bhyt":"YT-001-2024","salaryBase":35000,"allowance":3000,"status":"active","isKeyPersonnel":true,"bidCommitment":"CHT full-time 100%","atlCert":"","atlExpiry":"","reportsTo":""},
    {"id":"p2","type":"staff","name":"Lê Thị Thu","jobTitle":"Kỹ sư QA/QC","team":"Ban Chỉ huy","contractor":"Nội bộ","phone":"0912345678","cccd":"079023456789","dob":"10/12/1990","address":"45 Nguyễn Huệ, Q1, TP.HCM","joinDate":"01/01/2024","contractType":"xac_dinh","contractNo":"HĐLĐ-2024-002","contractExpiry":"31/12/2026","bhxh":"BH-002-2024","bhyt":"YT-002-2024","salaryBase":25000,"allowance":2000,"status":"active","isKeyPersonnel":true,"bidCommitment":"KS QA/QC cấp 1","atlCert":"","atlExpiry":"","reportsTo":"p1"},
    {"id":"p3","type":"staff","name":"Phạm Minh Quân","jobTitle":"Kỹ sư Giám sát","team":"Ban Chỉ huy","contractor":"Nội bộ","phone":"0923456789","cccd":"079034567890","dob":"05/04/1992","address":"78 Trần Hưng Đạo, Q5, TP.HCM","joinDate":"15/01/2024","contractType":"xac_dinh","contractNo":"HĐLĐ-2024-003","contractExpiry":"14/01/2026","bhxh":"BH-003-2024","bhyt":"YT-003-2024","salaryBase":22000,"allowance":2000,"status":"active","isKeyPersonnel":false,"bidCommitment":"","atlCert":"","atlExpiry":"","reportsTo":"p1"},
    {"id":"p4","type":"staff","name":"Hoàng Thị Mai","jobTitle":"Kế toán dự án","team":"Ban Chỉ huy","contractor":"Nội bộ","phone":"0934567890","cccd":"079045678901","dob":"22/11/1988","address":"99 Nguyễn Trãi, Q5, TP.HCM","joinDate":"01/01/2024","contractType":"khong_xac_dinh","contractNo":"HĐLĐ-2024-004","contractExpiry":"","bhxh":"BH-004-2024","bhyt":"YT-004-2024","salaryBase":20000,"allowance":1500,"status":"active","isKeyPersonnel":false,"bidCommitment":"","atlCert":"","atlExpiry":"","reportsTo":"p1"},
    {"id":"w1","type":"worker","name":"Nguyễn Văn Công","jobTitle":"Tổ trưởng Cốp pha","team":"Đội Cốp pha","contractor":"Phúc Thành","phone":"0945678901","cccd":"079056789012","dob":"15/03/1985","address":"Bình Dương","joinDate":"05/01/2024","contractType":"nhan_cong","contractNo":"HĐNC-2024-PT-001","contractExpiry":"31/12/2026","bhxh":"","bhyt":"","salaryBase":480,"allowance":50,"status":"active","isKeyPersonnel":false,"bidCommitment":"","atlCert":"An toàn lao động Nhóm 3","atlExpiry":"15/01/2026","reportsTo":"p1"},
    {"id":"w2","type":"worker","name":"Lê Minh Dũng","jobTitle":"Thợ cốp pha","team":"Đội Cốp pha","contractor":"Phúc Thành","phone":"0956789012","cccd":"079067890123","dob":"20/07/1990","address":"Đồng Nai","joinDate":"05/01/2024","contractType":"nhan_cong","contractNo":"HĐNC-2024-PT-002","contractExpiry":"31/12/2026","bhxh":"","bhyt":"","salaryBase":380,"allowance":30,"status":"active","isKeyPersonnel":false,"bidCommitment":"","atlCert":"An toàn lao động Nhóm 3","atlExpiry":"20/08/2026","reportsTo":"w1"},
    {"id":"w3","type":"worker","name":"Trần Văn Hùng","jobTitle":"Thợ nề","team":"Đội Hoàn thiện","contractor":"Phúc Thành","phone":"0967890123","cccd":"079078901234","dob":"12/05/1988","address":"Long An","joinDate":"10/01/2024","contractType":"nhan_cong","contractNo":"HĐNC-2024-PT-003","contractExpiry":"31/08/2026","bhxh":"","bhyt":"","salaryBase":360,"allowance":30,"status":"active","isKeyPersonnel":false,"bidCommitment":"","atlCert":"An toàn lao động Nhóm 2","atlExpiry":"12/05/2025","reportsTo":"p1"},
    {"id":"w4","type":"worker","name":"Phan Văn Đức","jobTitle":"Tổ trưởng Sắt","team":"Đội Sắt","contractor":"Thiên Long","phone":"0978901234","cccd":"079089012345","dob":"08/09/1983","address":"Tiền Giang","joinDate":"03/01/2024","contractType":"nhan_cong","contractNo":"HĐNC-2024-TL-001","contractExpiry":"31/12/2026","bhxh":"","bhyt":"","salaryBase":500,"allowance":50,"status":"active","isKeyPersonnel":false,"bidCommitment":"","atlCert":"An toàn lao động Nhóm 3","atlExpiry":"08/09/2026","reportsTo":"p1"},
    {"id":"w5","type":"worker","name":"Hoàng Minh Tuấn","jobTitle":"Thợ sắt","team":"Đội Sắt","contractor":"Thiên Long","phone":"0989012345","cccd":"079090123456","dob":"14/02/1994","address":"An Giang","joinDate":"03/01/2024","contractType":"nhan_cong","contractNo":"HĐNC-2024-TL-002","contractExpiry":"28/03/2026","bhxh":"","bhyt":"","salaryBase":400,"allowance":30,"status":"active","isKeyPersonnel":false,"bidCommitment":"","atlCert":"Vận hành máy xây dựng","atlExpiry":"28/03/2026","reportsTo":"w4"},
    {"id":"w6","type":"worker","name":"Lê Văn Đạt","jobTitle":"Thợ điện","team":"Đội MEP","contractor":"Thiên Long","phone":"0990123456","cccd":"079001234567","dob":"30/01/1992","address":"Cần Thơ","joinDate":"08/01/2024","contractType":"nhan_cong","contractNo":"HĐNC-2024-TL-003","contractExpiry":"31/12/2026","bhxh":"","bhyt":"","salaryBase":420,"allowance":40,"status":"active","isKeyPersonnel":false,"bidCommitment":"","atlCert":"Điện công trường","atlExpiry":"10/01/2025","reportsTo":"p1"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. MATERIALS — Vật tư mẫu (project đầu tiên)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'mat_items',
  '[
    {"id":"m1","code":"VT-001","name":"Thép CB300-V","unit":"Tấn","tonKho":50,"threshold":60,"maxStock":250,"donGia":15000000,"nhaCungCap":"Thép Hòa Phát","viTri":"Kho A-1","ngayNhapCuoi":"05/03/2026","ngayXuatCuoi":"07/03/2026"},
    {"id":"m2","code":"VT-002","name":"Xi măng PC40","unit":"Tấn","tonKho":200,"threshold":100,"maxStock":500,"donGia":1800000,"nhaCungCap":"Xi măng Hà Tiên","viTri":"Kho A-2","ngayNhapCuoi":"06/03/2026","ngayXuatCuoi":"07/03/2026"},
    {"id":"m3","code":"VT-003","name":"Cát vàng","unit":"m³","tonKho":150,"threshold":100,"maxStock":400,"donGia":350000,"nhaCungCap":"Cát Sông Đồng Nai","viTri":"Bãi B-1","ngayNhapCuoi":"04/03/2026","ngayXuatCuoi":"06/03/2026"},
    {"id":"m4","code":"VT-004","name":"Gạch đặc 6x9","unit":"1000v","tonKho":80,"threshold":50,"maxStock":300,"donGia":1200000,"nhaCungCap":"Gạch Đồng Tâm","viTri":"Bãi B-2","ngayNhapCuoi":"03/03/2026","ngayXuatCuoi":"05/03/2026"},
    {"id":"m5","code":"VT-005","name":"Đá 1x2","unit":"m³","tonKho":120,"threshold":80,"maxStock":350,"donGia":450000,"nhaCungCap":"Đá Biên Hòa","viTri":"Bãi B-3","ngayNhapCuoi":"06/03/2026","ngayXuatCuoi":"07/03/2026"},
    {"id":"m6","code":"VT-006","name":"Sơn nước nội","unit":"Thùng","tonKho":15,"threshold":20,"maxStock":100,"donGia":850000,"nhaCungCap":"Sơn 4 Mùa","viTri":"Kho C-1","ngayNhapCuoi":"01/03/2026","ngayXuatCuoi":"02/03/2026"},
    {"id":"m7","code":"VT-007","name":"Ống PVC Φ90","unit":"Cây","tonKho":200,"threshold":50,"maxStock":300,"donGia":95000,"nhaCungCap":"Nhựa Bình Minh","viTri":"Kho C-2","ngayNhapCuoi":"28/02/2026","ngayXuatCuoi":"28/02/2026"}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'mat_vouchers',
  '[
    {"id":"v1","type":"PN","code":"PN-2026-001","ngay":"05/03/2026","nguoiLap":"Hoàng Thị E","nguoiDuyet":"Trần Văn B","status":"approved","ghiChu":"Nhập thép đợt 3 theo HĐ 2026/HP-001","nhaCungCap":"Thép Hòa Phát","butToan":"Nợ TK152 / Có TK331","totalAmount":750000000,"items":[{"matHang":"Thép CB300-V","donVi":"Tấn","soLuong":50,"donGia":15000000,"thanhTien":750000000}]},
    {"id":"v2","type":"PX","code":"PX-2026-012","ngay":"07/03/2026","nguoiLap":"Hoàng Thị E","nguoiDuyet":"","status":"pending","ghiChu":"Xuất thép thi công dầm tầng 3 trục A-D","nhaCungCap":"","butToan":"Nợ TK621 / Có TK152","totalAmount":300000000,"items":[{"matHang":"Thép CB300-V","donVi":"Tấn","soLuong":20,"donGia":15000000,"thanhTien":300000000}]},
    {"id":"v3","type":"VAT","code":"HĐ-0001234","ngay":"05/03/2026","nguoiLap":"Hoàng Thị E","nguoiDuyet":"","status":"pending","ghiChu":"Hóa đơn VAT mua thép đợt 3","nhaCungCap":"Thép Hòa Phát","hoaDonVAT":"0001234","butToan":"Nợ TK133 / Có TK331","totalAmount":75000000,"items":[{"matHang":"VAT 10% — Thép CB300-V","donVi":"VNĐ","soLuong":1,"donGia":75000000,"thanhTien":75000000}]},
    {"id":"v4","type":"PN","code":"PN-2026-002","ngay":"06/03/2026","nguoiLap":"Hoàng Thị E","nguoiDuyet":"Trần Văn B","status":"approved","ghiChu":"Nhập xi măng đợt 5","nhaCungCap":"Xi măng Hà Tiên","butToan":"Nợ TK152 / Có TK331","totalAmount":360000000,"items":[{"matHang":"Xi măng PC40","donVi":"Tấn","soLuong":200,"donGia":1800000,"thanhTien":360000000}]}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'mat_kiemke',
  '[{"id":"kk1","ngay":"01/03/2026","nguoiKiemKe":"Hoàng Thị E","nguoiDuyet":"Trần Văn B","status":"approved","ghiChu":"Kiểm kê đầu tháng 3/2026","items":[{"matHangId":"m1","tenMatHang":"Thép CB300-V","donVi":"Tấn","soSach":52,"thucTe":50,"chenhLech":-2,"ghiChu":"Sai lệch nhỏ, đã điều chỉnh"},{"matHangId":"m2","tenMatHang":"Xi măng PC40","donVi":"Tấn","soSach":200,"thucTe":200,"chenhLech":0,"ghiChu":""},{"matHangId":"m3","tenMatHang":"Cát vàng","donVi":"m³","soSach":152,"thucTe":150,"chenhLech":-2,"ghiChu":"Bay hao tự nhiên"}]}]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. HSE — Sự cố, vi phạm, đào tạo, kiểm tra (project đầu tiên)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hse_incidents',
  '[
    {"id":"i1","date":"03/03/2026","time":"08:15","location":"Zone 2 — Tầng 3","description":"Công nhân thầu phụ Phúc Thành ngã giàn giáo, trầy xước tay phải","level":"minor","injured":"Nguyễn Văn Cường","root_cause":"Không đeo dây an toàn khi làm việc trên cao > 2m","action":"Sơ cứu tại chỗ, nghỉ 1 ngày, nhắc nhở toàn đội","status":"closed","reporter":"Trần Minh Hải"},
    {"id":"i2","date":"15/02/2026","time":"14:30","location":"Kho vật tư — Cổng B","description":"Xe nâng suýt va vào công nhân đi bộ do khu vực thiếu vạch phân làn","level":"near_miss","root_cause":"Không có vạch phân làn người và xe trong kho","action":"Vẽ vạch phân làn, cắm biển cảnh báo, họp an toàn toàn công trường","status":"closed","reporter":"Lê Thanh Tùng"},
    {"id":"i3","date":"20/01/2026","time":"10:00","location":"Khu vực đổ bê tông — Trục A","description":"Máy bơm bê tông rò rỉ dầu thủy lực ra nền đất","level":"medium","root_cause":"Ống thủy lực lão hóa chưa được thay thế đúng hạn","action":"Dừng máy, thay ống, thu gom dầu, báo cáo môi trường","status":"closed","reporter":"Trần Minh Hải"}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hse_violations',
  '[
    {"id":"vl1","date":"04/03/2026","worker":"Trần Văn Bình","contractor":"Phúc Thành","description":"Không đội mũ bảo hiểm khi làm việc trong khu vực thi công","level":"trung","photo_note":"Có ảnh chụp camera Zone 2","action":"Nhắc nhở lần 1, ký biên bản","fine_amount":500,"status":"resolved","recurrence":false},
    {"id":"vl2","date":"02/03/2026","worker":"Lê Minh Quân","contractor":"Phúc Thành","description":"Hút thuốc lá trong kho vật tư dễ cháy","level":"nghiem_trong","photo_note":"Bảo vệ bắt gặp","action":"Đình chỉ 3 ngày, phạt tiền, báo cáo NTP","fine_amount":2000,"status":"resolved","recurrence":true},
    {"id":"vl3","date":"28/02/2026","worker":"Nguyễn Thị Hoa","contractor":"Minh Khoa","description":"Không mặc áo phản quang khi làm việc ban đêm","level":"nhe","photo_note":"","action":"Nhắc nhở, phát áo phản quang","fine_amount":0,"status":"resolved","recurrence":false},
    {"id":"vl4","date":"01/03/2026","worker":"Phan Văn Đức","contractor":"Thiên Long","description":"Vận hành cẩu tháp không đúng vùng an toàn","level":"nghiem_trong","photo_note":"Camera ghi lại","action":"Đang điều tra, tạm dừng vận hành","fine_amount":0,"status":"open","recurrence":false}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hse_trainings',
  '[
    {"id":"t1","title":"An toàn làm việc trên cao","type":"Bắt buộc","scheduled_date":"10/03/2026","duration_hours":8,"trainer":"KS Nguyễn Tuấn Anh","participants":[],"max_participants":30,"status":"scheduled","pass_count":0,"certificate_expiry_months":12,"notes":"Bắt buộc với tất cả công nhân làm việc > 2m"},
    {"id":"t2","title":"Phòng chống cháy nổ & PCCC","type":"Bắt buộc","scheduled_date":"20/02/2026","duration_hours":4,"trainer":"Phòng PCCC Quận 7","participants":["Nguyễn Văn A","Trần Thị B","Lê Văn C"],"max_participants":50,"status":"completed","pass_count":48,"certificate_expiry_months":24,"notes":"Đã hoàn thành — 48/50 đạt"},
    {"id":"t3","title":"Sử dụng thiết bị bảo hộ cá nhân (PPE)","type":"Định kỳ","scheduled_date":"05/01/2026","duration_hours":2,"trainer":"HSE Officer nội bộ","participants":[],"max_participants":100,"status":"completed","pass_count":95,"certificate_expiry_months":6,"notes":"95/100 đạt, 5 người cần tái đào tạo"},
    {"id":"t4","title":"An toàn điện công trường","type":"Bắt buộc","scheduled_date":"01/02/2026","duration_hours":4,"trainer":"Điện lực khu vực","participants":[],"max_participants":20,"status":"overdue","pass_count":0,"certificate_expiry_months":12,"notes":"Bị hoãn do thời tiết — cần sắp xếp lại"}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hse_inspections',
  '[{"id":"ins1","date":"05/03/2026","inspector":"Lê Thanh Tùng","area":"Toàn công trường","checklist_items":[{"item":"Biển cảnh báo an toàn đầy đủ","result":"pass","note":""},{"item":"Giàn giáo có lan can bảo vệ","result":"pass","note":""},{"item":"Thiết bị PPE được sử dụng đúng cách","result":"fail","note":"Phát hiện 3 CN không đội mũ — đã xử lý"},{"item":"Lối đi thoát nạn thông thoáng","result":"pass","note":""},{"item":"PCCC đầy đủ và còn hạn","result":"pass","note":""}],"overall_score":80,"status":"completed","findings":"Phát hiện 3 CN không đội mũ BH — đã xử lý tại chỗ và lập biên bản","corrective_action":"Tăng cường giám sát khu vực Zone 2"}]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. OFFICE — Công văn, họp hành (project đầu tiên)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'office_congvan',
  '[
    {"id":"cv1","so_cv":"CV-2026/001-GĐDA","trich_yeu":"Phê duyệt phương án kỹ thuật xử lý nền đất yếu khu C4-D6","noi_dung":"Căn cứ kết quả khảo sát địa chất bổ sung ngày 05/02/2026, Ban QLDA chấp thuận triển khai phương án cọc xi măng đất theo đề xuất.","direction":"outbound","category":"Kỹ thuật","status":"sent","priority":"urgent","date_in":"07/03/2026","from_to":"Ban QLDA → Chỉ huy trưởng","handler":"Nguyễn Thị Lan (Thư ký)","tags":["Kỹ thuật","Nền móng"],"attachments":2},
    {"id":"cv2","so_cv":"2026/045-TVGS","trich_yeu":"Biên bản nghiệm thu cốt thép dầm tầng 3 — Đạt yêu cầu","noi_dung":"Biên bản nghiệm thu công tác cốt thép dầm sàn tầng 3 block A ngày 06/03/2026. Kết quả: Đạt yêu cầu kỹ thuật theo TCVN 9115:2012.","direction":"inbound","category":"Nghiệm thu","status":"received","priority":"normal","date_in":"06/03/2026","from_to":"TVGS Alpha → Ban QLDA","handler":"Phạm Minh Quân","tags":["Nghiệm thu","Kết cấu"],"attachments":1},
    {"id":"cv3","so_cv":"CV-2026/002-CHT","trich_yeu":"Báo cáo tiến độ tháng 2/2026 — Đạt 78% kế hoạch","noi_dung":"Báo cáo tiến độ thi công tháng 2/2026. Tổng tiến độ thực hiện đạt 78% so với kế hoạch tháng.","direction":"inbound","category":"Báo cáo","status":"processing","priority":"normal","date_in":"01/03/2026","deadline":"10/03/2026","from_to":"CHT Nguyễn Văn Anh → GĐ DA","handler":"Trần Thị Mai (Thư ký)","tags":["Báo cáo","Tiến độ"],"attachments":3},
    {"id":"cv4","so_cv":"2026/018-CĐT","trich_yeu":"Yêu cầu đẩy nhanh tiến độ tầng hầm B2 — Hoàn thành trước 30/04","noi_dung":"Chủ đầu tư yêu cầu Nhà thầu thi công hoàn thành toàn bộ công tác tầng hầm B2 trước ngày 30/04/2026.","direction":"inbound","category":"Chỉ đạo","status":"processing","priority":"express","date_in":"05/03/2026","deadline":"15/03/2026","from_to":"CĐT Hoàng Long → Ban QLDA","handler":"Nguyễn Thị Lan","tags":["Tiến độ","Tầng hầm"],"attachments":1}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'office_meetings',
  '[
    {"id":"m1","title":"Họp giao ban tuần 10/2026","date":"09/03/2026","time_start":"08:00","time_end":"09:30","location":"Phòng họp tại công trường","status":"scheduled","organizer":"GĐ DA Trần Văn Bình","attendees":["GĐ DA","CHT Nguyễn Văn Anh","TVGS Alpha","KS Giám sát Hoàng","QS Minh Tuấn"],"agenda":["Báo cáo tiến độ tuần 9","Giải quyết vướng mắc kỹ thuật","Kế hoạch tuần 10","Các vấn đề khác"],"notes":"","minute_id":null},
    {"id":"m2","title":"Họp kỹ thuật xử lý nền đất yếu khu C","date":"06/03/2026","time_start":"14:00","time_end":"16:00","location":"Văn phòng Ban QLDA","status":"done","organizer":"CHT Nguyễn Văn Anh","attendees":["CHT","TVGS KC","TK Kết cấu","KS Giám sát"],"agenda":["Báo cáo kết quả khảo sát","Đề xuất phương án","Thống nhất triển khai"],"notes":"Đã thống nhất phương án cọc xi măng đất. GĐ DA phê duyệt qua CV-2026/001.","minute_id":"min1"},
    {"id":"m3","title":"Họp CĐT — Tiến độ tầng hầm B2","date":"12/03/2026","time_start":"10:00","time_end":"11:30","location":"Văn phòng CĐT — Tầng 12 Landmark","status":"scheduled","organizer":"CĐT Hoàng Long","attendees":["CĐT","GĐ DA","CHT","QS Minh Tuấn"],"agenda":["Báo cáo hiện trạng tầng hầm","Phương án đẩy nhanh tiến độ","Phê duyệt VO acceleration"],"notes":"","minute_id":null}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'office_minutes',
  '[{"id":"min1","meeting_id":"m2","meeting_title":"Họp kỹ thuật xử lý nền đất yếu khu C","date":"06/03/2026","location":"Văn phòng Ban QLDA","status":"confirmed","prepared_by":"Nguyễn Thị Lan","attendees":["CHT Nguyễn Văn Anh","TVGS KC Alpha","TK Kết cấu Hùng","KS Giám sát Hoàng"],"conclusions":["Chấp thuận phương án cọc xi măng đất Φ600mm","GĐ DA phê duyệt qua văn bản CV-2026/001","Triển khai ngay sau khi nhận văn bản"],"action_items":[{"task":"Cung cấp bản vẽ cọc xi măng đất","responsible":"TK Kết cấu","deadline":"10/03/2026","status":"pending"},{"task":"Lập phương án thi công chi tiết","responsible":"CHT Nguyễn Văn Anh","deadline":"12/03/2026","status":"pending"}],"attachments":[]}]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. CALENDAR — Sự kiện (global — dùng cho tất cả projects)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'global',
  'calendar_events',
  '[
    {"id":"e1","date":"2026-03-20","time":"07:30","endTime":"08:30","title":"Họp giao ban công trường","type":"meeting","status":"completed","location":"VP Ban QLDA"},
    {"id":"e2","date":"2026-03-20","time":"09:00","endTime":"11:00","title":"Nghiệm thu cốt thép móng M1-M5","type":"inspection","status":"upcoming","location":"Khu A"},
    {"id":"e3","date":"2026-03-20","time":"13:30","endTime":"17:30","title":"Đổ bê tông móng khối lớn","type":"construction","status":"upcoming","location":"Khu A","alert":"Cần theo dõi thời tiết chiều nay"},
    {"id":"e4","date":"2026-03-21","time":"08:00","endTime":"09:00","title":"Duyệt hồ sơ thanh toán đợt 3","type":"payment","status":"upcoming","location":"Văn phòng"},
    {"id":"e5","date":"2026-03-22","time":"10:00","endTime":"12:00","title":"Họp kỹ thuật hệ thống M&E","type":"meeting","status":"upcoming","location":"Phòng họp 2"},
    {"id":"e6","date":"2026-03-24","time":"08:00","endTime":"17:00","title":"Kiểm tra an toàn toàn công trường","type":"inspection","status":"upcoming","location":"Toàn công trường"},
    {"id":"e7","date":"2026-03-19","time":"14:00","endTime":"15:30","title":"Ký biên bản nghiệm thu phần ngầm","type":"inspection","status":"completed","location":"Khu B"}
  ]'::jsonb
)
ON CONFLICT (project_id, collection) DO UPDATE SET payload = EXCLUDED.payload;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. CONTACTS — Đối tác liên hệ (global)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'global',
  'contacts',
  '[
    {"id":"c1","company":"Tập đoàn Đầu tư BĐS Alpha","type":"client","role":"Chủ đầu tư","contactPerson":"Phạm Thị D","position":"Giám đốc Ban QLDA","phone":"0933445566","email":"ptd@alphagroup.vn","address":"789 Lê Lợi, Q.1, TP.HCM","website":"https://alphagroup.vn","projectIds":[],"bank":{"bankName":"Vietcombank","accountNo":"1234567890","accountName":"TAP DOAN DAU TU BDS ALPHA"},"note":"Ưu tiên liên hệ qua email. Họp định kỳ thứ Sáu hàng tuần.","interactions":[{"id":"i1","date":"2026-03-05","note":"Họp triển khai gói thầu móng DA Alpha."},{"id":"i2","date":"2026-03-01","note":"Gửi hồ sơ thanh toán đợt 2."}],"createdAt":"2026-01-01"},
    {"id":"c2","company":"Công ty CP Xây dựng Hòa Bình","type":"contractor","role":"Tổng thầu thi công","contactPerson":"Nguyễn Văn A","position":"Chỉ huy trưởng","phone":"0901234567","email":"nva@hoabinh.com","address":"123 Nguyễn Đình Chiểu, Q.3, TP.HCM","website":"https://hbcorp.vn","projectIds":[],"bank":{"bankName":"BIDV","accountNo":"9876543210","accountName":"CONG TY CP XAY DUNG HOA BINH"},"note":"Nhà thầu chính DA Alpha. Hiện đang thi công móng.","interactions":[{"id":"i3","date":"2026-03-06","note":"Xử lý vi phạm HSE tại tầng 5."}],"createdAt":"2026-01-01"},
    {"id":"c3","company":"Công ty TNHH Thép Việt","type":"supplier","role":"Nhà cung cấp Thép CB300","contactPerson":"Trần Thị B","position":"GĐ Kinh doanh","phone":"0987654321","email":"ttb@thepviet.vn","address":"KCN Phú Mỹ 1, BR-VT","website":"","projectIds":[],"bank":{"bankName":"Techcombank","accountNo":"1122334455","accountName":"CONG TY TNHH THEP VIET"},"note":"Thép CB300 — giao trong 5 ngày sau đặt hàng. Chiết khấu 2% nếu TT sớm.","interactions":[],"createdAt":"2026-01-15"},
    {"id":"c4","company":"Công ty Tư vấn Thiết kế KT X","type":"consultant","role":"Tư vấn giám sát","contactPerson":"Lê Văn C","position":"Trưởng đoàn TVGS","phone":"0912345678","email":"lvc@tuvanx.com","address":"456 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM","website":"https://tuvanx.com","projectIds":[],"bank":null,"note":"TVGS chính dự án. Liên hệ trực tiếp về vấn đề kỹ thuật.","interactions":[{"id":"i4","date":"2026-02-20","note":"Họp kỹ thuật xử lý vướng mắc bản vẽ KC."}],"createdAt":"2026-01-01"},
    {"id":"c5","company":"Xi măng Hà Tiên","type":"supplier","role":"Nhà cung cấp Xi măng","contactPerson":"Hoàng Văn E","position":"Trưởng phòng KD","phone":"0945678901","email":"hve@hatiencement.vn","address":"Kiên Giang","website":"","projectIds":[],"bank":null,"note":"Giao hàng theo lịch tuần — đặt trước 3 ngày.","interactions":[],"createdAt":"2026-01-20"}
  ]'::jsonb
)
ON CONFLICT (project_id, collection) DO UPDATE SET payload = EXCLUDED.payload;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. CONTRACTS — Hợp đồng (project đầu tiên)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'contracts',
  '[
    {"id":"c1","type":"main","code":"HĐ-2026-001","name":"Hợp đồng Tổng thầu EPC","party":"CĐT Nguyễn Văn An","party_type":"Chủ đầu tư","value":120000,"signed_date":"01/01/2026","start_date":"01/01/2026","end_date":"31/12/2026","payment_terms":"Theo tiến độ: 30% khởi công, 40% khi đạt 50% KL, 30% nghiệm thu","paid_amount":42000,"retention_pct":5,"progress":35,"guarantees":[{"type":"performance","value":6000,"expiry":"31/01/2027"},{"type":"advance","value":3600,"expiry":"30/06/2026"}],"payment_schedule":[{"milestone":"Tạm ứng khởi công (30%)","pct":30,"amount":36000,"status":"paid","date":"05/01/2026"},{"milestone":"Đợt 1 — hoàn thành móng","pct":20,"amount":24000,"status":"paid","date":"15/02/2026"},{"milestone":"Đợt 2 — thân nhà 50%","pct":20,"amount":24000,"status":"pending","date":"30/04/2026"},{"milestone":"Đợt 3 — hoàn thiện","pct":20,"amount":24000,"status":"pending","date":"30/09/2026"},{"milestone":"Nghiệm thu bàn giao","pct":10,"amount":12000,"status":"pending","date":"31/12/2026"}],"linked_module":"qs","status":"active","gem_risk":"Bảo lãnh tạm ứng hết hạn 30/06/2026 — cần gia hạn hoặc hoàn ứng trước thời điểm này.","docs":["HĐ-2026-001.pdf","PL01-Đơn giá.pdf"]},
    {"id":"c2","type":"subcontractor","code":"HĐ-NTP-001","name":"HĐ NTP Sắt thép & Ván khuôn","party":"Công ty Phúc Thành","party_type":"Nhà thầu phụ","value":8500,"signed_date":"10/01/2026","start_date":"15/01/2026","end_date":"30/09/2026","payment_terms":"Khoán gọn theo hạng mục — nghiệm thu khối lượng từng đợt","paid_amount":3200,"retention_pct":5,"progress":38,"guarantees":[{"type":"performance","value":850,"expiry":"30/10/2026"}],"payment_schedule":[{"milestone":"Tạm ứng (20%)","pct":20,"amount":1700,"status":"paid","date":"20/01/2026"},{"milestone":"Đợt 1 — móng hoàn thành","pct":30,"amount":2550,"status":"paid","date":"28/02/2026"},{"milestone":"Đợt 2 — thân nhà T1-3","pct":30,"amount":2550,"status":"pending","date":"30/05/2026"},{"milestone":"Hoàn công + bảo lưu","pct":20,"amount":1700,"status":"pending","date":"30/09/2026"}],"linked_module":"qs","linked_id":"sub-pt","status":"active","gem_risk":"Tiến độ NTP chậm ~2 tuần so với lịch. Cần xác nhận nhân lực tổ sắt tuần tới.","docs":["HĐ-NTP-001.pdf"]},
    {"id":"c3","type":"supplier","code":"HĐ-CC-001","name":"HĐ Cung cấp Thép Xây dựng","party":"Công ty Thép Hòa Phát","party_type":"Nhà cung cấp","value":4200,"signed_date":"15/01/2026","start_date":"20/01/2026","end_date":"30/06/2026","payment_terms":"Thanh toán 30 ngày sau giao hàng","paid_amount":2800,"retention_pct":0,"progress":67,"guarantees":[],"payment_schedule":[{"milestone":"Đợt 1 — 50 tấn thép cuộn","pct":33,"amount":1386,"status":"paid","date":"25/01/2026"},{"milestone":"Đợt 2 — 80 tấn thép vằn","pct":40,"amount":1680,"status":"paid","date":"20/02/2026"},{"milestone":"Đợt 3 — 70 tấn còn lại","pct":27,"amount":1134,"status":"pending","date":"30/04/2026"}],"linked_module":"materials","status":"active","docs":["HĐ-CC-001.pdf"]}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RECORDS — Bản vẽ & RFI (project đầu tiên)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'rd_drawings',
  '[
    {"id":"D001","drawing_no":"A-001","title":"Mặt bằng tầng 1 — Block A","discipline":"Kiến trúc","current_rev":"C","rfi_linked":["RFI-003"],"revisions":[{"rev":"A","date":"15/09/2025","author":"KTS Minh Tuấn","description":"Phát hành lần đầu","file":"A-001_RevA.pdf","status":"superseded"},{"rev":"B","date":"10/11/2025","author":"KTS Minh Tuấn","description":"Điều chỉnh vị trí cầu thang bộ theo yêu cầu PCCC","file":"A-001_RevB.pdf","status":"superseded"},{"rev":"C","date":"18/01/2026","author":"KTS Minh Tuấn","description":"Cập nhật kích thước sảnh tầng 1 — xem VO-001","file":"A-001_RevC.pdf","status":"current"}]},
    {"id":"D002","drawing_no":"KC-015","title":"Chi tiết cốt thép móng băng trục A-B","discipline":"Kết cấu","current_rev":"B","rfi_linked":["RFI-001"],"revisions":[{"rev":"0","date":"20/09/2025","author":"KSC Hùng","description":"Bản phát hành thi công","file":"KC-015_Rev0.pdf","status":"superseded"},{"rev":"A","date":"05/12/2025","author":"KSC Hùng","description":"Sửa đổi chi tiết nối cốt thép theo RFI-001","file":"KC-015_RevA.pdf","status":"superseded"},{"rev":"B","date":"25/01/2026","author":"KSC Hùng","description":"Cập nhật chiều dày bê tông lót 100mm → 150mm","file":"KC-015_RevB.pdf","status":"current"}]},
    {"id":"D003","drawing_no":"M-008","title":"Sơ đồ hệ thống cấp nước tầng hầm B1-B2","discipline":"MEP","current_rev":"A","rfi_linked":["RFI-002"],"note":"Đang chờ phản hồi RFI-002 về vị trí van xả","revisions":[{"rev":"0","date":"01/10/2025","author":"KS Phúc","description":"Phát hành lần đầu","file":"M-008_Rev0.pdf","status":"superseded"},{"rev":"A","date":"14/02/2026","author":"KS Phúc","description":"Điều chỉnh tuyến ống chính D150 — tránh xung đột kết cấu","file":"M-008_RevA.pdf","status":"current"}]},
    {"id":"D004","drawing_no":"A-045","title":"Mặt đứng chính Block B — hướng Nam","discipline":"Kiến trúc","current_rev":"D","rfi_linked":[],"note":"⚠️ Một số NTP đang dùng Rev B — cần thông báo cập nhật Rev D","revisions":[{"rev":"A","date":"10/09/2025","author":"KTS Lan Anh","description":"Phát hành","file":"A-045_RevA.pdf","status":"superseded"},{"rev":"D","date":"05/02/2026","author":"KTS Lan Anh","description":"Hoàn thiện chi tiết joint kính + khung nhôm","file":"A-045_RevD.pdf","status":"current"}]},
    {"id":"D005","drawing_no":"E-022","title":"Sơ đồ nguyên lý tủ điện tầng 5","discipline":"MEP","current_rev":"0","rfi_linked":["RFI-004"],"revisions":[{"rev":"0","date":"12/01/2026","author":"KS Điện Đức","description":"Phát hành thi công","file":"E-022_Rev0.pdf","status":"draft"}]}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'rd_rfis',
  '[
    {"id":"rfi1","rfi_no":"RFI-001","title":"Làm rõ chi tiết nối cốt thép móng tại vị trí giao nhau trục A-3","discipline":"Kết cấu","status":"closed","priority":"urgent","date_issued":"01/12/2025","date_required":"08/12/2025","date_answered":"05/12/2025","submitted_by":"KS Giám sát Hoàng","assigned_to":"TVGS — Công ty TKS","description":"Bản vẽ KC-015 Rev0 không thể hiện rõ cách nối cốt thép D22 tại nút giao móng băng — móng đơn trục A-3.","drawing_ref":"KC-015","response":"Xem chi tiết bổ sung đính kèm. Nối chồng L=40d, đai tăng cường 3Ø8 mỗi nút.","attachments":2},
    {"id":"rfi2","rfi_no":"RFI-002","title":"Xác nhận cao độ đặt van xả đáy hệ thống cấp nước tầng hầm","discipline":"MEP","status":"open","priority":"normal","date_issued":"10/02/2026","date_required":"17/02/2026","submitted_by":"NTP Cơ điện Á Đông","assigned_to":"TVGS MEP — KS Minh","description":"Bản vẽ M-008 Rev0 chỉ ghi đặt theo hiện trường — không có cao độ cụ thể cho van xả đáy D80.","drawing_ref":"M-008","attachments":1},
    {"id":"rfi3","rfi_no":"RFI-003","title":"Kích thước hành lang thoát nạn tầng 1 — chưa đủ 1.5m theo QCVN","discipline":"Kiến trúc","status":"answered","priority":"urgent","date_issued":"20/01/2026","date_required":"27/01/2026","date_answered":"25/01/2026","submitted_by":"KS Giám sát Hoàng","assigned_to":"TVGS — KTS Minh Tuấn","description":"Bản vẽ A-001 Rev B: Chiều rộng hành lang thoát nạn tại trục 3-4 đo được 1.35m, không đạt QCVN 06:2022/BXD.","drawing_ref":"A-001","response":"Đã điều chỉnh trong Rev C — hành lang mở rộng đạt 1.6m.","attachments":3,"linked_ncr":"NCR-012"},
    {"id":"rfi4","rfi_no":"RFI-004","title":"Xác nhận chủng loại MCB cho tủ điện tầng 5 — ABB hay Schneider","discipline":"MEP","status":"open","priority":"normal","date_issued":"25/02/2026","date_required":"04/03/2026","submitted_by":"NTP Cơ điện Á Đông","assigned_to":"TVGS MEP — KS Minh","description":"Bản vẽ E-022 Rev0 ghi MCB 3P 63A — theo chỉ định CĐT nhưng spec chưa xác định hãng.","drawing_ref":"E-022","attachments":0},
    {"id":"rfi5","rfi_no":"RFI-005","title":"Yêu cầu bổ sung bản vẽ chi tiết gờ dầm tại tầng kỹ thuật","discipline":"Kết cấu","status":"overdue","priority":"urgent","date_issued":"15/02/2026","date_required":"22/02/2026","submitted_by":"KS Giám sát Hoàng","assigned_to":"TVGS — KSC Hùng","description":"Tầng kỹ thuật (tầng 7) có nhiều gờ dầm đặc biệt cho lắp đặt thiết bị nhưng chưa có bản vẽ chi tiết.","drawing_ref":"","attachments":0,"note":"Đã gửi nhắc nhở 2 lần — quá hạn 13 ngày!"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- Verify kết quả
-- ════════════════════════════════════════════════════════════════════════════
SELECT
  project_id,
  collection,
  jsonb_array_length(payload) AS record_count,
  LEFT(p.name, 30) AS project_name
FROM public.project_data pd
LEFT JOIN public.projects p ON p.id = pd.project_id
WHERE collection IN (
  'mp_people','mat_items','mat_vouchers','mat_kiemke',
  'hse_incidents','hse_trainings','hse_violations','hse_inspections',
  'office_congvan','office_meetings','office_minutes',
  'calendar_events','contacts','contracts',
  'rd_drawings','rd_rfis'
)
ORDER BY collection;

-- Dọn helper function
