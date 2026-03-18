/**
 * OnboardingFlow.tsx — GEM & CLAUDE PM Pro
 * S17 — Onboarding <10 phút cho user mới
 * Step 1: Thông tin công ty
 * Step 2: Tạo dự án đầu tiên
 * Step 3: Mời thành viên team
 * Step 4: Bắt đầu!
 */
import React, { useState } from 'react';
import { useNotification } from './NotificationEngine';
import ModalForm, { FormRow, FormGrid, inputCls, selectCls, BtnCancel, BtnSubmit } from './ModalForm';
import {
  Building2, FolderPlus, Users, Rocket, Check,
  ChevronRight, Plus, X, MapPin, Calendar, DollarSign,
  Mail, Phone, Briefcase, Sparkles,
} from 'lucide-react';
import { JOB_LABELS, type JobRole } from './supabase';

type Step = 1 | 2 | 3 | 4;

interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  tax_code: string;
}

interface FirstProject {
  name: string;
  type: string;
  location: string;
  start_date: string;
  budget: string;
  client_name: string;
}

interface InviteMember {
  email: string;
  role: JobRole;
  name: string;
}

const INVITE_ROLES: JobRole[] = [
  'chi_huy_truong', 'chi_huy_pho', 'ks_giam_sat', 'qaqc_site',
  'qs_site', 'ke_toan_site', 'hse_site', 'hr_site', 'thu_ky_site',
];

const PROJECT_TYPES = [
  'Nhà ở dân dụng', 'Căn hộ chung cư', 'Cao ốc văn phòng',
  'Khu công nghiệp', 'Cơ sở hạ tầng', 'Nhà máy', 'Khác',
];

const STEP_CONFIG = [
  { step: 1 as Step, icon: <Building2 size={18}/>, label: 'Công ty' },
  { step: 2 as Step, icon: <FolderPlus size={18}/>, label: 'Dự án' },
  { step: 3 as Step, icon: <Users size={18}/>, label: 'Team' },
  { step: 4 as Step, icon: <Rocket size={18}/>, label: 'Bắt đầu' },
];

interface OnboardingFlowProps {
  onComplete: (data: { company: CompanyInfo; project: FirstProject; members: InviteMember[] }) => void;
  onSkip?: () => void;
}

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const { err: notifErr, ok: notifOk } = useNotification();
  const [step, setStep] = useState<Step>(1);
  const [gemLoading, setGemLoading] = useState(false);

  const [company, setCompany] = useState<CompanyInfo>({
    name: '', address: '', phone: '', tax_code: '',
  });
  const [project, setProject] = useState<FirstProject>({
    name: '', type: 'Nhà ở dân dụng', location: '', start_date: '', budget: '', client_name: '',
  });
  const [members, setMembers] = useState<InviteMember[]>([
    { email: '', role: 'chi_huy_truong', name: '' },
  ]);

  const addMember = () => setMembers(prev => [...prev, { email: '', role: 'ks_giam_sat', name: '' }]);
  const removeMember = (i: number) => setMembers(prev => prev.filter((_, idx) => idx !== i));
  const updateMember = (i: number, field: keyof InviteMember, val: string) =>
    setMembers(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!company.name.trim()) { notifErr('Vui lòng nhập tên công ty!'); return false; }
    }
    if (step === 2) {
      if (!project.name.trim()) { notifErr('Vui lòng nhập tên dự án!'); return false; }
      if (!project.location.trim()) { notifErr('Vui lòng nhập địa điểm!'); return false; }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, 4) as Step);
  };

  const handleFinish = () => {
    notifOk(`🎉 Chào mừng ${company.name || 'Công ty'} đến với GEM & CLAUDE PM Pro!`);
    onComplete({ company, project, members: members.filter(m => m.email.trim()) });
  };

  const progressPct = ((step - 1) / 3) * 100;

  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <Sparkles size={15} className="text-white"/>
              </div>
              <span className="text-sm font-black text-slate-800">Thiết lập ban đầu</span>
            </div>
            {onSkip && (
              <button onClick={onSkip} className="text-xs text-slate-400 hover:text-slate-600 font-medium">
                Bỏ qua
              </button>
            )}
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-4">
            {STEP_CONFIG.map((s, i) => (
              <React.Fragment key={s.step}>
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  step === s.step ? 'bg-emerald-100 text-emerald-700' :
                  step > s.step  ? 'text-emerald-600'                 :
                                   'text-slate-400'
                }`}>
                  {step > s.step
                    ? <Check size={13} className="text-emerald-500"/>
                    : <span className={step === s.step ? 'text-emerald-600' : 'text-slate-300'}>{s.icon}</span>
                  }
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < 3 && <div className={`h-px flex-1 mx-1 transition-colors ${step > s.step ? 'bg-emerald-300' : 'bg-slate-200'}`}/>}
              </React.Fragment>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}/>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">

          {/* Step 1 — Công ty */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">Thông tin công ty của anh</h2>
                <p className="text-sm text-slate-500 mt-0.5">Sẽ hiển thị trên báo cáo và hóa đơn. Có thể chỉnh sau.</p>
              </div>
              <FormGrid cols={2}>
                <div className="col-span-2"><FormRow label="Tên công ty *">
                  <input className={inputCls} placeholder="VD: Công ty TNHH XD Phúc Thành"
                    value={company.name} onChange={e => setCompany(p => ({...p, name: e.target.value}))}/>
                </FormRow></div>
                <FormRow label="Mã số thuế">
                  <input className={inputCls} placeholder="0123456789"
                    value={company.tax_code} onChange={e => setCompany(p => ({...p, tax_code: e.target.value}))}/>
                </FormRow>
                <FormRow label="Điện thoại">
                  <input className={inputCls} placeholder="028 1234 5678"
                    value={company.phone} onChange={e => setCompany(p => ({...p, phone: e.target.value}))}/>
                </FormRow>
                <div className="col-span-2"><FormRow label="Địa chỉ">
                  <input className={inputCls} placeholder="Số nhà, đường, quận, tỉnh/thành phố"
                    value={company.address} onChange={e => setCompany(p => ({...p, address: e.target.value}))}/>
                </FormRow></div>
              </FormGrid>
            </div>
          )}

          {/* Step 2 — Dự án đầu tiên */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">Tạo dự án đầu tiên</h2>
                <p className="text-sm text-slate-500 mt-0.5">Có thể thêm nhiều dự án sau khi thiết lập xong.</p>
              </div>
              <FormGrid cols={2}>
                <div className="col-span-2"><FormRow label="Tên dự án *">
                  <input className={inputCls} placeholder="VD: Villa PAT — Quận 9 HCMC"
                    value={project.name} onChange={e => setProject(p => ({...p, name: e.target.value}))}/>
                </FormRow></div>
                <FormRow label="Loại công trình">
                  <select className={selectCls} value={project.type}
                    onChange={e => setProject(p => ({...p, type: e.target.value}))}>
                    {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Chủ đầu tư">
                  <input className={inputCls} placeholder="Tên CĐT / chủ nhà"
                    value={project.client_name} onChange={e => setProject(p => ({...p, client_name: e.target.value}))}/>
                </FormRow>
                <FormRow label="Địa điểm *">
                  <input className={inputCls} placeholder="VD: Quận 9, TP.HCM"
                    value={project.location} onChange={e => setProject(p => ({...p, location: e.target.value}))}/>
                </FormRow>
                <FormRow label="Ngày khởi công">
                  <input type="date" className={inputCls}
                    onChange={e => setProject(p => ({...p, start_date: e.target.value}))}/>
                </FormRow>
                <div className="col-span-2"><FormRow label="Ngân sách (tỷ VNĐ)">
                  <input type="number" step="0.1" className={inputCls} placeholder="VD: 45.5"
                    value={project.budget} onChange={e => setProject(p => ({...p, budget: e.target.value}))}/>
                </FormRow></div>
              </FormGrid>
            </div>
          )}

          {/* Step 3 — Mời team */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">Mời thành viên team</h2>
                <p className="text-sm text-slate-500 mt-0.5">Họ sẽ nhận email mời tham gia. Có thể bỏ qua và mời sau.</p>
              </div>
              <div className="space-y-3">
                {members.map((m, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        Thành viên {i + 1}
                      </span>
                      {members.length > 1 && (
                        <button onClick={() => removeMember(i)}
                          className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
                          <X size={12}/>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls + ' text-xs'} placeholder="Họ tên"
                        value={m.name} onChange={e => updateMember(i, 'name', e.target.value)}/>
                      <input type="email" className={inputCls + ' text-xs'} placeholder="email@congty.vn"
                        value={m.email} onChange={e => updateMember(i, 'email', e.target.value)}/>
                    </div>
                    <select className={selectCls + ' text-xs'} value={m.role}
                      onChange={e => updateMember(i, 'role', e.target.value as JobRole)}>
                      {INVITE_ROLES.map(r => <option key={r} value={r}>{JOB_LABELS[r]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {members.length < 8 && (
                <button onClick={addMember}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                  <Plus size={13}/> Thêm thành viên
                </button>
              )}
            </div>
          )}

          {/* Step 4 — Xong */}
          {step === 4 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
                <Rocket size={36} className="text-white"/>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">Sẵn sàng rồi, {company.name || 'anh'}! 🎉</h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  GEM đã thiết lập xong dự án <strong>{project.name}</strong>.<br/>
                  {members.filter(m => m.email).length > 0
                    ? `Đã gửi lời mời đến ${members.filter(m => m.email).length} thành viên.`
                    : 'Anh có thể mời thành viên sau trong phần Quản lý User.'}
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2">
                {[
                  '📊 Dashboard dự án đã sẵn sàng',
                  '📋 Tiến độ & Gantt chờ nhập dữ liệu',
                  '🤖 GEM AI đã được kích hoạt',
                  '💬 Zalo OA notification đang chờ cấu hình',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-emerald-700">
                    <Check size={12} className="shrink-0 text-emerald-500"/>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          {step > 1 && step < 4 ? (
            <button onClick={() => setStep(s => Math.max(s - 1, 1) as Step)}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              ← Quay lại
            </button>
          ) : <div/>}

          {step < 4 ? (
            <button onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
              {step === 3 && members.filter(m => m.email).length === 0 ? 'Bỏ qua bước này' : 'Tiếp theo'}
              <ChevronRight size={15}/>
            </button>
          ) : (
            <button onClick={handleFinish}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
              <Rocket size={15}/> Vào ứng dụng!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
