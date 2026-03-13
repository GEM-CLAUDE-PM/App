export const mockProjects = [
  {
    id: 'p1', name: 'Chung cư Sunrise Tower', type: 'in_progress', status: 'Đang thi công móng',
    progress: 35, budget: '120 Tỷ', update: 'Hôm nay',
    startDate: '2026-01-01', endDate: '2027-12-31',
    address: '123 Đường ABC, Quận 1, TP.HCM',
    templateId: 'chung_cu_cao_tang',
    spi: 0.94, ncr: 4, hse: 1, ntp_pending: 2,
  },
  {
    id: 'p2', name: 'KĐT Gamma Riverside', type: 'in_progress', status: 'Hoàn thiện nội thất',
    progress: 88, budget: '450 Tỷ', update: 'Hôm qua',
    startDate: '2025-05-15', endDate: '2026-06-30',
    address: '456 Đường DEF, Quận 2, TP.HCM',
    templateId: 'dan_dung_thuong_mai',
    spi: 0.97, ncr: 0, hse: 0, ntp_pending: 3,
  },
  {
    id: 'p3', name: 'Tòa nhà Delta Office', type: 'in_progress', status: 'Đổ bê tông tầng 5',
    progress: 20, budget: '80 Tỷ', update: '2 ngày trước',
    startDate: '2026-02-10', endDate: '2026-10-10',
    address: '789 Đường GHI, Quận 3, TP.HCM',
    templateId: 'dan_dung_thuong_mai',
    spi: 0.71, ncr: 2, hse: 1, ntp_pending: 1,
  },
  {
    id: 'p4', name: 'Dự án Đường vành đai Beta', type: 'potential', status: 'Đang thương thảo HĐ',
    progress: 0, budget: '200 Tỷ', update: 'Hôm nay',
    startDate: '2026-06-01', endDate: '2028-06-01',
    address: '101 Đường JKL, Quận 4, TP.HCM',
    templateId: 'ha_tang_ky_thuat',
    spi: null, ncr: 0, hse: 0, ntp_pending: 0,
  },
  {
    id: 'p5', name: 'Khu nghỉ dưỡng Epsilon', type: 'potential', status: 'Đang lập báo giá',
    progress: 0, budget: '150 Tỷ', update: '3 ngày trước',
    startDate: '2026-08-15', endDate: '2028-08-15',
    address: '202 Đường MNO, Quận 5, TP.HCM',
    templateId: 'nha_o_dan_dung',
    spi: null, ncr: 0, hse: 0, ntp_pending: 0,
  },
  {
    id: 'p6', name: 'Nhà máy Omega KCN Bình Dương', type: 'completed', status: 'Đang quyết toán',
    progress: 100, budget: '300 Tỷ', update: '1 tuần trước',
    startDate: '2024-01-01', endDate: '2025-12-31',
    address: '303 Đường PQR, KCN Sóng Thần, Bình Dương',
    templateId: 'cong_nghiep_nha_xuong',
    spi: 1.02, ncr: 0, hse: 0, ntp_pending: 0,
  },
  {
    id: 'p7', name: 'Cải tạo Văn phòng Sigma HQ', type: 'completed', status: 'Đã bàn giao',
    progress: 100, budget: '8 Tỷ', update: '1 tháng trước',
    startDate: '2025-09-15', endDate: '2026-01-15',
    address: '404 Đường STU, Quận 7, TP.HCM',
    templateId: 'cai_tao_noi_that',
    spi: 0.99, ncr: 0, hse: 0, ntp_pending: 0,
  },
];

// ── Template seed helper — gọi khi ProjectDashboard mount ─────────────────────
// Mỗi project trong mockProjects có templateId → lưu vào localStorage để
// ProgressDashboard, QaQcDashboard, GemAIDashboard đọc được
export function seedProjectTemplates(): void {
  mockProjects.forEach(p => {
    if (p.templateId) {
      const key = `gem_project_template_${p.id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, p.templateId);
      }
    }
  });
}

// ── Dòng tiền từng dự án (ProjectDashboard) ───────────────────────────────────
export const mockCashFlowData = [
  { month: 'T1', thu: 1200, chi: 800 },
  { month: 'T2', thu: 1900, chi: 1500 },
  { month: 'T3', thu: 3000, chi: 2100 },
  { month: 'T4', thu: 2500, chi: 2800 },
  { month: 'T5', thu: 4200, chi: 3000 },
  { month: 'T6', thu: 5000, chi: 3500 },
];

// ── Dòng tiền portfolio tổng hợp (Dashboard tổng quan) ───────────────────────
export const mockPortfolioCashFlow = [
  { month: 'T9',  thu: 42.5, chi: 38.2, ton: 4.3  },
  { month: 'T10', thu: 55.1, chi: 49.8, ton: 5.3  },
  { month: 'T11', thu: 48.3, chi: 52.1, ton: -3.8 },
  { month: 'T12', thu: 63.7, chi: 58.4, ton: 5.3  },
  { month: 'T1',  thu: 71.2, chi: 65.5, ton: 5.7  },
  { month: 'T2',  thu: 58.4, chi: 53.1, ton: 5.3  },
  { month: 'T3',  thu: 68.9, chi: 61.2, ton: 7.7  },
];

export const mockMaterialData = [
  { name: 'Thép CB300',    unit: 'Tấn',      tonKho: 50,  suDung: 120, nhap: 170, dinhMuc: 200, donGia: '15,000,000',  thanhTien: '2,550,000,000', threshold: 60  },
  { name: 'Xi măng PC40', unit: 'Tấn',      tonKho: 200, suDung: 500, nhap: 700, dinhMuc: 800, donGia: '1,800,000',   thanhTien: '1,260,000,000', threshold: 100 },
  { name: 'Cát vàng',     unit: 'm3',       tonKho: 150, suDung: 300, nhap: 450, dinhMuc: 500, donGia: '350,000',     thanhTien: '157,500,000',   threshold: 100 },
  { name: 'Gạch đặc',     unit: '1000 Viên',tonKho: 80,  suDung: 250, nhap: 330, dinhMuc: 400, donGia: '1,200,000',  thanhTien: '396,000,000',   threshold: 50  },
  { name: 'Đá 1x2',       unit: 'm3',       tonKho: 120, suDung: 400, nhap: 520, dinhMuc: 600, donGia: '450,000',    thanhTien: '234,000,000',   threshold: 80  },
];

export const mockLaborData = [
  { name: 'Thợ nề',  value: 45 },
  { name: 'Thợ sắt', value: 20 },
  { name: 'Cốp pha', value: 30 },
  { name: 'M&E',     value: 15 },
];

export const mockOrgData = [
  { id: '1',  name: 'Nguyễn Văn A',   role: 'Giám đốc Dự án',     dob: '15/05/1980', degree: 'Thạc sĩ Quản lý Dự án',         tasks: 'Điều hành chung toàn bộ dự án, chịu trách nhiệm trước CĐT.',  kpi: 95, achievements: 'Hoàn thành vượt tiến độ 3 dự án cấp A.',          avatar: 'https://picsum.photos/seed/nva/100/100' },
  { id: '2',  name: 'Trần Văn B',     role: 'Chỉ huy trưởng',     parentId: '1', dob: '20/08/1985', degree: 'Kỹ sư Xây dựng Dân dụng',      tasks: 'Điều hành thi công trực tiếp tại công trường.',               kpi: 92, achievements: 'Không để xảy ra tai nạn lao động trong 5 năm.',    avatar: 'https://picsum.photos/seed/tvb/100/100' },
  { id: '3',  name: 'Lê Thị C',       role: 'Kỹ thuật (QA/QC)',   parentId: '2', dob: '10/12/1990', degree: 'Kỹ sư Xây dựng',               tasks: 'Kiểm tra chất lượng, nghiệm thu công việc.',                  kpi: 88, achievements: 'Phát hiện và xử lý kịp thời 15 lỗi kỹ thuật.',    avatar: 'https://picsum.photos/seed/ltc/100/100' },
  { id: '4',  name: 'Phạm Văn D',     role: 'Khối lượng (QS)',    parentId: '2', dob: '05/04/1992', degree: 'Kỹ sư Kinh tế Xây dựng',       tasks: 'Lập hồ sơ thanh quyết toán, kiểm soát khối lượng.',          kpi: 90, achievements: 'Tiết kiệm 5% chi phí vật tư.',                    avatar: 'https://picsum.photos/seed/pvd/100/100' },
  { id: '5',  name: 'Hoàng Thị E',    role: 'Vật tư / Kho',       parentId: '2', dob: '22/11/1988', degree: 'Cử nhân Kế toán',               tasks: 'Quản lý nhập xuất tồn vật tư thiết bị.',                     kpi: 85, achievements: 'Không để thất thoát vật tư trong 2 năm.',         avatar: 'https://picsum.photos/seed/hte/100/100' },
  { id: '6',  name: 'Vũ Văn F',       role: 'An toàn (HSE)',      parentId: '2', dob: '30/01/1987', degree: 'Kỹ sư Bảo hộ Lao động',         tasks: 'Giám sát an toàn, huấn luyện công nhân.',                    kpi: 96, achievements: 'Đạt chứng chỉ HSE quốc tế NEBOSH.',              avatar: 'https://picsum.photos/seed/vvf/100/100' },
  { id: '7',  name: 'Đặng Văn G',     role: 'Giám sát QA',        parentId: '3', dob: '12/03/1995', degree: 'Kỹ sư Xây dựng',               tasks: 'Giám sát chất lượng hiện trường',                             kpi: 85, achievements: 'Hoàn thành tốt nhiệm vụ',                        avatar: 'https://picsum.photos/seed/dvg/100/100' },
  { id: '8',  name: 'Bùi Thị H',      role: 'Giám sát QC',        parentId: '3', dob: '25/07/1996', degree: 'Kỹ sư Xây dựng',               tasks: 'Kiểm tra vật liệu đầu vào',                                  kpi: 89, achievements: 'Phát hiện lô thép không đạt chuẩn',              avatar: 'https://picsum.photos/seed/bth/100/100' },
  { id: '9',  name: 'Ngô Văn I',      role: 'Nhân viên QS',       parentId: '4', dob: '08/09/1997', degree: 'Cử nhân Kinh tế',               tasks: 'Đo bóc khối lượng',                                          kpi: 82, achievements: 'Hoàn thành đúng hạn',                           avatar: 'https://picsum.photos/seed/nvi/100/100' },
  { id: '10', name: 'Đỗ Văn K',       role: 'Giám sát An toàn',   parentId: '6', dob: '14/02/1994', degree: 'Cao đẳng Bảo hộ Lao động',      tasks: 'Tuần tra an toàn',                                           kpi: 88, achievements: 'Nhắc nhở 50 trường hợp vi phạm',               avatar: 'https://picsum.photos/seed/dvk/100/100' },
];

export const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];

export const mockAttendancePayrollData = [
  { id: '1',  name: 'Nguyễn Văn A',   role: 'Giám đốc Dự án',   days: 26, overtime: 10, status: 'Đủ công',      baseSalary: 45000000, allowance: 5000000, bonus: 2000000, tax: 4500000, net: 47500000, category: 'management' },
  { id: '2',  name: 'Trần Văn B',     role: 'Chỉ huy trưởng',   days: 25, overtime: 15, status: 'Nghỉ 1 ngày', baseSalary: 35000000, allowance: 3000000, bonus: 1500000, tax: 3200000, net: 36300000, category: 'management' },
  { id: '3',  name: 'Lê Thị C',       role: 'Kỹ thuật (QA/QC)', days: 26, overtime: 5,  status: 'Đủ công',      baseSalary: 25000000, allowance: 2000000, bonus: 1000000, tax: 1800000, net: 26200000, category: 'management' },
  { id: '4',  name: 'Phạm Văn D',     role: 'Khối lượng (QS)',  days: 24, overtime: 8,  status: 'Nghỉ 2 ngày', baseSalary: 22000000, allowance: 2000000, bonus: 800000,  tax: 1500000, net: 23300000, category: 'management' },
  { id: '5',  name: 'Hoàng Thị E',    role: 'Vật tư / Kho',     days: 26, overtime: 0,  status: 'Đủ công',      baseSalary: 18000000, allowance: 1500000, bonus: 500000,  tax: 1000000, net: 19000000, category: 'management' },
  { id: '6',  name: 'Vũ Văn F',       role: 'An toàn (HSE)',    days: 26, overtime: 12, status: 'Đủ công',      baseSalary: 20000000, allowance: 2000000, bonus: 1200000, tax: 1400000, net: 21800000, category: 'management' },
  { id: 'W1', name: 'Trần Văn Hùng',  role: 'Thợ nề chính',     days: 24, overtime: 20, status: 'Đủ công',      baseSalary: 12000000, allowance: 1000000, bonus: 2000000, tax: 0,       net: 15000000, category: 'worker'     },
  { id: 'W2', name: 'Lê Văn Dũng',    role: 'Thợ sắt',          days: 22, overtime: 15, status: 'Nghỉ 2 ngày', baseSalary: 10000000, allowance: 800000,  bonus: 1500000, tax: 0,       net: 12300000, category: 'worker'     },
  { id: '3',  name: 'Nguyễn Thị Hoa', role: 'Phụ hồ',           days: 26, overtime: 5,  status: 'Đủ công',      baseSalary: 8000000,  allowance: 500000,  bonus: 500000,  tax: 0,       net: 9000000,  category: 'worker'     },
  { id: 'W4', name: 'Phạm Minh Tuấn', role: 'Thợ điện',         days: 25, overtime: 10, status: 'Đủ công',      baseSalary: 11000000, allowance: 1000000, bonus: 1200000, tax: 0,       net: 13200000, category: 'worker'     },
];
