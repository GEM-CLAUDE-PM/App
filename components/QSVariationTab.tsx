// QSVariationTab.tsx — GEM&CLAUDE PM Pro
// Variation Orders tab — tách từ QSDashboard.tsx

import React from "react";
import {
  Plus, X, Save, Send, Sparkles, Loader2, ChevronDown, ChevronRight,
  Check, Clock, TrendingUp, Hash, Calculator, Printer, Download,
  AlertTriangle
} from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { UserContext } from "./permissions";
import {
  type VariationOrder, type VOStatus, type VOType,
  MOCK_VOS, VO_STATUS, VO_TYPE_CFG, fmt, fmtB
} from "./QSTypes";

const genAI = new GoogleGenerativeAI(
  (import.meta as any).env?.VITE_GEMINI_API_KEY || ""
);

function VariationOrdersTab({ fmtB, fmt, projectId, qsCtx, qsLevel, submitQSDoc, findEngineDoc, triggerApproval, onVOApprovedRef }: {
  fmtB: (n:number)=>string; fmt: (n:number)=>string;
  projectId: string;
  qsCtx: UserContext;
  qsLevel: number;
  submitQSDoc: (itemId:string, docType:any, title:string, amount:number, extra:any, creator:UserContext) => string|null;
  findEngineDoc: (itemId:string) => any;
  triggerApproval: (docId:string, voucherId:string, type:'VO'|'ACCEPTANCE'|'PAYMENT', onApproved:(fa:boolean)=>void) => void;
  onVOApprovedRef: React.MutableRefObject<((voucherId:string)=>void)|null>;
}) {
  const [vos, setVos] = React.useState<VariationOrder[]>(MOCK_VOS);
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [filterType, setFilterType]     = React.useState<string>("all");
  const [showForm, setShowForm]         = React.useState(false);
  const [expandedId, setExpandedId]     = React.useState<string|null>(null);
  const [gemLoading, setGemLoading]     = React.useState(false);
  const [gemText, setGemText]           = React.useState("");

  // Seed VO docs vào engine (idempotent)
  React.useEffect(() => {
    if (!projectId) return;
    const seeds: SeedVoucherInput[] = vos.map(v => ({
      voucherId: v.id, voucherCode: v.vo_no,
      docType: 'VARIATION_ORDER' as any,
      title: `VO — ${v.title}`,
      amount: Math.abs(v.value_change),
      voucherData: v,
      legacyStatus: (v.status === 'approved' || v.status === 'implemented'
        ? 'approved' : v.status === 'submitted' ? 'pending'
        : v.status === 'rejected' ? 'rejected' : 'draft') as any,
    }));
    seedApprovalDocs(projectId, seeds);
  }, [projectId, vos.length]);

  // Register VO approved callback for parent PIN modal
  React.useEffect(() => {
    onVOApprovedRef.current = (voucherId: string) => {
      setVos(p => p.map(v => v.id === voucherId
        ? {...v, status: 'approved' as VOStatus, date_approved: new Date().toLocaleDateString('vi-VN')}
        : v));
    };
  }, []);

  const filtered = vos.filter(v =>
    (filterStatus==="all" || v.status===filterStatus) &&
    (filterType==="all"   || v.type===filterType)
  );

  const totalAdd  = vos.filter(v=>v.value_change>0&&v.status!=="rejected").reduce((s,v)=>s+v.value_change,0);
  const totalDed  = vos.filter(v=>v.value_change<0&&v.status!=="rejected").reduce((s,v)=>s+v.value_change,0);
  const netChange = totalAdd + totalDed;
  const pending   = vos.filter(v=>v.status==="submitted").length;
  const baseContract = 85_000_000_000;

  const analyzeWithGEM = async (vo: VariationOrder) => {
    setGemLoading(true); setGemText("");
    try {
      const { genAI: g } = await import('./gemini');
      const model = g.getGenerativeModel({ model:"gemini-3-flash-preview", systemInstruction: GEM_QS_SYSTEM });
      const prompt = `Phân tích Variation Order sau:\nVO: ${vo.vo_no} — ${vo.title}\nLoại: ${VO_TYPE_CFG[vo.type].label}\nGiá trị thay đổi: ${fmtB(vo.value_change)} VNĐ\nMô tả: ${vo.description}\nLý do: ${vo.reason}\n${vo.note?'Ghi chú: '+vo.note:''}\n\nHãy phân tích: (1) Tính hợp lệ của VO này, (2) Rủi ro pháp lý, (3) Khuyến nghị xử lý, (4) Các điểm cần làm rõ trước khi phê duyệt.`;
      const result = await model.generateContent(prompt);
      setGemText(result.response.text());
    } catch {
      setGemText("❌ Không thể kết nối GEM. Vui lòng thử lại.");
    }
    setGemLoading(false);
  };

  const [newVO, setNewVO] = React.useState({ vo_no:"", title:"", type:"scope_addition" as VOType, description:"", reason:"", value_change:"", submitted_by:"" });

  return (
    <div className="space-y-5">

      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mb-3"><Hash size={17}/></div>
          <div className="text-2xl font-bold text-slate-800">{vos.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Tổng VO phát sinh</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3"><TrendingUp size={17}/></div>
          <div className="text-lg font-bold text-emerald-700 leading-tight">{fmtB(netChange)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Biến động HĐ thuần ({netChange>=0?"+":""}{((netChange/baseContract)*100).toFixed(1)}%)</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
          <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3"><Clock size={17}/></div>
          <div className="text-2xl font-bold text-amber-700">{pending}</div>
          <div className="text-xs text-slate-500 mt-0.5">Đang chờ phê duyệt</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3"><Calculator size={17}/></div>
          <div className="text-lg font-bold text-slate-800 leading-tight">{fmtB(baseContract + netChange)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Giá trị HĐ điều chỉnh</div>
        </div>
      </div>

      {/* ── Pending alert ── */}
      {pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0"><AlertTriangle size={17} className="text-amber-600"/></div>
          <div>
            <p className="font-bold text-amber-800 text-sm">{pending} Variation Order đang chờ phê duyệt</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {vos.filter(v=>v.status==="submitted").map(v=><span key={v.id} className="mr-2">{v.vo_no} ({fmtB(v.value_change)})</span>)}
            </p>
          </div>
        </div>
      )}

      {/* ── GEM Analysis panel ── */}
      {gemText && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-blue-600"/>
            <span className="font-bold text-blue-800 text-sm">Nàng GEM — Phân tích Variation Order</span>
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{gemText}</div>
          <button onClick={()=>setGemText("")} className="mt-3 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"><X size={11}/>Đóng</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["all","draft","submitted","approved","rejected","implemented"] as const).map(s => (
            <button key={s} onClick={()=>setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${filterStatus===s?"bg-blue-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {s==="all"?"Tất cả":VO_STATUS[s].label}
              {s!=="all"&&<span className="ml-1 opacity-70">({vos.filter(v=>v.status===s).length})</span>}
            </button>
          ))}
        </div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm">
          <Plus size={15}/> Tạo Variation Order
        </button>
      </div>

      {/* ── VO List ── */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
            <Hash size={32} className="mx-auto mb-2 opacity-30"/>
            <p className="font-semibold">Không có Variation Order nào</p>
          </div>
        )}
        {filtered.map(vo => {
          const st  = VO_STATUS[vo.status];
          const tc  = VO_TYPE_CFG[vo.type];
          const isExpanded = expandedId === vo.id;
          const isPos = vo.value_change >= 0;

          return (
            <div key={vo.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${vo.status==="rejected"?"border-rose-200 opacity-80":vo.status==="submitted"?"border-amber-200":"border-slate-200"}`}>
              {/* VO Header */}
              <div className="p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={()=>setExpandedId(isExpanded?null:vo.id)}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${tc.cls} shrink-0`}>{tc.icon}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-black text-slate-800 text-sm">{vo.vo_no}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>{st.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tc.cls}`}>{tc.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 truncate">{vo.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Ngày tạo: {vo.date_issued} · {vo.submitted_by}{vo.date_approved&&` · Phê duyệt: ${vo.date_approved}`}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className={`text-base font-black ${isPos?"text-emerald-600":"text-rose-600"}`}>
                      {isPos?"+":""}{fmtB(vo.value_change)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isPos?"+":""}{((vo.value_change/vo.contract_value_before)*100).toFixed(2)}% HĐ
                    </div>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded?"rotate-180":""}`}/>
                </div>
              </div>

              {/* VO Detail (expanded) */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  <div className="p-4 space-y-4">
                    {/* Description + Reason */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 tracking-wide">Mô tả thay đổi</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{vo.description}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-600 uppercase mb-1.5 tracking-wide">Lý do / Căn cứ</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{vo.reason}</p>
                      </div>
                    </div>

                    {/* Note */}
                    {vo.note && (
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-rose-600 uppercase mb-1 tracking-wide">Ghi chú / Tranh chấp</p>
                        <p className="text-xs text-rose-700">{vo.note}</p>
                      </div>
                    )}

                    {/* BOQ items */}
                    {vo.boq_items.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">Chi tiết hạng mục thay đổi</p>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-semibold">
                              <tr>
                                <th className="px-3 py-2 text-left">Mã hạng mục</th>
                                <th className="px-3 py-2 text-left">Mô tả</th>
                                <th className="px-3 py-2 text-right">Thay đổi KL</th>
                                <th className="px-3 py-2 text-right">ĐVT</th>
                                <th className="px-3 py-2 text-right">Đơn giá</th>
                                <th className="px-3 py-2 text-right font-bold">Giá trị TĐ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {vo.boq_items.map((item,i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 font-mono text-slate-600">{item.code}</td>
                                  <td className="px-3 py-2 text-slate-700">{item.description}</td>
                                  <td className={`px-3 py-2 text-right font-bold ${item.qty_change>0?"text-emerald-600":item.qty_change<0?"text-rose-600":"text-slate-600"}`}>
                                    {item.qty_change>0?"+":""}{fmt(item.qty_change)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-500">{item.unit}</td>
                                  <td className="px-3 py-2 text-right text-slate-600">{fmtB(item.unit_price)}</td>
                                  <td className={`px-3 py-2 text-right font-bold ${item.qty_change*item.unit_price>=0?"text-emerald-700":"text-rose-600"}`}>
                                    {item.qty_change!==0?fmtB(item.qty_change*item.unit_price):"Điều chỉnh ĐG"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={()=>analyzeWithGEM(vo)} disabled={gemLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50">
                        {gemLoading?<Loader2 size={12} className="animate-spin"/>:<Sparkles size={12}/>}
                        GEM Phân tích VO
                      </button>
                      {vo.status==="draft" && (
                        <button onClick={() => {
                          // QS site nộp VO lên engine
                          const qsCreator: UserContext = { userId: `user_qs_site`, roleId: 'qs_site' as any };
                          const docId = submitQSDoc(
                            vo.id, 'VARIATION_ORDER', `VO — ${vo.title}`,
                            Math.abs(vo.value_change), { vo }, qsCreator,
                          );
                          if (docId) {
                            setVos(p => p.map(v => v.id===vo.id ? {...v, status:'submitted' as VOStatus} : v));
                          }
                        }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100">
                          <Send size={11}/> Gửi phê duyệt
                        </button>
                      )}
                      {vo.status==="submitted" && (
                        <>
                          {qsLevel >= 3 && (() => {
                            const doc = findEngineDoc(vo.id);
                            const approvable = doc && canApproveDoc(doc, qsCtx);
                            return approvable ? (
                              <button onClick={() => {
                                const doc = findEngineDoc(vo.id);
                                if (doc) triggerApproval(doc.id, vo.id, 'VO', (fa) => {
                                  onVOApprovedRef.current?.(vo.id);
                                  if (!fa) setVos(p => p.map(v => v.id===vo.id ? {...v, status:'submitted' as VOStatus} : v));
                                });
                              }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">
                                <CheckCircle2 size={11}/> Phê duyệt
                              </button>
                            ) : (
                              <span className="text-[10px] text-rose-600 font-semibold px-2 py-1 bg-rose-50 rounded-lg">
                                ↑ Vượt hạn mức — cần PM/GĐ
                              </span>
                            );
                          })()}
                          {qsLevel >= 3 && (
                            <button onClick={() => {
                              const doc = findEngineDoc(vo.id);
                              if (doc) {
                                processApproval({ projectId, docId: doc.id, action: 'REJECT', ctx: qsCtx });
                                setVos(p => p.map(v => v.id===vo.id ? {...v, status:'rejected' as VOStatus} : v));
                              }
                            }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100">
                              <X size={11}/> Từ chối
                            </button>
                          )}
                          {qsLevel < 3 && (
                            <span className="text-[10px] text-amber-600 px-2 py-1 bg-amber-50 rounded-lg">⏳ Chờ CH Phó duyệt</span>
                          )}
                        </>
                      )}
                      {vo.status==="approved" && (
                        <button onClick={()=>setVos(p=>p.map(v=>v.id===vo.id?{...v,status:"implemented" as VOStatus}:v))}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-xs font-bold hover:bg-teal-100">
                          <Check size={11}/> Đánh dấu đã thực hiện
                        </button>
                      )}
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">
                        <Printer size={11}/> In VO
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">
                        <Download size={11}/> Excel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Create VO Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Plus size={18} className="text-blue-600"/>Tạo Variation Order mới</h3>
              <button onClick={()=>setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18}/></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Số VO</label>
                <input placeholder="VD: VO-006" value={newVO.vo_no} onChange={e=>setNewVO(p=>({...p,vo_no:e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Loại thay đổi</label>
                <select value={newVO.type} onChange={e=>setNewVO(p=>({...p,type:e.target.value as VOType}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {Object.entries(VO_TYPE_CFG).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Tiêu đề VO</label>
                <input placeholder="Mô tả ngắn gọn nội dung thay đổi" value={newVO.title} onChange={e=>setNewVO(p=>({...p,title:e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Mô tả chi tiết thay đổi</label>
                <textarea value={newVO.description} onChange={e=>setNewVO(p=>({...p,description:e.target.value}))} rows={3}
                  placeholder="Mô tả đầy đủ phạm vi thay đổi, vị trí, hạng mục liên quan..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"/>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Lý do / Căn cứ</label>
                <textarea value={newVO.reason} onChange={e=>setNewVO(p=>({...p,reason:e.target.value}))} rows={2}
                  placeholder="Nêu rõ căn cứ pháp lý, biên bản họp, điều khoản HĐ liên quan..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Giá trị thay đổi (đồng)</label>
                <input placeholder="VD: 1850000000 (dương = tăng, âm = giảm)" value={newVO.value_change} onChange={e=>setNewVO(p=>({...p,value_change:e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Người lập</label>
                <input placeholder="VD: Nguyễn Văn Tùng (QS)" value={newVO.submitted_by} onChange={e=>setNewVO(p=>({...p,submitted_by:e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={()=>setShowForm(false)} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">Hủy</button>
              <button onClick={()=>{
                if(!newVO.vo_no||!newVO.title) return alert("Vui lòng điền Số VO và Tiêu đề!");
                const vo: VariationOrder = {
                  id: "vo_"+Date.now(), vo_no: newVO.vo_no, title: newVO.title,
                  type: newVO.type, status:"draft", date_issued: new Date().toLocaleDateString("vi-VN"),
                  value_change: Number(newVO.value_change)||0,
                  contract_value_before: 88_750_000_000,
                  description: newVO.description, reason: newVO.reason,
                  submitted_by: newVO.submitted_by, boq_items:[],
                };
                setVos(p=>[vo,...p]);
                setNewVO({ vo_no:"", title:"", type:"scope_addition", description:"", reason:"", value_change:"", submitted_by:"" });
                setShowForm(false);
                alert("✅ Đã tạo VO mới!");
              }} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
                <Save size={14}/> Tạo Variation Order
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}



export { VariationOrdersTab };
export default VariationOrdersTab;
