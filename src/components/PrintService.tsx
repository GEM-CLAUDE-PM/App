/**
 * PrintService.tsx — GEM&CLAUDE PM Pro
 * Dịch vụ xuất PDF/In dùng chung cho toàn app
 * Hỗ trợ: Nhật ký giám sát | QS Payment | Báo cáo tiến độ
 */

import React from 'react';

// ─── Print CSS inject helper ──────────────────────────────────────────────────
const PRINT_CSS = `
  @media print {
    html, body, #root { visibility: hidden !important; margin: 0 !important; }
    .gem-print-zone { 
      visibility: visible !important; 
      position: fixed !important; 
      inset: 0 !important; 
      background: white !important; 
      padding: 0 !important;
      z-index: 99999 !important;
    }
    .gem-no-print { display: none !important; }
    .gem-print-hint { display: none !important; }
    @page {
      size: A4 portrait;
      margin: 10mm 15mm 15mm 15mm;
    }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { border-collapse: collapse !important; width: 100% !important; page-break-inside: avoid; }
    th, td { border: 1px solid #333 !important; padding: 5px 8px !important; font-size: 10pt !important; }
    thead { background: #f0f0f0 !important; }
    h1 { font-size: 14pt !important; }
    h2 { font-size: 12pt !important; }
    .page-break { page-break-before: always; }
  }
`;

function injectPrintStyle() {
  const id = 'gem-print-style';
  // Remove cũ để luôn inject mới nhất
  const old = document.getElementById(id);
  if (old) old.remove();
  const s = document.createElement('style');
  s.id = id;
  s.textContent = PRINT_CSS;
  document.head.appendChild(s);
  // Override title tạm thời để browser không print URL/title
  const origTitle = document.title;
  document.title = ' ';
  setTimeout(() => { document.title = origTitle; }, 3000);
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PrintHeaderInfo {
  projectName: string;
  docTitle: string;
  docNo?: string;
  date?: string;
  preparedBy?: string;
  approvedBy?: string;
  logoSrc?: string;
  // ProjectConfig fields — nếu có sẽ override generic header
  projectId?: string;
}

// ─── Load project config for print (lazy — không cần import full module) ─────
function loadCfg(projectId?: string) {
  if (!projectId) return null;
  try {
    const raw = localStorage.getItem(`gem_project_config_${projectId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function loadLogo(projectId?: string): string {
  if (!projectId) return '';
  return localStorage.getItem(`gem_project_logo_${projectId}`) || '';
}

// ─── Shared Print Header ──────────────────────────────────────────────────────
export function PrintHeader({ info }: { info: PrintHeaderInfo }) {
  const cfg  = loadCfg(info.projectId);
  const logo = info.logoSrc || loadLogo(info.projectId);

  const contractorName  = cfg?.contractorShortName || cfg?.contractorName || '';
  const contractorAddr  = cfg?.contractorAddress   || '';
  const contractorPhone = cfg?.contractorPhone     || '';
  const contractorMST   = cfg?.contractorMST       || '';
  const ownerName       = cfg?.ownerShortName      || cfg?.ownerName || '';
  const ownerRep        = cfg?.ownerRepresentative || '';
  const supervisorName  = cfg?.supervisorShortName || cfg?.supervisorName || '';
  const contractNo      = cfg?.contractNo          || '';
  const projectFullName = cfg?.projectFullName     || info.projectName;

  return (
    <div style={{ borderBottom: '2px solid #1a8a7a', paddingBottom: 10, marginBottom: 16 }}>

      {/* ── Dòng 1: CỘNG HÒA — full width, canh giữa, độc lập ── */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#222' }}>
          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
        </div>
        <div style={{ fontSize: 9, fontStyle: 'italic', color: '#222', marginTop: 1 }}>
          Độc lập - Tự do - Hạnh Phúc
        </div>
        <div style={{ fontSize: 8, color: '#aaa', marginTop: 1 }}>───────────</div>
      </div>

      {/* ── Dòng 2: Logo+Nhà thầu | Tên CT+Tiêu đề | CĐT+TVGS ── */}
      <table style={{ width: '100%', border: 'none' }}>
        <tbody>
          <tr>
            {/* Cột trái — Logo + nhà thầu */}
            <td style={{ border: 'none', verticalAlign: 'top', width: '33%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                {logo && (
                  <img src={logo} alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#1a8a7a', textTransform: 'uppercase', letterSpacing: -0.3, lineHeight: 1.2 }}>
                    {contractorName}
                  </div>
                  <div style={{ fontSize: 7.5, color: '#555', marginTop: 2, lineHeight: 1.5 }}>
                    {contractorAddr && <div>{contractorAddr}</div>}
                    {contractorPhone && <div>ĐT: {contractorPhone}</div>}
                    {contractorMST   && <div>MST: {contractorMST}</div>}
                  </div>
                </div>
              </div>
            </td>

            {/* Cột giữa — Tiêu đề tài liệu + tên công trình */}
            <td style={{ border: 'none', verticalAlign: 'top', textAlign: 'center', width: '34%' }}>
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, color: '#111', lineHeight: 1.2 }}>
                {info.docTitle}
              </div>
              <div style={{ fontSize: 9, color: '#1a8a7a', marginTop: 4, fontWeight: 600 }}>
                {projectFullName}
              </div>
              {contractNo && (
                <div style={{ fontSize: 8, color: '#666', marginTop: 2 }}>HĐ số: {contractNo}</div>
              )}
            </td>

            {/* Cột phải — Chủ đầu tư, TVGS, số doc, ngày */}
            <td style={{ border: 'none', verticalAlign: 'top', textAlign: 'right', width: '33%' }}>
              {ownerName && (
                <div style={{ fontSize: 8, color: '#444', marginBottom: 3, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 7.5, letterSpacing: 0.5 }}>Chủ đầu tư: </span>
                  {ownerName}
                  {ownerRep && <><br/><span style={{ color: '#777' }}>ĐD: {ownerRep}</span></>}
                </div>
              )}
              {supervisorName && (
                <div style={{ fontSize: 8, color: '#444', marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 7.5, letterSpacing: 0.5 }}>TVGS: </span>
                  {supervisorName}
                </div>
              )}
              <div style={{ fontSize: 8, color: '#555', marginTop: 4 }}>
                {info.docNo && <div>Số: <strong>{info.docNo}</strong></div>}
                <div>Ngày: {info.date || new Date().toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Người lập / Người duyệt ── */}
      <table style={{ width: '100%', border: 'none', marginTop: 8, borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
        <tbody>
          <tr>
            <td style={{ border: 'none', fontSize: 8.5, color: '#555' }}>
              Người lập: <strong>{info.preparedBy || '_______________'}</strong>
            </td>
            <td style={{ border: 'none', fontSize: 8.5, color: '#555', textAlign: 'right' }}>
              Người duyệt: <strong>{info.approvedBy || '_______________'}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Signature Row ────────────────────────────────────────────────────────────
export function PrintSignatureRow({ roles }: { roles: { title: string; name?: string }[] }) {
  return (
    <table style={{ width: '100%', border: 'none', marginTop: 24 }}>
      <tbody>
        <tr>
          {roles.map((r, i) => (
            <td key={i} style={{ border: 'none', textAlign: 'center', verticalAlign: 'top', fontSize: 9 }}>
              <div style={{ fontWeight: 700 }}>{r.title}</div>
              <div style={{ color: '#555', fontSize: 8, fontStyle: 'italic', marginBottom: 4 }}>(Ký, ghi rõ họ tên)</div>
              <div style={{ height: 48 }}/>
              <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontWeight: 600 }}>
                {r.name || ''}
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

// ─── 1. In Nhật ký Giám sát ──────────────────────────────────────────────────
export interface SupervisionLogPrintData {
  log: {
    date: string;
    inspector: string;
    area: string;
    weather: string;
    temp: string;
    workers_count: number;
    items: { work: string; standard: string; result: 'pass' | 'fail' | 'note'; observation: string }[];
    conclusion: string;
    next_plan: string;
    status: string;
  };
  projectName: string;
  logNo?: string;
}

export function SupervisionLogPrint({ data, onClose }: { data: SupervisionLogPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { log, projectName, logNo } = data;
  const RESULT_LABEL: Record<string, { label: string; color: string }> = {
    pass: { label: 'Đạt', color: '#16a34a' },
    fail: { label: 'Không đạt', color: '#dc2626' },
    note: { label: 'Lưu ý', color: '#d97706' },
  };

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName,
        docTitle: 'NHẬT KÝ GIÁM SÁT THI CÔNG',
        docNo: logNo || `NKGS-${log.date.replace(/\//g, '')}`,
        date: log.date,
        preparedBy: log.inspector,
      }}/>

      {/* Thông tin chung */}
      <table style={{ width: '100%', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}><strong>Ngày giám sát:</strong> {log.date}</td>
            <td><strong>Kỹ sư giám sát:</strong> {log.inspector}</td>
          </tr>
          <tr>
            <td><strong>Khu vực:</strong> {log.area}</td>
            <td><strong>Số công nhân:</strong> {log.workers_count} người</td>
          </tr>
          <tr>
            <td><strong>Thời tiết:</strong> {log.weather}</td>
            <td><strong>Nhiệt độ:</strong> {log.temp}</td>
          </tr>
        </tbody>
      </table>

      {/* Nội dung giám sát */}
      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 3 }}>
        I. NỘI DUNG GIÁM SÁT
      </div>
      <table style={{ width: '100%', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#e8f5e9' }}>
            <th style={{ width: '4%' }}>STT</th>
            <th style={{ width: '30%' }}>Hạng mục công việc</th>
            <th style={{ width: '26%' }}>Tiêu chuẩn áp dụng</th>
            <th style={{ width: '10%' }}>Kết quả</th>
            <th>Nhận xét / Yêu cầu</th>
          </tr>
        </thead>
        <tbody>
          {log.items.map((item, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{item.work}</td>
              <td>{item.standard}</td>
              <td style={{ textAlign: 'center', fontWeight: 700, color: RESULT_LABEL[item.result]?.color }}>
                {RESULT_LABEL[item.result]?.label}
              </td>
              <td>{item.observation}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Kết luận */}
      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 3 }}>
        II. KẾT LUẬN & KIẾN NGHỊ
      </div>
      <div style={{ padding: '8px', border: '1px solid #ccc', minHeight: 48, marginBottom: 10, fontSize: 10 }}>
        {log.conclusion || '___'}
      </div>

      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>III. KẾ HOẠCH NGÀY KẾ TIẾP</div>
      <div style={{ padding: '8px', border: '1px solid #ccc', minHeight: 36, marginBottom: 16, fontSize: 10 }}>
        {log.next_plan || '___'}
      </div>

      <PrintSignatureRow roles={[
        { title: 'KỸ THUẬT NHÀ THẦU', name: '' },
        { title: 'KỸ SƯ GIÁM SÁT', name: log.inspector },
        { title: 'CHỦ ĐẦU TƯ/TVGS', name: '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 2. In QS Payment Request ─────────────────────────────────────────────────
export interface QSPaymentPrintData {
  payment: {
    id: string;
    title: string;
    period: string;
    contract_value: number;
    completed_pct: number;
    prev_claimed: number;
    this_claim: number;
    retention_pct: number;
    net_payable: number;
    items?: { description: string; unit: string; qty: number; rate: number; amount: number }[];
    notes?: string;
  };
  projectName: string;
  contractorName?: string;
}

export function QSPaymentPrint({ data, onClose }: { data: QSPaymentPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { payment, projectName, contractorName } = data;
  const fmt = (n: number) => n.toLocaleString('vi-VN') + ' đ';
  const fmtB = (n: number) => (n / 1e9).toFixed(3) + ' tỷ';

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName,
        docTitle: 'GIẤY ĐỀ NGHỊ THANH TOÁN',
        docNo: payment.id,
        preparedBy: contractorName || 'Nhà thầu',
      }}/>

      {/* Thông tin thanh toán */}
      <table style={{ width: '100%', marginBottom: 14 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}><strong>Kỳ thanh toán:</strong> {payment.period}</td>
            <td><strong>Nhà thầu:</strong> {contractorName || '___'}</td>
          </tr>
          <tr>
            <td><strong>Giá trị hợp đồng:</strong> {fmtB(payment.contract_value)}</td>
            <td><strong>% KL hoàn thành:</strong> {payment.completed_pct}%</td>
          </tr>
        </tbody>
      </table>

      {/* Bảng tính */}
      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 3 }}>
        I. BẢNG TỔNG HỢP GIÁ TRỊ ĐỀ NGHỊ THANH TOÁN
      </div>
      <table style={{ width: '100%', marginBottom: 14 }}>
        <thead>
          <tr style={{ background: '#e3f2fd' }}>
            <th style={{ width: '5%' }}>STT</th>
            <th>Khoản mục</th>
            <th style={{ width: '25%', textAlign: 'right' }}>Giá trị (đồng)</th>
          </tr>
        </thead>
        <tbody>
          {[
            { stt: 1, label: 'Giá trị hợp đồng (VAT)', val: payment.contract_value },
            { stt: 2, label: `Giá trị hoàn thành lũy kế (${payment.completed_pct}%)`, val: payment.contract_value * payment.completed_pct / 100 },
            { stt: 3, label: 'Đã thanh toán các kỳ trước', val: payment.prev_claimed },
            { stt: 4, label: 'Giá trị đề nghị thanh toán kỳ này', val: payment.this_claim, bold: true },
            { stt: 5, label: `Khấu trừ bảo lãnh tạm ứng (${payment.retention_pct}%)`, val: -(payment.this_claim * payment.retention_pct / 100) },
            { stt: 6, label: 'SỐ TIỀN ĐỀ NGHỊ THANH TOÁN THỰC TẾ', val: payment.net_payable, bold: true, bg: '#fff9c4' },
          ].map(row => (
            <tr key={row.stt} style={{ background: (row as any).bg || undefined }}>
              <td style={{ textAlign: 'center' }}>{row.stt}</td>
              <td style={{ fontWeight: row.bold ? 700 : undefined }}>{row.label}</td>
              <td style={{ textAlign: 'right', fontWeight: row.bold ? 700 : undefined }}>{fmt(row.val)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Chi tiết items nếu có */}
      {payment.items && payment.items.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 3 }}>
            II. BẢNG KHỐI LƯỢNG CHI TIẾT
          </div>
          <table style={{ width: '100%', marginBottom: 14 }}>
            <thead>
              <tr style={{ background: '#e3f2fd' }}>
                <th style={{ width: '5%' }}>STT</th>
                <th>Hạng mục</th>
                <th style={{ width: '8%' }}>ĐVT</th>
                <th style={{ width: '10%', textAlign: 'right' }}>KL</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Đơn giá</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {payment.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>{item.description}</td>
                  <td style={{ textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ textAlign: 'right' }}>{item.qty.toLocaleString('vi-VN')}</td>
                  <td style={{ textAlign: 'right' }}>{item.rate.toLocaleString('vi-VN')}</td>
                  <td style={{ textAlign: 'right' }}>{item.amount.toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {payment.notes && (
        <div style={{ marginBottom: 14 }}>
          <strong>Ghi chú:</strong> {payment.notes}
        </div>
      )}

      <PrintSignatureRow roles={[
        { title: 'KỸ SƯ QS LẬP', name: '' },
        { title: 'CHỈ HUY TRƯỞNG', name: '' },
        { title: 'CHỦ ĐẦU TƯ XÁC NHẬN', name: '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 3. In Báo cáo Tiến độ ───────────────────────────────────────────────────
export interface ProgressReportPrintData {
  projectName: string;
  reportDate?: string;
  reportPeriod?: string;
  preparedBy?: string;
  spi: number;
  cpi: number;
  eac: number;
  bac: number;
  ev: number;
  pv: number;
  ac: number;
  sv: number;
  cv: number;
  tcpi: number;
  overallPct: number;
  milestones?: { name: string; planned: string; actual?: string; status: 'done' | 'ontrack' | 'delayed' | 'critical' }[];
  issues?: { desc: string; severity: 'high' | 'medium' | 'low'; owner: string }[];
  nextActions?: string[];
}

export function ProgressReportPrint({ data, onClose }: { data: ProgressReportPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { projectName, reportDate, reportPeriod, preparedBy, spi, cpi, eac, bac, ev, pv, ac, sv, cv, tcpi, overallPct, milestones, issues, nextActions } = data;
  const fmtB = (n: number) => (n / 1e9).toFixed(2) + ' tỷ';
  const statusLabel: Record<string, { label: string; color: string }> = {
    done:     { label: 'Hoàn thành', color: '#16a34a' },
    ontrack:  { label: 'Đúng tiến độ', color: '#2563eb' },
    delayed:  { label: 'Chậm tiến độ', color: '#d97706' },
    critical: { label: 'Nguy cơ cao', color: '#dc2626' },
  };

  const spiColor = spi >= 0.95 ? '#16a34a' : spi >= 0.85 ? '#d97706' : '#dc2626';
  const cpiColor = cpi >= 0.95 ? '#16a34a' : cpi >= 0.85 ? '#d97706' : '#dc2626';

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName,
        docTitle: 'BÁO CÁO TIẾN ĐỘ DỰ ÁN',
        docNo: `BCTĐ-${(reportDate || new Date().toLocaleDateString('vi-VN')).replace(/\//g, '')}`,
        date: reportDate,
        preparedBy,
      }}/>

      {reportPeriod && (
        <div style={{ textAlign: 'center', fontSize: 10, color: '#555', marginBottom: 12 }}>
          Kỳ báo cáo: <strong>{reportPeriod}</strong>
        </div>
      )}

      {/* Chỉ số EVM */}
      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 3 }}>
        I. CHỈ SỐ EARNED VALUE MANAGEMENT (EVM)
      </div>
      <table style={{ width: '100%', marginBottom: 14 }}>
        <thead>
          <tr style={{ background: '#e8f5e9' }}>
            <th style={{ width: '5%' }}>STT</th>
            <th>Chỉ số</th>
            <th style={{ width: '12%' }}>Ký hiệu</th>
            <th style={{ width: '22%', textAlign: 'right' }}>Giá trị</th>
            <th style={{ width: '28%' }}>Đánh giá</th>
          </tr>
        </thead>
        <tbody>
          {[
            { stt: 1, label: 'Ngân sách hoàn thành', sym: 'BAC', val: fmtB(bac), note: 'Tổng giá trị hợp đồng' },
            { stt: 2, label: 'Giá trị kế hoạch', sym: 'PV', val: fmtB(pv), note: 'Theo tiến độ baseline' },
            { stt: 3, label: 'Giá trị thực hiện', sym: 'EV', val: fmtB(ev), note: `Hoàn thành ${overallPct}% KL` },
            { stt: 4, label: 'Chi phí thực tế', sym: 'AC', val: fmtB(ac), note: 'Đã giải ngân' },
            { stt: 5, label: 'Chỉ số hiệu suất tiến độ', sym: 'SPI', val: spi.toFixed(3), note: spi >= 1 ? '✓ Đúng/vượt tiến độ' : spi >= 0.85 ? '⚠ Chậm nhẹ' : '✗ Chậm đáng kể', color: spiColor },
            { stt: 6, label: 'Chỉ số hiệu suất chi phí', sym: 'CPI', val: cpi.toFixed(3), note: cpi >= 1 ? '✓ Trong ngân sách' : cpi >= 0.85 ? '⚠ Vượt nhẹ' : '✗ Vượt đáng kể', color: cpiColor },
            { stt: 7, label: 'Lệch tiến độ', sym: 'SV', val: fmtB(sv), note: sv >= 0 ? '✓ Đúng/vượt kế hoạch' : '✗ Chậm so kế hoạch' },
            { stt: 8, label: 'Lệch chi phí', sym: 'CV', val: fmtB(cv), note: cv >= 0 ? '✓ Tiết kiệm' : '✗ Vượt ngân sách' },
            { stt: 9, label: 'Dự báo chi phí cuối dự án', sym: 'EAC', val: fmtB(eac), note: eac > bac ? `Vượt ${fmtB(eac - bac)}` : `Tiết kiệm ${fmtB(bac - eac)}` },
            { stt: 10, label: 'Hiệu suất cần đạt (còn lại)', sym: 'TCPI', val: tcpi.toFixed(3), note: tcpi <= 1.1 ? '✓ Khả thi' : tcpi <= 1.2 ? '⚠ Thách thức' : '✗ Rất khó khả thi' },
          ].map(row => (
            <tr key={row.stt}>
              <td style={{ textAlign: 'center' }}>{row.stt}</td>
              <td>{row.label}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.sym}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: (row as any).color }}>{row.val}</td>
              <td style={{ fontSize: 9, color: '#444' }}>{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Milestones */}
      {milestones && milestones.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 3 }}>
            II. TÌNH TRẠNG CÁC MỐC TIẾN ĐỘ CHÍNH
          </div>
          <table style={{ width: '100%', marginBottom: 14 }}>
            <thead>
              <tr style={{ background: '#e8f5e9' }}>
                <th style={{ width: '5%' }}>STT</th>
                <th>Mốc tiến độ</th>
                <th style={{ width: '18%', textAlign: 'center' }}>Kế hoạch</th>
                <th style={{ width: '18%', textAlign: 'center' }}>Thực tế</th>
                <th style={{ width: '18%', textAlign: 'center' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>{m.name}</td>
                  <td style={{ textAlign: 'center' }}>{m.planned}</td>
                  <td style={{ textAlign: 'center' }}>{m.actual || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: statusLabel[m.status]?.color, fontSize: 9 }}>
                    {statusLabel[m.status]?.label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Vấn đề tồn tại */}
      {issues && issues.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 3 }}>
            III. VẤN ĐỀ TỒN TẠI & KIẾN NGHỊ
          </div>
          <table style={{ width: '100%', marginBottom: 14 }}>
            <thead>
              <tr style={{ background: '#fce4ec' }}>
                <th style={{ width: '5%' }}>STT</th>
                <th>Vấn đề</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Mức độ</th>
                <th style={{ width: '20%' }}>Phụ trách</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>{issue.desc}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 9, color: issue.severity === 'high' ? '#dc2626' : issue.severity === 'medium' ? '#d97706' : '#16a34a' }}>
                    {issue.severity === 'high' ? 'Cao' : issue.severity === 'medium' ? 'Trung bình' : 'Thấp'}
                  </td>
                  <td>{issue.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Kế hoạch kỳ tới */}
      {nextActions && nextActions.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, borderBottom: '1px solid #333', paddingBottom: 3 }}>
            IV. KẾ HOẠCH KỲ TỚI
          </div>
          <table style={{ width: '100%', marginBottom: 14 }}>
            <tbody>
              {nextActions.map((action, i) => (
                <tr key={i}>
                  <td style={{ width: '5%', textAlign: 'center' }}>{i + 1}</td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <PrintSignatureRow roles={[
        { title: 'NGƯỜI LẬP BÁO CÁO', name: preparedBy || '' },
        { title: 'CHỈ HUY TRƯỞNG', name: '' },
        { title: 'GIÁM ĐỐC DỰ ÁN', name: '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── usePrint hook — helper dùng trong mọi dashboard ─────────────────────────
export function usePrint() {
  const [printComponent, setPrintComponent] = React.useState<React.ReactNode>(null);

  const printSupervisionLog = React.useCallback((data: SupervisionLogPrintData) => {
    setPrintComponent(
      <SupervisionLogPrint data={data} onClose={() => setPrintComponent(null)} />
    );
  }, []);

  const printQSPayment = React.useCallback((data: QSPaymentPrintData) => {
    setPrintComponent(
      <QSPaymentPrint data={data} onClose={() => setPrintComponent(null)} />
    );
  }, []);

  const printProgressReport = React.useCallback((data: ProgressReportPrintData) => {
    setPrintComponent(
      <ProgressReportPrint data={data} onClose={() => setPrintComponent(null)} />
    );
  }, []);

  return { printComponent, printSupervisionLog, printQSPayment, printProgressReport };
}

export default { usePrint, PrintHeader, PrintSignatureRow, SupervisionLogPrint, QSPaymentPrint, ProgressReportPrint };

// ─── 4. In Biên bản Nghiệm thu (ITP) ─────────────────────────────────────────
export interface ITPPrintData {
  checklist: {
    id: number | string;
    name: string;
    date: string;
    location?: string;
    docType: string;
    items?: { work: string; standard: string; result: string; observation: string }[];
    inspector?: string;
    conclusion?: string;
  };
  projectName: string;
  projectId?: string;
}

export function ITPPrint({ data, onClose }: { data: ITPPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { checklist, projectName, projectId } = data;
  const RESULT_MAP: Record<string, { label: string; color: string }> = {
    pass: { label: 'Đạt', color: '#16a34a' },
    fail: { label: 'Không đạt', color: '#dc2626' },
    note: { label: 'Lưu ý', color: '#d97706' },
    Đạt: { label: 'Đạt', color: '#16a34a' },
    'Không đạt': { label: 'Không đạt', color: '#dc2626' },
  };

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName,
        projectId,
        docTitle: 'BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG',
        docNo: `NT-${String(checklist.id).padStart(3,'0')}`,
        date: checklist.date,
      }}/>

      {/* Thông tin chung */}
      <table style={{ width: '100%', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}><strong>Hạng mục nghiệm thu:</strong> {checklist.name}</td>
            <td><strong>Ngày nghiệm thu:</strong> {checklist.date}</td>
          </tr>
          <tr>
            <td><strong>Vị trí:</strong> {checklist.location || '___'}</td>
            <td><strong>Loại tài liệu:</strong> {checklist.docType}</td>
          </tr>
        </tbody>
      </table>

      {/* Nội dung nghiệm thu */}
      {checklist.items && checklist.items.length > 0 ? (
        <>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>I. NỘI DUNG NGHIỆM THU</div>
          <table style={{ width: '100%', marginBottom: 14 }}>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>STT</th>
                <th style={{ width: '30%' }}>Hạng mục công việc</th>
                <th style={{ width: '28%' }}>Tiêu chuẩn áp dụng</th>
                <th style={{ width: '12%' }}>Kết quả</th>
                <th>Nhận xét / Yêu cầu</th>
              </tr>
            </thead>
            <tbody>
              {checklist.items.map((item, i) => {
                const res = RESULT_MAP[item.result] || { label: item.result, color: '#333' };
                return (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td>{item.work}</td>
                    <td>{item.standard}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: res.color }}>{res.label}</td>
                    <td>{item.observation}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>I. NỘI DUNG NGHIỆM THU</div>
          <div style={{ border: '1px solid #ccc', minHeight: 80, marginBottom: 12, padding: 8, fontSize: 10 }}>
            (Nội dung nghiệm thu theo hồ sơ thiết kế và tiêu chuẩn kỹ thuật áp dụng)
          </div>
        </>
      )}

      {/* Kết luận */}
      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>II. KẾT LUẬN</div>
      <div style={{ border: '1px solid #ccc', minHeight: 40, padding: 8, marginBottom: 16, fontSize: 10 }}>
        {checklist.conclusion || '☐ Đạt yêu cầu, đồng ý cho triển khai bước thi công tiếp theo.'}
      </div>

      <PrintSignatureRow roles={[
        { title: 'KỸ THUẬT NHÀ THẦU', name: '' },
        { title: 'KỸ SƯ GIÁM SÁT', name: checklist.inspector || '' },
        { title: 'ĐẠI DIỆN CHỦ ĐẦU TƯ', name: '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 5. In Phiếu Không Phù Hợp (NCR) ────────────────────────────────────────
export interface NCRPrintData {
  ncr: {
    id: string;
    title: string;
    severity: string;
    status: string;
    reportedBy: string;
    date: string;
    location: string;
    deadline?: string;
    description?: string;
    rootCause?: string;
    correctionAction?: string;
    preventionAction?: string;
  };
  projectName: string;
  projectId?: string;
}

export function NCRPrint({ data, onClose }: { data: NCRPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { ncr, projectName, projectId } = data;
  const SEV_COLOR: Record<string, string> = {
    Cao: '#dc2626', 'Trung bình': '#d97706', Thấp: '#16a34a',
  };

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName,
        projectId,
        docTitle: 'PHIẾU KHÔNG PHÙ HỢP (NCR)',
        docNo: ncr.id,
        date: ncr.date,
        preparedBy: ncr.reportedBy,
      }}/>

      {/* Thông tin NCR */}
      <table style={{ width: '100%', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ width: '70%' }}><strong>Nội dung không phù hợp:</strong> {ncr.title}</td>
            <td><strong>Mức độ: </strong>
              <span style={{ fontWeight: 700, color: SEV_COLOR[ncr.severity] || '#333' }}>{ncr.severity}</span>
            </td>
          </tr>
          <tr>
            <td><strong>Vị trí:</strong> {ncr.location}</td>
            <td><strong>Hạn khắc phục:</strong> {ncr.deadline || '___'}</td>
          </tr>
          <tr>
            <td><strong>Người phát hiện:</strong> {ncr.reportedBy}</td>
            <td><strong>Ngày phát hiện:</strong> {ncr.date}</td>
          </tr>
          <tr>
            <td colSpan={2}><strong>Trạng thái:</strong> {ncr.status}</td>
          </tr>
        </tbody>
      </table>

      {/* Mô tả */}
      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>I. MÔ TẢ SỰ KHÔNG PHÙ HỢP</div>
      <div style={{ border: '1px solid #ccc', minHeight: 50, padding: 8, marginBottom: 10, fontSize: 10 }}>
        {ncr.description || '___'}
      </div>

      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>II. NGUYÊN NHÂN GỐC RỄ</div>
      <div style={{ border: '1px solid #ccc', minHeight: 40, padding: 8, marginBottom: 10, fontSize: 10 }}>
        {ncr.rootCause || '___'}
      </div>

      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>III. BIỆN PHÁP KHẮC PHỤC</div>
      <div style={{ border: '1px solid #ccc', minHeight: 40, padding: 8, marginBottom: 10, fontSize: 10 }}>
        {ncr.correctionAction || '___'}
      </div>

      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>IV. BIỆN PHÁP PHÒNG NGỪA</div>
      <div style={{ border: '1px solid #ccc', minHeight: 40, padding: 8, marginBottom: 14, fontSize: 10 }}>
        {ncr.preventionAction || '___'}
      </div>

      <PrintSignatureRow roles={[
        { title: 'NGƯỜI LẬP PHIẾU', name: ncr.reportedBy },
        { title: 'KỸ SƯ GIÁM SÁT', name: '' },
        { title: 'ĐẠI DIỆN NHÀ THẦU', name: '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 6. In Phiếu Kho (Nhập/Xuất) ─────────────────────────────────────────────
export interface VoucherPrintData {
  voucher: {
    id: string;
    type: string; // 'entry' | 'exit' | 'return'
    date: string;
    material: string;
    unit: string;
    qty: number;
    unitPrice?: number;
    totalValue?: number;
    supplier?: string;
    requestedBy?: string;
    approvedBy?: string;
    notes?: string;
    status: string;
    hangMuc?: string;
  };
  projectName: string;
  projectId?: string;
}

const VOUCHER_TITLE: Record<string, string> = {
  entry:  'PHIẾU NHẬP KHO',
  exit:   'PHIẾU XUẤT KHO',
  return: 'PHIẾU HOÀN TRẢ KHO',
};

export function VoucherPrint({ data, onClose }: { data: VoucherPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { voucher: v, projectName, projectId } = data;
  const title = VOUCHER_TITLE[v.type] || 'PHIẾU KHO';
  const fmt = (n?: number) => n != null ? n.toLocaleString('vi-VN') : '___';

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{ projectName, projectId, docTitle: title, docNo: v.id, date: v.date, preparedBy: v.requestedBy }}/>

      <table style={{ width: '100%', marginBottom: 14 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}><strong>Vật tư / Hàng hóa:</strong> {v.material}</td>
            <td><strong>Đơn vị tính:</strong> {v.unit}</td>
          </tr>
          <tr>
            <td><strong>Số lượng:</strong> {fmt(v.qty)}</td>
            <td><strong>Đơn giá:</strong> {fmt(v.unitPrice)} đ</td>
          </tr>
          <tr>
            <td><strong>Thành tiền:</strong> {fmt(v.totalValue)} đ</td>
            <td><strong>Hạng mục sử dụng:</strong> {v.hangMuc || '___'}</td>
          </tr>
          {v.supplier && <tr><td colSpan={2}><strong>Nhà cung cấp:</strong> {v.supplier}</td></tr>}
          <tr>
            <td><strong>Người {v.type === 'entry' ? 'giao' : 'nhận'}:</strong> {v.requestedBy || '___'}</td>
            <td><strong>Người phê duyệt:</strong> {v.approvedBy || '___'}</td>
          </tr>
          {v.notes && <tr><td colSpan={2}><strong>Ghi chú:</strong> {v.notes}</td></tr>}
        </tbody>
      </table>

      <PrintSignatureRow roles={
        v.type === 'entry'
          ? [{ title: 'NGƯỜI GIAO HÀNG', name: '' }, { title: 'THỦ KHO', name: '' }, { title: 'KẾ TOÁN', name: '' }]
          : [{ title: 'NGƯỜI ĐỀ NGHỊ', name: v.requestedBy || '' }, { title: 'THỦ KHO', name: '' }, { title: 'CHỈ HUY TRƯỞNG', name: v.approvedBy || '' }]
      }/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 7. In Biên bản Kiểm kê Kho (S10-DN) ────────────────────────────────────
export interface InventoryPrintData {
  kiemKe: {
    id: string;
    date: string;
    approvedBy?: string;
    items?: { name: string; unit: string; soSach: number; thucTe: number; chenh: number }[];
    notes?: string;
    status: string;
  };
  projectName: string;
  projectId?: string;
  auditRows?: { id: string; type: string; date: string; material: string; unit: string; qty: number; requestedBy?: string }[];
}

export function InventoryPrint({ data, onClose }: { data: InventoryPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { kiemKe: kk, projectName, projectId, auditRows } = data;
  const fmt = (n: number) => n.toLocaleString('vi-VN');

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{ projectName, projectId, docTitle: 'BIÊN BẢN KIỂM KÊ KHO VẬT TƯ (S10-DN)', docNo: kk.id, date: kk.date }}/>

      {/* Nếu có items kiểm kê chi tiết */}
      {kk.items && kk.items.length > 0 ? (
        <table style={{ width: '100%', marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>STT</th>
              <th style={{ width: '30%' }}>Tên vật tư</th>
              <th style={{ width: '10%' }}>ĐVT</th>
              <th style={{ width: '15%' }}>Số sổ sách</th>
              <th style={{ width: '15%' }}>Thực tế</th>
              <th style={{ width: '15%' }}>Chênh lệch</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {kk.items.map((item, i) => (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{item.name}</td>
                <td style={{ textAlign: 'center' }}>{item.unit}</td>
                <td style={{ textAlign: 'right' }}>{fmt(item.soSach)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(item.thucTe)}</td>
                <td style={{ textAlign: 'right', color: item.chenh !== 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                  {item.chenh > 0 ? '+' : ''}{fmt(item.chenh)}
                </td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : auditRows && auditRows.length > 0 ? (
        /* Fallback: audit trail */
        <table style={{ width: '100%', marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>STT</th>
              <th style={{ width: '15%' }}>Mã phiếu</th>
              <th style={{ width: '12%' }}>Loại</th>
              <th style={{ width: '13%' }}>Ngày</th>
              <th>Vật tư</th>
              <th style={{ width: '8%' }}>ĐVT</th>
              <th style={{ width: '10%' }}>SL</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map((r, i) => (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{r.id}</td>
                <td style={{ textAlign: 'center' }}>{r.type === 'entry' ? 'Nhập' : r.type === 'exit' ? 'Xuất' : 'Hoàn'}</td>
                <td>{r.date}</td>
                <td>{r.material}</td>
                <td style={{ textAlign: 'center' }}>{r.unit}</td>
                <td style={{ textAlign: 'right' }}>{r.qty.toLocaleString('vi-VN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ border: '1px solid #ccc', minHeight: 100, marginBottom: 14, padding: 8, fontSize: 10 }}>
          (Danh sách vật tư kiểm kê)
        </div>
      )}

      {kk.notes && (
        <div style={{ marginBottom: 12 }}><strong>Ghi chú:</strong> {kk.notes}</div>
      )}

      <PrintSignatureRow roles={[
        { title: 'THỦ KHO', name: '' },
        { title: 'KẾ TOÁN VẬT TƯ', name: '' },
        { title: 'CHỈ HUY TRƯỞNG', name: kk.approvedBy || '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 8. In Báo cáo HSE ────────────────────────────────────────────────────────
export interface HSEReportPrintData {
  reportContent: string;
  period?: string;
  stats?: {
    incidents: number;
    inspections: number;
    violations: number;
    trainings: number;
    safetyScore?: number;
  };
  projectName: string;
  projectId?: string;
  preparedBy?: string;
}

export function HSEReportPrint({ data, onClose }: { data: HSEReportPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { reportContent, period, stats, projectName, projectId, preparedBy } = data;

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName, projectId,
        docTitle: 'BÁO CÁO AN TOÀN LAO ĐỘNG & MÔI TRƯỜNG (HSE)',
        date: new Date().toLocaleDateString('vi-VN'),
        preparedBy: preparedBy || 'Cán bộ HSE',
        docNo: period ? `HSE-${period.replace(/\//g, '')}` : undefined,
      }}/>

      {stats && (
        <table style={{ width: '100%', marginBottom: 14 }}>
          <thead><tr><th>Chỉ số</th><th>Số liệu</th></tr></thead>
          <tbody>
            <tr><td>Sự cố / Tai nạn</td><td style={{ textAlign: 'center' }}>{stats.incidents}</td></tr>
            <tr><td>Kiểm tra an toàn</td><td style={{ textAlign: 'center' }}>{stats.inspections}</td></tr>
            <tr><td>Vi phạm ghi nhận</td><td style={{ textAlign: 'center' }}>{stats.violations}</td></tr>
            <tr><td>Buổi huấn luyện</td><td style={{ textAlign: 'center' }}>{stats.trainings}</td></tr>
            {stats.safetyScore != null && (
              <tr>
                <td><strong>Điểm an toàn tổng hợp</strong></td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: stats.safetyScore >= 80 ? '#16a34a' : '#dc2626' }}>
                  {stats.safetyScore}/100
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 8 }}>NỘI DUNG BÁO CÁO</div>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 10, border: '1px solid #eee', padding: 10, minHeight: 200 }}>
        {reportContent}
      </div>

      <PrintSignatureRow roles={[
        { title: 'CÁN BỘ HSE', name: preparedBy || '' },
        { title: 'CHỈ HUY TRƯỞNG', name: '' },
        { title: 'ĐẠI DIỆN CĐT/TVGS', name: '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 9. In Chi tiết Hợp đồng ─────────────────────────────────────────────────
export interface ContractPrintData {
  contract: {
    id: string;
    name: string;
    party: string;
    value: number;
    paid_amount: number;
    type: string;
    status: string;
    start_date?: string;
    end_date?: string;
    payment_terms?: string;
    guarantees?: { type: string; value: number; expiry: string }[];
    description?: string;
  };
  projectName: string;
  projectId?: string;
}

export function ContractPrint({ data, onClose }: { data: ContractPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { contract: c, projectName, projectId } = data;
  const fmt = (n: number) => (n / 1e6).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' triệu VNĐ';
  const pct = c.value > 0 ? Math.round(c.paid_amount / c.value * 100) : 0;
  const GUARANTEE_LABEL: Record<string, string> = {
    performance: 'Bảo lãnh thực hiện',
    advance: 'Bảo lãnh tạm ứng',
    warranty: 'Bảo hành',
    retention: 'Tiền giữ lại',
  };

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName, projectId,
        docTitle: 'THÔNG TIN HỢP ĐỒNG',
        docNo: c.id,
        date: new Date().toLocaleDateString('vi-VN'),
      }}/>

      <table style={{ width: '100%', marginBottom: 14 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}><strong>Tên hợp đồng:</strong> {c.name}</td>
            <td><strong>Loại hợp đồng:</strong> {c.type}</td>
          </tr>
          <tr>
            <td><strong>Bên ký kết:</strong> {c.party}</td>
            <td><strong>Trạng thái:</strong> {c.status}</td>
          </tr>
          <tr>
            <td><strong>Giá trị HĐ:</strong> {fmt(c.value)}</td>
            <td><strong>Đã thanh toán:</strong> {fmt(c.paid_amount)} ({pct}%)</td>
          </tr>
          {c.start_date && <tr>
            <td><strong>Ngày bắt đầu:</strong> {c.start_date}</td>
            <td><strong>Ngày kết thúc:</strong> {c.end_date || '___'}</td>
          </tr>}
          {c.payment_terms && <tr>
            <td colSpan={2}><strong>Điều kiện thanh toán:</strong> {c.payment_terms}</td>
          </tr>}
        </tbody>
      </table>

      {c.guarantees && c.guarantees.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>BẢO LÃNH & BẢO HÀNh</div>
          <table style={{ width: '100%', marginBottom: 14 }}>
            <thead><tr><th>Loại bảo lãnh</th><th>Giá trị</th><th>Hết hạn</th></tr></thead>
            <tbody>
              {c.guarantees.map((g, i) => (
                <tr key={i}>
                  <td>{GUARANTEE_LABEL[g.type] || g.type}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(g.value * 1e6)}</td>
                  <td style={{ textAlign: 'center' }}>{g.expiry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {c.description && (
        <>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>NỘI DUNG / GHI CHÚ</div>
          <div style={{ border: '1px solid #ccc', padding: 8, minHeight: 40, fontSize: 10, marginBottom: 14 }}>
            {c.description}
          </div>
        </>
      )}

      <PrintSignatureRow roles={[
        { title: 'ĐẠI DIỆN NHÀ THẦU', name: '' },
        { title: 'BAN GIÁM ĐỐC', name: '' },
        { title: 'ĐẠI DIỆN BÊN KÝ', name: c.party },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 10. In Báo cáo Nhân lực / Bảng công / Bảng lương ───────────────────────
export interface ManpowerPrintData {
  type: 'overview' | 'orgchart' | 'timesheet' | 'payroll';
  projectName: string;
  projectId?: string;
  period?: string;
  preparedBy?: string;
  // Bảng công
  timesheetRows?: {
    name: string; role: string;
    days: (number | string)[];
    total: number; ot: number;
  }[];
  // Bảng lương
  payrollRows?: {
    name: string; role: string;
    baseSalary: number; otPay: number;
    deductions: number; net: number;
  }[];
  // Tổng quan nhân lực
  stats?: {
    total: number; present: number;
    roles: { name: string; count: number }[];
  };
}

export function ManpowerPrint({ data, onClose }: { data: ManpowerPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { type, projectName, projectId, period, preparedBy, timesheetRows, payrollRows, stats } = data;
  const fmt = (n: number) => n.toLocaleString('vi-VN');

  const TITLE_MAP = {
    overview:  'BÁO CÁO NHÂN LỰC THI CÔNG',
    orgchart:  'SƠ ĐỒ TỔ CHỨC BAN CHỈ HUY CÔNG TRƯỜNG',
    timesheet: 'BẢNG CHẤM CÔNG',
    payroll:   'BẢNG TÍNH LƯƠNG',
  };

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName, projectId,
        docTitle: TITLE_MAP[type],
        date: new Date().toLocaleDateString('vi-VN'),
        preparedBy: preparedBy || 'Chỉ huy trưởng',
        docNo: period ? `${type.toUpperCase()}-${period.replace(/\//g,'')}` : undefined,
      }}/>

      {/* ── Bảng công ── */}
      {type === 'timesheet' && timesheetRows && (
        <table style={{ width: '100%', fontSize: 9 }}>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>STT</th>
              <th style={{ width: '22%' }}>Họ và tên</th>
              <th style={{ width: '15%' }}>Chức vụ</th>
              {Array.from({ length: 31 }, (_, i) => (
                <th key={i} style={{ width: '1.6%', padding: '3px 1px', fontSize: 7 }}>{i + 1}</th>
              ))}
              <th style={{ width: '7%' }}>Công</th>
              <th style={{ width: '7%' }}>OT</th>
            </tr>
          </thead>
          <tbody>
            {timesheetRows.map((row, i) => (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{row.name}</td>
                <td style={{ fontSize: 8 }}>{row.role}</td>
                {Array.from({ length: 31 }, (_, d) => (
                  <td key={d} style={{ textAlign: 'center', fontSize: 7, padding: '2px 0' }}>
                    {row.days?.[d] ?? ''}
                  </td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.total}</td>
                <td style={{ textAlign: 'center' }}>{row.ot || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Bảng lương ── */}
      {type === 'payroll' && payrollRows && (
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>STT</th>
              <th style={{ width: '25%' }}>Họ và tên</th>
              <th style={{ width: '15%' }}>Chức vụ</th>
              <th style={{ width: '15%' }}>Lương cơ bản</th>
              <th style={{ width: '12%' }}>Làm thêm</th>
              <th style={{ width: '12%' }}>Khấu trừ</th>
              <th style={{ width: '16%' }}>Thực lĩnh</th>
            </tr>
          </thead>
          <tbody>
            {payrollRows.map((row, i) => (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{row.name}</td>
                <td style={{ fontSize: 9 }}>{row.role}</td>
                <td style={{ textAlign: 'right' }}>{fmt(row.baseSalary)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(row.otPay)}</td>
                <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(row.deductions)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(row.net)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
              <td colSpan={3} style={{ textAlign: 'right' }}>TỔNG CỘNG</td>
              <td style={{ textAlign: 'right' }}>{fmt(payrollRows.reduce((s, r) => s + r.baseSalary, 0))}</td>
              <td style={{ textAlign: 'right' }}>{fmt(payrollRows.reduce((s, r) => s + r.otPay, 0))}</td>
              <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(payrollRows.reduce((s, r) => s + r.deductions, 0))}</td>
              <td style={{ textAlign: 'right', color: '#1a8a7a' }}>{fmt(payrollRows.reduce((s, r) => s + r.net, 0))}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* ── Overview ── */}
      {(type === 'overview' || type === 'orgchart') && stats && (
        <table style={{ width: '100%', marginBottom: 14 }}>
          <thead><tr><th>Vị trí / Chức vụ</th><th>Số lượng</th></tr></thead>
          <tbody>
            {stats.roles.map((r, i) => (
              <tr key={i}>
                <td>{r.name}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.count}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td>TỔNG NHÂN LỰC</td>
              <td style={{ textAlign: 'center' }}>{stats.total}</td>
            </tr>
          </tbody>
        </table>
      )}

      <PrintSignatureRow roles={
        type === 'payroll'
          ? [{ title: 'KẾ TOÁN', name: '' }, { title: 'CHỈ HUY TRƯỞNG', name: '' }, { title: 'GIÁM ĐỐC DỰ ÁN', name: '' }]
          : [{ title: 'NGƯỜI LẬP', name: preparedBy || '' }, { title: 'CHỈ HUY TRƯỞNG', name: '' }, { title: 'GIÁM ĐỐC DỰ ÁN', name: '' }]
      }/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 11. In Phiếu Công nợ (Accounting) ───────────────────────────────────────
export interface DebtPrintData {
  debt: {
    id: string;
    name: string;
    type: string;
    contact?: string;
    total: number;
    paid: number;
    status: string;
    dueDate?: string;
    notes?: string;
  };
  projectName: string;
  projectId?: string;
}

export function DebtPrint({ data, onClose }: { data: DebtPrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { debt: d, projectName, projectId } = data;
  const fmt = (n: number) => (n).toFixed(2) + ' tỷ';
  const remaining = d.total - d.paid;
  const pct = d.total > 0 ? Math.round(d.paid / d.total * 100) : 0;
  const STATUS_LABEL: Record<string, string> = {
    unpaid: 'Chưa thanh toán', partial: 'Thanh toán một phần',
    paid: 'Đã thanh toán đủ', overdue: 'Quá hạn',
  };

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName, projectId,
        docTitle: 'PHIẾU THEO DÕI CÔNG NỢ',
        docNo: d.id,
        date: new Date().toLocaleDateString('vi-VN'),
      }}/>

      <table style={{ width: '100%', marginBottom: 14 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%' }}><strong>Tên đối tác / Hợp đồng:</strong> {d.name}</td>
            <td><strong>Loại:</strong> {d.type}</td>
          </tr>
          {d.contact && <tr><td colSpan={2}><strong>Người liên hệ:</strong> {d.contact}</td></tr>}
          <tr>
            <td><strong>Giá trị hợp đồng:</strong> {fmt(d.total)}</td>
            <td><strong>Trạng thái:</strong> {STATUS_LABEL[d.status] || d.status}</td>
          </tr>
          <tr>
            <td><strong>Đã thanh toán:</strong> {fmt(d.paid)} ({pct}%)</td>
            <td><strong>Còn lại:</strong> <span style={{ color: remaining > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{fmt(remaining)}</span></td>
          </tr>
          {d.dueDate && <tr><td colSpan={2}><strong>Hạn thanh toán:</strong> {d.dueDate}</td></tr>}
          {d.notes && <tr><td colSpan={2}><strong>Ghi chú:</strong> {d.notes}</td></tr>}
        </tbody>
      </table>

      {/* Thanh tiến độ thanh toán */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, marginBottom: 4, fontWeight: 700 }}>Tiến độ thanh toán: {pct}%</div>
        <div style={{ height: 12, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626' }}/>
        </div>
      </div>

      <PrintSignatureRow roles={[
        { title: 'KẾ TOÁN', name: '' },
        { title: 'CHỈ HUY TRƯỞNG', name: '' },
        { title: 'GIÁM ĐỐC DỰ ÁN', name: '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// ─── 12. In Bảng kê Nghĩa vụ Thuế ───────────────────────────────────────────
export interface TaxTablePrintData {
  taxes: {
    period: string;
    type: string;
    description: string;
    base: number;
    rate: number;
    taxAmount: number;
    status: string;
    dueDate: string;
  }[];
  projectName: string;
  projectId?: string;
  period?: string;
}

export function TaxTablePrint({ data, onClose }: { data: TaxTablePrintData; onClose: () => void }) {
  React.useEffect(() => {
    injectPrintStyle();
    const timer = setTimeout(() => window.print(), 500);
    const afterPrint = () => onClose();
    window.addEventListener('afterprint', afterPrint);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', afterPrint); };
  }, [onClose]);

  const { taxes, projectName, projectId, period } = data;
  const fmt = (n: number) => (n * 1e9).toLocaleString('vi-VN') + ' đ';
  const totalTax = taxes.reduce((s, t) => s + t.taxAmount, 0);
  const STATUS_LABEL: Record<string, string> = {
    declared: 'Đã khai', paid: 'Đã nộp', pending: 'Chờ khai', overdue: 'Quá hạn',
  };

  return (
    <div className="gem-print-zone" style={{ padding: '12mm 15mm', fontFamily: 'Times New Roman, serif', fontSize: 11, color: '#111' }}>
      <PrintHeader info={{
        projectName, projectId,
        docTitle: 'BẢNG KÊ NGHĨA VỤ THUẾ',
        date: new Date().toLocaleDateString('vi-VN'),
        preparedBy: 'Kế toán trưởng',
        docNo: period ? `TAX-${period.replace(/\//g, '')}` : undefined,
      }}/>

      <table style={{ width: '100%', fontSize: 9 }}>
        <thead>
          <tr>
            <th style={{ width: '8%' }}>Kỳ</th>
            <th style={{ width: '12%' }}>Loại thuế</th>
            <th style={{ width: '20%' }}>Mô tả</th>
            <th style={{ width: '14%', textAlign: 'right' }}>Căn cứ tính</th>
            <th style={{ width: '8%', textAlign: 'center' }}>Thuế suất</th>
            <th style={{ width: '14%', textAlign: 'right' }}>Số thuế</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Trạng thái</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Hạn nộp</th>
          </tr>
        </thead>
        <tbody>
          {taxes.map((t, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              <td style={{ textAlign: 'center' }}>{t.period}</td>
              <td>{t.type}</td>
              <td style={{ fontSize: 8 }}>{t.description}</td>
              <td style={{ textAlign: 'right' }}>{fmt(t.base)}</td>
              <td style={{ textAlign: 'center' }}>{(t.rate * 100).toFixed(0)}%</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(t.taxAmount)}</td>
              <td style={{ textAlign: 'center', fontSize: 8, color: t.status === 'paid' ? '#16a34a' : t.status === 'overdue' ? '#dc2626' : '#d97706' }}>
                {STATUS_LABEL[t.status] || t.status}
              </td>
              <td style={{ textAlign: 'center' }}>{t.dueDate}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700, background: '#f1f5f9' }}>
            <td colSpan={5} style={{ textAlign: 'right' }}>TỔNG SỐ THUẾ PHẢI NỘP</td>
            <td style={{ textAlign: 'right', color: '#dc2626' }}>{fmt(totalTax)}</td>
            <td colSpan={2}></td>
          </tr>
        </tbody>
      </table>

      <PrintSignatureRow roles={[
        { title: 'KẾ TOÁN TRƯỞNG', name: '' },
        { title: 'CHỈ HUY TRƯỞNG', name: '' },
        { title: 'GIÁM ĐỐC DỰ ÁN', name: '' },
      ]}/>

      <div style={{ marginTop: 20, fontSize: 8, color: '#888', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
        GEM & CLAUDE PM Pro v1.0 · AI-Powered Construction ERP · In lúc: {new Date().toLocaleString('vi-VN')}
      </div>
    </div>
  );
}
