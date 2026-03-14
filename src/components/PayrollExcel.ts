// PayrollExcel.ts — GEM&CLAUDE PM Pro · S11
// Export bảng lương Excel via SheetJS — 4 sheets
// Sheet 1: Tổng hợp theo tổ/đội | Sheet 2: Chi tiết | Sheet 3: D02-LT BHXH | Sheet 4: Thuế TNCN

import type { Employee, PayrollRecord } from './PayrollTypes';
import { fmt, CONTRACT_LABEL, PAYMENT_LABEL } from './PayrollTypes';

export async function exportPayrollExcel(
  employees: Employee[],
  records: PayrollRecord[],
  projectName: string,
  periodLabel: string,
) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs' as any);
  const wb = XLSX.utils.book_new();

  // ── Helper ──────────────────────────────────────────────────────────────────
  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
  const getEmp = (id: string) => empMap[id];
  const fmtK   = (n: number) => Math.round(n); // số K đồng

  // ── SHEET 1: Tổng hợp theo tổ/đội ──────────────────────────────────────────
  const teams = [...new Set(employees.map(e => e.team || e.department || 'Chưa phân nhóm'))];

  const sheet1Rows: any[][] = [
    [`BẢNG LƯƠNG TỔNG HỢP — ${projectName}`],
    [`Kỳ: ${periodLabel}`],
    [],
    ['STT', 'Họ và tên', 'Chức vụ', 'Tổ/Đội', 'Loại HĐ', 'Ngày công',
     'Lương CB (K)', 'Phụ cấp (K)', 'OT (K)', 'Thưởng (K)', 'Gộp (K)',
     'BHXH NLĐ (K)', 'TNCN (K)', 'Tạm ứng (K)', 'Thực lĩnh (K)',
     'CP NSDLĐ (K)', 'Trạng thái TT'],
  ];

  let stt = 1;
  let grandTotal = { gross: 0, bhxh: 0, tncn: 0, net: 0, cost_nsd: 0 };

  for (const team of teams) {
    const teamEmps = employees.filter(e => (e.team || e.department || 'Chưa phân nhóm') === team);
    const teamRecs = records.filter(r => teamEmps.some(e => e.id === r.emp_id));

    // Header tổ
    sheet1Rows.push([`--- ${team} ---`]);

    let teamTotal = { gross: 0, bhxh: 0, tncn: 0, net: 0, cost_nsd: 0 };

    for (const rec of teamRecs) {
      const emp = getEmp(rec.emp_id);
      if (!emp) continue;
      sheet1Rows.push([
        stt++,
        emp.full_name,
        emp.position,
        team,
        CONTRACT_LABEL[emp.contract_type],
        `${rec.days_worked}/${rec.days_in_period}`,
        fmtK(rec.salary_base_snap),
        fmtK(rec.allowances_taxable + rec.allowances_exempt),
        fmtK(rec.ot_amount),
        fmtK(rec.bonus),
        fmtK(rec.gross),
        fmtK(rec.bhxh),
        fmtK(rec.tncn),
        fmtK(rec.advances),
        fmtK(rec.net_salary),
        fmtK(rec.total_cost_nsd),
        PAYMENT_LABEL[rec.payment_status].label,
      ]);
      teamTotal.gross    += rec.gross;
      teamTotal.bhxh     += rec.bhxh;
      teamTotal.tncn     += rec.tncn;
      teamTotal.net      += rec.net_salary;
      teamTotal.cost_nsd += rec.total_cost_nsd;
    }

    // Tổng tổ
    sheet1Rows.push([
      '', `TỔNG ${team} (${teamRecs.length} người)`, '', '', '', '',
      '', '', '', '',
      fmtK(teamTotal.gross),
      fmtK(teamTotal.bhxh),
      fmtK(teamTotal.tncn),
      '',
      fmtK(teamTotal.net),
      fmtK(teamTotal.cost_nsd),
      '',
    ]);
    sheet1Rows.push([]);

    grandTotal.gross    += teamTotal.gross;
    grandTotal.bhxh     += teamTotal.bhxh;
    grandTotal.tncn     += teamTotal.tncn;
    grandTotal.net      += teamTotal.net;
    grandTotal.cost_nsd += teamTotal.cost_nsd;
  }

  // Tổng toàn dự án
  sheet1Rows.push([
    '', `TỔNG TOÀN DỰ ÁN (${records.length} người)`, '', '', '', '',
    '', '', '', '',
    fmtK(grandTotal.gross),
    fmtK(grandTotal.bhxh),
    fmtK(grandTotal.tncn),
    '',
    fmtK(grandTotal.net),
    fmtK(grandTotal.cost_nsd),
    '',
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  ws1['!cols'] = [4,20,18,14,16,10,12,12,10,10,12,12,10,10,12,12,14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp');

  // ── SHEET 2: Chi tiết từng người ─────────────────────────────────────────────
  const sheet2Rows: any[][] = [
    [`CHI TIẾT BẢNG LƯƠNG — ${projectName} — Kỳ: ${periodLabel}`],
    [],
    ['Mã phiếu', 'Họ và tên', 'Chức vụ', 'Tổ/Đội', 'Loại HĐ', 'Ngày công',
     'Lương CB', 'PC chịu thuế', 'PC miễn thuế', 'OT', 'Thưởng', 'Gộp',
     'BHXH NLĐ', 'BHYT NLĐ', 'BHTN NLĐ', 'TN tính thuế', 'TNCN',
     'Tạm ứng', 'Thực lĩnh',
     'BHXH NSD', 'BHYT NSD', 'BHTN NSD', 'Tổng CP NSD',
     'Trạng thái', 'Khóa'],
  ];

  for (const rec of records) {
    const emp = getEmp(rec.emp_id);
    if (!emp) continue;
    const bhxh_nsd = Math.round(rec.salary_base_snap * 0.175);
    const bhyt_nsd = Math.round(rec.salary_base_snap * 0.03);
    const bhtn_nsd = Math.round(rec.salary_base_snap * 0.01);
    sheet2Rows.push([
      rec.ref_code,
      emp.full_name, emp.position,
      emp.team || emp.department,
      CONTRACT_LABEL[emp.contract_type],
      `${rec.days_worked}/${rec.days_in_period}`,
      fmtK(rec.salary_base_snap),
      fmtK(rec.allowances_taxable),
      fmtK(rec.allowances_exempt),
      fmtK(rec.ot_amount),
      fmtK(rec.bonus),
      fmtK(rec.gross),
      fmtK(rec.bhxh),
      fmtK(rec.bhyt),
      fmtK(rec.bhtn),
      fmtK(rec.taxable),
      fmtK(rec.tncn),
      fmtK(rec.advances),
      fmtK(rec.net_salary),
      fmtK(bhxh_nsd),
      fmtK(bhyt_nsd),
      fmtK(bhtn_nsd),
      fmtK(rec.total_cost_nsd),
      PAYMENT_LABEL[rec.payment_status].label,
      rec.locked ? 'Đã khóa' : 'Mở',
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  ws2['!cols'] = Array(25).fill({ wch: 14 });
  XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết');

  // ── SHEET 3: Mẫu D02-LT BHXH ─────────────────────────────────────────────────
  const sheet3Rows: any[][] = [
    ['MẪU D02-LT — DANH SÁCH LAO ĐỘNG THAM GIA BHXH/BHYT/BHTN'],
    [`Đơn vị: ${projectName} — Kỳ: ${periodLabel}`],
    [],
    ['STT', 'Họ và tên', 'Số BHXH', 'Số thẻ BHYT', 'Chức danh', 'Mức lương đóng BH',
     'BHXH NLĐ (8%)', 'BHYT NLĐ (1.5%)', 'BHTN NLĐ (1%)', 'Tổng NLĐ đóng',
     'BHXH NSD (17.5%)', 'BHYT NSD (3%)', 'BHTN NSD (1%)', 'Tổng NSD đóng',
     'Tổng đóng', 'Ghi chú'],
  ];

  let bhxhStt = 1;
  for (const rec of records.filter(r => {
    const e = getEmp(r.emp_id);
    return e && e.contract_type !== 'thoi_vu' && e.contract_type !== 'ctv';
  })) {
    const emp = getEmp(rec.emp_id);
    if (!emp) continue;
    const bhxh_nsd = Math.round(rec.salary_base_snap * 0.175);
    const bhyt_nsd = Math.round(rec.salary_base_snap * 0.03);
    const bhtn_nsd = Math.round(rec.salary_base_snap * 0.01);
    const total_nld = rec.bhxh + rec.bhyt + rec.bhtn;
    const total_nsd = bhxh_nsd + bhyt_nsd + bhtn_nsd;
    sheet3Rows.push([
      bhxhStt++,
      emp.full_name,
      emp.bhxh || 'CHƯA CÓ',
      emp.bhyt || 'CHƯA CÓ',
      emp.position,
      fmtK(rec.salary_base_snap),
      fmtK(rec.bhxh),
      fmtK(rec.bhyt),
      fmtK(rec.bhtn),
      fmtK(total_nld),
      fmtK(bhxh_nsd),
      fmtK(bhyt_nsd),
      fmtK(bhtn_nsd),
      fmtK(total_nsd),
      fmtK(total_nld + total_nsd),
      !emp.bhxh ? '⚠️ Thiếu số BHXH' : '',
    ]);
  }

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
  ws3['!cols'] = [4,20,14,14,16,14,12,12,12,12,12,12,12,12,12,20].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws3, 'D02-LT BHXH');

  // ── SHEET 4: Tổng hợp thuế TNCN (mẫu 02/TNDN) ────────────────────────────────
  const sheet4Rows: any[][] = [
    ['TỔNG HỢP THUẾ TNCN — MẪU 02/TNDN'],
    [`Đơn vị: ${projectName} — Kỳ: ${periodLabel}`],
    [],
    ['STT', 'Họ và tên', 'MST cá nhân / CCCD', 'Thu nhập gộp',
     'Giảm trừ bản thân', 'Giảm trừ người phụ thuộc', 'Số người phụ thuộc',
     'TN tính thuế', 'Thuế TNCN phải nộp', 'Ghi chú'],
  ];

  let tncnStt = 1;
  for (const rec of records.filter(r => r.tncn > 0)) {
    const emp = getEmp(rec.emp_id);
    if (!emp) continue;
    const giam_tru_bt = 11_000;
    const giam_tru_npt = (emp.dependants || 0) * 4_400;
    sheet4Rows.push([
      tncnStt++,
      emp.full_name,
      emp.cccd || '',
      fmtK(rec.gross),
      fmtK(giam_tru_bt),
      fmtK(giam_tru_npt),
      emp.dependants || 0,
      fmtK(rec.taxable),
      fmtK(rec.tncn),
      emp.contract_type === 'thoi_vu' ? 'Khấu trừ 10%' : 'Lũy tiến',
    ]);
  }

  const ws4 = XLSX.utils.aoa_to_sheet(sheet4Rows);
  ws4['!cols'] = [4,20,16,14,14,16,10,14,14,14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws4, 'Thuế TNCN');

  // ── Export ──────────────────────────────────────────────────────────────────
  const filename = `BangLuong_${projectName.replace(/\s/g, '_')}_${periodLabel.replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
