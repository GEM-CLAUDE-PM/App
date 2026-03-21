-- ═══════════════════════════════════════════════════════════════════════════
-- GEM & CLAUDE PM Pro — Seed Data S30 (File 2)
-- Modules: Progress/WBS, BOQ, QS, QaQc, HR, Equipment, Risk, Procurement,
--          GiamSat, Accounting, HSE PTW/Toolbox
-- Chạy TRONG Supabase SQL Editor sau khi đã chạy seed_pilot_data.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- Xóa seed cũ (idempotent)
DELETE FROM public.project_data
WHERE collection IN (
  'progress_wbs','progress_milestones',
  'boq_items','rate_library',
  'qs_items','qs_acceptance','qs_payments','qs_subs',
  'qa_checklists','qa_defects','qa_feedbacks',
  'hr_employees','hr_contracts','hr_leaves','hr_evaluations',
  'eq_maintenance',
  'risk_register',
  'procurement_rfqs','procurement_pos','procurement_suppliers',
  'gs_logs','gs_rfi',
  'acc_debts',
  'hse_ptws','hse_toolbox'
)
AND project_id = 'p1';

-- ════════════════════════════════════════════════════════════════════════════
-- 1. PROGRESS — WBS + Milestones
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'progress_wbs',
  '[
    {"id":"1","code":"1.0","name":"Công tác chuẩn bị","budget":1.8,"pv_pct":100,"ev_pct":100,"ac":1.95,"category":"Móng","responsible":"Trần Văn B","critical":false},
    {"id":"2","code":"2.0","name":"Thi công móng cọc","budget":5.2,"pv_pct":100,"ev_pct":100,"ac":5.60,"category":"Móng","responsible":"Trần Văn B","critical":false},
    {"id":"3","code":"3.0","name":"Đài móng & giằng móng","budget":3.8,"pv_pct":85,"ev_pct":72,"ac":3.20,"category":"Móng","responsible":"Lê Thị C","critical":true},
    {"id":"4","code":"4.0","name":"Tầng hầm (tường vây & sàn)","budget":6.4,"pv_pct":65,"ev_pct":48,"ac":4.10,"category":"Thân nhà","responsible":"Trần Văn B","critical":true},
    {"id":"5","code":"5.0","name":"Cột & dầm tầng 1-2","budget":4.2,"pv_pct":42,"ev_pct":28,"ac":1.40,"category":"Thân nhà","responsible":"Lê Thị C","critical":true},
    {"id":"6","code":"6.0","name":"Sàn tầng 1-2","budget":3.1,"pv_pct":30,"ev_pct":14,"ac":0.52,"category":"Thân nhà","responsible":"Trần Văn B","critical":true},
    {"id":"7","code":"7.0","name":"Xây tường bao tầng 1","budget":2.4,"pv_pct":15,"ev_pct":5,"ac":0.14,"category":"Hoàn thiện","responsible":"Lê Thị C","critical":false},
    {"id":"8","code":"8.0","name":"Hệ thống M&E (điện, nước)","budget":7.8,"pv_pct":22,"ev_pct":10,"ac":0.90,"category":"M&E","responsible":"Phạm Văn D","critical":false},
    {"id":"9","code":"9.0","name":"Hoàn thiện kiến trúc","budget":6.5,"pv_pct":0,"ev_pct":0,"ac":0.00,"category":"Hoàn thiện","responsible":"Lê Thị C","critical":false},
    {"id":"10","code":"10.0","name":"Nghiệm thu & bàn giao","budget":1.8,"pv_pct":0,"ev_pct":0,"ac":0.00,"category":"Kết thúc","responsible":"Nguyễn A","critical":false}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'progress_milestones',
  '[
    {"id":"ms1","name":"Xong móng cọc","plan":"25/01/2026","actual":"23/01/2026","status":"done","delta":-2,"critical":false},
    {"id":"ms2","name":"Xong tầng hầm B1","plan":"22/02/2026","actual":"","status":"delayed","delta":12,"critical":true},
    {"id":"ms3","name":"Cất nóc (hoàn thiện thô)","plan":"30/04/2026","actual":"","status":"at_risk","delta":0,"critical":true},
    {"id":"ms4","name":"Hoàn thiện toàn bộ","plan":"31/07/2026","actual":"","status":"on_track","delta":0,"critical":false},
    {"id":"ms5","name":"Bàn giao CĐT","plan":"15/08/2026","actual":"","status":"on_track","delta":0,"critical":false}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 2. BOQ — Bảng khối lượng
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'boq_items',
  '[
    {"id":"c1","code":"C1","chapter":"C1","name":"PHẦN NGẦM","unit":"","qty_contract":0,"unit_price":0,"qty_done":0,"qty_plan_current":0,"isChapter":true},
    {"id":"c1-1","code":"C1.1","chapter":"C1","name":"Cọc BTCT D400 L=20m","unit":"m","qty_contract":4800,"unit_price":420000,"qty_done":4800,"qty_plan_current":4800},
    {"id":"c1-2","code":"C1.2","chapter":"C1","name":"Đập đầu cọc","unit":"Cọc","qty_contract":240,"unit_price":800000,"qty_done":240,"qty_plan_current":240},
    {"id":"c1-3","code":"C1.3","chapter":"C1","name":"Đài móng M1 BTCT 250# V=42m³","unit":"m³","qty_contract":336,"unit_price":3800000,"qty_done":336,"qty_plan_current":336},
    {"id":"c1-4","code":"C1.4","chapter":"C1","name":"Giằng móng 250# V=18m³","unit":"m³","qty_contract":144,"unit_price":3600000,"qty_done":144,"qty_plan_current":144},
    {"id":"c1-5","code":"C1.5","chapter":"C1","name":"Cốt thép móng D≤10 CT3","unit":"Tấn","qty_contract":28.5,"unit_price":28500000,"qty_done":28.5,"qty_plan_current":28.5},
    {"id":"c1-6","code":"C1.6","chapter":"C1","name":"Cốt thép móng D>10 CT3","unit":"Tấn","qty_contract":62.4,"unit_price":26800000,"qty_done":62.4,"qty_plan_current":62.4},
    {"id":"c2","code":"C2","chapter":"C2","name":"PHẦN THÂN","unit":"","qty_contract":0,"unit_price":0,"qty_done":0,"qty_plan_current":0,"isChapter":true},
    {"id":"c2-1","code":"C2.1","chapter":"C2","name":"Cột BTCT 300# F=0.25m² T1-T5","unit":"m³","qty_contract":420,"unit_price":4200000,"qty_done":210,"qty_plan_current":280},
    {"id":"c2-2","code":"C2.2","chapter":"C2","name":"Dầm sàn BTCT 250# T1-T5","unit":"m³","qty_contract":680,"unit_price":3900000,"qty_done":340,"qty_plan_current":408},
    {"id":"c2-3","code":"C2.3","chapter":"C2","name":"Sàn BTCT 250# T1-T5","unit":"m³","qty_contract":1250,"unit_price":3750000,"qty_done":500,"qty_plan_current":625},
    {"id":"c2-4","code":"C2.4","chapter":"C2","name":"Cốt thép cột D≤10","unit":"Tấn","qty_contract":45,"unit_price":28500000,"qty_done":22.5,"qty_plan_current":27},
    {"id":"c2-5","code":"C2.5","chapter":"C2","name":"Cốt thép cột D>10","unit":"Tấn","qty_contract":120,"unit_price":26800000,"qty_done":60,"qty_plan_current":72},
    {"id":"c2-6","code":"C2.6","chapter":"C2","name":"Cốt thép sàn, dầm D≤10","unit":"Tấn","qty_contract":85,"unit_price":28500000,"qty_done":42.5,"qty_plan_current":51},
    {"id":"c2-7","code":"C2.7","chapter":"C2","name":"Xây tường 20cm gạch ống T1-T3","unit":"m²","qty_contract":3200,"unit_price":185000,"qty_done":960,"qty_plan_current":1600},
    {"id":"c3","code":"C3","chapter":"C3","name":"HOÀN THIỆN","unit":"","qty_contract":0,"unit_price":0,"qty_done":0,"qty_plan_current":0,"isChapter":true},
    {"id":"c3-1","code":"C3.1","chapter":"C3","name":"Trát tường trong (vữa M75)","unit":"m²","qty_contract":8500,"unit_price":95000,"qty_done":0,"qty_plan_current":850},
    {"id":"c3-2","code":"C3.2","chapter":"C3","name":"Ốp lát gạch ceramic 400x400","unit":"m²","qty_contract":4200,"unit_price":320000,"qty_done":0,"qty_plan_current":420},
    {"id":"c3-3","code":"C3.3","chapter":"C3","name":"Sơn tường ngoài 2 nước","unit":"m²","qty_contract":6800,"unit_price":75000,"qty_done":0,"qty_plan_current":0},
    {"id":"c4","code":"C4","chapter":"C4","name":"HỆ THỐNG M&E","unit":"","qty_contract":0,"unit_price":0,"qty_done":0,"qty_plan_current":0,"isChapter":true},
    {"id":"c4-1","code":"C4.1","chapter":"C4","name":"Hệ thống điện chiếu sáng","unit":"HT","qty_contract":1,"unit_price":1850000000,"qty_done":0,"qty_plan_current":0},
    {"id":"c4-2","code":"C4.2","chapter":"C4","name":"Hệ thống cấp thoát nước","unit":"HT","qty_contract":1,"unit_price":1200000000,"qty_done":0,"qty_plan_current":0},
    {"id":"c4-3","code":"C4.3","chapter":"C4","name":"Hệ thống PCCC","unit":"HT","qty_contract":1,"unit_price":980000000,"qty_done":0,"qty_plan_current":0},
    {"id":"c4-4","code":"C4.4","chapter":"C4","name":"Thang máy 8 người (2 cabin)","unit":"Cái","qty_contract":2,"unit_price":650000000,"qty_done":0,"qty_plan_current":0}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 3. QS — Thanh toán, nghiệm thu, nhà thầu phụ
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'qs_items',
  '[
    {"id":"c1-1","code":"C1.1","chapter":"C1","name":"Cọc BTCT D400 L=20m","unit":"m","qty_contract":4800,"unit_price":420000,"qty_done":4800,"qty_plan_current":4800},
    {"id":"c1-3","code":"C1.3","chapter":"C1","name":"Đài móng M1 BTCT 250#","unit":"m³","qty_contract":336,"unit_price":3800000,"qty_done":336,"qty_plan_current":336},
    {"id":"c2-1","code":"C2.1","chapter":"C2","name":"Cột BTCT 300# T1-T5","unit":"m³","qty_contract":420,"unit_price":4200000,"qty_done":210,"qty_plan_current":280},
    {"id":"c2-2","code":"C2.2","chapter":"C2","name":"Dầm sàn BTCT 250# T1-T5","unit":"m³","qty_contract":680,"unit_price":3900000,"qty_done":340,"qty_plan_current":408},
    {"id":"c2-3","code":"C2.3","chapter":"C2","name":"Sàn BTCT 250# T1-T5","unit":"m³","qty_contract":1250,"unit_price":3750000,"qty_done":500,"qty_plan_current":625}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'qs_acceptance',
  '[
    {"id":"a1","lot_no":"NT-001","date":"15/01/2026","status":"approved","submitted_by":"Phạm Văn D","approved_by":"Trần Văn B","note":"Nghiệm thu toàn bộ phần ngầm — móng M1 đến M12","total_value":6487770000,"items":[{"boq_id":"c1-1","qty":4800},{"boq_id":"c1-3","qty":336}]},
    {"id":"a2","lot_no":"NT-002","date":"20/02/2026","status":"approved","submitted_by":"Phạm Văn D","approved_by":"Trần Văn B","note":"Nghiệm thu cột, dầm, sàn tầng 1-2","total_value":2532900000,"items":[{"boq_id":"c2-1","qty":84},{"boq_id":"c2-2","qty":136},{"boq_id":"c2-3","qty":200}]},
    {"id":"a3","lot_no":"NT-003","date":"07/03/2026","status":"submitted","submitted_by":"Phạm Văn D","note":"Nghiệm thu cột, dầm, sàn tầng 3-5 (đợt 1)","total_value":5188200000,"items":[{"boq_id":"c2-1","qty":126},{"boq_id":"c2-2","qty":204},{"boq_id":"c2-3","qty":300}]}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'qs_payments',
  '[
    {"id":"p1","request_no":"TT-001","date":"20/01/2026","period":"Tháng 01/2026","lot_ids":["a1"],"subtotal":6487770000,"vat":648777000,"total":7136547000,"advance_deduct":500000000,"net_payable":6636547000,"status":"paid","note":"Thanh toán đợt 1 — phần ngầm"},
    {"id":"p2","request_no":"TT-002","date":"25/02/2026","period":"Tháng 02/2026","lot_ids":["a2"],"subtotal":2532900000,"vat":253290000,"total":2786190000,"advance_deduct":300000000,"net_payable":2486190000,"status":"approved","note":"Thanh toán đợt 2 — thân T1-T2"},
    {"id":"p3","request_no":"TT-003","date":"08/03/2026","period":"Tháng 03/2026","lot_ids":["a3"],"subtotal":5188200000,"vat":518820000,"total":5707020000,"advance_deduct":300000000,"net_payable":5407020000,"status":"draft","note":"Thanh toán đợt 3 — thân T3-T5 (đợt 1)"}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'qs_subs',
  '[
    {"id":"s1","code":"NTP-001","name":"Công ty TNHH Nền móng Việt","type":"subcontractor","scope":"Thi công cọc khoan nhồi D400, đài móng, giằng móng","contract_value":4200000000,"contract_no":"HĐP-2025/01","start_date":"10/01/2026","end_date":"20/02/2026","pay_mechanism":"progress","retention_pct":5,"advance_paid":420000000,"contact":"Ông Nguyễn Bá Thành — 0901 234 567","bank_account":"VCB - 0071004123456"},
    {"id":"s2","code":"NTP-002","name":"Đội thợ nề - Trần Văn Hùng","type":"team","scope":"Xây tường, trát, ốp lát toàn bộ dự án","contract_value":2850000000,"contract_no":"HĐK-2025/02","start_date":"15/02/2026","end_date":"30/09/2026","pay_mechanism":"unit_rate","retention_pct":3,"advance_paid":200000000,"contact":"Trần Văn Hùng — 0912 345 678"},
    {"id":"s3","code":"NTP-003","name":"Công ty CP Điện lạnh Á Đông","type":"subcontractor","scope":"Hệ thống điện chiếu sáng, điều hòa không khí","contract_value":3650000000,"contract_no":"HĐP-2025/03","start_date":"01/04/2026","end_date":"30/10/2026","pay_mechanism":"lump_sum","retention_pct":5,"advance_paid":365000000,"contact":"Bà Lê Thị Mai — 0908 765 432","bank_account":"TCB - 19032847561023"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4. QA/QC — Checklists, NCR, Phản hồi
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'qa_checklists',
  '[
    {"id":1,"name":"Nghiệm thu cốt thép móng M1","status":"Hoàn thành","progress":100,"date":"01/03/2026","docType":"ITP","location":"Khu A - Trục 1-3"},
    {"id":2,"name":"Nghiệm thu ván khuôn sàn tầng 2","status":"Hoàn thành","progress":100,"date":"05/03/2026","docType":"ITP","location":"Tầng 2 - Block B"},
    {"id":3,"name":"Kiểm tra vật liệu thép CB300","status":"Hoàn thành","progress":100,"date":"28/02/2026","docType":"MIR","location":"Bãi tập kết vật tư"},
    {"id":4,"name":"Nghiệm thu cốt thép sàn tầng 5","status":"Đang tiến hành","progress":60,"date":"07/03/2026","docType":"ITP","location":"Tầng 5 - Toàn bộ"},
    {"id":5,"name":"Kiểm tra an toàn hệ giàn giáo","status":"Đang tiến hành","progress":40,"date":"08/03/2026","docType":"HSE","location":"Mặt ngoài Tầng 3-5"},
    {"id":6,"name":"Nghiệm thu xây tường phân khu A","status":"Chưa bắt đầu","progress":0,"date":"10/03/2026","docType":"ITP","location":"Phân khu A"}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'qa_defects',
  '[
    {"id":"NCR-001","title":"Rỗ tổ ong bề mặt cột C1","severity":"Cao","status":"Đang xử lý","reportedBy":"Lê Thị C","date":"01/03/2026","location":"Cột C1 - Tầng 3","deadline":"08/03/2026"},
    {"id":"NCR-002","title":"Sai lệch kích thước ván khuôn dầm D3","severity":"Trung bình","status":"Chờ duyệt","reportedBy":"Trần Văn B","date":"28/02/2026","location":"Dầm D3 - Tầng 2","deadline":"10/03/2026"},
    {"id":"NCR-003","title":"Thép sàn thiếu lớp bảo vệ (con kê)","severity":"Cao","status":"Đã khắc phục","reportedBy":"Đặng Văn G","date":"25/02/2026","location":"Sàn tầng 2 - Khu B","deadline":"05/03/2026"},
    {"id":"NCR-004","title":"Đường hàn cột thép không đều","severity":"Thấp","status":"Đã khắc phục","reportedBy":"Lê Thị C","date":"20/02/2026","location":"Cột thép - Tầng 1","deadline":"01/03/2026"},
    {"id":"NCR-005","title":"Bê tông lót móng thiếu chiều dày","severity":"Trung bình","status":"Chờ duyệt","reportedBy":"Bùi Thị H","date":"03/03/2026","location":"Móng M5 - Khu C","deadline":"12/03/2026"}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'qa_feedbacks',
  '[
    {"id":1,"sender":"Chủ đầu tư","type":"Khiếu nại","content":"Tiến độ hoàn thiện tầng 5 chậm hơn kế hoạch 2 ngày.","priority":"Cao","status":"Chờ phản hồi","reply":"","replyDate":""},
    {"id":2,"sender":"TVGS","type":"Kiến nghị","content":"Cần bổ sung thêm 2 máy trắc đạc cho khu vực tháp B.","priority":"Trung bình","status":"Đã trả lời","reply":"Đã điều động 02 máy từ đội khảo sát số 1 vào sáng 06/03.","replyDate":"06/03/2026"},
    {"id":3,"sender":"Tổ đội","type":"Báo cáo","content":"Hệ thống điện thi công khu B bị chập, cần kiểm tra lại.","priority":"Cao","status":"Chờ phản hồi","reply":"","replyDate":""}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 5. HR — Nhân viên, hợp đồng, nghỉ phép, đánh giá
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hr_employees',
  '[
    {"id":"e1","full_name":"Nguyễn Văn Anh","position":"Chỉ huy trưởng","department":"Ban Chỉ huy","cccd":"079087001234","phone":"0901234567","email":"nvanh@villapat.vn","address":"Q.7, TP.HCM","dob":"15/05/1982","join_date":"01/01/2026","status":"active","bhxh":"7901234567890","bhyt":"HCM-0012345","avatar_initial":"VA","salary_base":25000,"allowance":5000},
    {"id":"e2","full_name":"Trần Thị Bích","position":"Kế toán dự án","department":"Tài chính","cccd":"079092005678","phone":"0912345678","email":"ttbich@villapat.vn","address":"Q.Bình Thạnh, TP.HCM","dob":"22/08/1992","join_date":"01/01/2026","status":"active","bhxh":"7902345678901","bhyt":"HCM-0023456","avatar_initial":"TB","salary_base":18000,"allowance":2000},
    {"id":"e3","full_name":"Lê Thanh Tùng","position":"Kỹ sư HSE","department":"An toàn","cccd":"079095007890","phone":"0923456789","email":"lttung@villapat.vn","address":"Q.Tân Bình, TP.HCM","dob":"10/11/1995","join_date":"15/01/2026","status":"active","bhxh":"7903456789012","bhyt":"HCM-0034567","avatar_initial":"LT","salary_base":16000,"allowance":3000},
    {"id":"e4","full_name":"Phạm Minh Quân","position":"Kỹ sư Giám sát","department":"Kỹ thuật","cccd":"079090009012","phone":"0934567890","email":"pmquan@villapat.vn","address":"Q.12, TP.HCM","dob":"03/03/1990","join_date":"01/01/2026","status":"active","bhxh":"7904567890123","bhyt":"HCM-0045678","avatar_initial":"MQ","salary_base":17000,"allowance":2500},
    {"id":"e5","full_name":"Hoàng Thị Mai","position":"Thư ký dự án","department":"Hành chính","cccd":"079098001234","phone":"0945678901","email":"htmai@villapat.vn","address":"Q.3, TP.HCM","dob":"17/06/1998","join_date":"01/02/2026","status":"probation","bhxh":"","bhyt":"","avatar_initial":"HM","salary_base":10000,"allowance":1000}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hr_contracts',
  '[
    {"id":"lc1","emp_id":"e1","type":"khong_xac_dinh","code":"HĐLĐ-2026-001","signed_date":"01/01/2026","start_date":"01/01/2026","end_date":"","salary":25000,"allowance":5000,"notes":"Hợp đồng lao động không xác định thời hạn","status":"active"},
    {"id":"lc2","emp_id":"e2","type":"xac_dinh","code":"HĐLĐ-2026-002","signed_date":"01/01/2026","start_date":"01/01/2026","end_date":"31/12/2026","salary":18000,"allowance":2000,"notes":"Hợp đồng 1 năm theo dự án","status":"active"},
    {"id":"lc3","emp_id":"e3","type":"xac_dinh","code":"HĐLĐ-2026-003","signed_date":"15/01/2026","start_date":"15/01/2026","end_date":"14/07/2026","salary":16000,"allowance":3000,"notes":"Hợp đồng 6 tháng, xem xét gia hạn","status":"active"},
    {"id":"lc4","emp_id":"e4","type":"xac_dinh","code":"HĐLĐ-2026-004","signed_date":"01/01/2026","start_date":"01/01/2026","end_date":"31/12/2026","salary":17000,"allowance":2500,"notes":"","status":"active"},
    {"id":"lc5","emp_id":"e5","type":"thu_viec","code":"HĐTV-2026-005","signed_date":"01/02/2026","start_date":"01/02/2026","end_date":"30/04/2026","salary":10000,"allowance":1000,"notes":"Thử việc 3 tháng","status":"active"}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hr_leaves',
  '[
    {"id":"lv1","emp_id":"e1","type":"annual","from_date":"10/03/2026","to_date":"12/03/2026","days":3,"reason":"Nghỉ phép năm","status":"approved","approver":"Ban Giám đốc"},
    {"id":"lv2","emp_id":"e3","type":"sick","from_date":"05/03/2026","to_date":"06/03/2026","days":2,"reason":"Ốm sốt","status":"approved","approver":"CHT"},
    {"id":"lv3","emp_id":"e5","type":"personal","from_date":"15/03/2026","to_date":"15/03/2026","days":1,"reason":"Việc gia đình","status":"pending","approver":""}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hr_evaluations',
  '[
    {"id":"ev1","emp_id":"e1","period":"Q1/2026","scores":{"attitude":5,"skill":5,"result":4,"teamwork":5,"initiative":4},"total":4.6,"comment":"Chỉ huy trưởng có kinh nghiệm, lãnh đạo tốt. Cần cải thiện báo cáo tiến độ đúng hạn hơn.","evaluator":"GĐ Nguyễn Tuấn Anh"},
    {"id":"ev2","emp_id":"e2","period":"Q1/2026","scores":{"attitude":5,"skill":4,"result":5,"teamwork":4,"initiative":3},"total":4.2,"comment":"Kế toán chính xác, đáng tin cậy. Nên chủ động hơn trong việc phát hiện vấn đề.","evaluator":"GĐ Nguyễn Tuấn Anh"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. EQUIPMENT — Bảo dưỡng thiết bị
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'eq_maintenance',
  '[
    {"id":"MT001","equipId":"EQ005","type":"Khẩn cấp","desc":"Kiểm tra bơm thủy lực — sắp hết giờ bảo dưỡng","scheduledDate":"02/03/2026","status":"overdue","cost":0,"provider":"","technician":""},
    {"id":"MT002","equipId":"EQ001","type":"Định kỳ","desc":"Thay dầu máy + lọc dầu, kiểm tra hệ thống phanh","scheduledDate":"15/03/2026","status":"scheduled","cost":0,"provider":"Đại lý Komatsu HCM","technician":"KTV Minh"},
    {"id":"MT003","equipId":"EQ003","type":"Sửa chữa","desc":"Sửa hệ thống thủy lực — rò rỉ dầu cylinder trái","scheduledDate":"01/03/2026","status":"in_progress","cost":12500000,"provider":"CAT Service","technician":"KTV Đức"},
    {"id":"MT004","equipId":"EQ002","type":"Định kỳ","desc":"Kiểm tra cáp cẩu + hệ thống phanh điện từ","scheduledDate":"20/03/2026","status":"scheduled","cost":0,"provider":"Liebherr Vietnam","technician":""},
    {"id":"MT005","equipId":"EQ006","type":"Định kỳ","desc":"Thay dầu máy, kiểm tra xích máy đào","scheduledDate":"18/04/2026","status":"scheduled","cost":0,"provider":"Đại lý Komatsu HCM","technician":""}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. RISK — Sổ rủi ro
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'risk_register',
  '[
    {"id":"r1","code":"R-001","title":"Trễ bàn giao mặt bằng tầng hầm","description":"Thi công tầng hầm bị chậm do địa chất phức tạp hơn dự kiến","category":"schedule","likelihood":4,"impact":4,"owner":"CHT Trần Văn B","mitigation":"Tăng ca, bổ sung thiết bị đào","contingency":"EOT + phạt NTP theo HĐ","status":"mitigating","created_at":"01/03/2026","due_date":"30/04/2026","residual_likelihood":2,"residual_impact":3},
    {"id":"r2","code":"R-002","title":"Biến động giá thép","description":"Giá thép tăng >15% so với dự toán gốc","category":"financial","likelihood":3,"impact":4,"owner":"QS Tuấn","mitigation":"Lock giá với NCC trước 3 tháng","contingency":"Điều chỉnh HĐ theo Phụ lục giá","status":"open","created_at":"15/02/2026","due_date":"15/04/2026","residual_likelihood":2,"residual_impact":2},
    {"id":"r3","code":"R-003","title":"Chứng chỉ an toàn nhân công hết hạn","description":"12 công nhân tổ sắt chứng chỉ an toàn hết hạn trước khi hoàn thành tầng 3","category":"safety","likelihood":4,"impact":3,"owner":"HSE Hải","mitigation":"Lên lịch huấn luyện lại tháng 3","contingency":"Tạm ngừng công việc trên cao cho nhóm này","status":"mitigating","created_at":"10/03/2026","due_date":"20/03/2026"},
    {"id":"r4","code":"R-004","title":"Thay đổi thiết kế M&E từ CĐT","description":"CĐT đang xem xét thay đổi hệ thống điều hòa tầng 4-5","category":"technical","likelihood":2,"impact":3,"owner":"KS M&E Phạm","mitigation":"Freeze design review trước 31/03","contingency":"Variation order + điều chỉnh tiến độ","status":"open","created_at":"05/03/2026"},
    {"id":"r5","code":"R-005","title":"Trễ phê duyệt hồ sơ pháp lý","description":"Xin phép xây dựng bổ sung tầng mái chưa được duyệt","category":"legal","likelihood":2,"impact":5,"owner":"GĐ DA","mitigation":"Nộp hồ sơ bổ sung, thuê tư vấn pháp lý","contingency":"Dừng thi công mái nếu không có phép","status":"open","created_at":"01/03/2026","due_date":"01/05/2026"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. PROCUREMENT — Mua hàng, nhà cung cấp, PO
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'procurement_suppliers',
  '[
    {"id":"sup1","name":"Thép Hòa Phát","category":["vat_lieu"],"contact":"Nguyễn Văn Tâm — 0901 111 222","email":"tamhp@hoaphatsgroup.vn","address":"KCN Phú Mỹ 1, BR-VT","rating":5,"notes":"NCC thép chính — uy tín, giao đúng hạn","bank_account":"VCB - 0071001234567"},
    {"id":"sup2","name":"Xi măng Hà Tiên","category":["vat_lieu"],"contact":"Hoàng Văn Em — 0912 222 333","email":"hve@hatiencement.vn","address":"Kiên Giang","rating":4,"notes":"Giao hàng theo lịch tuần — đặt trước 3 ngày"},
    {"id":"sup3","name":"Cát Sông Đồng Nai","category":["vat_lieu"],"contact":"Trần Văn Sông — 0923 333 444","email":"","address":"Đồng Nai","rating":3,"notes":"Chất lượng ổn định, giao không đều"},
    {"id":"sup4","name":"Liebherr Vietnam","category":["thiet_bi"],"contact":"Phạm Đức Linh — 0934 444 555","email":"pdulinh@liebherr.com","address":"KCN Long Bình, Đồng Nai","rating":5,"notes":"Bảo trì cẩu tháp EC180 — hợp đồng bảo dưỡng định kỳ"}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'procurement_rfqs',
  '[
    {"id":"rfq1","code":"RFQ-2026-001","title":"Thép CB300-V đợt 4","category":"vat_lieu","items":[{"description":"Thép CB300-V D16-D25","unit":"Tấn","qty":80}],"deadline":"15/03/2026","status":"quoted","note":"Cần giao trước 25/03 để kịp thi công tầng 6","project_id":""},
    {"id":"rfq2","code":"RFQ-2026-002","title":"Xi măng PC40 đợt 6","category":"vat_lieu","items":[{"description":"Xi măng PC40 bao 50kg","unit":"Tấn","qty":150}],"deadline":"18/03/2026","status":"open","note":"Ưu tiên nhà cung cấp Hà Tiên","project_id":""},
    {"id":"rfq3","code":"RFQ-2026-003","title":"Thuê máy bơm bê tông thay thế","category":"thiet_bi","items":[{"description":"Máy bơm bê tông 80m³/h","unit":"Ca","qty":30}],"deadline":"12/03/2026","status":"awarded","note":"EQ005 đang bảo trì — cần thuê gấp","project_id":""}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'procurement_pos',
  '[
    {"id":"po1","code":"PO-2026-001","rfq_id":"rfq1","supplier_id":"sup1","supplier_name":"Thép Hòa Phát","items":[{"description":"Thép CB300-V D16-D25","unit":"Tấn","qty":80,"unit_price":15200000,"total":1216000000}],"total":1216000000,"vat_pct":10,"grand_total":1337600000,"delivery_date":"24/03/2026","status":"approved","note":"Đã có đủ chứng từ phê duyệt"},
    {"id":"po2","code":"PO-2026-002","rfq_id":"rfq3","supplier_id":"","supplier_name":"Pumping Services VN","items":[{"description":"Thuê máy bơm bê tông 80m³/h","unit":"Ca","qty":30,"unit_price":4500000,"total":135000000}],"total":135000000,"vat_pct":10,"grand_total":148500000,"delivery_date":"13/03/2026","status":"draft","note":"Chờ phê duyệt GĐ DA"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 9. GIÁM SÁT — Nhật ký + RFI
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'gs_logs',
  '[
    {"id":"gl1","date":"07/03/2026","shift":"Ca sáng","weather":"Nắng","temp":32,"humidity":75,"reporter":"KS Giám sát Hoàng","works_done":["Đổ BT sàn tầng 3 khu A — 120m³, đạt 95% kế hoạch","Lắp ván khuôn dầm tầng 4 trục B-C — hoàn thành","Kiểm tra nghiệm thu cốt thép tầng 5 — đạt yêu cầu"],"issues":["Máy bơm BT bị trục trặc 30 phút ca chiều"],"manpower":{"total":85,"nt_chinh":12,"nt_phu":{"Phúc Thành":28,"Thiên Long":35,"Minh Khoa":10}},"equipment_active":["EQ001","EQ002","EQ005","EQ006"],"safety_status":"OK","photos_count":8},
    {"id":"gl2","date":"06/03/2026","shift":"Cả ngày","weather":"Nắng nhẹ","temp":30,"humidity":70,"reporter":"KS Giám sát Hoàng","works_done":["Cốt thép cột tầng 5 block B — 8 cột hoàn thành","Cẩu thép lên tầng 5 — 12 tấn","Nghiệm thu cốt thép dầm tầng 3 — GĐ phê duyệt"],"issues":[],"manpower":{"total":90,"nt_chinh":12,"nt_phu":{"Phúc Thành":30,"Thiên Long":38,"Minh Khoa":10}},"equipment_active":["EQ001","EQ002","EQ006"],"safety_status":"OK","photos_count":6}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'gs_rfi',
  '[
    {"id":"rfi1","rfi_no":"GS-RFI-001","date":"06/03/2026","subject":"Xác nhận cao độ đặt cống thoát nước khu C","from":"KS Giám sát Hoàng","to":"TVGS Alpha","priority":"normal","status":"open","description":"Bản vẽ thoát nước khu C chưa ghi rõ cao độ đặt cống D400. Đề nghị xác nhận cao độ -1.200 hay -1.500 so với cốt ±0.000.","response":"","deadline":"13/03/2026"},
    {"id":"rfi2","rfi_no":"GS-RFI-002","date":"04/03/2026","subject":"Làm rõ quy cách bu lông neo móng thang máy","from":"KS Giám sát Hoàng","to":"TVGS Alpha","priority":"urgent","status":"answered","description":"Bản vẽ móng thang máy (TM-001) không ghi rõ quy cách bu lông neo. Cần xác nhận M24 hay M30, cấp bền 8.8.","response":"Bu lông neo M30, cấp bền 8.8, L=600mm. Xem chi tiết TM-001 Rev A đính kèm.","deadline":"11/03/2026","answered_date":"07/03/2026"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 10. ACCOUNTING — Công nợ
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'acc_debts',
  '[
    {"id":"d1","partner":"CĐT Hoàng Long","type":"receivable","amount":7136547000,"due_date":"28/02/2026","status":"overdue","invoice_no":"TT-001","days_overdue":18,"notes":"Thanh toán đợt 1 — đã gửi nhắc nhở lần 2"},
    {"id":"d2","partner":"Thép Hòa Phát","type":"payable","amount":1337600000,"due_date":"24/03/2026","status":"pending","invoice_no":"PO-2026-001","days_overdue":0,"notes":"PO thép đợt 4 — chưa đến hạn"},
    {"id":"d3","partner":"NTP Phúc Thành","type":"payable","amount":2550000000,"due_date":"15/03/2026","status":"pending","invoice_no":"TT-NTP-002","days_overdue":0,"notes":"Thanh toán đợt 2 NTP sắt thép"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- 11. HSE PTW + Toolbox Talk
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hse_ptws',
  '[
    {"id":"ptw1","permit_no":"PTW-2026-001","type":"hot_work","title":"Hàn cốt thép tầng 5 khu B","location":"Tầng 5 — Block B","work_date":"10/03/2026","valid_from":"07:00","valid_to":"17:00","applicant":"Đội trưởng Sắt Phan Văn Đức","supervisor":"KS Giám sát Hoàng","hazards":["Tia lửa hàn","Khí độc","Bỏng"],"precautions":["Màn chắn tia lửa","Bình CO2 dự phòng","PPE đầy đủ","Thông gió khu vực"],"status":"approved","approver":"HSE Officer Lê Thanh Tùng"},
    {"id":"ptw2","permit_no":"PTW-2026-002","type":"confined_space","title":"Vệ sinh bể nước tầng hầm","location":"Tầng hầm B2 — Bể nước","work_date":"12/03/2026","valid_from":"08:00","valid_to":"12:00","applicant":"Đội MEP Thiên Long","supervisor":"KS M&E Phạm","hazards":["Thiếu oxy","Khí H2S","Ngã ngã"],"precautions":["Đo khí O2 trước khi vào","Dây an toàn","Người giám sát bên ngoài liên tục","Liên lạc radio 15 phút/lần"],"status":"pending","approver":""}
  ]'::jsonb
);

INSERT INTO public.project_data (project_id, collection, payload) VALUES (
  'p1', 'hse_toolbox',
  '[
    {"id":"tb1","date":"07/03/2026","time":"06:45","topic":"An toàn khi làm việc trên cao tầng 5","conductor":"HSE Officer Lê Thanh Tùng","location":"Khu vực tập kết tầng 5","attendees_count":28,"duration_min":15,"key_points":["Kiểm tra dây an toàn trước khi lên cao","Không để dụng cụ gần mép sàn","Báo hiệu khi di chuyển vật nặng"],"status":"completed"},
    {"id":"tb2","date":"06/03/2026","time":"06:45","topic":"Sử dụng máy hàn an toàn","conductor":"HSE Officer Lê Thanh Tùng","location":"Khu vực thi công Block B","attendees_count":15,"duration_min":15,"key_points":["Kiểm tra dây điện máy hàn","Màn chắn tia lửa bắt buộc","Không hàn gần vật liệu dễ cháy"],"status":"completed"}
  ]'::jsonb
);

-- ════════════════════════════════════════════════════════════════════════════
-- Verify kết quả
-- ════════════════════════════════════════════════════════════════════════════
SELECT
  pd.collection,
  jsonb_array_length(pd.payload) AS records,
  LEFT(p.name, 25) AS project
FROM public.project_data pd
LEFT JOIN public.projects p ON p.id = pd.project_id
WHERE pd.collection IN (
  'progress_wbs','progress_milestones',
  'boq_items','qs_items','qs_acceptance','qs_payments','qs_subs',
  'qa_checklists','qa_defects','qa_feedbacks',
  'hr_employees','hr_contracts','hr_leaves','hr_evaluations',
  'eq_maintenance','risk_register',
  'procurement_rfqs','procurement_pos','procurement_suppliers',
  'gs_logs','gs_rfi','acc_debts',
  'hse_ptws','hse_toolbox'
)
ORDER BY pd.collection;

