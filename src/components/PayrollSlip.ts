// PayrollSlip.ts — GEM&CLAUDE PM Pro · S11
// Print phiếu lương: logo + tên công ty + dấu đỏ + mã tham chiếu + QR code

import type { Employee, PayrollRecord } from './PayrollTypes';
import { fmt, CONTRACT_LABEL } from './PayrollTypes';

/** Tạo QR code SVG đơn giản dạng placeholder (S12 sẽ dùng thư viện thật) */
function qrSVG(data: string): string {
  // Simple visual placeholder — S18 sẽ integrate qrcode.js thật
  const hash = data.split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0);
  const cells: boolean[][] = Array.from({ length: 21 }, (_, r) =>
    Array.from({ length: 21 }, (_, c) => ((hash * (r + 1) * (c + 1)) % 3) === 0)
  );
  const cell = 4;
  const size = 21 * cell + 16;
  let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;
  cells.forEach((row, r) =>
    row.forEach((on, c) => {
      if (on) svg += `<rect x="${c * cell + 8}" y="${r * cell + 8}" width="${cell}" height="${cell}" fill="#1a1a1a"/>`;
    })
  );
  svg += `</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function printPayslip(
  emp: Employee,
  record: PayrollRecord,
  projectName: string,
  projectLogo?: string,
) {
  const w = window.open('', '_blank');
  if (!w) return;

  const qr = qrSVG(record.ref_code + '|' + record.net_salary);

  const allowanceRows = emp.allowances.map(a =>
    `<tr class="${a.type === 'taxable' ? 'income' : 'exempt'}">
      <td>${a.name}${a.type === 'exempt' ? ' (miễn thuế)' : ''}</td>
      <td class="right">${fmt(a.amount)}</td>
    </tr>`
  ).join('');

  const logoHtml = projectLogo
    ? `<img src="${projectLogo}" style="height:48px;object-fit:contain;margin-bottom:6px" alt="logo"/>`
    : `<div style="width:48px;height:48px;background:linear-gradient(135deg,#1a8a7a,#c47a5a);border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;color:white;font-weight:900;font-size:18px">G</div>`;

  w.document.write(`<!DOCTYPE html><html lang="vi"><head>
    <meta charset="UTF-8">
    <title>Phiếu lương — ${emp.full_name} — ${record.period_label}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: "Times New Roman", serif; font-size: 12px; padding: 15mm 20mm; color: #1a1a1a; }
      .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #1a8a7a; }
      .header-left { text-align: center; flex: 1; }
      .header-right { text-align: right; font-size: 10px; color: #555; }
      h1 { font-size: 15px; font-weight: bold; text-transform: uppercase; margin: 6px 0 2px; color: #1a1a1a; }
      .sub { font-size: 11px; color: #c47a5a; font-weight: bold; }
      .ref { font-size: 10px; color: #555; margin-top: 2px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; font-size: 11px; }
      .info-item { display: flex; gap: 6px; }
      .info-label { color: #666; min-width: 80px; }
      .info-value { font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
      th, td { border: 1px solid #ccc; padding: 4px 8px; }
      th { background: #f0f0f0; font-weight: bold; text-align: left; }
      .right { text-align: right; }
      .income { background: #f0fff4; }
      .exempt { background: #f0f8ff; }
      .ot     { background: #fff8e1; }
      .deduct { background: #fff8f0; }
      .net    { background: #1a8a7a; color: white; font-weight: bold; font-size: 13px; }
      .nsd    { background: #f5f0ff; }
      .total  { font-weight: bold; }
      .footer { display: flex; justify-content: space-between; margin-top: 20px; }
      .sign   { text-align: center; width: 30%; }
      .sign p { margin-bottom: 40px; font-size: 11px; }
      .qr-section { text-align: center; }
      .qr-section img { width: 80px; height: 80px; }
      .qr-section p { font-size: 9px; color: #888; margin-top: 2px; }
      .stamp { position: relative; display: inline-block; }
      .stamp::after {
        content: 'GEM&CLAUDE PM';
        position: absolute; top: -10px; right: -10px;
        border: 2px solid #c0392b; border-radius: 50%;
        color: #c0392b; font-size: 8px; font-weight: bold;
        padding: 4px; opacity: 0.6; transform: rotate(-20deg);
        white-space: nowrap;
      }
      @page { size: A4; margin: 15mm 20mm; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>

  <div class="header">
    <div class="header-left">
      ${logoHtml}
      <h1>Phiếu lương tháng ${record.period_label}</h1>
      <div class="sub">GEM&CLAUDE PM Pro — ${projectName}</div>
      <div class="ref">Mã phiếu: <b>${record.ref_code}</b></div>
    </div>
    <div class="header-right">
      <div class="qr-section">
        <img src="${qr}" alt="QR"/>
        <p>Scan để xác nhận</p>
      </div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item"><span class="info-label">Họ tên:</span><span class="info-value">${emp.full_name}</span></div>
    <div class="info-item"><span class="info-label">Chức vụ:</span><span class="info-value">${emp.position}</span></div>
    <div class="info-item"><span class="info-label">Phòng/Tổ:</span><span class="info-value">${emp.team || emp.department}</span></div>
    <div class="info-item"><span class="info-label">Loại HĐ:</span><span class="info-value">${CONTRACT_LABEL[emp.contract_type]}</span></div>
    <div class="info-item"><span class="info-label">Số BHXH:</span><span class="info-value">${emp.bhxh || '⚠️ Chưa có'}</span></div>
    <div class="info-item"><span class="info-label">Số BHYT:</span><span class="info-value">${emp.bhyt || '⚠️ Chưa có'}</span></div>
    <div class="info-item"><span class="info-label">Ngày công:</span><span class="info-value">${record.days_worked}/${record.days_in_period} ngày</span></div>
    <div class="info-item"><span class="info-label">Người PT:</span><span class="info-value">${emp.dependants} người</span></div>
  </div>

  <table>
    <tr><th colspan="2">THU NHẬP</th></tr>
    <tr class="income"><td>Lương cơ bản (${record.days_worked}/${record.days_in_period} ngày)</td><td class="right">${fmt(record.salary_base_snap)}</td></tr>
    ${allowanceRows}
    ${record.ot_amount > 0 ? `<tr class="ot"><td>Tăng ca (OT)</td><td class="right">${fmt(record.ot_amount)}</td></tr>` : ''}
    ${record.bonus > 0 ? `<tr class="income"><td>Thưởng</td><td class="right">${fmt(record.bonus)}</td></tr>` : ''}
    <tr class="total"><td>TỔNG THU NHẬP GỘP</td><td class="right">${fmt(record.gross)}</td></tr>
  </table>

  <table>
    <tr><th colspan="2">KHẤU TRỪ</th></tr>
    <tr class="deduct"><td>BHXH NLĐ đóng (8% lương CB)</td><td class="right">- ${fmt(record.bhxh)}</td></tr>
    <tr class="deduct"><td>BHYT NLĐ đóng (1.5% lương CB)</td><td class="right">- ${fmt(record.bhyt)}</td></tr>
    <tr class="deduct"><td>BHTN NLĐ đóng (1% lương CB)</td><td class="right">- ${fmt(record.bhtn)}</td></tr>
    <tr class="deduct"><td>Thu nhập tính thuế TNCN</td><td class="right">${fmt(record.taxable)}</td></tr>
    <tr class="deduct"><td>Thuế TNCN lũy tiến</td><td class="right">- ${fmt(record.tncn)}</td></tr>
    ${record.advances > 0 ? `<tr class="deduct"><td>Tạm ứng đã nhận</td><td class="right">- ${fmt(record.advances)}</td></tr>` : ''}
    <tr class="net"><td>THỰC LĨNH</td><td class="right">${fmt(record.net_salary)}</td></tr>
  </table>

  <table>
    <tr><th colspan="2">CHI PHÍ NSDLĐ ĐÓNG THÊM (không trừ vào lương NLĐ)</th></tr>
    <tr class="nsd"><td>BHXH NSDLĐ đóng (17.5%)</td><td class="right">${fmt(Math.round(record.salary_base_snap * 0.175))}</td></tr>
    <tr class="nsd"><td>BHYT NSDLĐ đóng (3%)</td><td class="right">${fmt(Math.round(record.salary_base_snap * 0.03))}</td></tr>
    <tr class="nsd"><td>BHTN NSDLĐ đóng (1%)</td><td class="right">${fmt(Math.round(record.salary_base_snap * 0.01))}</td></tr>
    <tr class="nsd total"><td>TỔNG CHI PHÍ NHÂN CÔNG (NSDLĐ)</td><td class="right">${fmt(record.total_cost_nsd)}</td></tr>
  </table>

  <div class="footer">
    <div class="sign">
      <p>Người lao động<br/>(Ký, ghi rõ họ tên)</p>
      <div class="stamp"><strong>${emp.full_name}</strong></div>
    </div>
    <div class="sign">
      <p>Kế toán<br/>(Ký, ghi rõ họ tên)</p>
    </div>
    <div class="sign">
      <p>Chỉ huy trưởng<br/>(Ký, đóng dấu)</p>
    </div>
  </div>

  <script>window.onload = () => { window.focus(); window.print(); }</script>
  </body></html>`);
  w.document.close();
}
