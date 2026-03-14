import { db } from "./db";
import { getProjectTemplate, PROJECT_TEMPLATES } from "./projectTemplates";
import { useNotification } from './NotificationEngine';
import React, { useState, useRef, useCallback, useEffect } from "react";
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import {
  createDocument, processApproval, submitDocument, getApprovalQueue,
  canApproveDoc, type ApprovalDoc,
} from "./approvalEngine";
import { type UserContext, WORKFLOWS, canActOnStep } from "./permissions";
import ApprovalQueue from "./ApprovalQueue";
import { usePrint, ITPPrint, NCRPrint } from "./PrintService";
import {
  ClipboardCheck, XCircle, Plus, X, Search, Mic, UploadCloud,
  Printer, CheckCircle2, AlertCircle, ChevronRight, FileText,
  Camera, Sparkles, LayoutDashboard, Clock, Calendar, Check,
  User, MapPin, AlertTriangle, ShieldCheck, MessageSquare,
  Send, Loader2, Download, Eye, Trash2, Target, BarChart2,
  Layers, Upload, Edit3, GripVertical, Settings, BookOpen,
  FolderOpen, ArrowLeft, Save, Star, FileSpreadsheet, Info,
  Hash, AlignLeft, List, ToggleLeft, Type, Table as TableIcon,
  Filter, ChevronDown, Activity, Award,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — SHARED TYPES
// ══════════════════════════════════════════════════════════════════════════════
interface ChecklistItem { l: string; d: string; checked?: boolean }
interface Checklist {
  id: number; name: string; status: string;
  progress: number; date: string; docType: string; location?: string;
}
interface Defect {
  id: string; title: string; severity: string; status: string;
  reportedBy: string; date: string; location?: string; deadline?: string;
}
interface Feedback {
  id: number; sender: string; type: string; content: string;
  priority: string; status: string; reply: string; replyDate: string;
}
interface ChatMessage { role: "gem" | "user"; text: string }

// ── Form Template Types ──────────────────────────────────────────────────────
type FieldType = "text" | "textarea" | "date" | "select" | "table" | "signature" | "checkbox" | "number";
interface TemplateField {
  id: string; label: string; type: FieldType;
  placeholder?: string; required?: boolean;
  autoFill?: string; options?: string[];
  tableColumns?: string[]; tableRows?: number;
  rows?: number;
}
interface FormTemplate {
  id: string; name: string; code: string; category: string;
  description: string; fields: TemplateField[];
  headerConfig: { projectName: boolean; projectCode: boolean; nationalHeader: boolean };
  footerConfig: { signatories: string[]; notes?: string };
  uploadedFile?: { name: string; type: "docx" | "xlsx" | "pdf"; size: string; uploadedAt: string };
  isSystem: boolean; projectId?: string; createdAt: string; usageCount: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — CONSTANTS & STATIC DATA
// ══════════════════════════════════════════════════════════════════════════════
// ── localStorage keys chuẩn SI V2.0 ─────────────────────────────────────────
// ── DB via db.ts (localStorage dev / Supabase prod) ─────────────────────────

;

const GEM_QAQC_SYSTEM = `Bạn là Nàng GEM Siêu Việt — chuyên gia QA/QC của hệ thống Construction ERP.
Giọng điệu: nữ miền Nam, thân thiện, chuyên nghiệp. Xưng "em", gọi "Anh/Chị", dùng: dạ / nha / ạ / nghen.
Câu ngắn, rõ ràng, liệt kê bằng số. Thực tế ngành xây dựng Việt Nam, theo TCVN và tiêu chuẩn hiện hành.
Khi soạn biên bản/tài liệu chính thức: KHÔNG xưng em/anh, dùng ngôi thứ ba, cấu trúc chuẩn CHXHCN Việt Nam.`;

const PRINT_STYLES = `
  @media print {
    html, body, #root { visibility: hidden !important; }
    .vung-in-doc-quyen { visibility: visible !important; position: absolute !important; left:0; top:0; width:100%; padding:15mm !important; background:white !important; }
    table { border-collapse: collapse !important; width: 100% !important; }
    th, td { border: 1px solid black !important; padding: 8px !important; }
    @page { size: A4; margin: 0; }
  }
`;

const DOC_TYPES_QAQC = [
  { id: "ITP", label: "Nghiệm thu Công việc xây dựng",   color: "emerald" },
  { id: "MIR", label: "Nghiệm thu Vật liệu đầu vào",     color: "blue"    },
  { id: "KL",  label: "Nghiệm thu Công việc Khuất lấp",  color: "amber"   },
  { id: "NCR", label: "Phiếu Không phù hợp (NCR)",        color: "rose"    },
  { id: "HSE", label: "Kiểm tra An toàn (HSE)",           color: "orange"  },
];

const TEMPLATE_CATEGORIES = [
  { id: "ITP",  label: "Nghiệm thu công việc",    color: "emerald" },
  { id: "NCR",  label: "Không phù hợp (NCR)",     color: "rose"    },
  { id: "HSE",  label: "An toàn - Môi trường",    color: "orange"  },
  { id: "RFI",  label: "Yêu cầu nghiệm thu",      color: "blue"    },
  { id: "MIR",  label: "Nghiệm thu vật liệu",     color: "indigo"  },
  { id: "QS",   label: "Khối lượng nghiệm thu",   color: "teal"    },
  { id: "LOG",  label: "Nhật ký thi công",        color: "violet"  },
  { id: "BG",   label: "Bàn giao hạng mục",       color: "slate"   },
];

const AUTO_FILL_KEYS: Record<string, string> = {
  project_name:    "Tên dự án",
  project_address: "Địa chỉ công trình",
  date_today:      "Ngày hôm nay",
  month_year:      "Tháng / Năm",
  contractor_name: "Tên nhà thầu",
  inspector_name:  "Tên kỹ thuật QA/QC",
};

const FIELD_TYPES_LIST = [
  { type: "text" as FieldType,      label: "Văn bản ngắn", icon: <Type size={13}/>        },
  { type: "textarea" as FieldType,  label: "Văn bản dài",  icon: <AlignLeft size={13}/>   },
  { type: "date" as FieldType,      label: "Ngày tháng",   icon: <Calendar size={13}/>    },
  { type: "number" as FieldType,    label: "Số liệu",      icon: <Hash size={13}/>        },
  { type: "select" as FieldType,    label: "Lựa chọn",     icon: <List size={13}/>        },
  { type: "checkbox" as FieldType,  label: "Đánh dấu",     icon: <ToggleLeft size={13}/>  },
  { type: "table" as FieldType,     label: "Bảng dữ liệu", icon: <TableIcon size={13}/>   },
  { type: "signature" as FieldType, label: "Ký tên",       icon: <Edit3 size={13}/>       },
];

// ── Initial QA/QC Data ───────────────────────────────────────────────────────
const INIT_CHECKLISTS: Checklist[] = [
  { id: 1, name: "Nghiệm thu cốt thép móng M1",      status: "Hoàn thành",      progress: 100, date: "01/03/2026", docType: "ITP", location: "Khu A - Trục 1-3"        },
  { id: 2, name: "Nghiệm thu ván khuôn sàn tầng 2",  status: "Hoàn thành",      progress: 100, date: "05/03/2026", docType: "ITP", location: "Tầng 2 - Block B"         },
  { id: 3, name: "Kiểm tra vật liệu thép CB300",      status: "Hoàn thành",      progress: 100, date: "28/02/2026", docType: "MIR", location: "Bãi tập kết vật tư"      },
  { id: 4, name: "Nghiệm thu cốt thép sàn tầng 5",   status: "Đang tiến hành", progress: 60,  date: "07/03/2026", docType: "ITP", location: "Tầng 5 - Toàn bộ"         },
  { id: 5, name: "Kiểm tra an toàn hệ giàn giáo",    status: "Đang tiến hành", progress: 40,  date: "08/03/2026", docType: "HSE", location: "Mặt ngoài Tầng 3-5"       },
  { id: 6, name: "Nghiệm thu xây tường phân khu A",  status: "Chưa bắt đầu",  progress: 0,   date: "10/03/2026", docType: "ITP", location: "Phân khu A"                },
];
const INIT_DEFECTS: Defect[] = [
  { id: "NCR-001", title: "Rỗ tổ ong bề mặt cột C1",              severity: "Cao",       status: "Đang xử lý",  reportedBy: "Lê Thị C",    date: "01/03/2026", location: "Cột C1 - Tầng 3",      deadline: "08/03/2026" },
  { id: "NCR-002", title: "Sai lệch kích thước ván khuôn dầm D3", severity: "Trung bình", status: "Chờ duyệt",  reportedBy: "Trần Văn B",  date: "28/02/2026", location: "Dầm D3 - Tầng 2",      deadline: "10/03/2026" },
  { id: "NCR-003", title: "Thép sàn thiếu lớp bảo vệ (con kê)",   severity: "Cao",       status: "Đã khắc phục", reportedBy: "Đặng Văn G",  date: "25/02/2026", location: "Sàn tầng 2 - Khu B",   deadline: "05/03/2026" },
  { id: "NCR-004", title: "Đường hàn cột thép không đều",          severity: "Thấp",      status: "Đã khắc phục", reportedBy: "Lê Thị C",    date: "20/02/2026", location: "Cột thép - Tầng 1",    deadline: "01/03/2026" },
  { id: "NCR-005", title: "Bê tông lót móng thiếu chiều dày",      severity: "Trung bình", status: "Chờ duyệt",  reportedBy: "Bùi Thị H",  date: "03/03/2026", location: "Móng M5 - Khu C",       deadline: "12/03/2026" },
];
const INIT_FEEDBACKS: Feedback[] = [
  { id: 1, sender: "Chủ đầu tư", type: "Khiếu nại",  content: "Tiến độ hoàn thiện tầng 5 chậm hơn kế hoạch 2 ngày.",                    priority: "Cao",       status: "Chờ phản hồi", reply: "", replyDate: "" },
  { id: 2, sender: "TVGS",       type: "Kiến nghị",  content: "Cần bổ sung thêm 2 máy trắc đạc cho khu vực tháp B.",                    priority: "Trung bình", status: "Đã trả lời",  reply: "Đã điều động 02 máy từ đội khảo sát số 1 vào sáng 06/03.", replyDate: "06/03/2026" },
  { id: 3, sender: "Tổ đội",     type: "Báo cáo",    content: "Hệ thống điện thi công khu B bị chập, cần kiểm tra lại.",                priority: "Cao",       status: "Chờ phản hồi", reply: "", replyDate: "" },
];
const PROJECT_SCHEDULE_ITEMS = [
  { id: "S1", task: "Nghiệm thu Cốt thép sàn tầng 5",  planDate: "2026-03-07", standard: "TCVN 4453:1995"      },
  { id: "S2", task: "Nghiệm thu Ván khuôn sàn tầng 5", planDate: "2026-03-08", standard: "TCVN 4453:1995"      },
  { id: "S3", task: "Nghiệm thu Xây tường phân khu A", planDate: "2026-03-10", standard: "TCVN 9377-1:2012"    },
];

// ── System Templates ─────────────────────────────────────────────────────────
const SYSTEM_TEMPLATES: FormTemplate[] = [
  {
    id: "sys-itp-001", name: "Biên bản Nghiệm thu Công việc Xây dựng",
    code: "ITP-STD-001", category: "ITP", isSystem: true, createdAt: "01/01/2026", usageCount: 47,
    description: "Mẫu chuẩn nghiệm thu 3 bên theo Thông tư 26/2016/TT-BXD",
    headerConfig: { projectName: true, projectCode: true, nationalHeader: true },
    footerConfig: { signatories: ["Đại diện Chủ đầu tư", "Tư vấn Giám sát", "Đơn vị Thi công"] },
    fields: [
      { id:"f1", label:"Tên dự án",                    type:"text",     required:true,  autoFill:"project_name"    },
      { id:"f2", label:"Địa điểm xây dựng",            type:"text",     required:true,  autoFill:"project_address" },
      { id:"f3", label:"Ngày nghiệm thu",              type:"date",     required:true,  autoFill:"date_today"      },
      { id:"f4", label:"Công việc được nghiệm thu",    type:"textarea", required:true,  rows:3, placeholder:"Mô tả hạng mục nghiệm thu..." },
      { id:"f5", label:"Vị trí (trục, tầng, khu vực)",type:"text",     required:true,  placeholder:"VD: Sàn tầng 5 - Trục A-D" },
      { id:"f6", label:"Tiêu chuẩn áp dụng",          type:"select",   required:true,  options:["TCVN 4453:1995","TCVN 9377-1:2012","TCVN 5574:2018","TCVN 6052:1995"] },
      { id:"f7", label:"Kết quả nghiệm thu",           type:"select",   required:true,  options:["Đạt yêu cầu - Cho phép thi công tiếp","Không đạt - Yêu cầu khắc phục","Tạm dừng - Chờ bổ sung hồ sơ"] },
      { id:"f8", label:"Bảng kiểm tra chi tiết",       type:"table",    tableColumns:["Hạng mục kiểm tra","Tiêu chuẩn","Kết quả đo","Đánh giá"], tableRows:5 },
      { id:"f9", label:"Tài liệu kèm theo",            type:"textarea", rows:2, placeholder:"Liệt kê bản vẽ, chứng chỉ..." },
      { id:"f10",label:"Ý kiến bổ sung",               type:"textarea", rows:2, placeholder:"Ghi chú thêm nếu có..." },
    ],
  },
  {
    id: "sys-ncr-001", name: "Phiếu Không Phù Hợp (NCR)",
    code: "NCR-STD-001", category: "NCR", isSystem: true, createdAt: "01/01/2026", usageCount: 23,
    description: "Ghi nhận và xử lý sự cố/không phù hợp trong thi công",
    headerConfig: { projectName: true, projectCode: true, nationalHeader: true },
    footerConfig: { signatories: ["Người phát hiện", "Chỉ huy trưởng", "Tư vấn Giám sát"], notes: "NCR phải được đóng trong vòng 7 ngày kể từ ngày phát hành." },
    fields: [
      { id:"f1", label:"Số NCR",                          type:"text",     required:true,  placeholder:"NCR-2026-001" },
      { id:"f2", label:"Ngày phát hành",                  type:"date",     required:true,  autoFill:"date_today" },
      { id:"f3", label:"Vị trí phát hiện",                type:"text",     required:true,  placeholder:"VD: Cột C1 - Tầng 3 - Block A" },
      { id:"f4", label:"Mô tả chi tiết sự cố",            type:"textarea", required:true,  rows:4, placeholder:"Mô tả rõ sự cố, sai lệch so với bản vẽ/tiêu chuẩn..." },
      { id:"f5", label:"Mức độ nghiêm trọng",             type:"select",   required:true,  options:["Cao — Dừng thi công ngay","Trung bình — Khắc phục trong 3 ngày","Thấp — Khắc phục trong 7 ngày"] },
      { id:"f6", label:"Nguyên nhân sơ bộ",               type:"select",   options:["Tay nghề công nhân","Vật liệu không đạt","Thiết bị thi công","Bản vẽ không rõ","Điều kiện thời tiết","Khác"] },
      { id:"f7", label:"Biện pháp khắc phục đề xuất",    type:"textarea", required:true,  rows:3 },
      { id:"f8", label:"Hạn khắc phục",                  type:"date",     required:true  },
      { id:"f9", label:"Kết quả sau khắc phục",          type:"textarea", rows:2, placeholder:"Điền sau khi khắc phục xong..." },
    ],
  },
  {
    id: "sys-hse-001", name: "Biên bản Kiểm tra An toàn - HSE",
    code: "HSE-STD-001", category: "HSE", isSystem: true, createdAt: "01/01/2026", usageCount: 31,
    description: "Kiểm tra an toàn lao động và môi trường công trường",
    headerConfig: { projectName: true, projectCode: true, nationalHeader: true },
    footerConfig: { signatories: ["Cán bộ HSE", "Chỉ huy trưởng", "Đại diện Tổ đội"] },
    fields: [
      { id:"f1", label:"Ngày kiểm tra",                  type:"date",     required:true,  autoFill:"date_today" },
      { id:"f2", label:"Khu vực kiểm tra",               type:"text",     required:true,  placeholder:"VD: Tầng 3-5 Block B" },
      { id:"f3", label:"Số lượng công nhân hiện trường", type:"number",   placeholder:"Người" },
      { id:"f4", label:"Checklist an toàn",              type:"table",    tableColumns:["Hạng mục","Yêu cầu","Thực tế","Đạt/KĐạt","Ghi chú"], tableRows:8 },
      { id:"f5", label:"Vi phạm phát hiện",              type:"textarea", rows:3, placeholder:"Liệt kê các vi phạm nếu có..." },
      { id:"f6", label:"Kết luận chung",                 type:"select",   options:["An toàn - Cho phép thi công","Có vi phạm nhỏ - Đã nhắc nhở","Có vi phạm nghiêm trọng - Tạm dừng"] },
    ],
  },
  {
    id: "sys-rfi-001", name: "Phiếu Yêu cầu Nghiệm thu (RFA)",
    code: "RFA-STD-001", category: "RFI", isSystem: true, createdAt: "01/01/2026", usageCount: 58,
    description: "Nhà thầu gửi lên yêu cầu TVGS/CĐT kiểm tra và nghiệm thu hạng mục",
    headerConfig: { projectName: true, projectCode: false, nationalHeader: false },
    footerConfig: { signatories: ["Nhà thầu (Gửi)", "TVGS (Nhận)", "Kết quả nghiệm thu"] },
    fields: [
      { id:"f1", label:"Số RFA",                         type:"text",    required:true,  placeholder:"RFA-2026-001" },
      { id:"f2", label:"Ngày gửi",                       type:"date",    required:true,  autoFill:"date_today" },
      { id:"f3", label:"Hạng mục yêu cầu nghiệm thu",   type:"textarea",required:true,  rows:2 },
      { id:"f4", label:"Vị trí",                         type:"text",    required:true },
      { id:"f5", label:"Ngày/Giờ đề nghị nghiệm thu",   type:"text",    placeholder:"VD: 08/03/2026 lúc 8:00 sáng" },
      { id:"f6", label:"Hồ sơ kèm theo",                type:"textarea",rows:2, placeholder:"Bản vẽ, chứng chỉ vật liệu, kết quả thử nghiệm..." },
      { id:"f7", label:"Phản hồi của TVGS/CĐT",         type:"select",  options:["Chấp thuận nghiệm thu","Từ chối - Yêu cầu bổ sung","Dời lịch"] },
      { id:"f8", label:"Ghi chú của TVGS",               type:"textarea",rows:2 },
    ],
  },
  {
    id: "sys-log-001", name: "Nhật ký Thi công Hàng ngày",
    code: "LOG-STD-001", category: "LOG", isSystem: true, createdAt: "01/01/2026", usageCount: 120,
    description: "Ghi chép tình hình thi công, nhân lực, thời tiết, vật tư trong ngày",
    headerConfig: { projectName: true, projectCode: false, nationalHeader: false },
    footerConfig: { signatories: ["Chỉ huy trưởng", "Cán bộ kỹ thuật"] },
    fields: [
      { id:"f1", label:"Ngày",                           type:"date",    required:true,  autoFill:"date_today" },
      { id:"f2", label:"Thời tiết sáng",                 type:"select",  options:["Nắng đẹp","Mưa nhỏ","Mưa lớn","Nhiều mây","Gió lớn"] },
      { id:"f3", label:"Thời tiết chiều",                type:"select",  options:["Nắng đẹp","Mưa nhỏ","Mưa lớn","Nhiều mây","Gió lớn"] },
      { id:"f4", label:"Tổng số công nhân",              type:"number",  placeholder:"Người" },
      { id:"f5", label:"Công việc thực hiện trong ngày", type:"textarea",required:true,  rows:4, placeholder:"Liệt kê công việc đã thực hiện..." },
      { id:"f6", label:"Vật tư nhập/xuất",               type:"table",   tableColumns:["Tên vật tư","Đơn vị","Nhập","Xuất","Tồn kho"], tableRows:4 },
      { id:"f7", label:"Vấn đề phát sinh",               type:"textarea",rows:2 },
      { id:"f8", label:"Kế hoạch ngày mai",              type:"textarea",rows:2 },
    ],
  },
  {
    id: "sys-mir-001", name: "Phiếu Nghiệm thu Vật liệu (MIR)",
    code: "MIR-STD-001", category: "MIR", isSystem: true, createdAt: "01/01/2026", usageCount: 19,
    description: "Kiểm tra vật liệu đầu vào trước khi đưa vào sử dụng tại công trình",
    headerConfig: { projectName: true, projectCode: true, nationalHeader: true },
    footerConfig: { signatories: ["Nhà cung cấp", "Kho vật tư", "Kỹ thuật QA/QC"] },
    fields: [
      { id:"f1", label:"Ngày nhập",                      type:"date",    required:true,  autoFill:"date_today" },
      { id:"f2", label:"Tên vật liệu",                   type:"text",    required:true },
      { id:"f3", label:"Nhà cung cấp",                   type:"text",    required:true },
      { id:"f4", label:"Số lô hàng / Chứng chỉ CO/CQ",  type:"text" },
      { id:"f5", label:"Bảng kiểm tra chất lượng",       type:"table",   tableColumns:["Chỉ tiêu","Yêu cầu tiêu chuẩn","Kết quả thực tế","Đánh giá"], tableRows:5 },
      { id:"f6", label:"Kết luận chung",                 type:"select",  required:true, options:["Đạt — Nhập kho sử dụng","Không đạt — Trả lại nhà cung cấp","Cần thử nghiệm thêm"] },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — HELPER FUNCTIONS & MINI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
const getTemplateByDocType = (docType: string): ChecklistItem[] => {
  if (docType === "MIR") return [
    { l:"Chứng chỉ xuất xưởng, CO/CQ",    d:"Kiểm tra bản gốc, đối chiếu mã lô" },
    { l:"Quy cách, chủng loại thực tế",    d:"Đo đạc kích thước, thông số kỹ thuật" },
    { l:"Tình trạng ngoại quan",            d:"Không móp méo, rỉ sét, đúng nhãn mác" },
    { l:"Số lượng thực nhận",               d:"Đếm/Cân đối chiếu phiếu giao hàng" },
  ];
  if (docType === "NCR") return [
    { l:"Mô tả sự cố/sai phạm",            d:"Ghi rõ vị trí, kích thước sai lệch" },
    { l:"Nguyên nhân sơ bộ",               d:"Do tay nghề, thiết bị hay vật liệu?" },
    { l:"Biện pháp khắc phục đề xuất",     d:"Đục bỏ, gia cố hay chấp nhận hạ cấp?" },
    { l:"Thời hạn khắc phục",              d:"Ghi rõ ngày hoàn thành dự kiến" },
  ];
  if (docType === "HSE") return [
    { l:"Bảo hộ lao động (PPE)",           d:"Dây an toàn, mũ, giày đầy đủ" },
    { l:"An toàn điện / Cháy nổ",          d:"Tủ điện chống giật, bình chữa cháy" },
    { l:"Lan can, che chắn lỗ mở",         d:"Lưới chống rơi, rào chắn cứng" },
    { l:"Biển cảnh báo nguy hiểm",         d:"Đặt đúng vị trí, còn rõ chữ" },
  ];
  return [
    { l:"Tim trục & Cao độ hình học",     d:"Sai số ±5mm theo TCVN 4453" },
    { l:"Độ kín khít ván khuôn",          d:"Không chảy nước xi măng khi đổ" },
    { l:"Lớp bảo vệ cốt thép (Con kê)",  d:"D=25mm (Dầm), D=15mm (Sàn)" },
    { l:"Mật độ & Vị trí nối thép",       d:"Đúng vùng nén/kéo theo bản vẽ Shop" },
    { l:"Vệ sinh cốp pha trước khi đổ",  d:"Không còn rác, nước đọng, dầu bẩn" },
  ];
};

const SeverityBadge = ({ s }: { s: string }) => {
  const cls = s === "Cao" ? "bg-rose-100 text-rose-700" : s === "Trung bình" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500";
  return <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${cls}`}>{s}</span>;
};
const StatusBadge = ({ s }: { s: string }) => {
  const cls = ["Đã khắc phục","Hoàn thành","Đã trả lời"].includes(s) ? "bg-emerald-100 text-emerald-700"
    : ["Đang xử lý","Đang tiến hành"].includes(s) ? "bg-blue-100 text-blue-700"
    : ["Chờ duyệt","Chờ phản hồi"].includes(s) ? "bg-amber-100 text-amber-700"
    : "bg-slate-100 text-slate-500";
  return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${cls}`}>{s}</span>;
};

const catColor = (catId: string): string => {
  const map: Record<string,string> = { ITP:"bg-emerald-100 text-emerald-700", NCR:"bg-rose-100 text-rose-700", HSE:"bg-orange-100 text-orange-700", RFI:"bg-blue-100 text-blue-700", MIR:"bg-indigo-100 text-indigo-700", QS:"bg-teal-100 text-teal-700", LOG:"bg-violet-100 text-violet-700", BG:"bg-slate-100 text-slate-700" };
  return map[catId] || "bg-slate-100 text-slate-700";
};

// ── Render a single template field in fill-form mode ─────────────────────────
function RenderField({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  const base = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-100 bg-white transition-all";
  if (field.type === "text" || field.type === "number")
    return <input type={field.type === "number" ? "number" : "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={base}/>;
  if (field.type === "date")
    return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={base}/>;
  if (field.type === "textarea")
    return <textarea value={value} onChange={e => onChange(e.target.value)} rows={field.rows || 3} placeholder={field.placeholder} className={`${base} resize-none`}/>;
  if (field.type === "select")
    return <select value={value} onChange={e => onChange(e.target.value)} className={base}><option value="">— Chọn —</option>{field.options?.map(o => <option key={o}>{o}</option>)}</select>;
  if (field.type === "checkbox")
    return <div className="flex gap-4">{["Đạt","Không đạt","N/A"].map(o => <label key={o} className="flex items-center gap-2 cursor-pointer"><input type="radio" value={o} checked={value===o} onChange={() => onChange(o)} className="accent-emerald-600"/><span className="text-sm font-medium text-slate-700">{o}</span></label>)}</div>;
  if (field.type === "table") {
    const cols = field.tableColumns || ["Cột 1","Cột 2","Kết quả"];
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr>{cols.map(c => <th key={c} className="px-3 py-2 text-left text-xs font-bold text-slate-500 border-b border-slate-200 whitespace-nowrap">{c}</th>)}</tr></thead>
          <tbody>{Array.from({length: field.tableRows||3}).map((_,r) => <tr key={r} className="border-b border-slate-100 last:border-0">{cols.map((_,c) => <td key={c} className="px-1 py-1"><input className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:bg-emerald-50 rounded min-w-[80px]" placeholder="—"/></td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (field.type === "signature")
    return <div className="border-2 border-dashed border-slate-200 rounded-xl h-20 flex items-center justify-center text-slate-400 text-xs font-medium hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors cursor-pointer"><Edit3 size={14} className="mr-2"/>Click để ký tên</div>;
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — FORM TEMPLATE MANAGER (embedded)
// ══════════════════════════════════════════════════════════════════════════════
function FormTemplateManager({ projectId, projectName, projectAddress }: { projectId: string; projectName: string; projectAddress?: string }) {
  const [tmplView, setTmplView]   = useState<"library"|"editor"|"fill"|"preview">("library");
  const [catFilter, setCatFilter] = useState("Tất cả");
  const [search, setSearch]       = useState("");
  const [selectedTmpl, setSelectedTmpl]   = useState<FormTemplate|null>(null);
  const [editingTmpl, setEditingTmpl]     = useState<FormTemplate|null>(null);
  const [filledVals, setFilledVals]       = useState<Record<string,string>>({});
  const [aiFilledSet, setAiFilledSet]     = useState<Set<string>>(new Set());
  const [isAiFilling, setIsAiFilling]     = useState(false);
  const [customTmpls, setCustomTmpls]     = useState<FormTemplate[]>([]);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [editorSection, setEditorSection] = useState<"fields"|"header"|"footer">("fields");
  const [dragOver, setDragOver]           = useState<number|null>(null);
  const tmplFileRef = useRef<HTMLInputElement>(null);

  const allTmpls  = [...SYSTEM_TEMPLATES, ...customTmpls];
  const filtered  = allTmpls.filter(t =>
    (catFilter === "Tất cả" || t.category === catFilter) &&
    t.name.toLowerCase().includes(search.toLowerCase()) &&
    (!t.projectId || t.projectId === projectId)
  );

  const buildAutoMap = useCallback(() => {
    const today = new Date();
    return {
      project_name:    projectName,
      project_address: projectAddress || "Villa PAT - TP.HCM",
      date_today:      today.toISOString().split("T")[0],
      month_year:      `${String(today.getMonth()+1).padStart(2,"0")}/${today.getFullYear()}`,
      contractor_name: "Công ty XD Nàng GEM",
      inspector_name:  "Lê Thị C — Kỹ thuật QA/QC",
    } as Record<string,string>;
  }, [projectName, projectAddress]);

  const autoFillAll = useCallback((tmpl: FormTemplate) => {
    const map = buildAutoMap();
    const vals: Record<string,string> = {};
    tmpl.fields.forEach(f => { if (f.autoFill && map[f.autoFill]) vals[f.id] = map[f.autoFill]; });
    return vals;
  }, [buildAutoMap]);

  const handleAiFill = async () => {
    if (!selectedTmpl) return;
    setIsAiFilling(true);
    const preVals = autoFillAll(selectedTmpl);
    const filled = new Set<string>();
    for (const f of selectedTmpl.fields) {
      await new Promise(r => setTimeout(r, 180));
      if (preVals[f.id]) {
        setFilledVals(prev => ({...prev, [f.id]: preVals[f.id]}));
        filled.add(f.id); setAiFilledSet(new Set(filled));
      }
    }
    setIsAiFilling(false);
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["docx","xlsx","pdf"].includes(ext||"")) { notifInfo('Chỉ hỗ trợ .docx, .xlsx, .pdf'); return; }
    setIsParsingFile(true);
    setTimeout(() => {
      setIsParsingFile(false);
      const tmpl: FormTemplate = {
        id:`custom-${Date.now()}`, name: file.name.replace(/\.[^/.]+$/,""),
        code:`UPLOAD-${String(customTmpls.length+1).padStart(3,"0")}`,
        category:"ITP", description:`Upload từ file ${file.name}`,
        isSystem:false, projectId, createdAt:new Date().toLocaleDateString("vi-VN"), usageCount:0,
        uploadedFile:{ name:file.name, type:ext as any, size:`${(file.size/1024).toFixed(0)} KB`, uploadedAt:new Date().toLocaleDateString("vi-VN") },
        headerConfig:{ projectName:true, projectCode:true, nationalHeader:true },
        footerConfig:{ signatories:["Chủ đầu tư","Tư vấn Giám sát","Nhà thầu"] },
        fields:[
          { id:"uf1", label:"Tên dự án",        type:"text",     required:true, autoFill:"project_name"    },
          { id:"uf2", label:"Ngày thực hiện",    type:"date",     required:true, autoFill:"date_today"      },
          { id:"uf3", label:"Nội dung chính",    type:"textarea", rows:4, placeholder:"AI nhận diện vùng điền — nhập nội dung..." },
          { id:"uf4", label:"Kết luận/Kết quả", type:"textarea", rows:3 },
          { id:"uf5", label:"Ghi chú",           type:"textarea", rows:2 },
        ],
      };
      setCustomTmpls(prev => [tmpl, ...prev]);
      setEditingTmpl({...tmpl}); setTmplView("editor");
      alert(`✅ Nàng GEM đã đọc "${file.name}"!\n\nEm nhận diện được ${tmpl.fields.length} vùng điền. Anh chỉnh sửa thêm trong trình soạn thảo nhé!`);
    }, 2200);
    e.target.value = "";
  };

  const addField = (type: FieldType) => {
    if (!editingTmpl) return;
    const f: TemplateField = {
      id:`f${Date.now()}`, label:`Trường ${editingTmpl.fields.length+1}`, type,
      placeholder:"Nhập nội dung...",
      ...(type==="select"?{options:["Lựa chọn 1","Lựa chọn 2"]}:{}),
      ...(type==="table"?{tableColumns:["Cột 1","Cột 2","Kết quả"],tableRows:3}:{}),
      ...(type==="textarea"?{rows:3}:{}),
    };
    setEditingTmpl({...editingTmpl, fields:[...editingTmpl.fields, f]});
  };
  const updateField = (idx: number, updates: Partial<TemplateField>) => {
    if (!editingTmpl) return;
    const fields=[...editingTmpl.fields]; fields[idx]={...fields[idx],...updates};
    setEditingTmpl({...editingTmpl, fields});
  };
  const removeField = (idx: number) => {
    if (!editingTmpl) return;
    setEditingTmpl({...editingTmpl, fields:editingTmpl.fields.filter((_,i)=>i!==idx)});
  };
  const moveField = (from: number, to: number) => {
    if (!editingTmpl) return;
    const fields=[...editingTmpl.fields]; const [m]=fields.splice(from,1); fields.splice(to,0,m);
    setEditingTmpl({...editingTmpl, fields});
  };
  const saveTmpl = () => {
    if (!editingTmpl) return;
    const toSave = editingTmpl.isSystem ? {...editingTmpl, id:`custom-${Date.now()}`, isSystem:false, projectId, code:`${editingTmpl.code}-COPY`} : editingTmpl;
    setCustomTmpls(prev => prev.some(t=>t.id===toSave.id) ? prev.map(t=>t.id===toSave.id?toSave:t) : [toSave,...prev]);
    notifOk('Đã lưu mẫu thành công!'); setTmplView("library");
  };

  // ── LIBRARY VIEW ────────────────────────────────────────────────────────────
  if (tmplView === "library") return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Thư viện Biểu mẫu — {projectName}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} mẫu khả dụng · {customTmpls.length} mẫu của dự án</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium cursor-pointer transition-all ${isParsingFile ? "bg-blue-50 border-blue-300 text-blue-600" : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"}`}>
            {isParsingFile ? <><Loader2 size={15} className="animate-spin"/> AI đang đọc file...</> : <><Upload size={15}/> Upload mẫu (Word / Excel / PDF)</>}
            <input type="file" className="hidden" accept=".docx,.xlsx,.pdf" onChange={handleUploadFile} disabled={isParsingFile}/>
          </label>
          <button onClick={() => {
            const blank: FormTemplate = {
              id:`custom-${Date.now()}`, name:"Mẫu mới chưa đặt tên",
              code:`CUSTOM-${String(customTmpls.length+1).padStart(3,"0")}`,
              category:"ITP", description:"", fields:[], isSystem:false, projectId,
              createdAt:new Date().toLocaleDateString("vi-VN"), usageCount:0,
              headerConfig:{projectName:true,projectCode:true,nationalHeader:true},
              footerConfig:{signatories:["Chủ đầu tư","Tư vấn Giám sát","Nhà thầu"]},
            };
            setEditingTmpl(blank); setTmplView("editor");
          }} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-sm">
            <Plus size={15}/> Tạo mẫu mới
          </button>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm theo tên hoặc mã biên bản..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["Tất cả",...TEMPLATE_CATEGORIES.map(c=>c.id)].map(cat => (
            <button key={cat} onClick={()=>setCatFilter(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${catFilter===cat ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Star size={11} className="text-amber-400 fill-amber-300"/> Mẫu hệ thống</span>
        <span className="flex items-center gap-1"><FolderOpen size={11} className="text-blue-500"/> Mẫu dự án</span>
        <span className="flex items-center gap-1"><Upload size={11} className="text-indigo-500"/> Mẫu upload</span>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(tmpl => (
          <div key={tmpl.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-md transition-all group flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${catColor(tmpl.category)}`}>{tmpl.category}</span>
                {tmpl.isSystem && <Star size={11} className="text-amber-400 fill-amber-300" title="Mẫu hệ thống"/>}
                {tmpl.uploadedFile && <Upload size={11} className="text-indigo-500" title={`Upload ${tmpl.uploadedFile.type.toUpperCase()}`}/>}
              </div>
              <span className="text-[10px] font-mono text-slate-400">{tmpl.code}</span>
            </div>
            <h4 className="font-bold text-slate-800 text-sm mb-1 leading-snug">{tmpl.name}</h4>
            <p className="text-[11px] text-slate-400 mb-4 line-clamp-2 flex-1">{tmpl.description}</p>
            <div className="flex items-center gap-3 text-[10px] text-slate-400 mb-4">
              <span className="flex items-center gap-1"><FileText size={10}/>{tmpl.fields.length} trường</span>
              <span className="flex items-center gap-1"><Edit3 size={10}/>{tmpl.usageCount} lần dùng</span>
              {tmpl.uploadedFile && <span className="flex items-center gap-1 text-indigo-500"><Upload size={10}/>{tmpl.uploadedFile.type.toUpperCase()} · {tmpl.uploadedFile.size}</span>}
            </div>
            {/* Action buttons — always visible */}
            <div className="flex gap-2">
              <button onClick={() => {
                  setSelectedTmpl(tmpl);
                  const pre=autoFillAll(tmpl);
                  setFilledVals(pre); setAiFilledSet(new Set(Object.keys(pre)));
                  setTmplView("fill");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors">
                <Edit3 size={13}/> Dùng mẫu này
              </button>
              <button onClick={()=>{setEditingTmpl({...tmpl});setTmplView("editor");}}
                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors" title="Chỉnh sửa">
                <Settings size={15}/>
              </button>
              <button onClick={()=>{setSelectedTmpl(tmpl);setTmplView("preview");}}
                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors" title="Xem trước">
                <Eye size={15}/>
              </button>
              {!tmpl.isSystem && (
                <button onClick={()=>setCustomTmpls(prev=>prev.filter(t=>t.id!==tmpl.id))}
                  className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors" title="Xóa">
                  <Trash2 size={15}/>
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length===0 && (
          <div className="col-span-3 py-20 text-center text-slate-400">
            <Layers size={40} className="mx-auto mb-3 opacity-20"/>
            <p>Không tìm thấy mẫu nào phù hợp</p>
            <p className="text-xs mt-1">Thử thay đổi bộ lọc hoặc tạo mẫu mới</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── FILL FORM VIEW ──────────────────────────────────────────────────────────
  if (tmplView==="fill" && selectedTmpl) return (
    <div className="space-y-5 pb-6">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>setTmplView("library")} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ArrowLeft size={18} className="text-slate-600"/></button>
          <div>
            <p className="font-bold text-slate-800 text-sm">{selectedTmpl.name}</p>
            <p className="text-xs text-slate-400">{selectedTmpl.code} · {projectName}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleAiFill} disabled={isAiFilling}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all disabled:opacity-60">
            {isAiFilling ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            {isAiFilling ? "AI đang điền..." : "AI tự điền thông tin"}
          </button>
          <button onClick={()=>setPrintITP({
              id: selectedTmpl?.id || 'TMPL',
              name: selectedTmpl?.name || '',
              date: new Date().toLocaleDateString('vi-VN'),
              location: projectAddress,
              docType: selectedTmpl?.category || 'ITP',
              items: [],
            })}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50">
            <Printer size={14}/> In / PDF
          </button>
          <button onClick={()=>notifInfo('Chức năng xuất file Word/Excel sẽ khả dụng sau khi tích hợp Supabase Storage!')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100">
            <Download size={14}/> Xuất file gốc
          </button>
        </div>
      </div>

      {/* AI status */}
      {aiFilledSet.size>0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
          <Sparkles size={15} className="text-emerald-600 shrink-0"/>
          <span className="text-emerald-800">Nàng GEM đã tự điền <strong>{aiFilledSet.size}</strong> trường. Anh kiểm tra lại và bổ sung các trường còn lại nhé!</span>
        </div>
      )}

      {/* Form body */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{selectedTmpl.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{projectName} · {selectedTmpl.code}</p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${catColor(selectedTmpl.category)}`}>{selectedTmpl.category}</span>
        </div>
        <div className="p-6 space-y-5">
          {selectedTmpl.fields.map(field => (
            <div key={field.id}>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                {field.label}{field.required && <span className="text-rose-500">*</span>}
                {aiFilledSet.has(field.id) && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full normal-case tracking-normal border border-emerald-100">
                    <Sparkles size={9}/> AI điền
                  </span>
                )}
              </label>
              <RenderField field={field} value={filledVals[field.id]||""} onChange={v=>setFilledVals(prev=>({...prev,[field.id]:v}))}/>
            </div>
          ))}
        </div>
        {/* Signature area */}
        {selectedTmpl.footerConfig.signatories.length>0 && (
          <div className="p-6 pt-0">
            {selectedTmpl.footerConfig.notes && (
              <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-800 flex gap-2">
                <Info size={14} className="shrink-0 mt-0.5"/>{selectedTmpl.footerConfig.notes}
              </div>
            )}
            <div className="border-t border-slate-200 pt-6">
              <div className={`grid gap-6 ${selectedTmpl.footerConfig.signatories.length===3?"grid-cols-3":selectedTmpl.footerConfig.signatories.length===2?"grid-cols-2":"grid-cols-1"}`}>
                {selectedTmpl.footerConfig.signatories.map(sig => (
                  <div key={sig} className="text-center">
                    <p className="text-xs font-bold text-slate-700 uppercase">{sig}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 mb-10">(Ký, ghi rõ họ tên, đóng dấu)</p>
                    <div className="border-t border-slate-300 pt-2">
                      <input className="w-full text-center text-xs bg-transparent border-none focus:outline-none text-slate-500" placeholder="Ký tên..."/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={()=>setTmplView("library")} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
        <button onClick={()=>notifOk('Đã lưu biên bản vào hồ sơ dự án!')}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-md shadow-emerald-100 flex items-center gap-2">
          <Save size={15}/> Lưu biên bản
        </button>
      </div>
    </div>
  );

  // ── EDITOR VIEW ─────────────────────────────────────────────────────────────
  if (tmplView==="editor" && editingTmpl) return (
    <div className="space-y-5 pb-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={()=>setTmplView("library")} className="p-2 hover:bg-slate-100 rounded-xl"><ArrowLeft size={18} className="text-slate-600"/></button>
          <div>
            <input value={editingTmpl.name} onChange={e=>setEditingTmpl({...editingTmpl,name:e.target.value})}
              className="font-bold text-slate-800 text-sm bg-transparent border-b border-transparent focus:border-emerald-400 focus:outline-none w-64 md:w-80"/>
            <p className="text-xs text-slate-400 mt-0.5">{editingTmpl.isSystem ? "📌 Mẫu hệ thống — Lưu sẽ tạo bản copy riêng" : `✏️ Chỉnh sửa · ${editingTmpl.code}`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>{setSelectedTmpl(editingTmpl);const pre=autoFillAll(editingTmpl);setFilledVals(pre);setAiFilledSet(new Set(Object.keys(pre)));setTmplView("fill");}}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm hover:bg-slate-200">
            <Eye size={14}/> Xem trước
          </button>
          <button onClick={saveTmpl} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-sm">
            <Save size={14}/> Lưu mẫu
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Settings panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {(["fields","header","footer"] as const).map(sec => (
              <button key={sec} onClick={()=>setEditorSection(sec)}
                className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors border-b border-slate-100 last:border-0 flex items-center justify-between ${editorSection===sec?"bg-emerald-50 text-emerald-700":"hover:bg-slate-50 text-slate-600"}`}>
                {sec==="fields"?"📋 Trường dữ liệu":sec==="header"?"🏷️ Tiêu đề":"✍️ Ký tên & Chân trang"}
                <ChevronRight size={14}/>
              </button>
            ))}
          </div>

          {editorSection==="fields" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-3">Thêm loại trường</p>
              <div className="grid grid-cols-2 gap-2">
                {FIELD_TYPES_LIST.map(ft => (
                  <button key={ft.type} onClick={()=>addField(ft.type)}
                    className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-xl text-left hover:border-emerald-400 hover:bg-emerald-50 transition-all">
                    <span className="text-slate-400">{ft.icon}</span>
                    <span className="text-xs font-medium text-slate-700">{ft.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {editorSection==="header" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
              <p className="text-xs font-bold text-slate-400 uppercase">Cấu hình tiêu đề</p>
              {[{key:"nationalHeader",label:"Quốc hiệu CHXHCNVN"},{key:"projectName",label:"Tên dự án"},{key:"projectCode",label:"Mã biên bản"}].map(opt => (
                <label key={opt.key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-700">{opt.label}</span>
                  <div onClick={()=>setEditingTmpl({...editingTmpl,headerConfig:{...editingTmpl.headerConfig,[opt.key]:!(editingTmpl.headerConfig as any)[opt.key]}})}
                    className={`w-10 h-5 rounded-full cursor-pointer relative transition-colors ${(editingTmpl.headerConfig as any)[opt.key]?"bg-emerald-500":"bg-slate-200"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(editingTmpl.headerConfig as any)[opt.key]?"translate-x-5":"translate-x-0.5"}`}/>
                  </div>
                </label>
              ))}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Danh mục</label>
                <select value={editingTmpl.category} onChange={e=>setEditingTmpl({...editingTmpl,category:e.target.value})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500">
                  {TEMPLATE_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.id} — {c.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {editorSection==="footer" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase">Danh sách ký tên</p>
              {editingTmpl.footerConfig.signatories.map((sig,i) => (
                <div key={i} className="flex gap-2">
                  <input value={sig} onChange={e=>{const s=[...editingTmpl.footerConfig.signatories];s[i]=e.target.value;setEditingTmpl({...editingTmpl,footerConfig:{...editingTmpl.footerConfig,signatories:s}});}}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"/>
                  <button onClick={()=>{const s=editingTmpl.footerConfig.signatories.filter((_,idx)=>idx!==i);setEditingTmpl({...editingTmpl,footerConfig:{...editingTmpl.footerConfig,signatories:s}});}}
                    className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl"><X size={14}/></button>
                </div>
              ))}
              <button onClick={()=>{const s=[...editingTmpl.footerConfig.signatories,"Người ký mới"];setEditingTmpl({...editingTmpl,footerConfig:{...editingTmpl.footerConfig,signatories:s}});}}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:border-emerald-300 hover:text-emerald-600 transition-all">
                + Thêm người ký
              </button>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Ghi chú chân trang</label>
                <textarea value={editingTmpl.footerConfig.notes||""} rows={2}
                  onChange={e=>setEditingTmpl({...editingTmpl,footerConfig:{...editingTmpl.footerConfig,notes:e.target.value}})}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:border-emerald-500"
                  placeholder="VD: Biên bản có giá trị từ ngày ký..."/>
              </div>
            </div>
          )}
        </div>

        {/* Field list */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-sm">{editingTmpl.fields.length} trường đã cấu hình</h3>
              <p className="text-xs text-slate-400">Kéo ⠿ để sắp xếp</p>
            </div>
            {editingTmpl.fields.length===0 && (
              <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                <Plus size={28} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Chọn loại trường từ bảng bên trái để thêm vào</p>
              </div>
            )}
            <div className="space-y-2">
              {editingTmpl.fields.map((field,idx) => (
                <div key={field.id} draggable
                  onDragStart={e=>e.dataTransfer.setData("idx",String(idx))}
                  onDragOver={e=>{e.preventDefault();setDragOver(idx);}}
                  onDrop={e=>{e.preventDefault();moveField(Number(e.dataTransfer.getData("idx")),idx);setDragOver(null);}}
                  onDragLeave={()=>setDragOver(null)}
                  className={`border rounded-xl p-3 transition-all ${dragOver===idx?"border-emerald-400 bg-emerald-50":"border-slate-200 hover:border-slate-300"}`}>
                  <div className="flex items-start gap-3">
                    <GripVertical size={16} className="text-slate-300 hover:text-slate-500 cursor-grab mt-2 shrink-0"/>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nhãn</label>
                        <input value={field.label} onChange={e=>updateField(idx,{label:e.target.value})}
                          className="w-full mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-emerald-500"/>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Loại trường</label>
                        <select value={field.type} onChange={e=>updateField(idx,{type:e.target.value as FieldType})}
                          className="w-full mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white">
                          {FIELD_TYPES_LIST.map(ft=><option key={ft.type} value={ft.type}>{ft.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">AI tự điền từ</label>
                        <select value={field.autoFill||""} onChange={e=>updateField(idx,{autoFill:e.target.value||undefined})}
                          className="w-full mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white">
                          <option value="">— Không tự điền —</option>
                          {Object.entries(AUTO_FILL_KEYS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={!!field.required} onChange={e=>updateField(idx,{required:e.target.checked})} className="accent-emerald-600"/>
                          <span className="text-xs text-slate-600 font-medium">Trường bắt buộc</span>
                        </label>
                      </div>
                      {field.type==="select" && (
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Các lựa chọn (mỗi dòng 1 giá trị)</label>
                          <textarea value={(field.options||[]).join("\n")} rows={3}
                            onChange={e=>updateField(idx,{options:e.target.value.split("\n").filter(Boolean)})}
                            className="w-full mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:border-emerald-500"/>
                        </div>
                      )}
                    </div>
                    <button onClick={()=>removeField(idx)} className="text-rose-400 hover:bg-rose-50 p-1.5 rounded-lg transition-colors shrink-0 mt-1">
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── PREVIEW VIEW ─────────────────────────────────────────────────────────────
  if (tmplView==="preview" && selectedTmpl) return (
    <div className="space-y-4 pb-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
        <button onClick={()=>setTmplView("library")} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft size={16}/> Thư viện
        </button>
        <div className="flex gap-2">
          <button onClick={()=>{setEditingTmpl({...selectedTmpl});setTmplView("editor");}}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm hover:bg-slate-200">
            <Edit3 size={14}/> Chỉnh sửa
          </button>
          <button onClick={()=>{const pre=autoFillAll(selectedTmpl);setFilledVals(pre);setAiFilledSet(new Set(Object.keys(pre)));setTmplView("fill");}}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">
            <Edit3 size={14}/> Dùng mẫu này
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-3xl mx-auto">
        <div className="text-center border-b border-slate-200 pb-5 mb-6">
          <p className="text-xs font-mono text-slate-400 mb-1">{selectedTmpl.code}</p>
          <h1 className="text-xl font-bold text-slate-800">{selectedTmpl.name}</h1>
          <p className="text-sm text-slate-500 mt-1 mb-3">{selectedTmpl.description}</p>
          <div className="flex justify-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${catColor(selectedTmpl.category)}`}>{selectedTmpl.category}</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{selectedTmpl.fields.length} trường</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{selectedTmpl.footerConfig.signatories.length} người ký</span>
          </div>
        </div>
        <div className="space-y-4">
          {selectedTmpl.fields.map((f,i) => (
            <div key={f.id} className="flex items-start gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              <span className="text-xs font-bold text-slate-400 bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium text-slate-700">{f.label}</span>
                  {f.required && <span className="text-rose-500 text-xs">*</span>}
                  <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{FIELD_TYPES_LIST.find(ft=>ft.type===f.type)?.label}</span>
                  {f.autoFill && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={8}/>{AUTO_FILL_KEYS[f.autoFill]}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-6 border-t border-slate-200">
          <div className={`grid gap-6 ${selectedTmpl.footerConfig.signatories.length===3?"grid-cols-3":"grid-cols-2"}`}>
            {selectedTmpl.footerConfig.signatories.map(sig=>(
              <div key={sig} className="text-center">
                <p className="text-xs font-bold text-slate-600 uppercase">{sig}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 mb-10">(Ký, họ tên, đóng dấu)</p>
                <div className="border-t border-slate-300"/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — MAIN QA/QC DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
import type { DashboardProps } from './types';

interface QaQcProps {
  onNavigate?: (id: string) => void;
  projectId?: string;
  projectName?: string;
  projectAddress?: string;
  project?: any;
  ctx?: UserContext;                   // ← approval context (optional, backward-compat)
  setShowRecordForm?: (v: boolean) => void;
  setRecordType?: (v: string) => void;
  showRecordForm?: boolean;
  recordType?: string;
  recordData?: string | null;
  setRecordData?: (v: string | null) => void;
  isGeneratingRecord?: boolean;
  generateGemRecord?: () => Promise<void>;
}

// ─── ISO / TCVN 9045 Checklist Tab ───────────────────────────────────────────
const TCVN_CATEGORIES = [
  {
    id: 'c1', code: 'TCVN 9045-1', name: 'Công tác đất & Nền móng',
    items: [
      { id:'c1i1', ref:'4.1.2', text:'Kiểm tra kích thước hố móng theo bản vẽ thiết kế', critical:true  },
      { id:'c1i2', ref:'4.1.3', text:'Độ ẩm và sức chịu tải của đất nền đạt yêu cầu', critical:true  },
      { id:'c1i3', ref:'4.2.1', text:'Vật liệu đệm móng đúng chủng loại, chiều dày đúng TK', critical:false },
      { id:'c1i4', ref:'4.2.4', text:'Không có nước đọng dưới đáy móng khi đổ bê tông', critical:true  },
      { id:'c1i5', ref:'4.3.1', text:'Hồ sơ khảo sát địa chất được duyệt trước khi thi công', critical:false },
    ]
  },
  {
    id: 'c2', code: 'TCVN 9045-2', name: 'Kết cấu Bê tông & Cốt thép',
    items: [
      { id:'c2i1', ref:'5.1.1', text:'Cốt thép đúng chủng loại, đường kính, khoảng cách theo bản vẽ', critical:true },
      { id:'c2i2', ref:'5.1.3', text:'Chiều dày lớp bê tông bảo vệ đạt tối thiểu theo TCVN', critical:true },
      { id:'c2i3', ref:'5.2.1', text:'Cốp pha đảm bảo độ cứng, độ phẳng, chống thấm nước xi măng', critical:false },
      { id:'c2i4', ref:'5.3.2', text:'Bê tông trộn đúng thiết kế cấp phối, slump đạt yêu cầu', critical:true },
      { id:'c2i5', ref:'5.3.5', text:'Không thi công bê tông khi nhiệt độ ngoài trời >35°C hoặc trời mưa', critical:true },
      { id:'c2i6', ref:'5.4.1', text:'Bảo dưỡng bê tông ẩm tối thiểu 7 ngày sau khi đổ', critical:false },
      { id:'c2i7', ref:'5.5.2', text:'Mẫu bê tông thử nghiệm lấy đủ số lượng theo quy định', critical:false },
    ]
  },
  {
    id: 'c3', code: 'TCVN 9045-3', name: 'Kết cấu Xây & Trát',
    items: [
      { id:'c3i1', ref:'6.1.1', text:'Vật liệu xây (gạch, block) đúng chủng loại, mác theo TK', critical:false },
      { id:'c3i2', ref:'6.1.3', text:'Vữa xây đúng mác, tỷ lệ trộn đúng thiết kế cấp phối', critical:false },
      { id:'c3i3', ref:'6.2.2', text:'Mạch xây dày 10-15mm, mạch so le đúng quy cách', critical:false },
      { id:'c3i4', ref:'6.3.1', text:'Bề mặt tường thẳng đứng, sai số ≤5mm/3m chiều cao', critical:false },
      { id:'c3i5', ref:'6.4.2', text:'Chiều dày lớp trát 15-20mm, bề mặt phẳng, không nứt', critical:false },
    ]
  },
  {
    id: 'c4', code: 'TCVN 9045-4', name: 'Hệ thống Điện & Cơ (M&E)',
    items: [
      { id:'c4i1', ref:'7.1.2', text:'Đường ống điện ngầm đặt đúng vị trí trước khi đổ bê tông', critical:true },
      { id:'c4i2', ref:'7.2.1', text:'Đường ống cấp thoát nước không bị rò rỉ (kiểm tra áp lực)', critical:true },
      { id:'c4i3', ref:'7.3.1', text:'Hệ thống PCCC được nghiệm thu bởi đơn vị có thẩm quyền', critical:true },
      { id:'c4i4', ref:'7.4.2', text:'Tủ điện tổng và phụ lắp đặt đúng vị trí, tiếp địa đạt', critical:false },
    ]
  },
  {
    id: 'c5', code: 'TCVN 9045-5', name: 'Hoàn thiện & Bàn giao',
    items: [
      { id:'c5i1', ref:'8.1.1', text:'Bề mặt sơn đều màu, không nứt, không chảy, đủ số lớp', critical:false },
      { id:'c5i2', ref:'8.2.1', text:'Cửa, cửa sổ mở đóng trơn tru, khe hở ≤2mm', critical:false },
      { id:'c5i3', ref:'8.3.2', text:'Sàn gạch, đá phẳng (sai số ≤3mm/2m), không rỗng âm', critical:false },
      { id:'c5i4', ref:'8.4.1', text:'Chống thấm mái, nhà vệ sinh nghiệm thu 72h ngâm nước', critical:true },
      { id:'c5i5', ref:'8.5.1', text:'Hồ sơ hoàn công đầy đủ trước khi bàn giao CĐT', critical:true },
    ]
  },
];

type CheckStatus = 'pass' | 'fail' | 'na' | 'pending';
const STATUS_CLS2: Record<CheckStatus,string> = {
  pass:    'bg-emerald-500 text-white',
  fail:    'bg-rose-500 text-white',
  na:      'bg-slate-300 text-white',
  pending: 'bg-slate-100 text-slate-500 border border-slate-300',
};
const STATUS_LABEL2: Record<CheckStatus,string> = { pass:'✓ Đạt', fail:'✗ Không đạt', na:'N/A', pending:'Chưa KT' };

function ISOChecklistTab({ project, projectName }: { project:any; projectName:string }) {
  const [checks, setChecks] = useState<Record<string,CheckStatus>>({});
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [activeCat, setActiveCat] = useState(TCVN_CATEGORIES[0].id);
  const [showNoteFor, setShowNoteFor] = useState<string|null>(null);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText] = useState('');
  const [showGem, setShowGem] = useState(false);
  const [inspector, setInspector] = useState('');
  const [inspDate, setInspDate] = useState('07/03/2026');

  const setCheck = (id: string, s: CheckStatus) => setChecks(p => ({ ...p, [id]: s }));
  const allItems = TCVN_CATEGORIES.flatMap(c => c.items);
  const totalChecked = allItems.filter(i => checks[i.id] && checks[i.id] !== 'pending').length;
  const totalPass = allItems.filter(i => checks[i.id] === 'pass').length;
  const totalFail = allItems.filter(i => checks[i.id] === 'fail').length;
  const totalCritFail = allItems.filter(i => i.critical && checks[i.id] === 'fail').length;
  const pct = allItems.length > 0 ? Math.round((totalChecked / allItems.length) * 100) : 0;

  const analyzeWithGEM = async () => {
    setGemLoading(true); setGemText(''); setShowGem(true);
    try {
      const { genAI } = await import('./gemini');
      const model = genAI.getGenerativeModel({ model: GEM_MODEL_QUALITY, systemInstruction:`Bạn là Nàng GEM Siêu Việt — chuyên gia QA/QC xây dựng theo TCVN 9045. Xưng "em", gọi "Anh/Chị". Phân tích ngắn gọn, súc tích, nêu rõ hạng mục lỗi nghiêm trọng và kiến nghị.` });
      const failItems = allItems.filter(i => checks[i.id] === 'fail').map(i => `[${i.ref}] ${i.text}${notes[i.id] ? ` (Ghi chú: ${notes[i.id]})` : ''}`);
      const critFails = allItems.filter(i => i.critical && checks[i.id] === 'fail').map(i => i.text);
      const r = await model.generateContent(
        `Phân tích kết quả kiểm tra chất lượng TCVN 9045 — ${projectName}:\n` +
        `Ngày kiểm: ${inspDate} | Kiểm tra viên: ${inspector || 'KS QC'}\n` +
        `Tiến độ kiểm tra: ${pct}% (${totalChecked}/${allItems.length} mục)\n` +
        `Đạt: ${totalPass} | Không đạt: ${totalFail} | Critical fail: ${totalCritFail}\n\n` +
        (failItems.length > 0 ? `Hạng mục không đạt:\n${failItems.join('\n')}\n\n` : 'Không có hạng mục nào fail.\n\n') +
        (critFails.length > 0 ? `⚠ Critical fail:\n${critFails.join('\n')}\n\n` : '') +
        `Hãy phân tích: (1) Đánh giá tổng thể chất lượng, (2) Hạng mục fail cần sửa gấp nhất, (3) Có thể nghiệm thu tiếp không?, (4) Khuyến nghị cụ thể cho từng critical fail.`
      );
      setGemText(r.response.text());
    } catch { setGemText('❌ Không kết nối được GEM.'); }
    setGemLoading(false);
  };

  const cat = TCVN_CATEGORIES.find(c => c.id === activeCat)!;
  const catPass = cat.items.filter(i => checks[i.id] === 'pass').length;
  const catFail = cat.items.filter(i => checks[i.id] === 'fail').length;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label:'Tổng mục KT', val:`${totalChecked}/${allItems.length}`, sub:`${pct}%`, cls:'bg-slate-100 text-slate-700' },
          { label:'Đạt', val:totalPass, sub:'mục', cls:'bg-emerald-100 text-emerald-700' },
          { label:'Không đạt', val:totalFail, sub:'mục', cls:totalFail>0?'bg-rose-100 text-rose-700':'bg-slate-100 text-slate-500' },
          { label:'Critical fail', val:totalCritFail, sub:'mục', cls:totalCritFail>0?'bg-rose-200 text-rose-800 font-black':'bg-slate-100 text-slate-500' },
          { label:'N/A', val:allItems.filter(i=>checks[i.id]==='na').length, sub:'mục', cls:'bg-slate-100 text-slate-500' },
        ].map((k,i)=>(
          <div key={i} className={`p-3 rounded-2xl border border-slate-200 bg-white shadow-sm`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${k.cls}`}><Award size={14}/></div>
            <div className="text-xl font-black text-slate-800">{k.val}</div>
            <div className="text-[10px] text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2 text-sm font-bold text-slate-700">
          <span>Tiến độ kiểm tra TCVN 9045</span><span>{pct}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-400 transition-all" style={{width:`${(totalPass/allItems.length)*100}%`}}/>
          <div className="h-full bg-rose-400 transition-all" style={{width:`${(totalFail/allItems.length)*100}%`}}/>
          <div className="h-full bg-slate-300 transition-all" style={{width:`${(allItems.filter(i=>checks[i.id]==='na').length/allItems.length)*100}%`}}/>
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-slate-500 flex-wrap">
          {[['bg-emerald-400','Đạt'],['bg-rose-400','Không đạt'],['bg-slate-300','N/A'],['bg-slate-100 border border-slate-300','Chưa KT']].map(([c,l])=>(
            <span key={l} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded ${c}`}/>{l}</span>
          ))}
        </div>
      </div>

      {/* Info row + GEM button */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <input value={inspector} onChange={e=>setInspector(e.target.value)} placeholder="Kiểm tra viên" className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
          <input value={inspDate} onChange={e=>setInspDate(e.target.value)} placeholder="Ngày KT" className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300 w-28"/>
        </div>
        <button onClick={analyzeWithGEM} disabled={gemLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-60">
          {gemLoading?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>} GEM phân tích kết quả
        </button>
      </div>

      {/* GEM panel */}
      {showGem && (
        <div className="bg-gradient-to-br from-emerald-900 to-teal-900 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-emerald-100 flex items-center gap-2"><Sparkles size={14} className="text-emerald-300"/>GEM — Phân tích TCVN 9045</span>
            <button onClick={()=>setShowGem(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={13}/></button>
          </div>
          {gemLoading?<div className="flex items-center gap-2 text-emerald-200"><Loader2 size={14} className="animate-spin"/>Đang phân tích...</div>
            :<pre className="text-xs text-emerald-100 whitespace-pre-wrap leading-relaxed font-sans">{gemText}</pre>}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {TCVN_CATEGORIES.map(c=>{
          const cFail = c.items.filter(i=>checks[i.id]==='fail').length;
          const cPass = c.items.filter(i=>checks[i.id]==='pass').length;
          return (
            <button key={c.id} onClick={()=>setActiveCat(c.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeCat===c.id?'bg-emerald-600 text-white shadow-sm':'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'}`}>
              {c.code}
              {cFail>0&&<span className="w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center font-black">{cFail}</span>}
              {cFail===0&&cPass>0&&<span className="w-2 h-2 bg-emerald-400 rounded-full"/>}
            </button>
          );
        })}
      </div>

      {/* Checklist items */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">{cat.code} — {cat.name}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{cat.items.length} hạng mục · {catPass} đạt · {catFail} không đạt</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>cat.items.forEach(i=>setCheck(i.id,'pass'))} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100">✓ Đạt tất cả</button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {cat.items.map((item)=>{
            const status: CheckStatus = checks[item.id] || 'pending';
            return (
              <div key={item.id} className={`p-4 ${status==='fail'?'bg-rose-50':status==='pass'?'bg-emerald-50/30':''}`}>
                <div className="flex items-start gap-3">
                  <div className="shrink-0 pt-0.5">
                    <span className="text-[10px] font-black text-slate-400 font-mono">{item.ref}</span>
                    {item.critical&&<div className="text-[8px] font-black text-rose-500 uppercase tracking-wide mt-0.5">CRITICAL</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${item.critical?'font-semibold text-slate-800':'text-slate-700'}`}>{item.text}</p>
                    {notes[item.id]&&<p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-1.5">{notes[item.id]}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                    {(['pass','fail','na','pending'] as CheckStatus[]).map(s=>(
                      <button key={s} onClick={()=>setCheck(item.id,s)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${status===s?STATUS_CLS2[s]:'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {STATUS_LABEL2[s]}
                      </button>
                    ))}
                    <button onClick={()=>setShowNoteFor(showNoteFor===item.id?null:item.id)}
                      className="px-2 py-1 rounded-lg text-[10px] bg-amber-50 text-amber-600 border border-amber-200 font-bold hover:bg-amber-100">
                      📝
                    </button>
                  </div>
                </div>
                {showNoteFor===item.id&&(
                  <div className="mt-2 ml-12 flex gap-2">
                    <input autoFocus value={notes[item.id]||''} onChange={e=>setNotes(p=>({...p,[item.id]:e.target.value}))}
                      placeholder="Ghi chú lỗi, mức độ, biện pháp xử lý..."
                      className="flex-1 text-xs px-3 py-1.5 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                      onKeyDown={e=>e.key==='Enter'&&setShowNoteFor(null)}/>
                    <button onClick={()=>setShowNoteFor(null)} className="px-2.5 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-bold">Lưu</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical fail alert */}
      {totalCritFail > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rose-500 mt-0.5 shrink-0"/>
          <div>
            <p className="font-bold text-rose-800 text-sm">🚨 {totalCritFail} hạng mục Critical không đạt — KHÔNG được nghiệm thu</p>
            {allItems.filter(i=>i.critical&&checks[i.id]==='fail').map(i=>(
              <p key={i.id} className="text-xs text-rose-700 mt-0.5">• [{i.ref}] {i.text}</p>
            ))}
          </div>
        </div>
      )}

      {/* ── APPROVAL QUEUE DRAWER ── */}
      {showApprovalPanel && ctx && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowApprovalPanel(false)}/>
          <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
            <ApprovalQueue
              projectId={projectId}
              projectName={projectName}
              ctx={ctx}
              onClose={() => { setShowApprovalPanel(false); refreshQaQueue(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function QaQcDashboard({ onNavigate, projectId: _projectId, projectName: _projectName, projectAddress, project, ctx, setShowRecordForm, setRecordType, showRecordForm, recordType, recordData, setRecordData, isGeneratingRecord, generateGemRecord }: QaQcProps) {
  const projectId = _projectId ?? project?.id?.toString() ?? 'default';
  const projectName = _projectName ?? project?.name ?? 'Dự án';

  // ── Approval queue — docs QA/QC đang chờ user này xử lý ──────────────────
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [qaApprovalQueue, setQaApprovalQueue] = useState<ApprovalDoc[]>([]);
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [printITP, setPrintITP] = useState<any>(null);
  const [printNCR, setPrintNCR] = useState<any>(null);

  const refreshQaQueue = useCallback(() => {
    if (!ctx) return;
    setQaApprovalQueue(getApprovalQueue(projectId, ctx));
  }, [projectId, ctx]);

  useEffect(() => { refreshQaQueue(); }, [refreshQaQueue]);

  type QaDocType = 'NCR' | 'RFI' | 'INSPECTION_REQUEST' | 'ITP_MANAGEMENT'
                 | 'METHOD_STATEMENT' | 'DRAWING_REVISION' | 'QUALITY_AUDIT' | 'TESTING_LAB';

  const triggerQaDoc = useCallback((
    title: string,
    docType: QaDocType,
    data: Record<string, unknown> = {},
    amount?: number,
  ) => {
    if (!ctx) { notifInfo('Chưa đăng nhập'); return; }
    if (!WORKFLOWS[docType]) { alert(`DocType ${docType} chưa có workflow`); return; }
    const createResult = createDocument({ projectId, docType, ctx, title, data, amount });
    if (!createResult.ok) { alert(`❌ ${(createResult as any).error}`); return; }
    const submitResult = submitDocument(projectId, createResult.data!.id, ctx);
    if (submitResult.ok) {
      refreshQaQueue();
      notifOk('... "..." đã nộp vào hàng duyệt');
    } else {
      alert(`❌ Lỗi: ${(submitResult as any).error}`);
    }
  }, [projectId, ctx, refreshQaQueue]);

  /** Backward-compat wrapper */
  const triggerQaApproval = useCallback((defect: Defect, docType: 'NCR' | 'RFI') => {
    triggerQaDoc(defect.title, docType, { defect });
  }, [triggerQaDoc]);
  // ── /Approval wiring ───────────────────────────────────────────────────────

  const [activeTab, setActiveTab]               = useState("overview");
  const [showGemChat, setShowGemChat]           = useState(false);
  const [showDefectForm, setShowDefectForm]     = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showChecklistForm, setShowChecklistForm] = useState(false);

  // Data
  const [checklists, setChecklists]   = useState<Checklist[]>(INIT_CHECKLISTS);
  const [defects, setDefects]         = useState<Defect[]>(INIT_DEFECTS);
  const [feedbacks, setFeedbacks]     = useState<Feedback[]>(INIT_FEEDBACKS);

  // ── db.ts: load khi mount — seed từ template nếu chưa có data ─────────────
  useEffect(() => {
    (async () => {
      const [cl, def, fb] = await Promise.all([
        db.get('qa_checklists', projectId, checklists),
        db.get('qa_defects',    projectId, defects),
        db.get('qa_feedbacks',  projectId, feedbacks),
      ]);
      if ((cl as any[]).length) {
        setChecklists(cl as any);
      } else {
        // Chưa có checklist → thử seed từ project template
        const tplId = getProjectTemplate(projectId);
        const tpl   = tplId ? PROJECT_TEMPLATES[tplId] : null;
        if (tpl?.qaChecklists?.length) {
          const today = new Date().toLocaleDateString('vi-VN');
          const seeded: Checklist[] = tpl.qaChecklists.flatMap((cat, ci) =>
            cat.items.map((item, ii) => ({
              id:       (ci + 1) * 100 + ii + 1,
              name:     item,
              status:   'Chưa bắt đầu',
              progress: 0,
              date:     today,
              docType:  'ITP',
              location: cat.category,
            }))
          );
          setChecklists(seeded);
          db.set('qa_checklists', projectId, seeded);
        }
      }
      if ((def as any[]).length) setDefects(def as any);
      if ((fb  as any[]).length) setFeedbacks(fb  as any);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── db.ts: lưu khi data thay đổi ────────────────────────────────────────
  useEffect(() => { db.set('qa_checklists', projectId, checklists); }, [checklists]);
  useEffect(() => { db.set('qa_defects',    projectId, defects);    }, [defects]);
  useEffect(() => { db.set('qa_feedbacks',  projectId, feedbacks);  }, [feedbacks]);

  // Filters
  const [defectFilter, setDefectFilter]       = useState("Tất cả");
  const [checklistFilter, setChecklistFilter] = useState("Tất cả");
  const [fbFilter, setFbFilter]               = useState("Tất cả");
  const [searchTerm, setSearchTerm]           = useState("");
  const [replyingTo, setReplyingTo]           = useState<number|null>(null);
  const [replyText, setReplyText]             = useState("");

  // QA checklist form
  const [selectedDocType, setSelectedDocType] = useState("ITP");
  const [formLocation, setFormLocation]       = useState("");
  const [formDate, setFormDate]               = useState(new Date().toISOString().split("T")[0]);
  const [customItems, setCustomItems]         = useState<ChecklistItem[]>([]);

  // Defect form
  const [defectTitle, setDefectTitle]         = useState("");
  const [defectSeverity, setDefectSeverity]   = useState("Trung bình");
  const [defectLocation, setDefectLocation]   = useState("");
  const [defectDeadline, setDefectDeadline]   = useState("");

  // Feedback form
  const [fbSender, setFbSender]     = useState("Chủ đầu tư");
  const [fbType, setFbType]         = useState("Kiến nghị");
  const [fbContent, setFbContent]   = useState("");
  const [fbPriority, setFbPriority] = useState("Trung bình");

  // Chat
  const [messages, setMessages]     = useState<ChatMessage[]>([
    { role:"gem", text:"Dạ, chào Anh/Chị! Em đã quét xong toàn bộ hồ sơ QA/QC. Hiện có 2 NCR chưa đóng và 5 checklist đang chờ nghiệm thu. Anh muốn em phân tích sâu phần nào không ạ?" },
  ]);
  const [gemInput, setGemInput]     = useState("");
  const [isGemLoading, setIsGemLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Computed stats ────────────────────────────────────────────────────────
  const totalCL    = checklists.length;
  const doneCL     = checklists.filter(c=>c.status==="Hoàn thành").length;
  const inProgCL   = checklists.filter(c=>c.status==="Đang tiến hành").length;
  const pendingCL  = checklists.filter(c=>c.status==="Chưa bắt đầu").length;
  const openNCR    = defects.filter(d=>d.status!=="Đã khắc phục").length;
  const critNCR    = defects.filter(d=>d.severity==="Cao"&&d.status!=="Đã khắc phục").length;
  const closedNCR  = defects.filter(d=>d.status==="Đã khắc phục").length;
  const pendingFB  = feedbacks.filter(f=>f.status==="Chờ phản hồi").length;
  const quality    = Math.round((doneCL/totalCL)*100);

  // ── AI Chat ───────────────────────────────────────────────────────────────
  const askGem = async () => {
    if (!gemInput.trim()||isGemLoading) return;
    const userText=gemInput; setGemInput("");
    setMessages(prev=>[...prev,{role:"user",text:userText}]);
    setIsGemLoading(true);
    const ctx=`Dự án ${projectName} | QA/QC: Checklist ${doneCL}/${totalCL} hoàn thành, NCR mở ${openNCR} (${critNCR} nghiêm trọng), Phản hồi chờ ${pendingFB}, Chất lượng tổng ${quality}%`;
    try {
      const model = genAI.getGenerativeModel({
        model: GEM_MODEL,
        systemInstruction: GEM_QAQC_SYSTEM + `\nContext: ${ctx}`,
      });
      // Multi-turn: build history
      const history = messages.map(m => ({
        role: m.role === "gem" ? "model" : "user",
        parts: [{ text: m.text }],
      }));
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userText);
      setMessages(prev=>[...prev,{role:"gem",text:result.response.text()||"Dạ em xin lỗi, có lỗi kết nối ạ!"}]);
    } catch {
      setMessages(prev=>[...prev,{role:"gem",text:"Em bị mất kết nối tạm thời. Anh thử lại nghen!"}]);
    } finally { setIsGemLoading(false); }
  };

  // ── Save helpers ──────────────────────────────────────────────────────────
  const saveChecklist = () => {
    if (!customItems.length){notifInfo('Chưa có nội dung kiểm tra!');return;}
    setChecklists(prev=>[{
      id:Date.now(), name:`${DOC_TYPES_QAQC.find(d=>d.id===selectedDocType)?.label||"Biên bản"} — ${formLocation||"Chưa đặt vị trí"}`,
      status:"Chưa bắt đầu", progress:0,
      date:formDate.split("-").reverse().join("/"), docType:selectedDocType, location:formLocation,
    },...prev]);
    setShowChecklistForm(false); setFormLocation(""); setCustomItems([]);
    notifOk('Nàng GEM: Đã lưu hồ sơ thành công!');
  };
  const saveDefect = () => {
    if (!defectTitle.trim()){notifErr('Vui lòng mô tả lỗi!');return;}
    setDefects(prev=>[{
      id:`NCR-${String(prev.length+1).padStart(3,"0")}`, title:defectTitle,
      severity:defectSeverity, status:"Chờ duyệt", reportedBy:"Người dùng",
      date:new Date().toLocaleDateString("vi-VN"), location:defectLocation,
      deadline:defectDeadline.split("-").reverse().join("/"),
    },...prev]);
    setShowDefectForm(false); setDefectTitle(""); setDefectLocation(""); setDefectDeadline("");
  };
  const saveFeedback = () => {
    if (!fbContent.trim()){notifInfo('Vui lòng nhập nội dung!');return;}
    setFeedbacks(prev=>[{id:Date.now(),sender:fbSender,type:fbType,content:fbContent,priority:fbPriority,status:"Chờ phản hồi",reply:"",replyDate:""},...prev]);
    setShowFeedbackForm(false); setFbContent("");
  };
  const syncSchedule = () => {
    const today=new Date().toISOString().split("T")[0];
    const upcoming=PROJECT_SCHEDULE_ITEMS.filter(s=>s.planDate>=today);
    if (upcoming.length) {
      setChecklists(prev=>[...upcoming.map(s=>({id:Date.now()+Math.random(),name:`[TỰ ĐỘNG] ${s.task}`,status:"Chưa bắt đầu",progress:0,date:s.planDate.split("-").reverse().join("/"),docType:"ITP",location:"Xem tiến độ"})),...prev]);
      alert(`Nàng GEM: Đã tạo ${upcoming.length} biên bản nháp!`);
    } else notifInfo('Tiến độ ổn định, không có hạng mục cần khởi tạo gấp.');
  };

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredCL  = checklists.filter(c=>(checklistFilter==="Tất cả"||c.status===checklistFilter)&&c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredDef = defects.filter(d=>(defectFilter==="Tất cả"||d.status===defectFilter)&&d.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFB  = feedbacks.filter(f=>fbFilter==="Tất cả"||f.sender.includes(fbFilter));

  // ── Tab config ─────────────────────────────────────────────────────────────
  const tabs = [
    { id:"overview",   label:"Tổng quan",           icon:<LayoutDashboard size={15}/> },
    { id:"checklists", label:"Checklist Nghiệm thu", icon:<ClipboardCheck size={15}/>  },
    { id:"defects",    label:"NCR & Lỗi",           icon:<AlertCircle size={15}/>     },
    { id:"feedback",   label:"Phản hồi & Kiến nghị",icon:<MessageSquare size={15}/>   },
    { id:"templates",  label:"Thư viện Biểu mẫu",   icon:<Layers size={15}/>          },
    { id:"iso",        label:"ISO / TCVN 9045",      icon:<Award size={15}/>            },
  ];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-24">
      <style>{PRINT_STYLES}</style>

      {/* ── HEADER ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-emerald-600" size={22}/> Quản lý Chất lượng QA/QC
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Hệ thống kiểm soát chất lượng & biểu mẫu — {projectName}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={syncSchedule} className="flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-100 transition-all">
              <Clock size={15}/> Đồng bộ tiến độ
            </button>
            {/* Approval queue button */}
            <button
              onClick={() => setShowApprovalPanel(true)}
              className="relative flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-100 transition-all"
            >
              <ClipboardCheck size={15}/>
              Hàng duyệt QA
              {qaApprovalQueue.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {qaApprovalQueue.length}
                </span>
              )}
            </button>
            <button onClick={()=>setShowGemChat(!showGemChat)} className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl font-medium hover:shadow-lg transition-all text-sm">
              <Sparkles size={15}/> Nàng GEM
            </button>
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex overflow-x-auto">
          {tabs.map(tab=>(
            <button key={tab.id} onClick={()=>{setActiveTab(tab.id);setSearchTerm("");}}
              className={`px-4 md:px-5 py-4 font-medium text-sm whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${activeTab===tab.id?"border-emerald-600 text-emerald-700 bg-emerald-50/50":"border-transparent text-slate-600 hover:bg-slate-50"}`}>
              {tab.icon}{tab.label}
              {tab.id==="defects"&&openNCR>0&&<span className="ml-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{openNCR}</span>}
              {tab.id==="feedback"&&pendingFB>0&&<span className="ml-1 bg-amber-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">{pendingFB}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT + OPTIONAL CHAT SIDEBAR ── */}
      <div className={`grid grid-cols-1 gap-5 ${showGemChat?"lg:grid-cols-3":""}`}>
        <div className={`space-y-5 ${showGemChat?"lg:col-span-2":""}`}>

          {/* ══ TAB: OVERVIEW ════════════════════════════════════════════════ */}
          {activeTab==="overview" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {[
                  {label:"Chất lượng tổng thể",value:`${quality}%`,sub:`${doneCL}/${totalCL} checklist xong`,color:"emerald",icon:<Target size={18}/>},
                  {label:"NCR đang mở",value:openNCR,sub:`${critNCR} lỗi nghiêm trọng`,color:"rose",icon:<AlertCircle size={18}/>},
                  {label:"Chờ nghiệm thu",value:inProgCL+pendingCL,sub:`${inProgCL} đang làm · ${pendingCL} chưa bắt đầu`,color:"amber",icon:<Clock size={18}/>},
                  {label:"Phản hồi chờ",value:pendingFB,sub:`/${feedbacks.length} tổng`,color:"blue",icon:<MessageSquare size={18}/>},
                ].map((kpi,i)=>(
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
                    <div className={`inline-flex p-2 rounded-xl mb-3 bg-${kpi.color}-50 text-${kpi.color}-600`}>{kpi.icon}</div>
                    <div className={`text-2xl md:text-3xl font-bold ${kpi.color==="rose"&&openNCR>0?"text-rose-600":"text-slate-800"}`}>{kpi.value}</div>
                    <div className="text-xs text-slate-500 mt-1 font-medium">{kpi.label}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{kpi.sub}</div>
                  </div>
                ))}
              </div>
              {/* Progress bars */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><BarChart2 size={17} className="text-emerald-600"/>Tiến độ nghiệm thu</h3>
                <div className="space-y-4">
                  {checklists.slice(0,6).map(cl=>(
                    <div key={cl.id}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cl.status==="Hoàn thành"?"bg-emerald-500":cl.status==="Đang tiến hành"?"bg-blue-500":"bg-slate-300"}`}/>
                          <span className="text-sm font-medium text-slate-700 truncate">{cl.name}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-600 ml-2 shrink-0">{cl.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${cl.progress===100?"bg-emerald-500":cl.progress>0?"bg-blue-400":"bg-slate-200"}`} style={{width:`${cl.progress}%`}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* NCR mở */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><AlertTriangle size={15} className="text-rose-500"/>NCR đang mở</h3>
                    <button onClick={()=>setActiveTab("defects")} className="text-xs text-emerald-600 font-medium hover:underline">Xem tất cả</button>
                  </div>
                  <div className="space-y-2.5">
                    {defects.filter(d=>d.status!=="Đã khắc phục").slice(0,3).map(d=>(
                      <div key={d.id} className="flex items-start gap-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                        <SeverityBadge s={d.severity}/>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{d.id} · {d.date}</p>
                        </div>
                      </div>
                    ))}
                    {defects.filter(d=>d.status!=="Đã khắc phục").length===0&&(
                      <div className="text-center py-6 text-emerald-600"><CheckCircle2 size={28} className="mx-auto mb-1"/><p className="text-sm font-medium">Không có NCR nào đang mở!</p></div>
                    )}
                  </div>
                </div>
                {/* Lịch nghiệm thu */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Calendar size={15} className="text-blue-500"/>Nghiệm thu sắp tới</h3>
                    <button onClick={()=>setActiveTab("templates")} className="text-xs text-emerald-600 font-medium hover:underline">Mở biểu mẫu</button>
                  </div>
                  <div className="space-y-2.5">
                    {PROJECT_SCHEDULE_ITEMS.map(s=>(
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="shrink-0 text-center bg-blue-600 text-white rounded-lg px-2 py-1 min-w-[48px]">
                          <div className="text-[10px] font-bold">{s.planDate.split("-")[2]}/{s.planDate.split("-")[1]}</div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.task}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{s.standard}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: CHECKLISTS ══════════════════════════════════════════════ */}
          {activeTab==="checklists" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Template QA badge */}
              {(() => {
                const tplId = getProjectTemplate(projectId);
                const tpl   = tplId ? PROJECT_TEMPLATES[tplId] : null;
                if (!tpl) return null;
                const tplCount = tpl.qaChecklists.reduce((s, c) => s + c.items.length, 0);
                return (
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs">
                      <span>{tpl.icon}</span>
                      <span className="font-bold text-emerald-700">{tpl.name}</span>
                      <span className="text-emerald-600">— {tplCount} checklist items từ template ({tpl.qaChecklists.length} hạng mục)</span>
                    </div>
                    <button
                      onClick={() => {
                        const today = new Date().toLocaleDateString('vi-VN');
                        const seeded: any[] = tpl.qaChecklists.flatMap((cat, ci) =>
                          cat.items.map((item, ii) => ({
                            id: Date.now() + ci * 100 + ii,
                            name: item, status: 'Chưa bắt đầu', progress: 0,
                            date: today, docType: 'ITP', location: cat.category,
                          }))
                        );
                        setChecklists(seeded);
                      }}
                      className="text-[10px] font-bold text-emerald-700 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors shrink-0">
                      ↺ Reset về template
                    </button>
                  </div>
                );
              })()}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Tìm checklist..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"/>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["Tất cả","Hoàn thành","Đang tiến hành","Chưa bắt đầu"].map(f=>(
                    <button key={f} onClick={()=>setChecklistFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${checklistFilter===f?"bg-emerald-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={()=>{setShowChecklistForm(true);setCustomItems(getTemplateByDocType(selectedDocType));}}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all shrink-0">
                  <Plus size={15}/> Tạo mới
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCL.map(item=>(
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-md transition-all shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-50 rounded-lg"><ClipboardCheck className="text-emerald-600" size={15}/></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{item.docType}</span>
                      </div>
                      <StatusBadge s={item.status}/>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-1 text-sm leading-tight">{item.name}</h4>
                    {item.location&&<p className="text-[11px] text-slate-400 flex items-center gap-1 mb-1"><MapPin size={10}/>{item.location}</p>}
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mb-3"><Clock size={10}/>Hạn: {item.date}</p>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1"><span>Tiến độ</span><span>{item.progress}%</span></div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-3">
                      <div className={`h-full rounded-full ${item.progress===100?"bg-emerald-500":"bg-emerald-400"}`} style={{width:`${item.progress}%`}}/>
                    </div>
                    {/* Gửi duyệt — chỉ khi Hoàn thành */}
                    {item.status === "Hoàn thành" && (
                      <button
                        onClick={() => triggerQaDoc(
                          item.name,
                          'ITP_MANAGEMENT',
                          { checklist: item },
                        )}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all"
                      >
                        <Send size={10}/> Gửi nghiệm thu duyệt
                      </button>
                    )}
                  </div>
                ))}
                {filteredCL.length===0&&<div className="col-span-2 py-16 text-center text-slate-400"><ClipboardCheck size={36} className="mx-auto mb-2 opacity-30"/><p>Không tìm thấy checklist nào</p></div>}
              </div>
            </div>
          )}

          {/* ══ TAB: DEFECTS ═════════════════════════════════════════════════ */}
          {activeTab==="defects" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:"Đang mở",count:openNCR,color:"rose"},
                  {label:"Cao / Nghiêm trọng",count:critNCR,color:"orange"},
                  {label:"Đã đóng",count:closedNCR,color:"emerald"},
                ].map((s,i)=>(
                  <div key={i} className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{s.label}</p>
                    <span className={`text-3xl font-bold text-${s.color}-600`}>{s.count}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Tìm NCR..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"/>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["Tất cả","Chờ duyệt","Đang xử lý","Đã khắc phục"].map(f=>(
                    <button key={f} onClick={()=>setDefectFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${defectFilter===f?"bg-rose-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShowDefectForm(true)} className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-rose-700 shrink-0">
                  <Plus size={15}/> Ghi nhận lỗi
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Mã NCR","Mô tả","Mức độ","Trạng thái","Hạn KP",""].map(h=>(
                          <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDef.map(d=>(
                        <tr key={d.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-4 py-4"><span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{d.id}</span></td>
                          <td className="px-4 py-4">
                            <p className="font-medium text-slate-800">{d.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <User size={9}/>{d.reportedBy}{d.location&&<><span>·</span><MapPin size={9}/>{d.location}</>}
                            </p>
                          </td>
                          <td className="px-4 py-4"><SeverityBadge s={d.severity}/></td>
                          <td className="px-4 py-4"><StatusBadge s={d.status}/></td>
                          <td className="px-4 py-4 text-sm text-slate-600">{d.deadline||"—"}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Approval CTA — chỉ hiện khi chưa nộp duyệt và ctx tồn tại */}
                              {ctx && d.status === "Chờ duyệt" && (
                                <button
                                  onClick={() => triggerQaApproval(d, d.id.startsWith('RFI') ? 'RFI' : 'NCR')}
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                                  title="Gửi vào hàng duyệt">
                                  <Send size={10}/> Gửi duyệt
                                </button>
                              )}
                              {d.status!=="Đã khắc phục"&&(
                                <button onClick={()=>setDefects(prev=>prev.map(x=>x.id===d.id?{...x,status:"Đã khắc phục"}:x))}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Đánh dấu đã xử lý"><Check size={13}/></button>
                              )}
                              <button onClick={()=>setDefects(prev=>prev.filter(x=>x.id!==d.id))}
                                className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg" title="Xóa"><Trash2 size={13}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredDef.length===0&&<tr><td colSpan={6} className="py-14 text-center text-slate-400"><CheckCircle2 size={32} className="mx-auto mb-2 opacity-30"/><p>Không có lỗi nào</p></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: FEEDBACK ════════════════════════════════════════════════ */}
          {activeTab==="feedback" && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Cổng Phản hồi & Kiến nghị</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Tổng hợp ý kiến từ CĐT, TVGS và các bên liên quan</p>
                  </div>
                  <button onClick={()=>setShowFeedbackForm(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-700 shrink-0">
                    + Ghi nhận phản hồi
                  </button>
                </div>
                <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                  {["Tất cả","Chủ đầu tư","TVGS","Tổ đội"].map(cat=>(
                    <button key={cat} onClick={()=>setFbFilter(cat)}
                      className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-all whitespace-nowrap ${fbFilter===cat?"bg-blue-600 text-white shadow-sm":"bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  {filteredFB.map(fb=>(
                    <div key={fb.id} className={`p-5 rounded-2xl border-2 ${fb.status==="Đã trả lời"?"bg-white border-slate-100":"bg-blue-50/30 border-blue-100 shadow-sm"}`}>
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${fb.sender==="Chủ đầu tư"?"bg-purple-600 text-white":fb.sender==="TVGS"?"bg-blue-600 text-white":"bg-slate-600 text-white"}`}>{fb.sender}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{fb.type}</span>
                          <SeverityBadge s={fb.priority}/>
                        </div>
                        <StatusBadge s={fb.status}/>
                      </div>
                      <p className="text-sm text-slate-700 italic mb-3">"{fb.content}"</p>
                      {fb.reply&&(
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">✓ Phản hồi — {fb.replyDate}</p>
                          <p className="text-sm text-emerald-900">{fb.reply}</p>
                        </div>
                      )}
                      {fb.status!=="Đã trả lời"&&replyingTo!==fb.id&&(
                        <button onClick={()=>setReplyingTo(fb.id)} className="mt-3 flex items-center gap-1.5 text-blue-600 font-bold text-xs hover:bg-blue-50 px-3 py-2 rounded-lg transition-all">
                          Soạn câu trả lời <ChevronRight size={13}/>
                        </button>
                      )}
                      {replyingTo===fb.id&&(
                        <div className="mt-3 space-y-2">
                          <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={3}
                            className="w-full border-2 border-blue-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
                            placeholder="Nhập nội dung phản hồi..."/>
                          <div className="flex gap-2">
                            <button onClick={()=>{if(!replyText.trim())return;setFeedbacks(prev=>prev.map(f=>f.id===fb.id?{...f,reply:replyText,replyDate:new Date().toLocaleDateString("vi-VN"),status:"Đã trả lời"}:f));setReplyingTo(null);setReplyText("");}}
                              className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black">Xác nhận gửi</button>
                            <button onClick={()=>setReplyingTo(null)} className="text-slate-400 font-bold text-xs px-3 py-2 hover:bg-slate-100 rounded-xl">Hủy</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredFB.length===0&&<div className="py-12 text-center text-slate-400"><MessageSquare size={36} className="mx-auto mb-2 opacity-30"/><p>Không có phản hồi nào</p></div>}
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB: TEMPLATES ═══════════════════════════════════════════════ */}
          {activeTab==="templates" && (
            <div className="animate-in fade-in duration-300">
              <FormTemplateManager
                projectId={projectId}
                projectName={projectName}
                projectAddress={projectAddress}
              />
            </div>
          )}

          {activeTab==="iso" && (
            <ISOChecklistTab project={project} projectName={projectName} />
          )}
        </div>

        {/* ── GEM CHAT SIDEBAR ── */}
        {showGemChat && (
          <div className="lg:col-span-1 animate-in slide-in-from-right-5 duration-300">
            <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 overflow-hidden flex flex-col sticky top-24" style={{height:"600px"}}>
              <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"><Sparkles size={18}/></div>
                  <div>
                    <p className="font-bold text-sm">Nàng GEM QA/QC</p>
                    <p className="text-[10px] text-emerald-100 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-ping inline-block"/>AI thật · Claude
                    </p>
                  </div>
                </div>
                <button onClick={()=>setShowGemChat(false)} className="text-white/70 hover:text-white"><X size={20}/></button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
                {messages.map((m,i)=>(
                  <div key={i} className={`flex ${m.role==="gem"?"justify-start":"justify-end"}`}>
                    <div className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${m.role==="gem"?"bg-white text-slate-700 border border-slate-100":"bg-emerald-600 text-white"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {isGemLoading&&<div className="flex justify-start"><div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2"><Loader2 size={13} className="animate-spin text-emerald-500"/><span className="text-xs text-slate-400">Đang phân tích...</span></div></div>}
                <div ref={chatEndRef}/>
              </div>
              <div className="p-3 border-t border-slate-100 bg-white shrink-0">
                <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                  {["Tóm tắt tình hình","NCR nghiêm trọng","Cần làm gì hôm nay?"].map(q=>(
                    <button key={q} onClick={()=>setGemInput(q)} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg whitespace-nowrap hover:bg-emerald-100 transition-colors">{q}</button>
                  ))}
                </div>
                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 focus-within:border-emerald-400 transition-all">
                  <input value={gemInput} onChange={e=>setGemInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askGem()}
                    type="text" placeholder="Hỏi về chất lượng..." className="flex-1 bg-transparent border-none px-2 py-1.5 text-sm outline-none text-slate-700"/>
                  <button onClick={askGem} disabled={isGemLoading} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {isGemLoading?<Loader2 size={15} className="animate-spin"/>:<Send size={15}/>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════ MODALS ══════════════════════════════════════════ */}

      {/* Modal: Tạo checklist QA/QC */}
      {showChecklistForm && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 flex justify-between items-center text-white ${selectedDocType==="NCR"?"bg-rose-600":selectedDocType==="MIR"?"bg-blue-600":selectedDocType==="HSE"?"bg-orange-600":"bg-emerald-600"}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><ClipboardCheck size={22}/></div>
                <div>
                  <h3 className="font-bold text-lg">{DOC_TYPES_QAQC.find(d=>d.id===selectedDocType)?.label}</h3>
                  <p className="text-white/70 text-xs">Tạo checklist nghiệm thu nhanh</p>
                </div>
              </div>
              <button onClick={()=>setShowChecklistForm(false)} className="hover:rotate-90 transition-transform bg-black/10 p-2 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Loại hồ sơ</label>
                <select value={selectedDocType} onChange={e=>{setSelectedDocType(e.target.value);setCustomItems(getTemplateByDocType(e.target.value));}}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500">
                  {DOC_TYPES_QAQC.map(d=><option key={d.id} value={d.id}>{d.id} — {d.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Vị trí / Hạng mục</label>
                  <input value={formLocation} onChange={e=>setFormLocation(e.target.value)} placeholder="VD: Sàn tầng 5 - Block A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500"/>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Ngày thực hiện</label>
                  <input type="date" value={formDate} onChange={e=>setFormDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500"/>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-black text-slate-400 uppercase">Danh mục kiểm tra ({customItems.length} mục)</label>
                  <button onClick={()=>setCustomItems([...customItems,{l:"Hạng mục mới",d:"Tiêu chuẩn..."}])}
                    className="text-[10px] bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700">+ Thêm dòng</button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {customItems.map((item,i)=>(
                    <div key={i} className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl group">
                      <div className="flex-1 space-y-1">
                        <input value={item.l} onChange={e=>{const n=[...customItems];n[i].l=e.target.value;setCustomItems(n);}}
                          className="w-full text-sm font-medium text-slate-700 bg-transparent outline-none border-b border-transparent focus:border-emerald-400"/>
                        <input value={item.d} onChange={e=>{const n=[...customItems];n[i].d=e.target.value;setCustomItems(n);}}
                          className="w-full text-[11px] text-slate-400 bg-transparent outline-none"/>
                      </div>
                      <button onClick={()=>setCustomItems(customItems.filter((_,idx)=>idx!==i))}
                        className="text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-rose-50 rounded-lg"><X size={13}/></button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 flex gap-2">
                <Info size={14} className="shrink-0 mt-0.5"/>
                Muốn dùng mẫu biên bản đầy đủ hơn? Vào tab <strong>Thư viện Biểu mẫu</strong> để chọn mẫu có sẵn hoặc upload mẫu Word/Excel của anh lên!
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button onClick={()=>{
                const cl = checklists.find(c=>c.id===viewingChecklist);
                if (cl) setPrintITP({
                  id: cl.id,
                  name: cl.name,
                  date: cl.date,
                  location: cl.location,
                  docType: cl.docType,
                  items: [],
                });
              }} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">
                <Printer size={15}/> In biên bản
              </button>
              <button onClick={saveChecklist} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-lg shadow-emerald-100">
                <Sparkles size={15}/> Lưu hồ sơ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ghi nhận NCR */}
      {showDefectForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-rose-50">
              <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2"><AlertCircle size={20}/>Ghi nhận NCR mới</h3>
              <button onClick={()=>setShowDefectForm(false)} className="hover:rotate-90 transition-transform text-rose-400"><XCircle size={24}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Mô tả lỗi / Sai phạm *</label>
                <textarea value={defectTitle} onChange={e=>setDefectTitle(e.target.value)} rows={3}
                  placeholder="Mô tả rõ vị trí và tình trạng lỗi..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-400 outline-none resize-none"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Mức độ</label>
                  <select value={defectSeverity} onChange={e=>setDefectSeverity(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 outline-none">
                    <option>Cao (Dừng thi công)</option><option>Trung bình</option><option>Thấp (Khắc phục sau)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Hạn khắc phục</label>
                  <input type="date" value={defectDeadline} onChange={e=>setDefectDeadline(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 outline-none"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Vị trí cụ thể</label>
                <input value={defectLocation} onChange={e=>setDefectLocation(e.target.value)} placeholder="VD: Cột C1 - Tầng 3 - Block A"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-400"/>
              </div>
              <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center hover:bg-rose-50/50 hover:border-rose-200 cursor-pointer transition-all">
                <Camera className="mx-auto text-slate-400 mb-2" size={26}/>
                <p className="text-sm font-bold text-slate-600">Chụp ảnh / Đính kèm ảnh lỗi</p>
                <p className="text-xs text-slate-400">JPG, PNG — Tối đa 10MB</p>
              </div>
              <button onClick={saveDefect} className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100">
                Gửi báo cáo NCR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Phản hồi */}
      {showFeedbackForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2"><Mic size={20}/>Ghi nhận Phản hồi mới</h3>
              <button onClick={()=>setShowFeedbackForm(false)} className="hover:rotate-90 transition-transform opacity-70 hover:opacity-100"><XCircle size={24}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Bên gửi</label>
                  <select value={fbSender} onChange={e=>setFbSender(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none">
                    <option>Chủ đầu tư</option><option>TVGS</option><option>Tổ đội</option><option>Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Loại ý kiến</label>
                  <select value={fbType} onChange={e=>setFbType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none">
                    <option>Kiến nghị</option><option>Khiếu nại</option><option>Báo cáo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Nội dung chi tiết *</label>
                <textarea value={fbContent} onChange={e=>setFbContent(e.target.value)} rows={4}
                  placeholder="Nhập nội dung phản hồi hoặc kiến nghị..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Mức độ ưu tiên</label>
                <div className="flex gap-2">
                  {["Cao","Trung bình","Thấp"].map(p=>(
                    <button key={p} onClick={()=>setFbPriority(p)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${fbPriority===p?"bg-blue-600 text-white border-blue-600":"bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={saveFeedback} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100">
                Gửi & Lưu vào hệ thống
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print components ── */}
      {printITP && <ITPPrint
        data={{ checklist: printITP, projectName: projectName || '', projectId }}
        onClose={() => setPrintITP(null)}
      />}
      {printNCR && <NCRPrint
        data={{ ncr: printNCR, projectName: projectName || '', projectId }}
        onClose={() => setPrintNCR(null)}
      />}
    </div>
  );
}
