import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Camera,
  X,
  Sparkles,
  MessageSquare,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Copy,
  Check,
  PlayCircle,
  BookOpen,
  HelpCircle,
  Lightbulb,
  Zap,
  FolderKanban,
  ClipboardCheck,
  AlertTriangle,
  Package,
  CalendarDays,
  ArrowRight,
  Star,
  PlusCircle,
  Image,
  Phone,
  Shield,
  BarChart2,
  Cloud,
  Bell,
  HardHat,
  DollarSign,
  CheckCircle2,
  Users,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { GEM_MODEL } from './gemini';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useNotification } from './NotificationEngine';

// ── Gemini init — đúng theo SI v2: @google/generative-ai ─────────────────────
const genAI = new GoogleGenerativeAI((import.meta as any).env?.VITE_GEMINI_API_KEY || "");

// ── System prompt — cập nhật đầy đủ hệ thống hiện tại ────────────────────────
const SYSTEM_PROMPT = `Bạn là GEM — trợ lý AI quản lý xây dựng của GEM&CLAUDE PM Pro.

PHONG CÁCH: Giọng nữ miền Nam. Xưng "em", gọi "Anh/Chị". Dùng: dạ / nha / nghen / ạ. Thân thiện nhưng chuyên nghiệp. Câu ngắn gọn, có số liệu cụ thể khi có thể.

HỆ THỐNG GEM&CLAUDE PM Pro gồm 15 phần: Tổng quan, Hợp đồng (bảo mật PIN), Tiến độ, Tài nguyên, Nhân lực, Thiết bị, QA/QC, QS & Thanh toán, Báo cáo, Văn phòng, Thông báo, Kế toán, Cloud Storage, KS Giám sát, HR. Dữ liệu lưu an toàn trên máy chủ. Dùng được khi mất mạng, tự cập nhật khi có mạng trở lại. Phân quyền 3 cấp: Giám đốc / Quản lý / Nhân viên.

3 CHẾ ĐỘ:
1. CHAT THƯỜNG: Tư vấn nghiệm thu, khối lượng thanh toán, tiến độ, nhân công, vật tư, an toàn lao động, dòng tiền dự án. Trả lời tự nhiên, thân thiện.
2. HÀNH CHÍNH: Khi anh nói "soạn", "lập", "viết" biên bản/báo cáo → tự động chuyển văn phong chuẩn Nhà nước: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM, ngôi thứ ba khách quan, đủ thành phần ký tên. Hỗ trợ: biên bản nghiệm thu, báo cáo tuần, nhật ký công trình, phiếu vật tư, biên bản vi phạm, RFI, phiếu bàn giao.
3. HƯỚNG DẪN: Khi anh hỏi cách dùng hệ thống → hướng dẫn từng bước rõ ràng, chỉ đúng tên tab/mục trong ứng dụng.

QUY TẮC: Không bịa số liệu. Nếu không có dữ liệu thực → nói rõ và hỏi thêm. Luôn đề xuất việc cần làm tiếp theo. Khi có cảnh báo quan trọng → gợi ý gửi thông báo qua Zalo cho người phụ trách.`;

// ── Types ─────────────────────────────────────────────────────────────────────
type AppMode = "chat" | "admin" | "guide" | "new_project";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
  copied?: boolean;
  image?: string; // base64
}

// ── Features — 8 tính năng cập nhật đầy đủ ───────────────────────────────────
const FEATURES = [
  {
    icon: ClipboardCheck,
    color: "emerald",
    title: "Chất lượng & Nghiệm thu",
    desc: "Lập phiếu ghi lỗi, tạo checklist nghiệm thu, theo dõi hạng mục chưa đạt — GEM soạn biên bản đúng mẫu Nhà nước",
    prompt: "GEM hướng dẫn em cách tạo phiếu kiểm tra và ghi lỗi kỹ thuật trên công trường",
  },
  {
    icon: DollarSign,
    color: "blue",
    title: "Khối lượng & Thanh toán",
    desc: "Theo dõi từng hạng mục đã làm bao nhiêu, lập hồ sơ đề nghị thanh toán, cảnh báo khi sắp trễ hạn",
    prompt: "GEM giải thích cách theo dõi khối lượng thi công và lập hồ sơ thanh toán với chủ đầu tư",
  },
  {
    icon: HardHat,
    color: "rose",
    title: "Nhân công & An toàn lao động",
    desc: "Điểm danh ca làm việc, ghi vi phạm an toàn tại chỗ, theo dõi chứng chỉ còn hạn hay hết hạn",
    prompt: "Hướng dẫn cách ghi nhận vi phạm an toàn lao động và lập biên bản đúng quy định",
  },
  {
    icon: Package,
    color: "amber",
    title: "Vật tư & Máy móc",
    desc: "Theo dõi tồn kho vật tư theo thời gian thực, lập phiếu yêu cầu, lịch bảo dưỡng máy móc",
    prompt: "Làm sao theo dõi vật tư tồn kho để không bị đứt hàng giữa chừng?",
  },
  {
    icon: CalendarDays,
    color: "violet",
    title: "Lịch & Tiến độ thi công",
    desc: "Theo dõi tiến độ từng giai đoạn, cảnh báo hạng mục chậm, tạo sự kiện họp giao ban",
    prompt: "GEM phân tích tình hình tiến độ công trình và đề xuất cách khắc phục khi bị chậm",
  },
  {
    icon: FileText,
    color: "indigo",
    title: "Soạn hồ sơ & Giấy tờ",
    desc: "Biên bản nghiệm thu, báo cáo tuần, nhật ký công trình, phiếu yêu cầu — đúng mẫu chuẩn Nhà nước",
    prompt: "Soạn biên bản họp giao ban tuần này với đầy đủ thành phần ký tên",
  },
  {
    icon: Cloud,
    color: "teal",
    title: "Lưu trữ hồ sơ & Bản vẽ",
    desc: "Upload bản vẽ, hợp đồng, ảnh hiện trường vào 8 ngăn riêng — tìm lại trong vài giây, chia sẻ link bảo mật",
    prompt: "GEM hướng dẫn cách lưu và chia sẻ bản vẽ thi công cho các bên liên quan",
  },
  {
    icon: Bell,
    color: "rose",
    title: "Cảnh báo & Thông báo Zalo",
    desc: "Cài quy tắc tự động: vi phạm an toàn, trễ thanh toán, họp giao ban — Zalo báo thẳng đúng người",
    prompt: "Thiết lập cảnh báo Zalo khi có vi phạm an toàn mức nghiêm trọng chưa được xử lý",
  },
];

// ── Lessons — 5 bài học thực tế ───────────────────────────────────────────────
const LESSONS = [
  {
    id: "l1",
    title: "Bắt đầu dùng GEM",
    level: "Cơ bản",
    duration: "3 phút",
    steps: [
      {
        step: 1,
        title: "Chọn công trình",
        desc: 'Nhấn vào ô "Công trình" phía trên để GEM biết anh đang nói về công trình nào — câu trả lời sẽ chính xác hơn nhiều.',
      },
      {
        step: 2,
        title: "Hỏi tự nhiên như hỏi người",
        desc: 'Không cần từ khoá đặc biệt. Cứ hỏi: "Tuần này tiến độ thế nào?", "Hôm nay có bao nhiêu công nhân?", "Còn NCR nào chưa xử lý không?"',
      },
      { step: 3, title: "Nhấn các gợi ý nhanh", desc: "Các nút gợi ý phía trên ô nhập — nhấn vào là GEM trả lời ngay, không cần gõ." },
      {
        step: 4,
        title: "Đính kèm ảnh công trường",
        desc: "Nhấn icon 📷 để chụp hoặc chọn ảnh — GEM phân tích an toàn lao động, chất lượng thi công ngay trong chat.",
      },
    ],
    practicePrompt: "GEM ơi, hôm nay trên công trường có gì cần xử lý không?",
  },
  {
    id: "l2",
    title: "Soạn biên bản nghiệm thu",
    level: "Trung bình",
    duration: "5 phút",
    steps: [
      {
        step: 1,
        title: "Vào tab Hành chính",
        desc: 'Nhấn tab "Hành chính" ở trên cùng → chọn "Biên bản nghiệm thu" — GEM tự điền khung chuẩn.',
      },
      {
        step: 2,
        title: "Điền thông tin còn thiếu",
        desc: "GEM hỏi anh: tên hạng mục, ngày thực hiện, thành phần tham dự, kết quả kiểm tra. Trả lời lần lượt là xong.",
      },
      { step: 3, title: "Đọc lại và chỉnh sửa", desc: "GEM xuất bản thảo — anh đọc lại, yêu cầu sửa chỗ nào không ưng là GEM sửa ngay." },
      {
        step: 4,
        title: "Copy vào Word hoặc lưu lên máy chủ",
        desc: "Nhấn Copy lấy nội dung paste vào Word, hoặc lưu thẳng lên Cloud trong tab Lưu trữ — tự phân loại đúng ngăn.",
      },
    ],
    practicePrompt: "Soạn biên bản nghiệm thu cốt thép móng M1 đến M5 ngày hôm nay, thành phần tham dự gồm Ban QLDA, TVGS và Nhà thầu",
  },
  {
    id: "l3",
    title: "Theo dõi tiến độ & chi phí",
    level: "Nâng cao",
    duration: "7 phút",
    steps: [
      {
        step: 1,
        title: "Hiểu 2 chỉ số quan trọng nhất",
        desc: "Chỉ số tiến độ (SPI): dưới 1 là chậm so với kế hoạch. Chỉ số chi phí (CPI): dưới 1 là đang vượt ngân sách. GEM luôn hiển thị 2 số này ở màn hình chính.",
      },
      {
        step: 2,
        title: "Hỏi GEM phân tích",
        desc: 'Nói: "GEM phân tích tiến độ công trình này" — GEM đọc dữ liệu và nêu ngay những hạng mục đang có vấn đề.',
      },
      {
        step: 3,
        title: "Nhận giải pháp cụ thể",
        desc: "Khi tiến độ dưới 85% kế hoạch hoặc chi phí vượt 10%, GEM tự động đề xuất giải pháp — tăng ca, điều chỉnh nhân lực, báo cáo CĐT.",
      },
    ],
    practicePrompt: "GEM phân tích tình hình tiến độ và chi phí công trình này, nêu rõ hạng mục nào đang có vấn đề và đề xuất cách xử lý",
  },
  {
    id: "l4",
    title: "Dùng GEM trên điện thoại",
    level: "Cơ bản",
    duration: "2 phút",
    steps: [
      {
        step: 1,
        title: "Cài lên màn hình chính",
        desc: 'Mở trình duyệt trên điện thoại → nhấn banner "Thêm vào màn hình chính" — GEM xuất hiện như app thật, không cần cửa hàng app.',
      },
      {
        step: 2,
        title: "Dùng được khi mất mạng",
        desc: "Ra ngoài công trường mất sóng vẫn nhập liệu bình thường — hệ thống lưu tạm lại. Về văn phòng có mạng là tự cập nhật lên máy chủ.",
      },
      {
        step: 3,
        title: "Nhận cảnh báo qua Zalo",
        desc: "Vào tab Thông báo → cài quy tắc → khi có sự cố an toàn, trễ thanh toán hay họp giao ban, Zalo báo thẳng vào điện thoại anh.",
      },
    ],
    practicePrompt: "GEM hướng dẫn cách cài ứng dụng lên điện thoại và thiết lập nhận cảnh báo qua Zalo",
  },
  {
    id: "l5",
    title: "Phân quyền & Bảo mật",
    level: "Trung bình",
    duration: "4 phút",
    steps: [
      {
        step: 1,
        title: "Ba cấp người dùng",
        desc: "Giám đốc thấy toàn bộ. Quản lý (CHT, KS QA/QC, KS QS, cán bộ HSE) thấy phần việc của mình. Nhân viên thấy ca làm việc và nhiệm vụ được giao.",
      },
      {
        step: 2,
        title: "Hợp đồng bảo mật PIN",
        desc: "Tab Hợp đồng có lớp mã PIN riêng — chỉ người được Giám đốc cấp quyền mới xem được giá trị hợp đồng. Tránh lộ thông tin nhạy cảm ra ngoài.",
      },
      {
        step: 3,
        title: "Thêm người vào dự án",
        desc: "Vào tab Nhân lực → mục Phân quyền → nhập tên và vai trò → người đó đăng nhập sẽ thấy đúng phần việc của họ ngay.",
      },
    ],
    practicePrompt: "GEM hướng dẫn cách thêm người vào dự án và phân quyền cho từng vai trò",
  },
];

// ── FAQs — 8 câu hỏi thực tế ──────────────────────────────────────────────────
const FAQS = [
  {
    q: "GEM có nhớ cuộc trò chuyện không?",
    a: 'Dạ có! Em nhớ toàn bộ cuộc trò chuyện trong phiên làm việc hiện tại. Khi anh đóng cửa sổ chat thì lịch sử xoá để bảo mật — anh có thể nhấn "Xoá lịch sử" bất cứ lúc nào nghen.',
  },
  {
    q: "Làm sao để GEM soạn văn bản hành chính chuẩn?",
    a: 'Anh nhấn tab "Hành chính" và chọn loại văn bản, hoặc cứ gõ "soạn biên bản...", "lập báo cáo..." — GEM tự chuyển sang văn phong chuẩn Nhà nước có đầy đủ tiêu đề, thành phần ký tên nghen.',
  },
  {
    q: "GEM phân tích ảnh công trường được không?",
    a: "Dạ được! Anh nhấn icon 📷 và chọn ảnh — GEM phân tích ngay: ai không đội mũ bảo hộ, chất lượng thi công có vấn đề không, vật liệu đúng quy cách chưa. Tiện lắm anh ơi!",
  },
  {
    q: "Dữ liệu dự án có an toàn không?",
    a: "Dạ hoàn toàn yên tâm! Dữ liệu lưu trên máy chủ bảo mật với phân quyền chặt chẽ — chỉ người được cấp quyền mới xem được. Hợp đồng còn có thêm lớp mã PIN riêng. Cuộc trò chuyện với GEM không lưu lại sau khi đóng.",
  },
  {
    q: "Mất mạng ngoài công trường vẫn dùng được không?",
    a: "Dạ được nghen! Anh vẫn nhập liệu, ghi chép bình thường khi không có mạng. Hệ thống lưu tạm lại — anh thấy con số đỏ nhỏ trên thanh công cụ là biết còn bao nhiêu mục chờ. Về văn phòng có mạng là tự cập nhật lên máy chủ, không cần làm gì thêm.",
  },
  {
    q: "Thiết lập cảnh báo Zalo như thế nào?",
    a: 'Anh vào tab Thông báo → chọn "Cài đặt Zalo" → nhập mã OA → bật các quy tắc muốn nhận. Ví dụ: vi phạm an toàn → báo CHT ngay; sắp tới hạn thanh toán → báo Kế toán trước 3 ngày. Một lần cài là chạy tự động nghen!',
  },
  {
    q: "Ai được vào xem phần nào trong hệ thống?",
    a: "Hệ thống có 3 cấp: Giám đốc thấy toàn bộ kể cả Hợp đồng và Kế toán. Quản lý (CHT, KS QA/QC, KS QS, HSE...) thấy đúng tab công việc của mình. Nhân viên và công nhân chỉ thấy ca làm việc và nhiệm vụ được giao. Anh cài trong tab Nhân lực nghen.",
  },
  {
    q: "GEM có thể làm báo cáo tuần tự động không?",
    a: 'Dạ được! Vào tab Báo cáo → chọn "Báo cáo tuần" → GEM đọc dữ liệu cả tuần rồi tự viết: tiến độ, nhân lực, vật tư, vướng mắc. Anh đọc lại, chỉnh chỗ nào chưa đúng, copy ra Word hoặc gửi Zalo cho CĐT ngay trong ứng dụng.',
  },
];

// ── Tips — 6 mẹo sử dụng hiệu quả ────────────────────────────────────────────
const TIPS = [
  {
    icon: Zap,
    color: "amber",
    tip: "Nói rõ hạng mục — GEM trả lời chính xác hơn",
    detail: 'Thay vì "báo cáo tiến độ" → nói "báo cáo tiến độ cốt thép tầng 3 tuần này". Càng cụ thể, GEM càng đúng.',
  },
  {
    icon: Star,
    color: "violet",
    tip: "Hỏi tiếp — GEM nhớ ngữ cảnh cả buổi",
    detail: 'Sau khi hỏi về tiến độ, cứ hỏi tiếp "Vậy nguyên nhân chậm là gì?" hay "Đề xuất giải pháp đi" — không cần nhắc lại từ đầu.',
  },
  {
    icon: FileText,
    color: "blue",
    tip: 'Bắt đầu bằng "soạn" là ra văn bản chuẩn ngay',
    detail: 'Gõ "soạn biên bản...", "lập báo cáo...", "viết nhật ký..." → GEM tự chuyển sang văn phong hành chính chuẩn, đủ ký tên.',
  },
  {
    icon: Lightbulb,
    color: "emerald",
    tip: "Yêu cầu checklist để kiểm tra nhanh",
    detail: 'Hỏi "GEM cho checklist nghiệm thu bê tông" → ra danh sách đánh dấu ngay trong chat, không cần tìm file mẫu.',
  },
  {
    icon: Image,
    color: "rose",
    tip: "Gửi ảnh — GEM phân tích an toàn lao động",
    detail:
      'Chụp ảnh công trường rồi hỏi "GEM kiểm tra ảnh này có vi phạm an toàn không?" — GEM nhận diện mũ bảo hộ, đai an toàn, rào chắn...',
  },
  {
    icon: Bell,
    color: "indigo",
    tip: "Nhờ GEM gửi cảnh báo Zalo ngay từ chat",
    detail: 'Phát hiện vấn đề → hỏi "GEM soạn tin nhắn cảnh báo vi phạm HSE này gửi cho anh An qua Zalo" — GEM soạn và gửi luôn.',
  },
];

// ── Admin templates — 8 mẫu văn bản ─────────────────────────────────────────
const ADMIN_TEMPLATES = [
  {
    id: "t1",
    icon: ClipboardCheck,
    color: "emerald",
    title: "Biên bản nghiệm thu",
    desc: "Nghiệm thu hạng mục thi công, vật liệu hoặc công việc hoàn thành",
    prompt: (proj: string) =>
      `Soạn biên bản nghiệm thu hạng mục [TÊN HẠNG MỤC] tại ${proj}. Ngày thực hiện: ${new Date().toLocaleDateString("vi-VN")}. Thành phần tham dự: Ban QLDA, TVGS, Nhà thầu. Kết quả: Đạt yêu cầu kỹ thuật theo bản vẽ thiết kế.`,
  },
  {
    id: "t2",
    icon: CalendarDays,
    color: "blue",
    title: "Báo cáo tiến độ tuần",
    desc: "Tổng hợp công việc, nhân lực, vật tư và tiến độ trong tuần",
    prompt: (proj: string) =>
      `Soạn báo cáo tiến độ tuần ${Math.ceil(new Date().getDate() / 7)} tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()} cho ${proj}. Nhân lực: [SỐ NGƯỜI]. Công việc đã thực hiện: [MÔ TẢ]. Khối lượng hoàn thành: [KL]. Kế hoạch tuần tới: [KẾ HOẠCH]. Vướng mắc và kiến nghị: [NẾU CÓ].`,
  },
  {
    id: "t3",
    icon: BookOpen,
    color: "indigo",
    title: "Nhật ký công trình",
    desc: "Ghi chép diễn biến thi công, thời tiết, nhân lực hàng ngày",
    prompt: (proj: string) =>
      `Soạn nhật ký công trình ngày ${new Date().toLocaleDateString("vi-VN")} tại ${proj}. Thời tiết: [THỜI TIẾT]. Nhân lực có mặt: [SỐ NGƯỜI - ĐƠN VỊ]. Máy móc thiết bị: [THIẾT BỊ]. Công việc thực hiện: [MÔ TẢ CHI TIẾT]. Khối lượng hoàn thành: [KL]. Chất lượng thi công: [ĐÁNH GIÁ].`,
  },
  {
    id: "t4",
    icon: Package,
    color: "amber",
    title: "Phiếu yêu cầu vật tư",
    desc: "Lập yêu cầu cấp phát hoặc mua sắm vật tư cho công trình",
    prompt: (proj: string) =>
      `Soạn phiếu yêu cầu vật tư cho ${proj}. Ngày yêu cầu: ${new Date().toLocaleDateString("vi-VN")}. Hạng mục sử dụng: [TÊN HẠNG MỤC]. Danh sách vật tư: [TÊN VẬT TƯ — ĐƠN VỊ — SỐ LƯỢNG]. Ngày cần có mặt tại công trường: [NGÀY]. Người yêu cầu: [TÊN — CHỨC VỤ].`,
  },
  {
    id: "t5",
    icon: AlertTriangle,
    color: "rose",
    title: "Biên bản vi phạm an toàn",
    desc: "Ghi nhận và xử lý vi phạm an toàn lao động tại công trường",
    prompt: (proj: string) =>
      `Soạn biên bản vi phạm an toàn lao động tại ${proj}. Ngày phát hiện: ${new Date().toLocaleDateString("vi-VN")}. Địa điểm: [VỊ TRÍ CỤ THỂ]. Nội dung vi phạm: [MÔ TẢ]. Người vi phạm: [TÊN — ĐƠN VỊ]. Biện pháp xử lý: [HÌNH THỨC]. Thời hạn khắc phục: [NGÀY]. Người lập biên bản: [TÊN — CHỨC VỤ].`,
  },
  {
    id: "t6",
    icon: Shield,
    color: "rose",
    title: "Báo cáo an toàn tuần",
    desc: "Tổng hợp tình hình an toàn lao động, vi phạm và biện pháp trong tuần",
    prompt: (proj: string) =>
      `Soạn báo cáo an toàn lao động tuần ${Math.ceil(new Date().getDate() / 7)} tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()} tại ${proj}. Số công nhân làm việc: [SỐ NGƯỜI]. Số ca kiểm tra an toàn: [SỐ CA]. Vi phạm phát hiện: [SỐ LƯỢNG — LOẠI VI PHẠM]. Biện pháp đã xử lý: [MÔ TẢ]. Tai nạn lao động: [NẾU CÓ]. Kế hoạch tuần tới: [KẾ HOẠCH].`,
  },
  {
    id: "t7",
    icon: HelpCircle,
    color: "violet",
    title: "Phiếu yêu cầu thông tin (RFI)",
    desc: "Yêu cầu làm rõ thông tin kỹ thuật từ tư vấn thiết kế hoặc chủ đầu tư",
    prompt: (proj: string) =>
      `Soạn phiếu yêu cầu thông tin (RFI) cho ${proj}. Ngày gửi: ${new Date().toLocaleDateString("vi-VN")}. Mã RFI: [RFI-${new Date().getFullYear()}-001]. Hạng mục liên quan: [TÊN HẠNG MỤC]. Nội dung cần làm rõ: [MÔ TẢ CHI TIẾT VẤN ĐỀ]. Bản vẽ / tài liệu liên quan: [SỐ HIỆU]. Yêu cầu phản hồi trước ngày: [NGÀY]. Người gửi: [TÊN — CHỨC VỤ — ĐƠN VỊ].`,
  },
  {
    id: "t8",
    icon: CheckCircle2,
    color: "emerald",
    title: "Biên bản bàn giao NTP",
    desc: "Bàn giao mặt bằng / hạng mục hoàn thành cho nhà thầu phụ",
    prompt: (proj: string) =>
      `Soạn biên bản bàn giao thi công cho ${proj}. Ngày bàn giao: ${new Date().toLocaleDateString("vi-VN")}. Hạng mục bàn giao: [TÊN HẠNG MỤC — VỊ TRÍ]. Phạm vi công việc: [MÔ TẢ]. Bên giao: [TÊN — CHỨC VỤ — ĐƠN VỊ]. Bên nhận: [TÊN — CHỨC VỤ — ĐƠN VỊ]. Điều kiện bàn giao: [YÊU CẦU KỸ THUẬT]. Thời gian thực hiện: [TỪ NGÀY — ĐẾN NGÀY].`,
  },
];

// ── Quick chips — đổi theo mode ───────────────────────────────────────────────
const CHIPS_CHAT = [
  "Tiến độ hôm nay thế nào?",
  "Kiểm tra lỗi chưa xử lý",
  "Nhân công hôm nay bao nhiêu?",
  "Dòng tiền tháng này",
  "Vật tư sắp hết chưa?",
  "Lịch nghiệm thu tuần này",
];
const CHIPS_ADMIN = [
  "Soạn biên bản nghiệm thu",
  "Lập báo cáo tuần",
  "Soạn nhật ký hôm nay",
  "Biên bản vi phạm an toàn",
  "Phiếu yêu cầu vật tư",
  "Soạn phiếu RFI",
];

// ── Color helpers ─────────────────────────────────────────────────────────────
const C_ICON: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  indigo: "bg-indigo-50 text-indigo-600",
  teal: "bg-teal-50 text-teal-600",
};
const C_BADGE: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onCopy }: { msg: Message; onCopy: (id: string, text: string) => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 group ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
          isUser ? "bg-emerald-600 text-white" : "bg-emerald-50 border border-emerald-200 text-emerald-600"
        }`}
      >
        {isUser ? "A" : <Sparkles size={14} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[82%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        {/* Image preview nếu có */}
        {msg.image && (
          <img
            src={msg.image}
            alt="Ảnh đính kèm"
            className="rounded-xl mb-1.5 max-w-[200px] max-h-[160px] object-cover border border-slate-200"
          />
        )}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-emerald-600 text-white rounded-tr-none"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm"
          }`}
        >
          {msg.text}
        </div>
        <div className={`flex items-center gap-2 mt-1 ${isUser ? "flex-row-reverse" : ""}`}>
          <span className="text-[10px] text-slate-400">
            {msg.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && (
            <button
              onClick={() => onCopy(msg.id, msg.text)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              {msg.copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Smart empty state ─────────────────────────────────────────────────────────
function EmptyState({ onSend, projectName }: { onSend: (t: string) => void; projectName: string }) {
  const suggestions = [
    { icon: BarChart2, color: "emerald", text: `Tiến độ ${projectName} hôm nay thế nào?` },
    { icon: HardHat, color: "rose", text: "Hôm nay trên công trường có vi phạm an toàn nào không?" },
    { icon: DollarSign, color: "blue", text: "Tháng này còn khoản thanh toán nào chưa xử lý không?" },
    { icon: ClipboardCheck, color: "violet", text: "Còn phiếu lỗi nào chưa được sửa chưa?" },
  ];
  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-4 py-6 gap-4 bg-slate-50/40">
      <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center">
        <Sparkles size={22} className="text-emerald-500" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700">Chào anh! Em đang sẵn sàng 👋</p>
        <p className="text-xs text-slate-400 mt-1">Hỏi bất cứ điều gì về công trình nghen</p>
      </div>
      <div className="w-full space-y-2">
        {suggestions.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => onSend(s.text)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-white border border-slate-200
                hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl transition-all text-left group"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${C_ICON[s.color]}`}>
                <Icon size={13} />
              </div>
              <span className="text-xs text-slate-600 group-hover:text-slate-800 flex-1">{s.text}</span>
              <ChevronRight size={12} className="text-slate-300 group-hover:text-emerald-400 transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══ MAIN COMPONENT ════════════════════════════════════════════════════════════
export default function ChatAssistant({ projects = [] }: { projects?: any[] }) {
  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [mode, setMode] = useState<AppMode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // ── Voice STT/TTS state ───────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const ttsEnabledRef = useRef(false); // ref để tránh stale closure trong speak()
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{
    name: string;
    type: "pdf" | "text";
    mimeType: string;
    data: string;
  } | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState((projects?.[0] as any)?.id || "");
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"features" | "lessons" | "faq" | "tips">("features");

  const chatSessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = (projects || []).find((p:any) => p.id === selectedProjectId) || (projects?.[0] as any);

  // ── Init Gemini session — đúng SI v2: getGenerativeModel + startChat ───────
  useEffect(() => {
    const model = genAI.getGenerativeModel({
      model: GEM_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    });
    chatSessionRef.current = model.startChat({ history: [] });
  }, []);

  // ── Auto scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Auto resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // ── STT — Speech to Text (Web Speech API) ──────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notifErr("Trình duyệt không hỗ trợ nhận giọng nói. Anh dùng Chrome nghen!");
      return;
    }
    // Tự bật TTS khi dùng mic — voice in → voice out
    setTtsEnabled(true);
    ttsEnabledRef.current = true;
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setInput(transcript);
      // Nếu final result → tự động gửi
      if (e.results[e.results.length - 1].isFinal) {
        setTimeout(() => handleSend(transcript), 300);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // Sync ref với state để speak() không bị stale closure
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  // ── TTS — Text to Speech ─────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!ttsEnabledRef.current) return;
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Chỉ bỏ markdown, giữ nguyên tiếng Anh để browser đọc tự nhiên
    let t = text;
    t = t.replace(/```[\s\S]*?```/g, ' ');
    t = t.replace(/#{1,6}\s+/g, '');
    t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
    t = t.replace(/\*([^*]+)\*/g, '$1');
    t = t.replace(/`([^`]+)`/g, '$1');
    t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    t = t.replace(/\n{2,}/g, '. ');
    t = t.replace(/\n/g, ', ');
    t = t.replace(/\s{2,}/g, ' ').trim();
    if (!t) return;

    // Split thành chunks để đọc hết — không bị cắt
    const chunks: string[] = [];
    const sentences = t.split(/(?<=[.!?,;])\s+/);
    let cur = '';
    for (const s of sentences) {
      if ((cur + s).length > 200) { if (cur) chunks.push(cur.trim()); cur = s; }
      else cur += (cur ? ' ' : '') + s;
    }
    if (cur.trim()) chunks.push(cur.trim());
    if (!chunks.length) return;

    const getViVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      return voices.find(v => v.name.includes('Google') && v.lang === 'vi-VN')
        || voices.find(v => v.lang === 'vi-VN')
        || voices.find(v => v.lang.startsWith('vi'))
        || null;
    };

    const speakChunks = (idx: number) => {
      if (idx >= chunks.length) { setIsSpeaking(false); return; }
      const utt = new SpeechSynthesisUtterance(chunks[idx]);
      utt.lang = 'vi-VN';
      const voice = getViVoice();
      if (voice) utt.voice = voice;
      utt.rate = 1.0;
      utt.pitch = 1.1;
      utt.volume = 1;
      if (idx === 0) utt.onstart = () => setIsSpeaking(true);
      utt.onend = () => speakChunks(idx + 1);
      utt.onerror = () => setIsSpeaking(false);
      synthRef.current = utt;
      window.speechSynthesis.speak(utt);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) speakChunks(0);
    else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        speakChunks(0);
      };
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text?: string, imageBase64?: string) => {
      const userText = (text || input).trim();
      if (!userText || isLoading) return;
      setInput("");
      setPendingImage(null);
      setPendingFile(null);
      if (mode !== "chat") setMode("chat");

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        text: userText + (pendingFile ? ` 📎 ${pendingFile.name}` : ""),
        timestamp: new Date(),
        image: imageBase64,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const ctx = `[Công trình đang chọn: ${selectedProject?.name || "Chưa chọn"}]\n${userText}`;
        const msgParts: any[] = [{ text: ctx }];

        // ── Ảnh ──────────────────────────────────────────────────────────────
        if (imageBase64) {
          msgParts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
            },
          });
        }

        // ── PDF — Gemini đọc native ───────────────────────────────────────────
        if (pendingFile?.type === "pdf") {
          msgParts.push({
            inlineData: { mimeType: "application/pdf", data: pendingFile.data },
          });
          msgParts[0].text = `${ctx}\n\n[File đính kèm: ${pendingFile.name}] Phân tích nội dung file PDF này theo yêu cầu trên.`;
        }

        // ── Text / CSV / JSON ─────────────────────────────────────────────────
        if (pendingFile?.type === "text") {
          const preview = pendingFile.data.length > 8000 ? pendingFile.data.slice(0, 8000) + "\n...[đã cắt bớt]" : pendingFile.data;
          msgParts[0].text = `${ctx}\n\n[Nội dung file ${pendingFile.name}]:\n\`\`\`\n${preview}\n\`\`\``;
        }

        const result = await chatSessionRef.current.sendMessage(msgParts);
        const resText = result.response.text();

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "model",
            text: resText,
            timestamp: new Date(),
          },
        ]);
        // TTS — đọc phản hồi nếu bật
        speak(resText);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "model",
            timestamp: new Date(),
            text: "Dạ anh ơi, kết nối bị gián đoạn rồi. Anh thử lại giúp em nghen! 🙏",
          },
        ]);
      }
      setIsLoading(false);
    },
    [input, isLoading, mode, selectedProject],
  );

  // ── Handle file pick — ảnh / PDF / Word / Excel / text ─────────────────────
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxMB = 10;
    if (file.size > maxMB * 1024 * 1024) {
      notifInfo(`File quá lớn! Tối đa ${maxMB}MB nghen anh.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    // ── ẢNH — gửi inlineData trực tiếp ──────────────────────────────────────
    if (file.type.startsWith("image/")) {
      reader.onload = () => setPendingImage(reader.result as string);
      reader.readAsDataURL(file);

      // ── PDF — gửi inlineData (Gemini đọc PDF native) ─────────────────────────
    } else if (file.type === "application/pdf") {
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setPendingFile({ name: file.name, type: "pdf", mimeType: "application/pdf", data: base64 });
      };
      reader.readAsDataURL(file);

      // ── TEXT / CSV / JSON / XML / Markdown ───────────────────────────────────
    } else if (file.type.startsWith("text/") || file.type === "application/json" || file.name.match(/\.(csv|txt|md|json|xml)$/i)) {
      reader.onload = () => {
        setPendingFile({ name: file.name, type: "text", mimeType: "text/plain", data: reader.result as string });
      };
      reader.readAsText(file);

      // ── WORD / EXCEL — thông báo giới hạn ────────────────────────────────────
    } else if (file.name.match(/\.(docx?|xlsx?|pptx?)$/i)) {
      notifInfo(`Dạ file ${file.name.split(".").pop()?.toUpperCase()} anh cần copy nội dung dán trực tiếp vào chat, hoặc lưu thành PDF rồi gửi lại nghen!`);
    } else {
      notifInfo("Dạ định dạng này GEM chưa hỗ trợ. Anh gửi ảnh, PDF, CSV, TXT hoặc JSON nghen!");
    }

    e.target.value = "";
  };

  // ── Copy message ────────────────────────────────────────────────────────────
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, copied: true } : m)));
    setTimeout(() => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, copied: false } : m))), 2000);
  };

  // ── Reset chat ──────────────────────────────────────────────────────────────
  const handleReset = () => {
    const model = genAI.getGenerativeModel({
      model: GEM_MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    });
    chatSessionRef.current = model.startChat({ history: [] });
    setMessages([]);
    setPendingImage(null);
  };

  // ── Tabs ────────────────────────────────────────────────────────────────────
  const MODES: { key: AppMode; icon: any; label: string }[] = [
    { key: "chat", icon: MessageSquare, label: "Chat" },
    { key: "admin", icon: FileText, label: "Hành chính" },
    { key: "guide", icon: BookOpen, label: "Hướng dẫn" },
    { key: "new_project", icon: PlusCircle, label: "Công trình" },
  ];

  const chips = mode === "admin" ? CHIPS_ADMIN : CHIPS_CHAT;

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* ── HEADER — Mode tabs ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-100 bg-white">
        <div className="flex">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-semibold
                  transition-all border-b-2 ${
                    mode === m.key
                      ? "text-emerald-700 border-emerald-500 bg-emerald-50/50"
                      : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                  }`}
              >
                <Icon size={12} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Project selector + reset — chỉ hiện trong Chat và Admin */}
        {(mode === "chat" || mode === "admin") && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50/60 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <FolderKanban size={12} className="text-slate-400" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer max-w-[160px]"
              >
                <option value="">— Chọn công trình —</option>
                {(projects || [])
                  .filter((p) => p.type === "in_progress")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            {mode === "chat" && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50"
              >
                <RotateCcw size={10} /> Xoá lịch sử
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ CHAT MODE ════════════════════════════════════════════════════════ */}
      {mode === "chat" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages hoặc empty state */}
          {messages.length === 0 ? (
            <EmptyState onSend={handleSend} projectName={selectedProject?.name || "công trình"} />
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/40">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} onCopy={handleCopy} />
              ))}
              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-emerald-600" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-emerald-500" />
                    <span className="text-xs text-slate-500 italic">Nàng GEM đang phân tích...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Quick chips */}
          <div className="px-3 py-2 border-t border-slate-100 bg-white">
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSend(chip)}
                  className="shrink-0 text-[10px] font-semibold px-3 py-1.5 bg-slate-100
                    hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-full
                    transition-colors border border-transparent hover:border-emerald-200 whitespace-nowrap"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* 🔊 Đang đọc — nhấn để dừng */}
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="mx-3 mb-1 flex items-center justify-center gap-2 py-1.5 rounded-xl text-xs font-bold text-white animate-pulse"
              style={{ background: "linear-gradient(90deg,#1a8a7a,#c47a5a)" }}
            >
              <Volume2 size={13} /> GEM đang đọc — Nhấn để dừng
            </button>
          )}

          {/* Ảnh đang chờ gửi */}
          {pendingImage && (
            <div className="px-3 pb-1 bg-white flex items-center gap-2">
              <img src={pendingImage} alt="preview" className="h-14 w-14 rounded-xl object-cover border border-slate-200" />
              <p className="text-xs text-slate-500 flex-1">Ảnh đã chọn — nhấn Gửi để GEM phân tích</p>
              <button onClick={() => setPendingImage(null)} className="p-1 hover:text-rose-500 text-slate-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          {/* File đang chờ gửi (PDF / text / CSV) */}
          {pendingFile && (
            <div className="px-3 pb-1 bg-white flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: pendingFile.type === "pdf" ? "#fee2e2" : "#dbeafe" }}
              >
                <FileText size={18} style={{ color: pendingFile.type === "pdf" ? "#dc2626" : "#2563eb" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{pendingFile.name}</p>
                <p className="text-[10px] text-slate-400">
                  {pendingFile.type === "pdf" ? "PDF — Gemini đọc trực tiếp" : "Text — nội dung sẽ được gửi kèm"}
                </p>
              </div>
              <button onClick={() => setPendingFile(null)} className="p-1 hover:text-rose-500 text-slate-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="shrink-0 p-3 bg-white border-t border-slate-100">
            <div className="flex items-end gap-2 bg-white border-2 border-slate-200 focus-within:border-emerald-500 rounded-2xl px-3 py-2 transition-all shadow-sm">
              {/* Camera */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors rounded-lg hover:bg-emerald-50 shrink-0"
                title="Đính kèm ảnh"
              >
                <Camera size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,text/plain,text/csv,application/json,.csv,.txt,.md,.json,.xml"
                onChange={handleImagePick}
                className="hidden"
              />

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(undefined, pendingImage || undefined);
                  }
                }}
                placeholder={isListening ? "🎤 Đang nghe..." : "Hỏi GEM bất cứ điều gì... (Enter gửi)"}
                className="flex-1 bg-transparent border-none text-sm focus:outline-none resize-none min-h-[36px] max-h-[120px] py-1.5"
                rows={1}
                disabled={isLoading}
              />

              {/* Mic button — STT */}
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isLoading}
                title={isListening ? "Dừng ghi âm" : "Nói chuyện với GEM"}
                className={`p-1.5 rounded-lg transition-all shrink-0 ${
                  isListening
                    ? "bg-rose-500 text-white animate-pulse shadow-md"
                    : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* TTS toggle */}
              <button
                onClick={() => {
                  const next = !ttsEnabled;
                  setTtsEnabled(next);
                  ttsEnabledRef.current = next;
                  if (!next && isSpeaking) stopSpeaking();
                }}
                title={ttsEnabled ? "Tắt đọc phản hồi" : "Bật đọc phản hồi"}
                className={`p-1.5 rounded-lg transition-all shrink-0 ${
                  isSpeaking
                    ? "bg-teal-500 text-white animate-pulse"
                    : ttsEnabled
                      ? "text-teal-600 bg-teal-50 border border-teal-200"
                      : "text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                }`}
              >
                {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* Send */}
              <button
                onClick={() => handleSend(undefined, pendingImage || undefined)}
                disabled={(!input.trim() && !pendingImage && !pendingFile) || isLoading}
                className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-xl transition-colors shadow-sm shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 text-center">🎤 Mic nói • 🔊 Loa đọc • 📎 Ảnh · PDF · CSV · TXT · JSON</p>
          </div>
        </div>
      )}

      {/* ══ ADMIN MODE ═══════════════════════════════════════════════════════ */}
      {mode === "admin" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex gap-2.5 items-start">
            <FileText size={14} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-800 leading-relaxed">
              Chọn mẫu → GEM soạn văn phong chuẩn Nhà nước, đủ thành phần ký tên. Anh chỉnh thêm chi tiết là xong!
            </p>
          </div>

          {/* Quick chips admin */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {CHIPS_ADMIN.map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  handleSend(chip);
                  setMode("chat");
                }}
                className="shrink-0 text-[10px] font-semibold px-3 py-1.5 bg-slate-100
                  hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-full
                  transition-colors border border-transparent hover:border-indigo-200 whitespace-nowrap"
              >
                {chip}
              </button>
            ))}
          </div>

          {ADMIN_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${C_ICON[tpl.color]}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{tpl.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{tpl.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleSend(tpl.prompt(selectedProject?.name || "dự án"));
                    setMode("chat");
                  }}
                  className="w-full py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700
                    text-slate-600 text-xs font-semibold border border-slate-200 hover:border-emerald-200
                    transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={11} /> Soạn với GEM <ArrowRight size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ GUIDE MODE ═══════════════════════════════════════════════════════ */}
      {mode === "guide" && (
        <div className="flex-1 overflow-y-auto">
          {/* Sub-tabs */}
          <div className="flex border-b border-slate-100 bg-white sticky top-0 z-10">
            {(
              [
                ["features", Sparkles, "Tính năng"],
                ["lessons", PlayCircle, "Bài học"],
                ["faq", HelpCircle, "Hỏi đáp"],
                ["tips", Lightbulb, "Mẹo hay"],
              ] as const
            ).map(([k, Icon, l]) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-semibold
                  transition-all border-b-2 ${
                    activeTab === k ? "text-emerald-700 border-emerald-500" : "text-slate-400 border-transparent hover:text-slate-600"
                  }`}
              >
                <Icon size={11} />
                {l}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {/* ── FEATURES ── */}
            {activeTab === "features" && (
              <>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2 items-start">
                  <Sparkles size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    <strong>GEM&CLAUDE PM Pro</strong> — quản lý toàn bộ công trình trong một chỗ. Nhấn "Thử ngay" để hỏi GEM về tính năng
                    đó!
                  </p>
                </div>
                <div className="space-y-3">
                  {FEATURES.map((f) => {
                    const Icon = f.icon;
                    return (
                      <div
                        key={f.title}
                        className="bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${C_ICON[f.color]}`}>
                            <Icon size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 text-sm">{f.title}</h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{f.desc}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            handleSend(f.prompt);
                            setMode("chat");
                          }}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl
                            bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold
                            border border-emerald-200 transition-colors"
                        >
                          Thử ngay <ArrowRight size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── LESSONS ── */}
            {activeTab === "lessons" && (
              <>
                <p className="text-xs text-slate-500 font-medium">Đọc từng bước → nhấn "Thực hành ngay" để thử với GEM</p>
                {LESSONS.map((lesson) => (
                  <div key={lesson.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                        <PlayCircle size={18} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 text-sm">{lesson.title}</h4>
                        <div className="flex gap-2 mt-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              C_BADGE[lesson.level === "Cơ bản" ? "emerald" : lesson.level === "Trung bình" ? "amber" : "violet"]
                            }`}
                          >
                            {lesson.level}
                          </span>
                          <span className="text-[10px] text-slate-400">{lesson.duration}</span>
                        </div>
                      </div>
                      {expandedLesson === lesson.id ? (
                        <ChevronUp size={15} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={15} className="text-slate-400" />
                      )}
                    </button>

                    {expandedLesson === lesson.id && (
                      <div className="px-4 pb-4 border-t border-slate-100">
                        <div className="space-y-3 mt-3">
                          {lesson.steps.map((s) => (
                            <div key={s.step} className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                {s.step}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            handleSend(lesson.practicePrompt);
                            setMode("chat");
                          }}
                          className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white
                            rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                        >
                          <PlayCircle size={13} /> Thực hành ngay với GEM
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* ── FAQ ── */}
            {activeTab === "faq" && (
              <>
                <p className="text-xs text-slate-500 font-medium">Câu hỏi thường gặp về Nàng GEM và hệ thống</p>
                {FAQS.map((faq, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === String(i) ? null : String(i))}
                      className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-start gap-2.5">
                        <HelpCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium text-slate-800">{faq.q}</p>
                      </div>
                      {expandedFaq === String(i) ? (
                        <ChevronUp size={14} className="text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-400 shrink-0" />
                      )}
                    </button>
                    {expandedFaq === String(i) && (
                      <div className="px-4 pb-4 border-t border-slate-100">
                        <p className="text-sm text-slate-600 leading-relaxed mt-3">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* ── TIPS ── */}
            {activeTab === "tips" && (
              <>
                <p className="text-xs text-slate-500 font-medium">Mẹo dùng GEM hiệu quả hơn mỗi ngày</p>
                {TIPS.map((tip, i) => {
                  const Icon = tip.icon;
                  return (
                    <div key={i} className={`rounded-xl p-4 border ${C_BADGE[tip.color]}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${C_ICON[tip.color]}`}>
                          <Icon size={15} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{tip.tip}</p>
                          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-white/70 rounded-lg px-2.5 py-2 border border-white">
                            💡 {tip.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ NEW PROJECT MODE — placeholder, wizard đã build riêng ════════════ */}
      {mode === "new_project" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-4 text-center">
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center">
            <PlusCircle size={26} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Tạo công trình mới</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Nhấn nút <strong>+</strong> trên thanh công cụ phía dưới để mở trình hướng dẫn tạo công trình mới — GEM dẫn anh qua 10 bước
              nghen!
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 w-full text-left space-y-2">
            {[
              "Đặt tên và chọn loại công trình",
              "Nhập thông tin địa điểm, chủ đầu tư",
              "Chọn tính năng cần dùng",
              "Xong — GEM khởi tạo ngay",
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </div>
                <p className="text-xs text-slate-600">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
