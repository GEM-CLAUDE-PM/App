// ProjectConfigPanel.tsx — GEM&CLAUDE PM Pro
// Cấu hình thông tin dự án: nhà thầu, chủ đầu tư, tư vấn, ban QLDA, hợp đồng
// Dùng cho header/footer form in + hiển thị dashboard

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Building2, User, Phone, Mail, MapPin, Hash, FileText,
  Upload, X, Save, ChevronDown, ChevronRight, Check,
  AlertCircle, Camera, Briefcase, Shield, ClipboardList,
  Calendar, RefreshCw, Eye, EyeOff, Edit3,
  Calculator, TrendingUp, DollarSign, Minus, Plus, Info,
  Clock, HardHat
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ProjectConfig {
  projectId: string;

  // Nhà thầu chính
  contractorName: string;
  contractorShortName: string;
  contractorAddress: string;
  contractorPhone: string;
  contractorEmail: string;
  contractorMST: string;
  contractorRepresentative: string;
  contractorPosition: string;

  // Chủ đầu tư
  ownerName: string;
  ownerShortName: string;
  ownerAddress: string;
  ownerPhone: string;
  ownerMST: string;
  ownerRepresentative: string;
  ownerPosition: string;

  // Tư vấn giám sát
  supervisorName: string;
  supervisorShortName: string;
  supervisorPhone: string;
  supervisorRepresentative: string;
  supervisorPosition: string;

  // Ban QLDA
  pmuName: string;
  pmuRepresentative: string;
  pmuPhone: string;
  pmuPosition: string;

  // Hợp đồng
  contractNo: string;
  contractDate: string;
  contractType: string;
  contractValue: string;

  // Công trình
  projectFullName: string;
  projectAddress: string;
  projectProvince: string;
  projectType: string;

  // Cấu hình lương — Cán bộ Ban chỉ huy
  staffPayrollFormula: string;      // công thức tính lương cán bộ
  workingDaysPerMonth: string;      // ngày công chuẩn (VD: "26")
  staffPayDay: string;              // ngày trả lương cán bộ (VD: "5")
  staffAllowanceTypes: string;      // phụ cấp cán bộ (phân cách phẩy)
  staffDeductionTypes: string;      // khấu trừ cán bộ (BHXH, thuế TNCN...)

  // Cấu hình lương — Công nhân NTP
  workerPayCycle: string;           // "week" | "biweek" | "month"
  workerPayDay: string;             // ngày thanh toán (VD: "2" = thứ 2 tuần sau)
  workingHoursPerDay: string;       // số giờ làm 1 ngày chuẩn (VD: "8")
  workerAllowanceTypes: string;     // phụ cấp công nhân

  // Hệ số tăng ca — áp dụng cho cả 2 đối tượng
  otRateWeekday: string;            // ngày thường (VD: "1.5")
  otRateWeekend: string;            // cuối tuần T7/CN (VD: "2.0")
  otRateHoliday: string;            // ngày lễ / nghỉ bù (VD: "3.0")

  // Vị trí công trường — Geofence chấm công GPS
  siteLatitude: string;             // vĩ độ tâm công trường (VD: "10.7769")
  siteLongitude: string;            // kinh độ tâm công trường (VD: "106.7009")
  siteRadius: string;               // bán kính geofence tính bằng mét (VD: "200")
  gpsAttendanceEnabled: boolean;    // bật/tắt tính năng GPS chấm công

  // Meta
  updatedAt: string;
  updatedBy: string;
}

const EMPTY_CONFIG = (projectId: string): ProjectConfig => ({
  projectId,
  contractorName: "", contractorShortName: "", contractorAddress: "",
  contractorPhone: "", contractorEmail: "", contractorMST: "",
  contractorRepresentative: "", contractorPosition: "Giám đốc",
  ownerName: "", ownerShortName: "", ownerAddress: "",
  ownerPhone: "", ownerMST: "", ownerRepresentative: "", ownerPosition: "Giám đốc",
  supervisorName: "", supervisorShortName: "", supervisorPhone: "",
  supervisorRepresentative: "", supervisorPosition: "Giám đốc",
  pmuName: "", pmuRepresentative: "", pmuPhone: "", pmuPosition: "Trưởng ban",
  contractNo: "", contractDate: "", contractType: "Trọn gói", contractValue: "",
  projectFullName: "", projectAddress: "", projectProvince: "", projectType: "",
  staffPayrollFormula: "((Lương CB / Ngày chuẩn) * Ngày công) + (Tăng ca * (Lương CB / Ngày chuẩn / Giờ/ngày) * Hệ số OT) + Phụ cấp + Thưởng - Thuế TNCN - BHXH 8% - BHYT 1.5% - BHTN 1%",
  workingDaysPerMonth: "26",
  staffPayDay: "5",
  staffAllowanceTypes: "Phụ cấp đi lại, Phụ cấp ăn trưa, Phụ cấp điện thoại, Phụ cấp nhà ở",
  staffDeductionTypes: "Thuế TNCN, BHXH (8%), BHYT (1.5%), BHTN (1%), Tạm ứng",
  workerPayCycle: "week",
  workerPayDay: "2",
  workingHoursPerDay: "8",
  workerAllowanceTypes: "Phụ cấp ăn trưa, Phụ cấp đi lại",
  otRateWeekday: "1.5",
  otRateWeekend: "2.0",
  otRateHoliday: "3.0",
  siteLatitude: "",
  siteLongitude: "",
  siteRadius: "200",
  gpsAttendanceEnabled: false,
  updatedAt: "", updatedBy: "",
});

const CONTRACT_TYPES = ["Trọn gói", "Đơn giá điều chỉnh", "Theo thời gian", "Hỗn hợp", "Khác"];

// ── Storage helpers ───────────────────────────────────────────────────────────
export const CONFIG_KEY  = (pid: string) => `gem_project_config_${pid}`;
export const LOGO_KEY    = (pid: string) => `gem_project_logo_${pid}`;

export function loadProjectConfig(projectId: string): ProjectConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY(projectId));
    return raw ? { ...EMPTY_CONFIG(projectId), ...JSON.parse(raw) } : EMPTY_CONFIG(projectId);
  } catch { return EMPTY_CONFIG(projectId); }
}

export function saveProjectConfig(cfg: ProjectConfig): void {
  localStorage.setItem(CONFIG_KEY(cfg.projectId), JSON.stringify(cfg));
}

export function loadProjectLogo(projectId: string): string {
  return localStorage.getItem(LOGO_KEY(projectId)) || "";
}

export function saveProjectLogo(projectId: string, base64: string): void {
  localStorage.setItem(LOGO_KEY(projectId), base64);
}

// ── Section component ─────────────────────────────────────────────────────────
function Section({
  title, icon, color, children, defaultOpen = true
}: {
  title: string; icon: React.ReactNode; color: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 ${color} border-b border-slate-100`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/60`}>
            {icon}
          </div>
          <span className="font-bold text-slate-800 text-sm">{title}</span>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
      </button>
      {open && <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>}
    </div>
  );
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, icon, span, type = "text", options, required
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: React.ReactNode;
  span?: boolean; type?: string; options?: string[]; required?: boolean;
}) {
  return (
    <div className={span ? "md:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </div>
        )}
        {options ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`w-full border border-slate-200 rounded-xl py-2.5 pr-3 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 ${icon ? 'pl-9' : 'pl-3'}`}
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full border border-slate-200 rounded-xl py-2.5 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 ${icon ? 'pl-9' : 'pl-3'}`}
          />
        )}
      </div>
    </div>
  );
}

// ── Logo uploader ─────────────────────────────────────────────────────────────
function LogoUploader({ projectId }: { projectId: string }) {
  const [logo, setLogo] = useState(() => loadProjectLogo(projectId));
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("Logo tối đa 500KB. Vui lòng nén ảnh trước.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setLogo(b64);
      saveProjectLogo(projectId, b64);
    };
    reader.readAsDataURL(file);
  }, [projectId]);

  const removeLogo = () => {
    setLogo("");
    saveProjectLogo(projectId, "");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="md:col-span-2">
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        Logo nhà thầu <span className="text-slate-400 font-normal">(PNG/JPG, tối đa 500KB)</span>
      </label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {logo ? (
            <img src={logo} alt="Logo" className="w-full h-full object-contain p-1" />
          ) : (
            <Camera size={24} className="text-slate-400" />
          )}
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-colors"
          >
            <Upload size={13} /> {logo ? "Đổi logo" : "Upload logo"}
          </button>
          {logo && (
            <button
              onClick={removeLogo}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <X size={13} /> Xoá logo
            </button>
          )}
          <p className="text-[10px] text-slate-400">Sẽ xuất hiện trên tất cả form in</p>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  projectId: string;
  projectName?: string;
  currentUser?: string;
  onSave?: (cfg: ProjectConfig) => void;
}

export default function ProjectConfigPanel({ projectId, projectName, currentUser = "Admin", onSave }: Props) {
  const [cfg, setCfg] = useState<ProjectConfig>(() => loadProjectConfig(projectId));
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activePreview, setActivePreview] = useState(false);

  // Reload khi đổi project
  useEffect(() => {
    setCfg(loadProjectConfig(projectId));
    setDirty(false);
    setSaved(false);
  }, [projectId]);

  const set = useCallback(<K extends keyof ProjectConfig>(key: K, val: ProjectConfig[K]) => {
    setCfg(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
  }, []);

  const handleSave = () => {
    const final: ProjectConfig = {
      ...cfg,
      updatedAt: new Date().toLocaleString("vi-VN"),
      updatedBy: currentUser,
    };
    saveProjectConfig(final);
    setCfg(final);
    setDirty(false);
    setSaved(true);
    onSave?.(final);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (confirm("Reset về lần lưu cuối?")) {
      setCfg(loadProjectConfig(projectId));
      setDirty(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Briefcase size={20} className="text-teal-600" />
              Cấu hình thông tin dự án
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {projectName || projectId} · Dùng cho form in, báo cáo và hiển thị dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cfg.updatedAt && (
              <span className="text-[10px] text-slate-400 hidden sm:block">
                Lưu lúc {cfg.updatedAt} bởi {cfg.updatedBy}
              </span>
            )}
            <button
              onClick={() => setActivePreview(p => !p)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              {activePreview ? <EyeOff size={13}/> : <Eye size={13}/>}
              {activePreview ? "Ẩn" : "Xem"} preview
            </button>
            {dirty && (
              <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                <RefreshCw size={13}/> Reset
              </button>
            )}
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                saved
                  ? "bg-emerald-500 text-white"
                  : dirty
                  ? "bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                  : "bg-slate-100 text-slate-500 cursor-not-allowed"
              }`}
              disabled={!dirty && !saved}
            >
              {saved ? <><Check size={13}/> Đã lưu</> : <><Save size={13}/> Lưu cấu hình</>}
            </button>
          </div>
        </div>

        {/* Dirty warning */}
        {dirty && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <AlertCircle size={13}/>
            Có thay đổi chưa lưu — nhấn "Lưu cấu hình" để áp dụng lên form in
          </div>
        )}
      </div>

      {/* ── Preview header form in ── */}
      {activePreview && (
        <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden">
          <div className="bg-teal-50 px-4 py-2.5 border-b border-teal-100 flex items-center gap-2">
            <Eye size={13} className="text-teal-600"/>
            <span className="text-xs font-bold text-teal-700">Preview — Header form in A4</span>
          </div>
          <PrintHeaderPreview cfg={cfg} logo={loadProjectLogo(projectId)} />
        </div>
      )}

      {/* ── Nhà thầu chính ── */}
      <Section title="Nhà thầu chính" icon={<Building2 size={15} className="text-teal-600"/>} color="bg-teal-50/60">
        <LogoUploader projectId={projectId} />
        <Field label="Tên công ty nhà thầu" value={cfg.contractorName} onChange={v => set("contractorName", v)}
          placeholder="Công ty CP Xây dựng..." icon={<Building2 size={14}/>} span required />
        <Field label="Tên viết tắt" value={cfg.contractorShortName} onChange={v => set("contractorShortName", v)}
          placeholder="VD: ABC Construction" icon={<Hash size={14}/>} />
        <Field label="Mã số thuế" value={cfg.contractorMST} onChange={v => set("contractorMST", v)}
          placeholder="0123456789" icon={<Hash size={14}/>} />
        <Field label="Địa chỉ" value={cfg.contractorAddress} onChange={v => set("contractorAddress", v)}
          placeholder="123 Đường ABC, Quận 1, TP.HCM" icon={<MapPin size={14}/>} span />
        <Field label="Điện thoại" value={cfg.contractorPhone} onChange={v => set("contractorPhone", v)}
          placeholder="028 xxxx xxxx" icon={<Phone size={14}/>} />
        <Field label="Email" value={cfg.contractorEmail} onChange={v => set("contractorEmail", v)}
          placeholder="info@company.vn" icon={<Mail size={14}/>} type="email" />
        <Field label="Người đại diện pháp lý" value={cfg.contractorRepresentative} onChange={v => set("contractorRepresentative", v)}
          placeholder="Nguyễn Văn A" icon={<User size={14}/>} />
        <Field label="Chức vụ" value={cfg.contractorPosition} onChange={v => set("contractorPosition", v)}
          placeholder="Giám đốc" icon={<Briefcase size={14}/>} />
      </Section>

      {/* ── Chủ đầu tư ── */}
      <Section title="Chủ đầu tư" icon={<Shield size={15} className="text-blue-600"/>} color="bg-blue-50/60">
        <Field label="Tên chủ đầu tư" value={cfg.ownerName} onChange={v => set("ownerName", v)}
          placeholder="Công ty CP Đầu tư..." icon={<Building2 size={14}/>} span required />
        <Field label="Tên viết tắt" value={cfg.ownerShortName} onChange={v => set("ownerShortName", v)}
          placeholder="VD: Owner Corp" icon={<Hash size={14}/>} />
        <Field label="Mã số thuế" value={cfg.ownerMST} onChange={v => set("ownerMST", v)}
          placeholder="0123456789" icon={<Hash size={14}/>} />
        <Field label="Địa chỉ" value={cfg.ownerAddress} onChange={v => set("ownerAddress", v)}
          placeholder="456 Đường XYZ, Quận 3, TP.HCM" icon={<MapPin size={14}/>} span />
        <Field label="Điện thoại" value={cfg.ownerPhone} onChange={v => set("ownerPhone", v)}
          placeholder="028 xxxx xxxx" icon={<Phone size={14}/>} />
        <Field label="Người đại diện pháp lý" value={cfg.ownerRepresentative} onChange={v => set("ownerRepresentative", v)}
          placeholder="Trần Thị B" icon={<User size={14}/>} />
        <Field label="Chức vụ" value={cfg.ownerPosition} onChange={v => set("ownerPosition", v)}
          placeholder="Tổng Giám đốc" icon={<Briefcase size={14}/>} />
      </Section>

      {/* ── Tư vấn giám sát ── */}
      <Section title="Tư vấn giám sát" icon={<ClipboardList size={15} className="text-purple-600"/>} color="bg-purple-50/60" defaultOpen={false}>
        <Field label="Tên đơn vị tư vấn" value={cfg.supervisorName} onChange={v => set("supervisorName", v)}
          placeholder="Công ty Tư vấn..." icon={<Building2 size={14}/>} span />
        <Field label="Tên viết tắt" value={cfg.supervisorShortName} onChange={v => set("supervisorShortName", v)}
          placeholder="VD: TVGS Corp" icon={<Hash size={14}/>} />
        <Field label="Điện thoại" value={cfg.supervisorPhone} onChange={v => set("supervisorPhone", v)}
          placeholder="028 xxxx xxxx" icon={<Phone size={14}/>} />
        <Field label="Người đại diện" value={cfg.supervisorRepresentative} onChange={v => set("supervisorRepresentative", v)}
          placeholder="Lê Văn C" icon={<User size={14}/>} />
        <Field label="Chức vụ" value={cfg.supervisorPosition} onChange={v => set("supervisorPosition", v)}
          placeholder="Giám đốc" icon={<Briefcase size={14}/>} />
      </Section>

      {/* ── Ban QLDA ── */}
      <Section title="Ban Quản lý dự án (QLDA)" icon={<User size={15} className="text-orange-600"/>} color="bg-orange-50/60" defaultOpen={false}>
        <Field label="Tên ban QLDA" value={cfg.pmuName} onChange={v => set("pmuName", v)}
          placeholder="Ban QLDA Dự án..." icon={<Building2 size={14}/>} span />
        <Field label="Trưởng ban / Đại diện" value={cfg.pmuRepresentative} onChange={v => set("pmuRepresentative", v)}
          placeholder="Phạm Văn D" icon={<User size={14}/>} />
        <Field label="Điện thoại" value={cfg.pmuPhone} onChange={v => set("pmuPhone", v)}
          placeholder="028 xxxx xxxx" icon={<Phone size={14}/>} />
        <Field label="Chức vụ" value={cfg.pmuPosition} onChange={v => set("pmuPosition", v)}
          placeholder="Trưởng ban" icon={<Briefcase size={14}/>} />
      </Section>

      {/* ── Hợp đồng ── */}
      <Section title="Thông tin hợp đồng" icon={<FileText size={15} className="text-emerald-600"/>} color="bg-emerald-50/60" defaultOpen={false}>
        <Field label="Số hợp đồng" value={cfg.contractNo} onChange={v => set("contractNo", v)}
          placeholder="HĐ-2025/ABC-XYZ/001" icon={<Hash size={14}/>} />
        <Field label="Ngày ký" value={cfg.contractDate} onChange={v => set("contractDate", v)}
          placeholder="01/01/2025" icon={<Calendar size={14}/>} type="date" />
        <Field label="Loại hợp đồng" value={cfg.contractType} onChange={v => set("contractType", v)}
          options={CONTRACT_TYPES} icon={<FileText size={14}/>} />
        <Field label="Giá trị hợp đồng (VNĐ)" value={cfg.contractValue} onChange={v => set("contractValue", v)}
          placeholder="85,000,000,000" icon={<Hash size={14}/>} />
      </Section>

      {/* ── Thông tin công trình ── */}
      <Section title="Thông tin công trình" icon={<MapPin size={15} className="text-rose-600"/>} color="bg-rose-50/60" defaultOpen={false}>
        <Field label="Tên đầy đủ công trình" value={cfg.projectFullName} onChange={v => set("projectFullName", v)}
          placeholder="Công trình xây dựng..." icon={<Building2 size={14}/>} span required />
        <Field label="Địa chỉ công trình" value={cfg.projectAddress} onChange={v => set("projectAddress", v)}
          placeholder="789 Đường..., Phường..., Quận..." icon={<MapPin size={14}/>} span />
        <Field label="Tỉnh / Thành phố" value={cfg.projectProvince} onChange={v => set("projectProvince", v)}
          placeholder="TP. Hồ Chí Minh" icon={<MapPin size={14}/>} />
        <Field label="Loại công trình" value={cfg.projectType} onChange={v => set("projectType", v)}
          placeholder="Nhà ở, Thương mại, Hạ tầng..." icon={<Building2 size={14}/>} />
      </Section>

      {/* ── Cấu hình lương ── */}
      <Section title="Cấu hình lương & chấm công" icon={<Calculator size={15} className="text-teal-600"/>} color="bg-teal-50/60" defaultOpen={false}>

        {/* ── Hệ số tăng ca ── */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-orange-500"/>
            <p className="text-xs font-bold text-slate-700">Hệ số tăng ca — áp dụng cho cả cán bộ và công nhân</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              ["otRateWeekday","📅 Ngày thường","1.5","border-orange-200 bg-orange-50","text-orange-700","focus:ring-orange-300","text-orange-400"],
              ["otRateWeekend","📆 Cuối tuần (T7/CN)","2.0","border-amber-200 bg-amber-50","text-amber-700","focus:ring-amber-300","text-amber-400"],
              ["otRateHoliday","🎌 Ngày lễ / nghỉ bù","3.0","border-rose-200 bg-rose-50","text-rose-700","focus:ring-rose-300","text-rose-400"],
            ] as [keyof typeof cfg, string, string, string, string, string, string][]).map(([key,lbl,,border,text,ring,sub])=>(
              <div key={key} className={`${border} border rounded-xl p-3`}>
                <p className={`text-[10px] font-bold ${text} mb-1.5`}>{lbl}</p>
                <p className="text-[9px] text-slate-400 mb-2">Điều 97 BLLĐ 2019</p>
                <input type="number" step="0.1" value={cfg[key] as string}
                  onChange={e => set(key, e.target.value)}
                  className={`w-full border ${border.split(' ')[0]} rounded-lg px-2 py-1.5 text-sm font-bold ${text} bg-white focus:outline-none focus:ring-2 ${ring} text-center`}/>
                <p className={`text-[9px] ${sub} text-center mt-1`}>× giờ làm thêm</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cán bộ Ban chỉ huy ── */}
        <div className="md:col-span-2 mt-1">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-100">
            <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center shrink-0">
              <Briefcase size={11} className="text-blue-600"/>
            </div>
            <p className="text-xs font-bold text-blue-800">Cán bộ Ban chỉ huy</p>
            <span className="text-[10px] text-slate-400">— lương tháng, 26 ngày chuẩn</span>
          </div>
        </div>
        <Field label="Ngày công chuẩn / tháng" value={cfg.workingDaysPerMonth}
          onChange={v => set("workingDaysPerMonth", v)} placeholder="26" type="number" icon={<Calendar size={14}/>}/>
        <Field label="Số giờ làm / ngày" value={cfg.workingHoursPerDay}
          onChange={v => set("workingHoursPerDay", v)} placeholder="8" type="number" icon={<Clock size={14}/>}/>
        <Field label="Ngày trả lương cán bộ (hàng tháng)" value={cfg.staffPayDay}
          onChange={v => set("staffPayDay", v)} placeholder="5" type="number" icon={<DollarSign size={14}/>} span/>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Hash size={13} className="text-blue-500"/> Công thức tính lương cán bộ
          </label>
          <textarea rows={2} value={cfg.staffPayrollFormula}
            onChange={e => set("staffPayrollFormula", e.target.value)}
            className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"/>
          <div className="flex flex-wrap gap-1.5">
            {["Lương CB","Ngày chuẩn","Ngày công","Giờ OT","Hệ số OT","Phụ cấp","Thưởng","Thuế TNCN","BHXH 8%","BHYT 1.5%","BHTN 1%","Tạm ứng"].map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-[10px] font-medium">{tag}</span>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Plus size={13} className="text-blue-400"/> Phụ cấp cán bộ <span className="font-normal text-slate-400">(phân cách bằng dấu phẩy)</span>
          </label>
          <input value={cfg.staffAllowanceTypes} onChange={e => set("staffAllowanceTypes", e.target.value)}
            placeholder="Phụ cấp đi lại, Phụ cấp ăn trưa, Phụ cấp điện thoại, ..."
            className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"/>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Minus size={13} className="text-blue-400"/> Khấu trừ cán bộ <span className="font-normal text-slate-400">(phân cách bằng dấu phẩy)</span>
          </label>
          <input value={cfg.staffDeductionTypes} onChange={e => set("staffDeductionTypes", e.target.value)}
            placeholder="Thuế TNCN, BHXH (8%), BHYT (1.5%), BHTN (1%), Tạm ứng"
            className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"/>
        </div>

        {/* ── Công nhân NTP ── */}
        <div className="md:col-span-2 mt-1">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-100">
            <div className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center shrink-0">
              <HardHat size={11} className="text-amber-600"/>
            </div>
            <p className="text-xs font-bold text-amber-800">Công nhân Nhà thầu phụ</p>
            <span className="text-[10px] text-slate-400">— lương ngày, chu kỳ linh hoạt</span>
          </div>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <RefreshCw size={13} className="text-amber-500"/> Chu kỳ thanh toán công nhân
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([["week","Hàng tuần","T2→CN, trả thứ 2 tuần sau"],["biweek","2 tuần","1–15 & 16–cuối tháng"],["month","Hàng tháng","Cùng ngày với cán bộ"]] as [string,string,string][]).map(([v,lbl,desc])=>(
              <button key={v} type="button" onClick={()=>set("workerPayCycle",v)}
                className={`rounded-xl px-3 py-2.5 border text-left transition-all ${cfg.workerPayCycle===v?'bg-amber-600 border-amber-600 text-white':'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                <p className="text-xs font-bold">{lbl}</p>
                <p className={`text-[10px] mt-0.5 ${cfg.workerPayCycle===v?'text-amber-100':'text-slate-400'}`}>{desc}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Plus size={13} className="text-amber-400"/> Phụ cấp công nhân <span className="font-normal text-slate-400">(phân cách bằng dấu phẩy)</span>
          </label>
          <input value={cfg.workerAllowanceTypes} onChange={e => set("workerAllowanceTypes", e.target.value)}
            placeholder="Phụ cấp ăn trưa, Phụ cấp đi lại, ..."
            className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"/>
        </div>

        <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Info size={14} className="text-amber-600 shrink-0 mt-0.5"/>
          <p className="text-xs text-amber-800">Cấu hình áp dụng toàn bộ dự án. Thay đổi có hiệu lực từ kỳ lương tiếp theo.</p>
        </div>
      </Section>

      {/* ── GPS Geofence ── */}
      <Section title="Vị trí công trường & Chấm công GPS" icon={<MapPin size={15} className="text-emerald-600"/>} color="bg-emerald-50/60" defaultOpen={false}>

        {/* Toggle bật/tắt */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.gpsAttendanceEnabled?'bg-emerald-100':'bg-slate-100'}`}>
                <MapPin size={18} className={cfg.gpsAttendanceEnabled?'text-emerald-600':'text-slate-400'}/>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">GPS Chấm công tự động</p>
                <p className="text-xs text-slate-500">THT vào vùng công trường → tự động điểm danh · Ngoài vùng → khóa chấm công</p>
              </div>
            </div>
            <button type="button" onClick={()=>set('gpsAttendanceEnabled', !cfg.gpsAttendanceEnabled)}
              className={`w-12 h-6 rounded-full transition-all flex items-center px-0.5 shrink-0 ${cfg.gpsAttendanceEnabled?'bg-emerald-500':'bg-slate-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${cfg.gpsAttendanceEnabled?'translate-x-6':''}`}/>
            </button>
          </div>
        </div>

        {/* Tọa độ + bán kính */}
        <div className={`md:col-span-2 transition-opacity ${cfg.gpsAttendanceEnabled?'opacity-100':'opacity-40 pointer-events-none'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <MapPin size={12} className="text-emerald-500"/> Vĩ độ (Latitude)
              </label>
              <input value={cfg.siteLatitude} onChange={e=>set('siteLatitude',e.target.value)}
                placeholder="VD: 10.7769" type="number" step="0.0001"
                className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <MapPin size={12} className="text-emerald-500"/> Kinh độ (Longitude)
              </label>
              <input value={cfg.siteLongitude} onChange={e=>set('siteLongitude',e.target.value)}
                placeholder="VD: 106.7009" type="number" step="0.0001"
                className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Shield size={12} className="text-emerald-500"/> Bán kính (mét)
              </label>
              <input value={cfg.siteRadius} onChange={e=>set('siteRadius',e.target.value)}
                placeholder="200" type="number" min="50" max="1000" step="50"
                className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-mono text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
            </div>
          </div>

          {/* Nút lấy GPS hiện tại */}
          <div className="mt-3 flex items-center gap-3">
            <button type="button"
              onClick={()=>{
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition(pos=>{
                  set('siteLatitude', pos.coords.latitude.toFixed(6));
                  set('siteLongitude', pos.coords.longitude.toFixed(6));
                }, ()=>alert('Không lấy được GPS. Vui lòng bật quyền định vị.'));
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">
              <MapPin size={13}/> Lấy vị trí hiện tại của tôi
            </button>
            {cfg.siteLatitude && cfg.siteLongitude && (
              <a href={`https://www.google.com/maps?q=${cfg.siteLatitude},${cfg.siteLongitude}&z=17`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
                <MapPin size={13}/> Xem trên Google Maps ↗
              </a>
            )}
          </div>

          {/* Preview thông tin */}
          {cfg.siteLatitude && cfg.siteLongitude && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                <MapPin size={14} className="text-white"/>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-emerald-800">
                  📍 {cfg.siteLatitude}, {cfg.siteLongitude}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  Vùng chấm công: bán kính {cfg.siteRadius||200}m · THT phải đứng trong vùng này mới chấm được
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Hướng dẫn */}
        <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <Info size={14} className="text-blue-500 shrink-0 mt-0.5"/>
          <div className="text-xs text-blue-700 space-y-0.5">
            <p className="font-bold">Cách cài đặt:</p>
            <p>1. Ra đứng giữa công trường → bấm "Lấy vị trí hiện tại"</p>
            <p>2. Nhập bán kính phù hợp (100–300m tùy quy mô)</p>
            <p>3. Bật toggle GPS → THT chỉ chấm được khi trong vùng</p>
            <p className="text-blue-500 pt-1">⚠️ CHT và HR vẫn có thể override bất kỳ lúc nào</p>
          </div>
        </div>
      </Section>

    </div>
  );
}

// ── PrintHeaderPreview — dùng trong form in ───────────────────────────────────
export function PrintHeaderPreview({ cfg, logo }: { cfg: ProjectConfig; logo?: string }) {
  return (
    <div className="p-5 font-sans text-xs text-slate-800">
      <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-slate-800">

        {/* Logo + Nhà thầu */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {logo ? (
            <img src={logo} alt="Logo" className="w-14 h-14 object-contain flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 bg-slate-100 rounded border border-slate-200 flex items-center justify-center flex-shrink-0">
              <Camera size={18} className="text-slate-400"/>
            </div>
          )}
          <div className="min-w-0">
            <div className="font-black text-sm uppercase text-teal-700 leading-tight">
              {cfg.contractorShortName || cfg.contractorName || "TÊN NHÀ THẦU"}
            </div>
            <div className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
              {cfg.contractorName && <div>{cfg.contractorName}</div>}
              {cfg.contractorAddress && <div>{cfg.contractorAddress}</div>}
              {(cfg.contractorPhone || cfg.contractorEmail) && (
                <div>
                  {cfg.contractorPhone && `ĐT: ${cfg.contractorPhone}`}
                  {cfg.contractorPhone && cfg.contractorEmail && " · "}
                  {cfg.contractorEmail && `Email: ${cfg.contractorEmail}`}
                </div>
              )}
              {cfg.contractorMST && <div>MST: {cfg.contractorMST}</div>}
            </div>
          </div>
        </div>

        {/* Tên công trình */}
        <div className="text-center flex-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest">Công trình</div>
          <div className="font-black text-sm text-slate-800 mt-0.5 leading-tight uppercase">
            {cfg.projectFullName || "TÊN CÔNG TRÌNH"}
          </div>
          {cfg.projectAddress && (
            <div className="text-[10px] text-slate-500 mt-0.5">{cfg.projectAddress}</div>
          )}
          {cfg.contractNo && (
            <div className="text-[10px] text-teal-700 mt-1 font-semibold">HĐ: {cfg.contractNo}</div>
          )}
        </div>

        {/* Chủ đầu tư */}
        <div className="text-right flex-1 text-[10px] text-slate-600 leading-relaxed">
          <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wide">Chủ đầu tư</div>
          <div className="font-semibold">{cfg.ownerShortName || cfg.ownerName || "—"}</div>
          {cfg.ownerRepresentative && (
            <div>Đại diện: {cfg.ownerRepresentative}</div>
          )}
          {cfg.supervisorName && (
            <>
              <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wide mt-1.5">TVGS</div>
              <div>{cfg.supervisorShortName || cfg.supervisorName}</div>
            </>
          )}
        </div>

      </div>
      <div className="text-[9px] text-slate-400 text-center mt-2 italic">
        Preview header — sẽ xuất hiện trên tất cả form in của dự án
      </div>
    </div>
  );
}

// ── usePrintHeader hook — dùng trong PrintService ─────────────────────────────
export function usePrintHeader(projectId: string) {
  const cfg = loadProjectConfig(projectId);
  const logo = loadProjectLogo(projectId);
  return { cfg, logo };
}
