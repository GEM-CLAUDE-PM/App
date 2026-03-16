/**
 * ProjectSetupWizard.tsx  —  GEM&CLAUDE PM Pro  S6
 * ══════════════════════════════════════════════════════════════════════════
 * Wizard 3 bước tạo dự án mới với template preset.
 *
 * Step 1 — Chọn loại dự án (5 templates)
 * Step 2 — Thông tin dự án (tên, CĐT, địa điểm, ngày KK, ngân sách)
 * Step 3 — Xem trước cấu hình & xác nhận
 * ══════════════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, Building2,
  Users, Calendar, DollarSign, MapPin, AlertTriangle,
  CheckCircle2, Shield, Zap, BarChart3, FileText,
} from 'lucide-react';
import {
  PROJECT_TEMPLATES, TEMPLATE_LIST, applyTemplate, saveProjectTemplate,
  type ProjectTypeId, type ProjectTemplate,
} from './projectTemplates';
import { seedMembersIfEmpty } from './projectMember';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface NewProjectData {
  id:            string;
  name:          string;
  type:          'potential' | 'inProgress' | 'completed';
  status:        string;
  budget:        string;
  budgetRaw:     number;
  progress:      number;
  update:        string;
  startDate:     string;
  endDate:       string;
  address:       string;
  investor:      string;
  templateId:    ProjectTypeId;
  spi:           null;
  ncr:           number;
  hse:           number;
  ntp_pending:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COLOR MAP
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { card: string; badge: string; icon: string; btn: string }> = {
  emerald: {
    card:  'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    icon:  'bg-emerald-100 text-emerald-600',
    btn:   'bg-emerald-600 hover:bg-emerald-700',
  },
  blue: {
    card:  'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    icon:  'bg-blue-100 text-blue-600',
    btn:   'bg-blue-600 hover:bg-blue-700',
  },
  amber: {
    card:  'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    icon:  'bg-amber-100 text-amber-600',
    btn:   'bg-amber-600 hover:bg-amber-700',
  },
  slate: {
    card:  'border-slate-300 bg-slate-50',
    badge: 'bg-slate-200 text-slate-700',
    icon:  'bg-slate-200 text-slate-600',
    btn:   'bg-slate-700 hover:bg-slate-800',
  },
  violet: {
    card:  'border-violet-200 bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
    icon:  'bg-violet-100 text-violet-600',
    btn:   'bg-violet-600 hover:bg-violet-700',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — TEMPLATE SELECTOR
// ─────────────────────────────────────────────────────────────────────────────

function TemplateCard({
  tpl, selected, onClick,
}: { tpl: ProjectTemplate; selected: boolean; onClick: () => void }) {
  const c = COLOR_MAP[tpl.color] || COLOR_MAP.slate;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border-2 rounded-2xl p-4 transition-all relative ${
        selected
          ? `border-slate-900 bg-white shadow-lg`
          : `${c.card} border hover:border-slate-400 hover:shadow-sm`
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center">
          <Check size={12} className="text-white"/>
        </div>
      )}
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{tpl.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm">{tpl.name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{tpl.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
              📐 {tpl.typicalScale}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
              💰 {tpl.typicalBudget}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>
              ⏱ {tpl.duration}
            </span>
          </div>
          {/* Team hint */}
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
            <Users size={9}/>
            <span>{tpl.teamStructure.filter(r => r.required).length} vai trò bắt buộc</span>
            <span className="mx-1">·</span>
            <Shield size={9}/>
            <span>{tpl.activeDocTypes.length} loại chứng từ</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — PROJECT INFO FORM
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectInfo {
  name:      string;
  investor:  string;
  address:   string;
  startDate: string;
  endDate:   string;
  budget:    string;
  status:    'potential' | 'inProgress';
}

function ProjectInfoForm({
  info, onChange, templateName,
}: {
  info:         ProjectInfo;
  onChange:     (field: keyof ProjectInfo, value: string) => void;
  templateName: string;
}) {
  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white transition-all";
  const labelCls = "text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5";

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2">
        <FileText size={13} className="text-slate-400 shrink-0"/>
        <p className="text-xs text-slate-600">
          Template: <strong>{templateName}</strong>
        </p>
      </div>

      {/* Name */}
      <div>
        <label className={labelCls}>Tên dự án *</label>
        <input
          value={info.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="VD: Chung cư Sunrise Tower Block A"
          className={inputCls}
          autoFocus
        />
      </div>

      {/* Investor */}
      <div>
        <label className={labelCls}>Chủ đầu tư</label>
        <input
          value={info.investor}
          onChange={e => onChange('investor', e.target.value)}
          placeholder="VD: Công ty CP Địa ốc Phương Nam"
          className={inputCls}
        />
      </div>

      {/* Address */}
      <div>
        <label className={labelCls}>Địa điểm thi công</label>
        <input
          value={info.address}
          onChange={e => onChange('address', e.target.value)}
          placeholder="VD: Quận 7, TP.HCM"
          className={inputCls}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Ngày khởi công</label>
          <input
            type="date"
            value={info.startDate}
            onChange={e => onChange('startDate', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Ngày hoàn thành (dự kiến)</label>
          <input
            type="date"
            value={info.endDate}
            onChange={e => onChange('endDate', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Budget */}
      <div>
        <label className={labelCls}>Giá trị hợp đồng (tỷ đồng)</label>
        <div className="relative">
          <input
            type="number"
            value={info.budget}
            onChange={e => onChange('budget', e.target.value)}
            placeholder="0"
            min="0"
            step="0.1"
            className={`${inputCls} pl-8`}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₫</span>
        </div>
      </div>

      {/* Status */}
      <div>
        <label className={labelCls}>Trạng thái ban đầu</label>
        <div className="flex gap-2">
          {[
            { value: 'potential',   label: '🔵 Tiềm năng / Đang lập KH' },
            { value: 'inProgress',  label: '🟢 Đang thi công' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange('status', opt.value)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all text-left ${
                info.status === opt.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — PREVIEW & CONFIRM
// ─────────────────────────────────────────────────────────────────────────────

function PreviewConfirm({
  tpl, info,
}: { tpl: ProjectTemplate; info: ProjectInfo }) {
  const c = COLOR_MAP[tpl.color] || COLOR_MAP.slate;
  const startDate = info.startDate ? new Date(info.startDate) : new Date();
  const applied   = applyTemplate(tpl.id, startDate);

  return (
    <div className="space-y-4">
      {/* Project summary card */}
      <div className={`border-2 rounded-2xl p-4 ${c.card}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{tpl.icon}</span>
          <div>
            <h3 className="font-bold text-slate-800">{info.name || 'Dự án mới'}</h3>
            {info.investor && <p className="text-xs text-slate-500 mt-0.5">CĐT: {info.investor}</p>}
            {info.address  && <p className="text-xs text-slate-500">📍 {info.address}</p>}
            {info.budget   && (
              <p className="text-xs text-slate-500">
                💰 {parseFloat(info.budget).toLocaleString('vi-VN')} tỷ đồng
              </p>
            )}
            {info.startDate && (
              <p className="text-xs text-slate-500">
                📅 {new Date(info.startDate).toLocaleDateString('vi-VN')}
                {info.endDate && ` → ${new Date(info.endDate).toLocaleDateString('vi-VN')}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* What gets configured */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            icon: <Users size={13}/>,
            label: 'Cơ cấu nhân sự',
            value: `${tpl.teamStructure.filter(r => r.required).length} vai trò bắt buộc`,
            detail: `+ ${tpl.teamStructure.filter(r => !r.required).length} tùy chọn`,
            color: 'text-blue-600',
            bg:    'bg-blue-50 border-blue-200',
          },
          {
            icon: <Shield size={13}/>,
            label: 'Chứng từ được bật',
            value: `${applied.activeDocTypes.length} / 28 loại`,
            detail: tpl.priorityDocTypes.slice(0,2).join(', '),
            color: 'text-emerald-600',
            bg:    'bg-emerald-50 border-emerald-200',
          },
          {
            icon: <DollarSign size={13}/>,
            label: 'Ngưỡng L3 duyệt',
            value: `${(applied.thresholds.L3_max / 1_000_000).toFixed(0)} triệu`,
            detail: `L4: ${(applied.thresholds.L4_max / 1_000_000_000).toFixed(0)} tỷ`,
            color: 'text-amber-600',
            bg:    'bg-amber-50 border-amber-200',
          },
          {
            icon: <Calendar size={13}/>,
            label: 'Milestones',
            value: `${applied.milestones.length} mốc`,
            detail: applied.milestones[0]?.name || '',
            color: 'text-violet-600',
            bg:    'bg-violet-50 border-violet-200',
          },
        ].map(item => (
          <div key={item.label} className={`border rounded-xl p-3 ${item.bg}`}>
            <div className={`flex items-center gap-1.5 mb-1 ${item.color}`}>
              {item.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </div>
            <p className={`text-sm font-black ${item.color}`}>{item.value}</p>
            <p className="text-[10px] text-slate-400 truncate">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Milestones preview */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Calendar size={9}/> Milestones gợi ý
        </p>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {applied.milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                m.type === 'start'  ? 'bg-emerald-500' :
                m.type === 'finish' ? 'bg-rose-500' :
                'bg-blue-400'
              }`}/>
              <span className="font-semibold text-slate-700 min-w-0 truncate">{m.name}</span>
              <span className="text-slate-400 shrink-0 ml-auto">{(m as any).date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risks summary */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          <AlertTriangle size={9}/> Rủi ro chính ({tpl.risks.length})
        </p>
        <div className="space-y-1">
          {tpl.risks.slice(0, 3).map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px]">
              <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded-full ${
                r.impact === 'cao'       ? 'bg-rose-100 text-rose-600' :
                r.impact === 'trung_binh'? 'bg-amber-100 text-amber-600' :
                'bg-slate-100 text-slate-500'
              }`}>
                {r.impact === 'cao' ? '⚠ Cao' : r.impact === 'trung_binh' ? '⚡ Vừa' : '✓ Thấp'}
              </span>
              <span className="text-slate-600">{r.risk}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {tpl.notes.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Lưu ý đặc thù
          </p>
          {tpl.notes.map((n, i) => (
            <p key={i} className="text-[11px] text-slate-600 leading-relaxed flex items-start gap-1.5 mb-0.5">
              <span className="shrink-0 mt-0.5">•</span>{n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WIZARD
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectSetupWizardProps {
  onConfirm: (project: NewProjectData) => void;
  onCancel:  () => void;
}

const STEPS = ['Loại dự án', 'Thông tin', 'Xác nhận'];

export default function ProjectSetupWizard({ onConfirm, onCancel }: ProjectSetupWizardProps) {
  const [step,       setStep]       = useState(0);
  const [templateId, setTemplateId] = useState<ProjectTypeId>('chung_cu_cao_tang');
  const [info, setInfo] = useState<ProjectInfo>({
    name:      '',
    investor:  '',
    address:   '',
    startDate: new Date().toISOString().split('T')[0],
    endDate:   '',
    budget:    '',
    status:    'inProgress',
  });

  const tpl = PROJECT_TEMPLATES[templateId];

  const handleInfoChange = (field: keyof ProjectInfo, value: string) => {
    setInfo(prev => ({ ...prev, [field]: value }));
  };

  const canNext = () => {
    if (step === 0) return !!templateId;
    if (step === 1) return info.name.trim().length > 0;
    return true;
  };

  const handleConfirm = () => {
    const id = `p${Date.now()}`;
    const budgetNum = parseFloat(info.budget) || 0;

    // Áp template
    const startDate = info.startDate ? new Date(info.startDate) : new Date();
    applyTemplate(templateId, startDate);
    saveProjectTemplate(id, templateId);

    // Seed members cho project
    seedMembersIfEmpty(id);

    // Lưu thresholds
    const thresholds = PROJECT_TEMPLATES[templateId].thresholds;
    localStorage.setItem(`gem_db__project_config__${id}`, JSON.stringify({
      L3_max:        thresholds.L3_max,
      L4_max:        thresholds.L4_max,
      warehouse_exit:thresholds.warehouse_exit,
      payment:       thresholds.payment,
    }));

    const project: NewProjectData = {
      id,
      name:       info.name.trim(),
      type:       info.status === 'inProgress' ? 'inProgress' : 'potential',
      status:     info.status === 'inProgress' ? 'Đang thi công' : 'Đang lập kế hoạch',
      budget:     budgetNum > 0 ? `${budgetNum} Tỷ` : '0 Tỷ',
      budgetRaw:  budgetNum * 1_000_000_000,
      progress:   0,
      update:     'Vừa tạo',
      startDate:  info.startDate || '-',
      endDate:    info.endDate   || '-',
      address:    info.address   || '-',
      investor:   info.investor  || '-',
      templateId,
      spi:        null,
      ncr:        0,
      hse:        0,
      ntp_pending:0,
    };
    onConfirm(project);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── HEADER ── */}
        <div className="bg-slate-900 px-6 py-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-bold text-base">Tạo dự án mới</h2>
              <p className="text-slate-400 text-xs mt-0.5">GEM&CLAUDE PM Pro — Setup Wizard</p>
            </div>
            <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
              <X size={18}/>
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                    i < step  ? 'bg-emerald-500 text-white' :
                    i === step? 'bg-white text-slate-900' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {i < step ? <Check size={11}/> : i + 1}
                  </div>
                  <span className={`text-xs font-semibold transition-all ${
                    i === step ? 'text-white' : i < step ? 'text-emerald-400' : 'text-slate-500'
                  }`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-3 transition-all ${i < step ? 'bg-emerald-500' : 'bg-slate-700'}`}/>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-4">
                Chọn loại dự án phù hợp để tự động cấu hình nhân sự, ngưỡng duyệt và quy trình.
              </p>
              {TEMPLATE_LIST.map(t => (
                <TemplateCard
                  key={t.id}
                  tpl={t}
                  selected={templateId === t.id}
                  onClick={() => setTemplateId(t.id)}
                />
              ))}
            </div>
          )}

          {step === 1 && (
            <ProjectInfoForm
              info={info}
              onChange={handleInfoChange}
              templateName={tpl.name}
            />
          )}

          {step === 2 && (
            <PreviewConfirm tpl={tpl} info={info}/>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3 shrink-0">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft size={14}/> Quay lại
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
          )}

          <div className="flex-1"/>

          {/* Template quick badge */}
          {step > 0 && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <span>{tpl.icon}</span> {tpl.shortName}
            </span>
          )}

          {step < 2 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
            >
              Tiếp theo <ChevronRight size={14}/>
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <CheckCircle2 size={14}/> Tạo dự án
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
