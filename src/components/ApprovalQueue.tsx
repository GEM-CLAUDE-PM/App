import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNotification } from './NotificationEngine';
import {
  CheckCircle2, XCircle, RotateCcw, Clock, Eye, ChevronRight,
  AlertTriangle, FileText, Package, Calculator, ShieldCheck,
  Users, Truck, ClipboardList, Filter, Search, ChevronDown,
  Upload, X, Lock, CheckCheck, Circle, ArrowRight, Loader2,
  Building2, HardHat, BarChart2, Info,
} from 'lucide-react';
import {
  ApprovalDoc, DocStatus, AuditEntry, ProcessInput,
  processApproval, submitDocument, getApprovalQueue, canApproveDoc,
  getMyDocs, getAllDocs, getStatusConfig, getCurrentStepLabel,
  getWorkflowProgress, STATUS_CONFIG, verifyPin,
} from './approvalEngine';
import {
  UserContext, WORKFLOWS, DocType, ROLES,
  getEffectiveLevel, canActOnStep, getNextActionableStep,
  type RoleId,
} from './permissions';

// ─────────────────────────────────────────────────
// TYPES & HELPERS
// ─────────────────────────────────────────────────

interface ApprovalQueueProps {
  projectId:   string;
  projectName: string;
  ctx:         UserContext;
  onClose?:    () => void;
}

type ViewMode = 'queue' | 'mine' | 'all';
type FilterStatus = DocStatus | 'ALL';

const DOC_TYPE_ICON: Record<string, React.ReactNode> = {
  // Nhóm A — Vật tư / Kho
  MATERIAL_REQUEST:    <Package      size={14}/>,
  WAREHOUSE_EXIT:      <Package      size={14}/>,
  WAREHOUSE_ENTRY:     <Package      size={14}/>,
  STOCK_TAKE:          <ClipboardList size={14}/>,
  // Nhóm B — QS / Hợp đồng
  VARIATION_ORDER:     <BarChart2    size={14}/>,
  ACCEPTANCE_INTERNAL: <CheckCheck   size={14}/>,
  ACCEPTANCE_OWNER:    <CheckCheck   size={14}/>,
  PAYMENT_REQUEST:     <Calculator   size={14}/>,
  CONTRACT_AMENDMENT:  <FileText     size={14}/>,
  SUBCONTRACT_PAYMENT: <Calculator   size={14}/>,
  // Nhóm C — Tài chính
  FINANCIAL_VOUCHER:   <Calculator   size={14}/>,
  TIMESHEET:           <Users        size={14}/>,
  OVERTIME_REQUEST:    <Clock        size={14}/>,
  // Nhóm D — Procurement
  PROCUREMENT:         <ClipboardList size={14}/>,
  MATERIAL_APPROVAL:   <CheckCheck   size={14}/>,
  MATERIAL_INCOMING:   <Truck        size={14}/>,
  VENDOR_PREQUALIFICATION: <Building2 size={14}/>,
  VENDOR_EVALUATION:   <Building2    size={14}/>,
  // Nhóm E — QA/QC
  NCR:                 <AlertTriangle size={14}/>,
  RFI:                 <Info         size={14}/>,
  INSPECTION_REQUEST:  <CheckCircle2 size={14}/>,
  ITP_MANAGEMENT:      <ClipboardList size={14}/>,
  METHOD_STATEMENT:    <FileText     size={14}/>,
  DRAWING_REVISION:    <FileText     size={14}/>,
  QUALITY_AUDIT:       <ShieldCheck  size={14}/>,
  TESTING_LAB:         <Filter       size={14}/>,
  // Nhóm F — HSE
  HSE_INCIDENT:        <ShieldCheck  size={14}/>,
  PERMIT_TO_WORK:      <HardHat      size={14}/>,
  HSE_INSPECTION:      <ShieldCheck  size={14}/>,
  CAPA:                <RotateCcw    size={14}/>,
  // Nhóm G — Nhân sự
  LEAVE_REQUEST:       <Users        size={14}/>,
  DISCIPLINE:          <AlertTriangle size={14}/>,
};

function fmtMoney(n?: number) {
  if (!n) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} tr`;
  return n.toLocaleString('vi-VN') + 'đ';
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000)   return 'vừa xong';
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)} giờ trước`;
  return `${Math.floor(diff/86_400_000)} ngày trước`;
}

// ─────────────────────────────────────────────────
// PIN MODAL
// ─────────────────────────────────────────────────

interface PinModalProps {
  onConfirm: (pin: string) => void;
  onCancel:  () => void;
  title:     string;
  userId:    string;
}

function PinModal({ onConfirm, onCancel, title, userId }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [lockMin, setLockMin] = useState(0);

  const handleSubmit = () => {
    if (pin.length < 4) { setError('PIN tối thiểu 4 ký tự'); return; }
    const result = verifyPin(userId, pin);
    if (result.success) {
      onConfirm(pin);
    } else if (result.locked) {
      setLocked(true);
      setLockMin(result.lockMinutes || 15);
      setError(`Tài khoản bị khóa ${result.lockMinutes} phút do nhập sai nhiều lần`);
    } else {
      setError(`PIN không đúng. Còn ${result.remainingAttempts} lần thử`);
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <Lock size={18} className="text-amber-400"/>
            </div>
            <div>
              <p className="text-white font-bold text-sm">Xác thực danh tính</p>
              <p className="text-slate-400 text-xs mt-0.5">{title}</p>
            </div>
          </div>
        </div>

        {/* PIN Input */}
        <div className="px-6 py-5">
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Nhập mã PIN cá nhân để xác nhận hành động phê duyệt này.
            Thao tác sẽ được ghi vào nhật ký kiểm toán.
          </p>

          {/* PIN dots display */}
          <div className="flex justify-center gap-3 mb-4">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all ${
                pin.length > i
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-transparent border-slate-300'
              }`}/>
            ))}
          </div>

          <input
            type="password"
            value={pin}
            onChange={e => { setPin(e.target.value.slice(0,6)); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Nhập PIN..."
            autoFocus
            disabled={locked}
            maxLength={6}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 disabled:bg-slate-50 disabled:text-slate-400"
          />

          {error && (
            <div className="mt-2 flex items-center gap-2 text-rose-600 text-xs bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="shrink-0"/>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-2">
          <button onClick={onCancel}
            className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={locked || pin.length < 4}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// WORKFLOW PROGRESS STEPPER
// ─────────────────────────────────────────────────

function WorkflowStepper({ doc }: { doc: ApprovalDoc }) {
  const workflow = WORKFLOWS[doc.docType];
  if (!workflow) return null;
  const steps = workflow.steps;
  const currIdx = steps.findIndex(s => s.stepId === doc.currentStepId);

  return (
    <div className="relative">
      <div className="flex items-start gap-0">
        {steps.map((step, idx) => {
          const isDone    = idx < currIdx || doc.status === 'COMPLETED' || doc.status === 'APPROVED';
          const isCurrent = idx === currIdx && doc.status !== 'COMPLETED';
          const isExt     = step.externalSign;

          return (
            <React.Fragment key={step.stepId}>
              <div className="flex flex-col items-center" style={{ minWidth: 0, flex: 1 }}>
                {/* Circle */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shrink-0 transition-all ${
                  isDone    ? 'bg-emerald-500 border-emerald-500 text-white' :
                  isCurrent ? 'bg-white border-amber-400 text-amber-600 animate-pulse' :
                  isExt     ? 'bg-violet-50 border-violet-300 text-violet-400' :
                              'bg-slate-50 border-slate-200 text-slate-300'
                }`}>
                  {isDone ? <CheckCircle2 size={12}/> :
                   isCurrent ? <Circle size={10}/> :
                   isExt ? '✍' : idx + 1}
                </div>
                {/* Label */}
                <p className={`text-[9px] text-center mt-1 leading-tight px-0.5 ${
                  isDone ? 'text-emerald-600 font-semibold' :
                  isCurrent ? 'text-amber-600 font-bold' :
                  'text-slate-400'
                }`} style={{ wordBreak: 'break-word' }}>
                  {step.label.length > 18 ? step.label.slice(0, 16) + '…' : step.label}
                </p>
              </div>
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mt-3 mx-0.5 rounded-full ${
                  idx < currIdx ? 'bg-emerald-400' : 'bg-slate-200'
                }`}/>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// DOC DETAIL PANEL
// ─────────────────────────────────────────────────

interface DocDetailProps {
  doc:         ApprovalDoc;
  ctx:         UserContext;
  onAction:    (action: 'APPROVE'|'REVIEW'|'REJECT'|'RETURN', doc: ApprovalDoc) => void;
  onClose:     () => void;
  uploadMode:  boolean;
  onUpload:    (doc: ApprovalDoc, file: File) => void;
  actionError?: string;
}

function DocDetailPanel({ doc, ctx, onAction, onClose, uploadMode, onUpload, actionError }: DocDetailProps) {
  const workflow    = WORKFLOWS[doc.docType];
  const statusCfg   = getStatusConfig(doc.status);
  const stepLabel   = getCurrentStepLabel(doc);
  const progress    = getWorkflowProgress(doc);
  const level       = getEffectiveLevel(ctx);

  const nextStep = getNextActionableStep(
    ctx, doc.docType, doc.currentStepId, doc.amount, doc.thresholds
  );
  const currStep    = WORKFLOWS[doc.docType]?.steps.find(s => s.stepId === doc.currentStepId);
  const { canAct }  = currStep ? canActOnStep(ctx, currStep, doc.amount, doc.thresholds) : { canAct: false };
  const canApprove    = canAct && !!nextStep && !nextStep.externalSign;
  const isReviewStep  = currStep?.actionType === 'review';
  const overThreshold = !canAct &&
    ['SUBMITTED','IN_REVIEW'].includes(doc.status) &&
    (doc.amount || 0) > 0;
  const canReject  = level >= 3 && ['SUBMITTED','IN_REVIEW'].includes(doc.status);
  const canReturn  = level >= 2 && ['SUBMITTED','IN_REVIEW'].includes(doc.status);

  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose}/>

      {/* Panel */}
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                doc.status === 'SUBMITTED' || doc.status === 'IN_REVIEW'
                  ? 'bg-amber-500/20' : 'bg-emerald-500/20'
              }`}>
                <span className={doc.status === 'SUBMITTED' || doc.status === 'IN_REVIEW'
                  ? 'text-amber-400' : 'text-emerald-400'}>
                  {DOC_TYPE_ICON[doc.docType] || <FileText size={14}/>}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{doc.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">{doc.docNumber}</p>
              </div>
            </div>
            <button onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors shrink-0 mt-0.5">
              <X size={18}/>
            </button>
          </div>

          {/* Status + progress */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
              style={{ color: statusCfg.color, backgroundColor: statusCfg.bgColor }}>
              {statusCfg.icon} {statusCfg.label}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all"
                  style={{ width: `${progress}%` }}/>
              </div>
              <span className="text-slate-400 text-[10px]">{progress}%</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Workflow stepper */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Luồng duyệt</p>
            <WorkflowStepper doc={doc}/>
          </div>

          {/* Current step highlight */}
          <div className={`rounded-xl border px-4 py-3 ${
            canApprove
              ? 'bg-amber-50 border-amber-200'
              : doc.status === 'PENDING_EXTERNAL'
              ? 'bg-violet-50 border-violet-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-400">Bước hiện tại</p>
            <p className={`text-sm font-bold ${
              canApprove ? 'text-amber-700' :
              doc.status === 'PENDING_EXTERNAL' ? 'text-violet-700' : 'text-slate-600'
            }`}>
              {stepLabel}
            </p>
            {doc.status === 'PENDING_EXTERNAL' && (
              <p className="text-xs text-violet-500 mt-1">
                Đang chờ chữ ký bên ngoài — upload file đã ký để hoàn tất
              </p>
            )}
            {nextStep?.pinRequired && canApprove && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Lock size={10}/> Cần xác thực PIN
              </p>
            )}
          </div>

          {/* Doc metadata */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Người tạo',    value: doc.createdByName },
              { label: 'Ngày tạo',     value: fmtTime(doc.createdAt) },
              { label: 'Loại chứng từ',value: workflow?.label || doc.docType },
              { label: 'Giá trị',      value: fmtMoney(doc.amount) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-bold text-slate-700 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Items breakdown — hiển thị đơn giá từng mặt hàng */}
          {(doc.data as any)?.voucher?.items?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Chi tiết hàng hóa
              </p>
              <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-slate-500 font-bold">Vật tư</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-bold">SL</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-bold">Đơn giá</th>
                      <th className="text-right px-3 py-2 text-slate-500 font-bold">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((doc.data as any).voucher.items as any[]).map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-700 font-medium">{item.matHang}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{item.soLuong} {item.donVi}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{fmtMoney(item.donGia)}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtMoney(item.thanhTien)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t border-slate-200">
                      <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-600">Tổng cộng</td>
                      <td className="px-3 py-2 text-right font-black text-emerald-700 text-xs">
                        {fmtMoney(doc.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Amount threshold indicator */}
          {doc.amount && doc.thresholds && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5">
              <BarChart2 size={12} className="shrink-0"/>
              <span>
                Ngưỡng duyệt L3: <strong>{fmtMoney(doc.thresholds.L3_max)}</strong>
                {doc.amount > doc.thresholds.L3_max
                  ? <span className="text-amber-600 font-bold ml-1">→ Cần PM phê duyệt</span>
                  : <span className="text-emerald-600 font-bold ml-1">→ CH Phó duyệt được</span>
                }
              </span>
            </div>
          )}

          {/* Audit log */}
          {doc.auditLog.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Lịch sử</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {[...doc.auditLog].reverse().map(entry => (
                  <div key={entry.id} className="flex items-start gap-2.5">
                    <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      {entry.action === 'APPROVE' ? <CheckCircle2 size={10} className="text-emerald-500"/> :
                       entry.action === 'REVIEW'  ? <Eye size={10} className="text-blue-500"/> :
                       entry.action === 'REJECT'  ? <XCircle size={10} className="text-rose-500"/> :
                       entry.action === 'RETURN'  ? <RotateCcw size={10} className="text-amber-500"/> :
                       entry.action === 'SUBMIT'  ? <ArrowRight size={10} className="text-blue-500"/> :
                       <Circle size={10} className="text-slate-400"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-snug">
                        <strong>{entry.userName}</strong>
                        {' '}
                        <span className="text-slate-500">
                          {entry.action === 'CREATE'  ? 'tạo chứng từ' :
                           entry.action === 'SUBMIT'  ? 'nộp để duyệt' :
                           entry.action === 'APPROVE' ? 'đã phê duyệt' :
                           entry.action === 'REVIEW'  ? 'xác nhận review' :
                           entry.action === 'REJECT'  ? 'từ chối' :
                           entry.action === 'RETURN'  ? 'trả về để sửa' :
                           entry.action}
                        </span>
                      </p>
                      {entry.comment && (
                        <p className="text-[10px] text-slate-400 italic mt-0.5">"{entry.comment}"</p>
                      )}
                      <p className="text-[9px] text-slate-300 mt-0.5">
                        {fmtTime(entry.timestamp)}
                        {entry.pinVerified && <span className="ml-1 text-emerald-400">• PIN verified</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* External sign upload */}
          {doc.status === 'PENDING_EXTERNAL' && (
            <div className="border-2 border-dashed border-violet-200 rounded-xl p-4 text-center">
              <Upload size={20} className="text-violet-400 mx-auto mb-2"/>
              <p className="text-sm font-bold text-violet-700 mb-1">Upload bản đã ký</p>
              <p className="text-xs text-violet-400 mb-3">PDF, JPG, PNG — tối đa 10MB</p>
              <input type="file" ref={fileRef} className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(doc, f); }}/>
              <button onClick={() => fileRef.current?.click()}
                className="bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors">
                Chọn file
              </button>
            </div>
          )}

          {/* Signed file link */}
          {doc.signedFileUrl && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-700">Đã có chữ ký bên ngoài</p>
                <p className="text-[10px] text-emerald-500 truncate">{doc.signedFileUrl}</p>
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        {(canApprove || canReject || canReturn || overThreshold) && (
          <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 shrink-0">
            {overThreshold && (
              <div className="mb-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5"/>
                <div>
                  <p className="text-xs text-rose-700 font-bold">Vượt hạn mức — cần cấp cao hơn</p>
                  <p className="text-[10px] text-rose-600 mt-0.5">
                    Giá trị <strong>{doc.amount ? (doc.amount/1_000_000).toFixed(0) + ' triệu' : '--'}</strong> vượt hạn mức của bạn. Chuyển tiếp lên PM hoặc Giám đốc.
                  </p>
                </div>
              </div>
            )}
            {actionError && (
              <div className="mb-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5"/>
                <p className="text-xs text-rose-700 font-semibold leading-snug">{actionError}</p>
              </div>
            )}
            <div className="flex gap-2">
              {canReturn && (
                <button onClick={() => onAction('RETURN', doc)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition-colors">
                  <RotateCcw size={12}/>
                  Trả về
                </button>
              )}
              {canReject && (
                <button onClick={() => onAction('REJECT', doc)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition-colors">
                  <XCircle size={12}/>
                  Từ chối
                </button>
              )}
              {canApprove && isReviewStep && (
                <button onClick={() => onAction('REVIEW', doc)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
                  <Eye size={14}/>
                  Xác nhận Review
                </button>
              )}
              {canApprove && !isReviewStep && (
                <button onClick={() => onAction('APPROVE', doc)}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  <CheckCircle2 size={14}/>
                  {processing ? 'Đang xử lý...' : 'Phê duyệt'}
                  {currStep?.pinRequired && !processing && <Lock size={11} className="opacity-70"/>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// DOC CARD
// ─────────────────────────────────────────────────

interface DocCardProps {
  doc:        ApprovalDoc;
  ctx:        UserContext;
  onClick:    () => void;
  highlight:  boolean;
  processing?: boolean;
  key?: React.Key;
}

function DocCard({ doc, ctx, onClick, highlight, processing = false }: DocCardProps) {
  const statusCfg = getStatusConfig(doc.status);
  const progress  = getWorkflowProgress(doc);
  const stepLabel      = getCurrentStepLabel(doc);
  const currStep       = WORKFLOWS[doc.docType]?.steps.find(s => s.stepId === doc.currentStepId);
  const { canAct }     = currStep ? canActOnStep(ctx, currStep, doc.amount, doc.thresholds) : { canAct: false };
  const nextStep       = getNextActionableStep(ctx, doc.docType, doc.currentStepId, doc.amount, doc.thresholds);
  const isMyTurn       = highlight && canAct && !!nextStep && !nextStep.externalSign;
  const isReviewStep   = currStep?.actionType === 'review';
  const needsEscalate  = highlight && !canAct &&
    ['SUBMITTED','IN_REVIEW'].includes(doc.status) && (doc.amount || 0) > 0;

  return (
    <button onClick={onClick}
      className={`w-full text-left rounded-2xl border transition-all hover:shadow-md group ${
        isMyTurn
          ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}>

      {/* Priority stripe */}
      {isMyTurn && (
        <div className="h-0.5 w-full rounded-t-2xl bg-gradient-to-r from-amber-400 to-amber-500"/>
      )}
      {needsEscalate && (
        <div className="h-0.5 w-full rounded-t-2xl bg-gradient-to-r from-rose-400 to-rose-500"/>
      )}

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isMyTurn ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {DOC_TYPE_ICON[doc.docType] || <FileText size={14}/>}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate leading-tight">{doc.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{doc.docNumber}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 whitespace-nowrap"
            style={{ color: statusCfg.color, backgroundColor: statusCfg.bgColor }}>
            {statusCfg.icon} {statusCfg.label}
          </span>
        </div>

        {/* Middle row: step + amount */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {isMyTurn
              ? <AlertTriangle size={11} className="text-amber-500 shrink-0"/>
              : needsEscalate
                ? <AlertTriangle size={11} className="text-rose-400 shrink-0"/>
                : <Clock size={11} className="text-slate-300 shrink-0"/>
            }
              {isMyTurn ? (
                <span className={`text-xs truncate max-w-[180px] font-semibold ${isReviewStep ? 'text-blue-700' : 'text-amber-700'}`}>
                  {isReviewStep ? `🔍 Review: ${currStep?.label}` : `Chờ bạn: ${nextStep?.label || currStep?.label}`}
                </span>
              ) : needsEscalate ? (
                <span className="text-xs truncate max-w-[180px] text-rose-600 font-semibold">↑ Cần cấp cao hơn</span>
              ) : (
                <span className="text-xs truncate max-w-[180px] text-slate-500">{stepLabel}</span>
              )}
          </div>
          {doc.amount && (
            <span className="text-xs font-bold text-slate-600">{fmtMoney(doc.amount)}</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${
              doc.status === 'REJECTED' ? 'bg-rose-400' :
              doc.status === 'COMPLETED' || doc.status === 'APPROVED' ? 'bg-emerald-400' :
              isMyTurn ? 'bg-amber-400' : 'bg-slate-300'
            }`} style={{ width: `${progress}%` }}/>
          </div>
          <span className="text-[9px] text-slate-400 shrink-0 w-8 text-right">{progress}%</span>
          <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0"/>
        </div>

        {/* Bottom: creator + time */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] text-slate-400">{doc.createdByName}</span>
          <span className="text-[10px] text-slate-400">{fmtTime(doc.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────

export default function ApprovalQueue({ projectId, projectName, ctx, onClose }: ApprovalQueueProps) {
  const { ok: notifOk } = useNotification();
  const [viewMode,     setViewMode]     = useState<ViewMode>('queue');
  const [docs,         setDocs]         = useState<ApprovalDoc[]>([]);
  const [queueDocs,    setQueueDocs]    = useState<ApprovalDoc[]>([]);
  const [selectedDoc,  setSelectedDoc]  = useState<ApprovalDoc | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [searchQ,      setSearchQ]      = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [actionError,  setActionError]  = useState<string>('');
  const [processing,   setProcessing]   = useState(false); // chặn double-approve
  const processedKeys = React.useRef<Set<string>>(new Set()); // idempotency key cache

  // PIN modal
  const [pinModal, setPinModal] = useState<{
    action: 'APPROVE'|'REVIEW'|'REJECT'|'RETURN';
    doc: ApprovalDoc;
    needPin: boolean;
    comment: string;
  } | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');

  const level = getEffectiveLevel(ctx);
  const [domainFilter, setDomainFilter] = useState<string>('all');

  // Load docs
  const loadDocs = useCallback(() => {
    setIsLoading(true);
    try {
      const all   = getAllDocs(projectId, ctx);
      const queue = getApprovalQueue(projectId, ctx);
      setDocs(all);
      setQueueDocs(queue);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, ctx]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Filtered docs based on view + filter + search
  const displayDocs = useMemo(() => {
    // Domain map: đủ 28 doc types theo nhóm
    const DOMAIN_DOCTYPES: Record<string, string[]> = {
      warehouse: ['WAREHOUSE_EXIT','WAREHOUSE_ENTRY','STOCK_TAKE','PROCUREMENT','MATERIAL_REQUEST','MATERIAL_INCOMING'],
      finance:   ['FINANCIAL_VOUCHER','PAYMENT_REQUEST','CONTRACT_AMENDMENT','SUBCONTRACT_PAYMENT','TIMESHEET','OVERTIME_REQUEST'],
      qs:        ['VARIATION_ORDER','ACCEPTANCE_INTERNAL','ACCEPTANCE_OWNER','PAYMENT_REQUEST','CONTRACT_AMENDMENT','SUBCONTRACT_PAYMENT','VENDOR_PREQUALIFICATION','VENDOR_EVALUATION'],
      qaqc:      ['NCR','RFI','INSPECTION_REQUEST','ITP_MANAGEMENT','METHOD_STATEMENT','DRAWING_REVISION','QUALITY_AUDIT','TESTING_LAB','MATERIAL_APPROVAL'],
      hse:       ['HSE_INCIDENT','PERMIT_TO_WORK','HSE_INSPECTION','CAPA'],
      hr:        ['LEAVE_REQUEST','DISCIPLINE','TIMESHEET','OVERTIME_REQUEST'],
      site:      ['WAREHOUSE_EXIT','WAREHOUSE_ENTRY','PROCUREMENT','MATERIAL_REQUEST','MATERIAL_INCOMING',
                  'VARIATION_ORDER','ACCEPTANCE_INTERNAL','ACCEPTANCE_OWNER',
                  'NCR','RFI','INSPECTION_REQUEST','ITP_MANAGEMENT','METHOD_STATEMENT',
                  'HSE_INCIDENT','PERMIT_TO_WORK','HSE_INSPECTION','CAPA',
                  'TIMESHEET','OVERTIME_REQUEST'],
      cross:     ['WAREHOUSE_EXIT','WAREHOUSE_ENTRY','STOCK_TAKE','PROCUREMENT','MATERIAL_REQUEST','MATERIAL_INCOMING',
                  'MATERIAL_APPROVAL','VARIATION_ORDER','ACCEPTANCE_INTERNAL','ACCEPTANCE_OWNER',
                  'PAYMENT_REQUEST','CONTRACT_AMENDMENT','SUBCONTRACT_PAYMENT',
                  'FINANCIAL_VOUCHER','TIMESHEET','OVERTIME_REQUEST',
                  'NCR','RFI','INSPECTION_REQUEST','ITP_MANAGEMENT','METHOD_STATEMENT','DRAWING_REVISION','QUALITY_AUDIT','TESTING_LAB',
                  'HSE_INCIDENT','PERMIT_TO_WORK','HSE_INSPECTION','CAPA',
                  'LEAVE_REQUEST','DISCIPLINE',
                  'VENDOR_PREQUALIFICATION','VENDOR_EVALUATION'],
    };
    // Compute visible docTypes for this ctx
    const visibleDocTypes = new Set<string>();
    const ctxDomains = (() => {
      const dm: Record<string, string[]> = {
        giam_doc:['cross'], pm:['cross'], ke_toan_truong:['finance','cross'],
        ke_toan_site:['finance'], ke_toan_kho:['finance','warehouse'],
        chi_huy_truong:['site','cross'], chi_huy_pho:['site','cross'],
        ks_giam_sat:['site','qaqc'], qaqc_site:['qaqc'],
        hse_site:['hse'], qs_site:['qs'],
        thu_kho:['warehouse'], thu_ky_site:['site'],
      };
      return dm[ctx.roleId] || ['cross'];
    })();
    ctxDomains.forEach(d => (DOMAIN_DOCTYPES[d] || []).forEach(dt => visibleDocTypes.add(dt)));

    let source: ApprovalDoc[] = [];
    if (viewMode === 'queue') source = queueDocs;
    else if (viewMode === 'mine') {
      // Match by exact userId OR by role-based userId convention (user_ROLE)
      // This handles the case where the user switches roles but views their own docs
      const myUserIds = new Set([
        ctx.userId,
        `user_${ctx.roleId}`,
      ]);
      source = docs.filter(d => myUserIds.has(d.createdBy));
    }
    else source = docs.filter(d => visibleDocTypes.has(d.docType));

    if (filterStatus !== 'ALL') source = source.filter(d => d.status === filterStatus);

    // Domain filter — only for 'all' view mode
    if (viewMode === 'all' && domainFilter !== 'all') {
      const DOMAIN_FILTER_MAP: Record<string, string[]> = {
        warehouse: ['WAREHOUSE_EXIT','WAREHOUSE_ENTRY','STOCK_TAKE','PROCUREMENT','MATERIAL_REQUEST','MATERIAL_INCOMING'],
        qs:        ['VARIATION_ORDER','ACCEPTANCE_INTERNAL','ACCEPTANCE_OWNER','PAYMENT_REQUEST','CONTRACT_AMENDMENT','SUBCONTRACT_PAYMENT','VENDOR_PREQUALIFICATION','VENDOR_EVALUATION'],
        finance:   ['FINANCIAL_VOUCHER','PAYMENT_REQUEST','CONTRACT_AMENDMENT','SUBCONTRACT_PAYMENT','TIMESHEET','OVERTIME_REQUEST'],
        qaqc:      ['NCR','RFI','INSPECTION_REQUEST','ITP_MANAGEMENT','METHOD_STATEMENT','DRAWING_REVISION','QUALITY_AUDIT','TESTING_LAB','MATERIAL_APPROVAL'],
        hse:       ['HSE_INCIDENT','PERMIT_TO_WORK','HSE_INSPECTION','CAPA'],
        hr:        ['LEAVE_REQUEST','DISCIPLINE','TIMESHEET','OVERTIME_REQUEST'],
      };
      const allowed = DOMAIN_FILTER_MAP[domainFilter] || [];
      source = source.filter(d => allowed.includes(d.docType));
    }

    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      source = source.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.docNumber.toLowerCase().includes(q) ||
        d.createdByName.toLowerCase().includes(q)
      );
    }
    return source;
  }, [viewMode, docs, queueDocs, filterStatus, searchQ, ctx.userId, domainFilter]);

  // Handle action
  const handleAction = (action: 'APPROVE'|'REVIEW'|'REJECT'|'RETURN', doc: ApprovalDoc) => {
    const workflow = WORKFLOWS[doc.docType];
    const steps    = workflow?.steps || [];
    const currStep = steps.find(s => s.stepId === doc.currentStepId);

    // REVIEW step: không cần PIN, không cần comment — thực hiện ngay
    if (action === 'REVIEW') {
      executeAction('REVIEW', doc, '', undefined);
      return;
    }

    // APPROVE: cần PIN nếu step yêu cầu VÀ là approve/r_a (không phải review)
    const needPin = currStep?.pinRequired
      && (currStep?.actionType === 'approve' || currStep?.actionType === 'r_a')
      && action === 'APPROVE';

    if (action !== 'APPROVE') {
      // Reject/Return: show comment modal only
      setPinModal({ action, doc, needPin: false, comment: '' });
      setShowCommentInput(true);
      return;
    }

    if (needPin) {
      setPinModal({ action, doc, needPin: true, comment: '' });
    } else {
      executeAction(action, doc, '', undefined);
    }
  };

  const executeAction = (
    action: 'APPROVE'|'REVIEW'|'REJECT'|'RETURN',
    doc: ApprovalDoc,
    comment: string,
    pin?: string,
  ) => {
    // ── Idempotency key: chặn double-approve cùng user/step ──────────────
    const iKey = `${doc.id}::${doc.currentStepId}::${action}::${ctx.userId}`;
    if (processing || processedKeys.current.has(iKey)) {
      setActionError('Thao tác này đã được xử lý. Vui lòng chờ.');
      setTimeout(() => setActionError(''), 3000);
      return;
    }
    setProcessing(true);
    processedKeys.current.add(iKey);

    const input: ProcessInput = {
      projectId, docId: doc.id, action, ctx, comment,
      ...(pin ? { pin } : {}),
    };
    const result = processApproval(input);
    if (result.ok) {
      loadDocs();
      setSelectedDoc(null);
      setPinModal(null);
      setComment('');
      setShowCommentInput(false);
    } else {
      // Nếu fail → xóa key để cho phép thử lại
      processedKeys.current.delete(iKey);
      setActionError((result as any).error || 'Có lỗi xảy ra');
      setTimeout(() => setActionError(''), 5000);
    }
    setProcessing(false);
  };

  const handleUpload = (doc: ApprovalDoc, file: File) => {
    // Simulate upload — in production: upload to Supabase Storage
    const fakeUrl = `https://storage.example.com/${doc.docNumber}_signed_${file.name}`;
    notifOk(`✅ Upload thành công: ${file.name}\nURL: ${fakeUrl}\n\nTrong môi trường production sẽ upload lên Supabase Storage.`);
    loadDocs();
  };

  const statusFilters: { value: FilterStatus; label: string }[] = [
    { value: 'ALL',              label: 'Tất cả' },
    { value: 'SUBMITTED',        label: 'Chờ duyệt' },
    { value: 'IN_REVIEW',        label: 'Đang xét' },
    { value: 'APPROVED',         label: 'Đã duyệt' },
    { value: 'PENDING_EXTERNAL', label: 'Chờ ký ngoài' },
    { value: 'COMPLETED',        label: 'Hoàn tất' },
    { value: 'REJECTED',         label: 'Từ chối' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-bold text-slate-800">Hàng chờ phê duyệt</h2>
            <p className="text-xs text-slate-400 mt-0.5">{projectName} · {ROLES[ctx.roleId]?.label}</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={18}/>
            </button>
          )}
        </div>

        {/* KPI strip — tách REVIEW / APPROVE */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {(() => {
            const reviewPending = queueDocs.filter(d => {
              const step = WORKFLOWS[d.docType]?.steps.find(s => s.stepId === d.currentStepId);
              return step?.actionType === 'review' || step?.actionType === 'r_a';
            });
            const approvePending = queueDocs.filter(d => {
              const step = WORKFLOWS[d.docType]?.steps.find(s => s.stepId === d.currentStepId);
              return step?.actionType === 'approve' || step?.actionType === 'r_a';
            });
            const inProgress = docs.filter(d => ['SUBMITTED','IN_REVIEW','PENDING_EXTERNAL'].includes(d.status));
            const doneToday  = docs.filter(d => {
              const today = new Date().toDateString();
              return d.status === 'COMPLETED' && new Date(d.updatedAt).toDateString() === today;
            });
            return [
              { label:'Chờ xác nhận', value: reviewPending.length,
                color: reviewPending.length > 0 ? 'text-blue-600'   : 'text-slate-400',
                bg:    reviewPending.length > 0 ? 'bg-blue-50 border-blue-200'   : 'bg-slate-50 border-slate-200',
                dot:   'bg-blue-500' },
              { label:'Chờ ký duyệt', value: approvePending.length,
                color: approvePending.length > 0 ? 'text-amber-600' : 'text-slate-400',
                bg:    approvePending.length > 0 ? 'bg-amber-50 border-amber-200': 'bg-slate-50 border-slate-200',
                dot:   'bg-amber-500' },
              { label:'Đang xử lý', value: inProgress.length,
                color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500' },
              { label:'Xong hôm nay', value: doneToday.length,
                color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
            ];
          })().map(kpi => (
            <div key={kpi.label} className={`rounded-xl border px-2.5 py-2 ${kpi.bg}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${kpi.dot}`}/>
              </div>
              <p className={`text-lg font-black ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[9px] text-slate-500 leading-tight">{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── VIEW MODE TABS ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-2 shrink-0">
        <div className="flex gap-1">
          {([
            { id:'queue', label:'Chờ tôi duyệt', badge: queueDocs.length },
            { id:'mine',  label:'Do tôi tạo', badge: 0 },
            { id:'all',   label:'Tất cả', badge: 0, minLevel: 3 },
          ] as { id: ViewMode; label: string; badge: number; minLevel?: number }[])
            .filter(v => !v.minLevel || level >= v.minLevel)
            .map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === v.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}>
                {v.label}
                {v.badge > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                    viewMode === v.id ? 'bg-amber-400 text-slate-900' : 'bg-rose-500 text-white'
                  }`}>{v.badge}</span>
                )}
              </button>
            ))
          }
        </div>
      </div>

      {/* ── DOMAIN FILTER TABS ── */}
      {viewMode === 'all' && (
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2 shrink-0 overflow-x-auto">
          <div className="flex gap-1 w-max">
            {([
              { id: 'all',       label: 'Tất cả nhóm' },
              { id: 'warehouse', label: '📦 Vật tư / Kho' },
              { id: 'qs',        label: '📐 QS / Hợp đồng' },
              { id: 'finance',   label: '💰 Tài chính' },
              { id: 'qaqc',      label: '🔍 QA/QC' },
              { id: 'hse',       label: '🦺 HSE' },
              { id: 'hr',        label: '👥 HR / NS' },
            ] as { id: string; label: string }[]).map(d => (
              <button key={d.id} onClick={() => setDomainFilter(d.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  domainFilter === d.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SEARCH + FILTER ── */}
      <div className="bg-white border-b border-slate-200 px-5 py-2.5 shrink-0 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Tìm theo tên, số hiệu..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as FilterStatus)}
            className="appearance-none pl-3 pr-7 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white cursor-pointer">
            {statusFilters.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
        </div>
      </div>

      {/* ── DOC LIST ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-slate-400 animate-spin"/>
          </div>
        ) : displayDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              {viewMode === 'queue'
                ? <CheckCheck size={28} className="text-emerald-400"/>
                : <FileText size={28} className="text-slate-300"/>
              }
            </div>
            <p className="text-sm font-bold text-slate-500 mb-1">
              {viewMode === 'queue' ? 'Không có gì chờ bạn duyệt' : 'Không tìm thấy chứng từ'}
            </p>
            <p className="text-xs text-slate-400">
              {viewMode === 'queue' ? 'Tốt lắm — hàng đợi trống!' : 'Thử thay đổi bộ lọc'}
            </p>
          </div>
        ) : (
          <>
            {/* Urgent section: docs waiting for this user */}
            {viewMode === 'all' && displayDocs.some(d => {
              const cs = WORKFLOWS[d.docType]?.steps.find(s => s.stepId === d.currentStepId);
              return cs ? canActOnStep(ctx, cs, d.amount, d.thresholds).canAct : false;
            }) && (
              <div className="flex items-center gap-2 py-1">
                <AlertTriangle size={11} className="text-amber-500 shrink-0"/>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Đang chờ bạn</p>
              </div>
            )}

            {displayDocs.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                ctx={ctx}
                onClick={() => setSelectedDoc(doc)}
                highlight={viewMode !== 'mine'}
                processing={processing}
              />
            ))}
          </>
        )}
      </div>

      {/* ── DETAIL PANEL ── */}
      {selectedDoc && (
        <DocDetailPanel
          doc={selectedDoc}
          ctx={ctx}
          onAction={handleAction}
          onClose={() => setSelectedDoc(null)}
          uploadMode={selectedDoc.status === 'PENDING_EXTERNAL'}
          onUpload={handleUpload}
          actionError={actionError}
        />
      )}

      {/* ── PIN MODAL ── */}
      {pinModal && pinModal.needPin && (
        <PinModal
          userId={ctx.userId}
          title={`${pinModal.action === 'APPROVE' ? 'Phê duyệt' : 'Xử lý'}: ${pinModal.doc.title}`}
          onConfirm={pin => executeAction(pinModal.action, pinModal.doc, comment, pin)}
          onCancel={() => { setPinModal(null); setComment(''); }}
        />
      )}

      {/* ── COMMENT MODAL (for reject/return) ── */}
      {pinModal && !pinModal.needPin && showCommentInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className={`px-6 py-4 ${pinModal.action === 'REJECT' ? 'bg-rose-600' : 'bg-amber-500'}`}>
              <p className="text-white font-bold">
                {pinModal.action === 'REJECT' ? '❌ Từ chối chứng từ' : '↩️ Trả về để sửa'}
              </p>
              <p className="text-white/80 text-xs mt-1">{pinModal.doc.title}</p>
            </div>
            <div className="p-5">
              <label className="text-xs font-bold text-slate-500 block mb-2">
                Lý do {pinModal.action === 'REJECT' ? 'từ chối' : 'trả về'} (bắt buộc)
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Nhập lý do cụ thể để người tạo biết cần sửa gì..."
                rows={3}
                autoFocus
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setPinModal(null); setComment(''); setShowCommentInput(false); }}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50">
                  Hủy
                </button>
                <button
                  onClick={() => executeAction(pinModal.action, pinModal.doc, comment)}
                  disabled={!comment.trim()}
                  className={`flex-1 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-colors ${
                    pinModal.action === 'REJECT'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}>
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
