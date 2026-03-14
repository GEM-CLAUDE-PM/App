import { useState } from "react";

const ROLES_CFG = {
  thu_kho:        { label: "Thủ kho",        level: 1, color: "#64748b" },
  ks_giam_sat:    { label: "KS Giám sát",     level: 2, color: "#7c3aed" },
  qs_site:        { label: "QS Site",         level: 2, color: "#0284c7" },
  qaqc_site:      { label: "QA/QC Site",      level: 2, color: "#059669" },
  ke_toan_site:   { label: "KT Site",         level: 2, color: "#d97706" },
  chi_huy_pho:    { label: "CH Phó",          level: 3, color: "#b45309" },
  chi_huy_truong: { label: "CH Trưởng",       level: 3, color: "#92400e" },
  truong_qaqc:    { label: "Trưởng QA/QC",    level: 3, color: "#065f46" },
  pm:             { label: "PM",              level: 4, color: "#1d4ed8" },
  ke_toan_truong: { label: "KT Trưởng",       level: 4, color: "#b91c1c" },
  giam_doc:       { label: "Giám đốc",        level: 5, color: "#1e1b4b" },
  external:       { label: "CĐT/Đối tác",     level: 0, color: "#6b7280" },
};

const STEP_TYPES = {
  internal: { label: "Nội bộ",       icon: "✓"  },
  pin:      { label: "PIN bắt buộc", icon: "🔑" },
  external: { label: "Ký ngoài app", icon: "🤝" },
  upload:   { label: "Upload bản ký",icon: "📎" },
};

const TYPE_BG = {
  internal: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  pin:      { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" },
  external: { bg: "#f5f3ff", text: "#6d28d9", border: "#c4b5fd" },
  upload:   { bg: "#f0f9ff", text: "#0369a1", border: "#7dd3fc" },
};

const LEVEL_COLOR = { 0:"#6b7280",1:"#64748b",2:"#0284c7",3:"#b45309",4:"#1d4ed8",5:"#1e1b4b" };

const PRESETS = {
  tiny:   { label:"Siêu nhỏ < 10 tỷ",  L3_max:20_000_000,   L4_max:100_000_000  },
  small:  { label:"Nhỏ 10–50 tỷ",      L3_max:50_000_000,   L4_max:300_000_000  },
  medium: { label:"Vừa 50–200 tỷ",     L3_max:100_000_000,  L4_max:500_000_000  },
  large:  { label:"Lớn > 200 tỷ",      L3_max:200_000_000,  L4_max:1_000_000_000},
};

const fmtM = v => v >= 1e9 ? `${(v/1e9).toFixed(1)} tỷ` : `${(v/1e6).toFixed(0)} tr`;

const INIT = {
  WAREHOUSE_EXIT: {
    label:"Phiếu xuất kho", icon:"📤", cat:"Kho",
    note:"Nội bộ — thủ kho xuất → site sử dụng",
    steps:[
      {id:"create",     label:"Thủ kho lập phiếu",    role:"thu_kho",        type:"internal", skipAbove:null,    skipIfBelow:null},
      {id:"approve_l3", label:"CH Phó duyệt",          role:"chi_huy_pho",    type:"pin",      skipAbove:"L3_max",skipIfBelow:null},
      {id:"approve_l4", label:"PM duyệt",              role:"pm",             type:"pin",      skipAbove:"L4_max",skipIfBelow:"L3_max"},
      {id:"ledger",     label:"KT ghi sổ",             role:"ke_toan_site",   type:"internal", skipAbove:null,    skipIfBelow:null},
    ],
  },
  WAREHOUSE_ENTRY: {
    label:"Phiếu nhập kho", icon:"📥", cat:"Kho",
    note:"Nội bộ — mua về nhập kho",
    steps:[
      {id:"create",     label:"Thủ kho lập phiếu",    role:"thu_kho",        type:"internal", skipAbove:null,    skipIfBelow:null},
      {id:"approve_l3", label:"CH Phó duyệt",          role:"chi_huy_pho",    type:"pin",      skipAbove:"L3_max",skipIfBelow:null},
      {id:"approve_l4", label:"PM duyệt",              role:"pm",             type:"pin",      skipAbove:"L4_max",skipIfBelow:"L3_max"},
      {id:"ledger",     label:"KT ghi sổ",             role:"ke_toan_site",   type:"internal", skipAbove:null,    skipIfBelow:null},
    ],
  },
  VARIATION_ORDER: {
    label:"Variation Order", icon:"📋", cat:"Hợp đồng",
    note:"VO thay đổi KL/ĐG — CĐT ký nếu > L3_max",
    steps:[
      {id:"create",     label:"QS lập VO",             role:"qs_site",        type:"internal", skipAbove:null,    skipIfBelow:null},
      {id:"review_ch",  label:"CH Phó/Trưởng review",  role:"chi_huy_pho",    type:"pin",      skipAbove:"L3_max",skipIfBelow:null, note:"≤ L3_max → APPROVED nội bộ"},
      {id:"approve_l4", label:"PM ký nội bộ",          role:"pm",             type:"pin",      skipAbove:"L4_max",skipIfBelow:"L3_max"},
      {id:"approve_l5", label:"GĐ ký nội bộ",          role:"giam_doc",       type:"pin",      skipAbove:null,    skipIfBelow:"L4_max"},
      {id:"ext_sign",   label:"CĐT ký xác nhận",       role:"external",       type:"external", skipAbove:null,    skipIfBelow:"L3_max"},
      {id:"upload",     label:"Upload bản đã ký",      role:"qs_site",        type:"upload",   skipAbove:null,    skipIfBelow:"L3_max"},
    ],
  },
  ACCEPTANCE_INTERNAL: {
    label:"BBNT Nội bộ", icon:"✅", cat:"Nghiệm thu",
    note:"NT nội bộ (tự kiểm) — không cần CĐT",
    steps:[
      {id:"create",     label:"KS Giám sát lập",       role:"ks_giam_sat",    type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"review_qs",  label:"QS kiểm tra KL",        role:"qs_site",        type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"sign_ch",    label:"CH Trưởng ký",          role:"chi_huy_truong", type:"pin",      skipAbove:null,skipIfBelow:null},
    ],
  },
  ACCEPTANCE_OWNER: {
    label:"BBNT với CĐT", icon:"🤝", cat:"Nghiệm thu",
    note:"NT thanh toán — bắt buộc CĐT/TVGS ký",
    steps:[
      {id:"create",     label:"KS Giám sát lập",       role:"ks_giam_sat",    type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"review_qs",  label:"QS kiểm tra KL",        role:"qs_site",        type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"sign_ch",    label:"CH Trưởng ký",          role:"chi_huy_truong", type:"pin",      skipAbove:null,skipIfBelow:null},
      {id:"ext_sign",   label:"CĐT/TVGS ký",           role:"external",       type:"external", skipAbove:null,skipIfBelow:null},
      {id:"upload",     label:"Upload bản đã ký 2 bên",role:"qs_site",        type:"upload",   skipAbove:null,skipIfBelow:null},
    ],
  },
  PAYMENT_REQUEST: {
    label:"Yêu cầu Thanh toán", icon:"💰", cat:"Tài chính",
    note:"QS lập → CH → PM → GĐ tùy giá trị",
    steps:[
      {id:"create",     label:"QS lập YC",             role:"qs_site",        type:"internal", skipAbove:null,    skipIfBelow:null},
      {id:"approve_l3", label:"CH Phó/Trưởng duyệt",   role:"chi_huy_pho",    type:"pin",      skipAbove:"L3_max",skipIfBelow:null},
      {id:"approve_l4", label:"PM duyệt",              role:"pm",             type:"pin",      skipAbove:"L4_max",skipIfBelow:"L3_max"},
      {id:"approve_l5", label:"GĐ ký",                 role:"giam_doc",       type:"pin",      skipAbove:null,    skipIfBelow:"L4_max"},
    ],
  },
  PROCUREMENT: {
    label:"Đề xuất Mua sắm", icon:"🛒", cat:"Tài chính",
    note:"Mua vật tư / dịch vụ",
    steps:[
      {id:"create",     label:"Nhân viên lập ĐX",      role:"qs_site",        type:"internal", skipAbove:null,    skipIfBelow:null},
      {id:"approve_l3", label:"CH Phó/Trưởng duyệt",   role:"chi_huy_pho",    type:"pin",      skipAbove:"L3_max",skipIfBelow:null},
      {id:"approve_l4", label:"PM ký ngân sách",       role:"pm",             type:"pin",      skipAbove:"L4_max",skipIfBelow:"L3_max"},
      {id:"approve_l5", label:"GĐ ký",                 role:"giam_doc",       type:"pin",      skipAbove:null,    skipIfBelow:"L4_max"},
    ],
  },
  FINANCIAL_VOUCHER: {
    label:"Chứng từ Kế toán", icon:"📒", cat:"Tài chính",
    note:"Phiếu thu/chi nội bộ",
    steps:[
      {id:"create",     label:"KT Site lập",           role:"ke_toan_site",   type:"internal", skipAbove:null,    skipIfBelow:null},
      {id:"approve_l4", label:"KT Trưởng duyệt",       role:"ke_toan_truong", type:"pin",      skipAbove:"L4_max",skipIfBelow:null},
      {id:"approve_l5", label:"GĐ ký",                 role:"giam_doc",       type:"pin",      skipAbove:null,    skipIfBelow:"L4_max"},
    ],
  },
  CONTRACT_AMENDMENT: {
    label:"Phụ lục Hợp đồng", icon:"📝", cat:"Hợp đồng",
    note:"Luôn cần GĐ + Đối tác ký",
    steps:[
      {id:"create",     label:"QS/PM soạn",            role:"qs_site",        type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"approve_l4", label:"PM ký nội bộ",          role:"pm",             type:"pin",      skipAbove:null,skipIfBelow:null},
      {id:"approve_l5", label:"GĐ ký",                 role:"giam_doc",       type:"pin",      skipAbove:null,skipIfBelow:null},
      {id:"ext_sign",   label:"Đối tác ký",            role:"external",       type:"external", skipAbove:null,skipIfBelow:null},
      {id:"upload",     label:"Upload bản ký",         role:"qs_site",        type:"upload",   skipAbove:null,skipIfBelow:null},
    ],
  },
  NCR: {
    label:"Non-Conformance Report", icon:"⚠️", cat:"Chất lượng",
    note:"QA/QC phát hành → nhà thầu xử lý",
    steps:[
      {id:"create",   label:"QA/QC phát hành",         role:"qaqc_site",      type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"issue",    label:"Gửi nhà thầu phụ",        role:"external",       type:"external", skipAbove:null,skipIfBelow:null},
      {id:"respond",  label:"NTP phản hồi",            role:"external",       type:"external", skipAbove:null,skipIfBelow:null},
      {id:"verify",   label:"QA/QC xác nhận",          role:"qaqc_site",      type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"close",    label:"Trưởng QA/QC đóng",       role:"truong_qaqc",    type:"pin",      skipAbove:null,skipIfBelow:null},
    ],
  },
  HSE_INCIDENT: {
    label:"Báo cáo Sự cố HSE", icon:"🦺", cat:"An toàn",
    note:"Sự cố → Trưởng HSE → PM ghi nhận",
    steps:[
      {id:"create",     label:"Lập báo cáo",           role:"ks_giam_sat",    type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"approve_l3", label:"Trưởng HSE xác nhận",   role:"truong_qaqc",    type:"internal", skipAbove:null,skipIfBelow:null},
      {id:"approve_l4", label:"PM ghi nhận",           role:"pm",             type:"internal", skipAbove:null,skipIfBelow:null},
    ],
  },
};

const CATS = ["Kho","Nghiệm thu","Hợp đồng","Tài chính","Chất lượng","An toàn"];
const SUMMARY_ROLES = ["thu_kho","ks_giam_sat","qs_site","qaqc_site","ke_toan_site","chi_huy_pho","chi_huy_truong","pm","ke_toan_truong","giam_doc"];

export default function WorkflowDesigner() {
  const [wfs, setWfs]           = useState(INIT);
  const [thresh, setThresh]     = useState({ L3_max:50_000_000, L4_max:500_000_000 });
  const [preset, setPreset]     = useState("small");
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing]   = useState(null);   // {dt, si}
  const [changed, setChanged]   = useState(new Set());
  const [tab, setTab]           = useState("flows"); // flows | matrix
  const [exported, setExported] = useState(false);

  const applyPreset = k => { setThresh(PRESETS[k]); setPreset(k); };

  const upd = (dt, si, field, val) => {
    setWfs(p => {
      const w = { ...p[dt], steps: [...p[dt].steps] };
      w.steps[si] = { ...w.steps[si], [field]: val };
      return { ...p, [dt]: w };
    });
    setChanged(p => new Set([...p, dt]));
  };

  const addStep = (dt, afterSi) => {
    setWfs(p => {
      const w = { ...p[dt], steps: [...p[dt].steps] };
      w.steps.splice(afterSi+1, 0, { id:`s${Date.now()}`, label:"Bước mới", role:"chi_huy_pho", type:"internal", skipAbove:null, skipIfBelow:null });
      return { ...p, [dt]: w };
    });
    setChanged(p => new Set([...p, dt]));
  };

  const delStep = (dt, si) => {
    if (si === 0) return;
    setWfs(p => {
      const w = { ...p[dt], steps: p[dt].steps.filter((_,i) => i !== si) };
      return { ...p, [dt]: w };
    });
    setChanged(p => new Set([...p, dt]));
  };

  const reset = dt => {
    setWfs(p => ({ ...p, [dt]: INIT[dt] }));
    setChanged(p => { const s = new Set(p); s.delete(dt); return s; });
  };

  const copyJSON = () => {
    const out = JSON.stringify({ thresholds: thresh, workflows: wfs }, null, 2);
    try { navigator.clipboard.writeText(out); } catch(e) {}
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  const threshLabel = k => k === "L3_max"
    ? `L3_max (${fmtM(thresh.L3_max)})`
    : `L4_max (${fmtM(thresh.L4_max)})`;

  return (
    <div style={{ fontFamily:"'Inter',sans-serif", background:"#f8fafc", minHeight:"100vh" }}>

      {/* ── HEADER ── */}
      <div style={{ background:"linear-gradient(135deg,#0f172a,#1e40af)", color:"#fff", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, letterSpacing:"-0.3px" }}>⚙️ Workflow Designer</div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>GEM&CLAUDE PM Pro — Luồng ký duyệt hồ sơ</div>
        </div>
        <button onClick={copyJSON}
          style={{ background: exported ? "#059669":"#0d9488", color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
          {exported ? "✓ Đã copy!" : "📤 Copy JSON"}
        </button>
      </div>

      {/* ── TABS ── */}
      <div style={{ display:"flex", gap:4, padding:"12px 24px 0", borderBottom:"1px solid #e2e8f0", background:"#fff" }}>
        {[{id:"flows",label:"📋 Luồng ký"},{ id:"matrix",label:"📊 Ma trận duyệt"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:"8px 16px", fontSize:12, fontWeight:700, border:"none", borderBottom: tab===t.id ? "2.5px solid #2563eb":"2.5px solid transparent",
              color: tab===t.id ? "#2563eb":"#64748b", background:"transparent", cursor:"pointer", borderRadius:"8px 8px 0 0" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:"20px 24px", maxWidth:960, margin:"0 auto" }}>

        {/* ── THRESHOLDS ── */}
        <div style={{ background:"#fff", borderRadius:16, border:"1px solid #e2e8f0", padding:"20px", marginBottom:20, boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
          <div style={{ fontWeight:700, fontSize:13, color:"#334155", marginBottom:14 }}>🎚️ Hạn mức phê duyệt theo quy mô dự án</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
            {Object.entries(PRESETS).map(([k,p]) => (
              <button key={k} onClick={() => applyPreset(k)}
                style={{ padding:"6px 14px", fontSize:11, fontWeight:700, borderRadius:20, border:"1.5px solid",
                  borderColor: preset===k ? "#2563eb":"#cbd5e1",
                  background: preset===k ? "#2563eb":"#f8fafc",
                  color: preset===k ? "#fff":"#64748b", cursor:"pointer" }}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {[{k:"L3_max",label:"CH Phó/Trưởng (L3) tối đa",color:"#b45309"},
              {k:"L4_max",label:"PM (L4) tối đa",color:"#1d4ed8"}].map(({k,label,color}) => (
              <div key={k}>
                <div style={{ fontSize:11, fontWeight:600, color:"#64748b", marginBottom:6 }}>{label}</div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <input type="range" min={10_000_000} max={2_000_000_000} step={10_000_000}
                    value={thresh[k]} onChange={e => setThresh(p => ({...p,[k]:+e.target.value}))}
                    style={{ flex:1, accentColor:color }} />
                  <span style={{ fontSize:14, fontWeight:800, color, minWidth:60, textAlign:"right" }}>{fmtM(thresh[k])}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FLOWS TAB ── */}
        {tab === "flows" && CATS.map(cat => {
          const docs = Object.entries(wfs).filter(([,w]) => w.cat === cat);
          if (!docs.length) return null;
          return (
            <div key={cat} style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>{cat}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {docs.map(([dt, wf]) => {
                  const open = expanded === dt;
                  const isDirty = changed.has(dt);
                  return (
                    <div key={dt} style={{ background:"#fff", borderRadius:16, border:`1.5px solid ${isDirty?"#3b82f6":"#e2e8f0"}`, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>

                      {/* ── DOC HEADER ── */}
                      <button onClick={() => setExpanded(open ? null : dt)}
                        style={{ width:"100%", padding:"14px 20px", display:"flex", alignItems:"center", gap:12, background:"transparent", border:"none", cursor:"pointer", textAlign:"left" }}>
                        <span style={{ fontSize:20 }}>{wf.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontWeight:700, fontSize:13, color:"#1e293b" }}>{wf.label}</span>
                            {isDirty && <span style={{ fontSize:9, padding:"2px 7px", background:"#dbeafe", color:"#1d4ed8", borderRadius:20, fontWeight:700 }}>EDITED</span>}
                          </div>
                          <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{wf.note}</div>
                        </div>

                        {/* Steps preview */}
                        <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap", maxWidth:380 }}>
                          {wf.steps.map((s,i) => {
                            const r = ROLES_CFG[s.role];
                            const tc = TYPE_BG[s.type];
                            return (
                              <span key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>
                                <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:tc.bg, color:tc.text, border:`1px solid ${tc.border}`, whiteSpace:"nowrap" }}>
                                  {STEP_TYPES[s.type].icon} {r?.label}
                                </span>
                                {i < wf.steps.length-1 && <span style={{ color:"#cbd5e1", fontSize:12 }}>→</span>}
                              </span>
                            );
                          })}
                        </div>
                        <span style={{ color:"#94a3b8", fontSize:14, marginLeft:8 }}>{open?"▲":"▼"}</span>
                      </button>

                      {/* ── EXPANDED ── */}
                      {open && (
                        <div style={{ borderTop:"1px solid #f1f5f9" }}>
                          <div style={{ padding:"8px 20px", background:"#f8fafc", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <span style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase" }}>{wf.steps.length} bước — nhấn ✏️ để chỉnh sửa</span>
                            <button onClick={() => reset(dt)} style={{ fontSize:10, color:"#ef4444", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>↺ Reset</button>
                          </div>

                          <div style={{ padding:"16px 20px" }}>
                            {wf.steps.map((step, si) => {
                              const r = ROLES_CFG[step.role];
                              const tc = TYPE_BG[step.type];
                              const isEd = editing?.dt===dt && editing?.si===si;
                              return (
                                <div key={step.id}>
                                  <div style={{ borderRadius:12, border:`1.5px solid ${isEd?"#3b82f6":tc.border}`, background: isEd?"#eff6ff":tc.bg, padding:"10px 14px", marginBottom:2 }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                      {/* Number */}
                                      <div style={{ width:24, height:24, borderRadius:"50%", background:LEVEL_COLOR[r?.level||0], color:"#fff", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                        {si+1}
                                      </div>
                                      {/* Info */}
                                      <div style={{ flex:1 }}>
                                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                          <span style={{ fontWeight:700, fontSize:12, color:"#1e293b" }}>{step.label}</span>
                                          <span style={{ fontSize:10, padding:"1px 8px", borderRadius:20, background:r?.color||"#64748b", color:"#fff", fontWeight:700 }}>{r?.label}</span>
                                          <span style={{ fontSize:10, padding:"1px 8px", borderRadius:20, background:tc.bg, color:tc.text, border:`1px solid ${tc.border}`, fontWeight:600 }}>
                                            {STEP_TYPES[step.type].icon} {STEP_TYPES[step.type].label}
                                          </span>
                                          {step.skipAbove && (
                                            <span style={{ fontSize:9, padding:"1px 7px", background:"#f0fdf4", color:"#15803d", border:"1px solid #86efac", borderRadius:20, fontWeight:600 }}>
                                              ⇡ skip nếu &gt; {threshLabel(step.skipAbove)}
                                            </span>
                                          )}
                                          {step.skipIfBelow && (
                                            <span style={{ fontSize:9, padding:"1px 7px", background:"#fff1f2", color:"#be123c", border:"1px solid #fda4af", borderRadius:20, fontWeight:600 }}>
                                              ✕ bỏ nếu ≤ {threshLabel(step.skipIfBelow)}
                                            </span>
                                          )}
                                          {step.note && <span style={{ fontSize:10, color:"#94a3b8", fontStyle:"italic" }}>{step.note}</span>}
                                        </div>
                                      </div>
                                      {/* Buttons */}
                                      <div style={{ display:"flex", gap:6 }}>
                                        <button onClick={() => setEditing(isEd ? null : {dt,si})}
                                          style={{ padding:"3px 10px", fontSize:10, fontWeight:700, background: isEd?"#dbeafe":"#f1f5f9", color: isEd?"#1d4ed8":"#475569", border:`1px solid ${isEd?"#93c5fd":"#cbd5e1"}`, borderRadius:8, cursor:"pointer" }}>
                                          {isEd ? "▲ Đóng" : "✏️"}
                                        </button>
                                        {si > 0 && (
                                          <button onClick={() => delStep(dt,si)}
                                            style={{ padding:"3px 8px", fontSize:10, fontWeight:700, background:"#fff1f2", color:"#be123c", border:"1px solid #fda4af", borderRadius:8, cursor:"pointer" }}>✕</button>
                                        )}
                                      </div>
                                    </div>

                                    {/* ── INLINE EDITOR ── */}
                                    {isEd && (
                                      <div style={{ marginTop:12, paddingTop:12, borderTop:"1px dashed #bfdbfe", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                                        {[
                                          { label:"Tên bước", field:"label", type:"text" },
                                        ].map(({label,field}) => (
                                          <div key={field}>
                                            <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                                            <input value={step[field]||""} onChange={e => upd(dt,si,field,e.target.value)}
                                              style={{ width:"100%", padding:"6px 10px", fontSize:12, border:"1.5px solid #cbd5e1", borderRadius:8, outline:"none", boxSizing:"border-box" }} />
                                          </div>
                                        ))}
                                        <div>
                                          <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>Người thực hiện</div>
                                          <select value={step.role} onChange={e => upd(dt,si,"role",e.target.value)}
                                            style={{ width:"100%", padding:"6px 10px", fontSize:12, border:"1.5px solid #cbd5e1", borderRadius:8, outline:"none" }}>
                                            {Object.entries(ROLES_CFG).map(([id,r]) => (
                                              <option key={id} value={id}>{r.label} (L{r.level})</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>Loại bước</div>
                                          <select value={step.type} onChange={e => upd(dt,si,"type",e.target.value)}
                                            style={{ width:"100%", padding:"6px 10px", fontSize:12, border:"1.5px solid #cbd5e1", borderRadius:8, outline:"none" }}>
                                            {Object.entries(STEP_TYPES).map(([id,t]) => (
                                              <option key={id} value={id}>{t.icon} {t.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div>
                                          <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>⇡ Skip nếu vượt</div>
                                          <select value={step.skipAbove||"none"} onChange={e => upd(dt,si,"skipAbove",e.target.value==="none"?null:e.target.value)}
                                            style={{ width:"100%", padding:"6px 10px", fontSize:12, border:"1.5px solid #cbd5e1", borderRadius:8, outline:"none" }}>
                                            <option value="none">— Không skip —</option>
                                            <option value="L3_max">Vượt L3_max ({fmtM(thresh.L3_max)}) → leo thang</option>
                                            <option value="L4_max">Vượt L4_max ({fmtM(thresh.L4_max)}) → leo thang</option>
                                          </select>
                                        </div>
                                        <div>
                                          <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>✕ Bỏ qua nếu ≤</div>
                                          <select value={step.skipIfBelow||"none"} onChange={e => upd(dt,si,"skipIfBelow",e.target.value==="none"?null:e.target.value)}
                                            style={{ width:"100%", padding:"6px 10px", fontSize:12, border:"1.5px solid #cbd5e1", borderRadius:8, outline:"none" }}>
                                            <option value="none">— Luôn thực hiện —</option>
                                            <option value="L3_max">≤ L3_max ({fmtM(thresh.L3_max)}) → bỏ qua bước này</option>
                                            <option value="L4_max">≤ L4_max ({fmtM(thresh.L4_max)}) → bỏ qua bước này</option>
                                          </select>
                                        </div>
                                        <div>
                                          <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", marginBottom:4 }}>Ghi chú</div>
                                          <input value={step.note||""} onChange={e => upd(dt,si,"note",e.target.value)}
                                            placeholder="Chú thích nghiệp vụ..."
                                            style={{ width:"100%", padding:"6px 10px", fontSize:12, border:"1.5px solid #cbd5e1", borderRadius:8, outline:"none", boxSizing:"border-box" }} />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Add step button */}
                                  <div style={{ display:"flex", justifyContent:"center", margin:"2px 0" }}>
                                    <button onClick={() => addStep(dt,si)}
                                      style={{ fontSize:10, color:"#cbd5e1", background:"none", border:"none", cursor:"pointer", padding:"2px 12px", borderRadius:20, fontWeight:700 }}
                                      onMouseEnter={e => e.target.style.color="#3b82f6"}
                                      onMouseLeave={e => e.target.style.color="#cbd5e1"}>
                                      + thêm bước
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── MATRIX TAB ── */}
        {tab === "matrix" && (
          <div style={{ background:"#fff", borderRadius:16, border:"1px solid #e2e8f0", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            <div style={{ padding:"14px 20px", background:"#f8fafc", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"#334155" }}>📊 Ma trận — Ai duyệt loại hồ sơ nào</div>
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>🔑 = cần PIN &nbsp; ✓ = nội bộ &nbsp; 🤝 = ký ngoài &nbsp; 📎 = upload</div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:"1.5px solid #e2e8f0" }}>
                    <th style={{ textAlign:"left", padding:"10px 16px", fontWeight:700, color:"#475569", background:"#f8fafc", minWidth:160 }}>Loại hồ sơ</th>
                    {SUMMARY_ROLES.map(rid => {
                      const r = ROLES_CFG[rid];
                      return (
                        <th key={rid} style={{ padding:"6px 8px", fontWeight:700, color:r.color, background:"#f8fafc", textAlign:"center", whiteSpace:"nowrap", fontSize:10 }}>
                          <div>{r.label}</div>
                          <div style={{ fontSize:9, color:"#94a3b8", fontWeight:500 }}>L{r.level}</div>
                        </th>
                      );
                    })}
                    <th style={{ padding:"6px 8px", fontWeight:700, color:"#6b7280", background:"#f8fafc", textAlign:"center", fontSize:10 }}>CĐT/<br/>ĐT</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(wfs).map(([dt, wf], ri) => (
                    <tr key={dt} style={{ borderBottom:"1px solid #f1f5f9", background: ri%2===0?"#fff":"#fafafa" }}>
                      <td style={{ padding:"8px 16px", fontWeight:600, color:"#1e293b" }}>
                        <span style={{ marginRight:6 }}>{wf.icon}</span>{wf.label}
                      </td>
                      {SUMMARY_ROLES.map(rid => {
                        const match = wf.steps.find(s => s.role === rid);
                        const icon = match ? (match.type==="pin"?"🔑":match.type==="external"?"🤝":match.type==="upload"?"📎":"✓") : null;
                        return (
                          <td key={rid} style={{ textAlign:"center", padding:"8px 6px" }}>
                            {icon
                              ? <span title={match.label} style={{ fontSize:14 }}>{icon}</span>
                              : <span style={{ color:"#e2e8f0", fontSize:12 }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ textAlign:"center", padding:"8px 6px" }}>
                        {wf.steps.some(s => s.role==="external")
                          ? <span style={{ fontSize:14 }}>🤝</span>
                          : <span style={{ color:"#e2e8f0", fontSize:12 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
