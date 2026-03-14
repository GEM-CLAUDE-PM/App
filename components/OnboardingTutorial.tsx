import React, { useState } from 'react';
import {
  X, ChevronRight, ChevronLeft, Sparkles, Check,
  LayoutDashboard, ClipboardCheck, HardHat, MessageCircle,
  DollarSign, BarChart2, ShieldCheck, Smartphone, Rocket,
  FolderPlus, Loader2, RotateCcw, SkipForward,
} from 'lucide-react';

// ── Nội dung 10 trang — ngôn ngữ bình dân, không thuật ngữ kỹ thuật ──────────
const tutorialSteps = [
  {
    // Trang 1 — Chào mừng
    title: "Chào mừng anh đến với GEM!",
    content: "Chào anh! Em là Nàng GEM — trợ lý luôn có mặt trên công trường của anh. Anh bận trăm thứ, em lo giấy tờ, nhắc việc và cảnh báo khi có chuyện. Từ nghiệm thu, thanh toán đến nhân công, an toàn — tất cả trong một chỗ. Em dẫn anh qua 9 trang giới thiệu nhanh nghen!",
    icon: <Sparkles className="text-orange-400" size={24} />,
  },
  {
    // Trang 2 — Dashboard
    title: "Nhìn vào là biết công trình đang thế nào",
    content: "Mở app lên là thấy ngay: hôm nay tiến độ bao nhiêu phần trăm, tiền đã thanh toán chưa, có việc gì cần xử lý không. GEM tóm tắt buổi sáng cho anh như người trợ lý đứng báo cáo trước mặt vậy — không cần mở từng mục lên kiểm tra.",
    icon: <LayoutDashboard className="text-emerald-400" size={24} />,
  },
  {
    // Trang 3 — QA/QC
    title: "Chất lượng & Nghiệm thu — GEM lo giấy tờ",
    content: "Phát hiện lỗi thi công — chụp ảnh, GEM lập phiếu ghi lỗi ngay tại chỗ. Cần nghiệm thu hạng mục — GEM soạn biên bản đúng mẫu Nhà nước, anh chỉ điền tên hạng mục là xong. Không cần nhớ mẫu nào, không cần tra quy định — em lo hết.",
    icon: <ClipboardCheck className="text-emerald-400" size={24} />,
  },
  {
    // Trang 4 — Nhân lực + HSE
    title: "Nhân công & An toàn lao động hàng ngày",
    content: "Sáng vào công trường: điểm danh công nhân, ghi ai vắng, ai làm ca nào. Thấy ai không đội mũ bảo hộ — ghi vi phạm tại chỗ bằng điện thoại, GEM tự lập biên bản. Chứng chỉ an toàn ai còn hạn ai hết hạn — GEM nhắc trước khi xảy ra chuyện.",
    icon: <HardHat className="text-emerald-400" size={24} />,
  },
  {
    // Trang 5 — Chat AI
    title: "Hỏi GEM như hỏi người — cái gì cũng được",
    content: "Anh cứ hỏi tự nhiên: \"Tuần này tiến độ thế nào?\", \"Còn bao nhiêu tiền chưa thanh toán?\", \"Soạn biên bản nghiệm thu móng hôm nay\". GEM trả lời ngay và soạn giấy tờ luôn trong chat — không cần mở Word, không cần tra mẫu.",
    icon: <MessageCircle className="text-emerald-400" size={24} />,
  },
  {
    // Trang 6 — QS + Kế toán
    title: "Khối lượng & Tiền thanh toán — không để sót",
    content: "Mỗi hạng mục GEM theo dõi: làm được bao nhiêu, còn bao nhiêu, đã quyết toán chưa. Sắp tới hạn thanh toán với chủ đầu tư — GEM nhắc anh trước, lập hồ sơ đề nghị thanh toán luôn, không để trễ mà bị phạt hợp đồng. Dòng tiền ra vào dự án cũng được theo dõi riêng — chỉ Giám đốc và Kế toán mới vào được.",
    icon: <DollarSign className="text-emerald-400" size={24} />,
  },
  {
    // Trang 7 — Báo cáo AI
    title: "Báo cáo cuối tuần — GEM viết thay anh",
    content: "Cuối tuần không cần ngồi gõ báo cáo nữa. GEM đọc dữ liệu cả tuần rồi tự viết: tiến độ, nhân lực, vật tư, vướng mắc — anh đọc lại, ký tên là xong. Muốn gửi cho chủ đầu tư qua Zalo — một nút là xong.",
    icon: <BarChart2 className="text-emerald-400" size={24} />,
  },
  {
    // Trang 8 — Phân quyền + Bảo mật hợp đồng
    title: "Mỗi người thấy đúng phần việc của mình",
    content: "Giám đốc thấy toàn bộ. Kế toán thấy tiền. Giám sát thấy kỹ thuật. Công nhân thấy ca làm việc của mình thôi. Hợp đồng có thêm lớp bảo mật riêng — phải nhập mã PIN mới xem được giá trị, tránh lộ thông tin nhạy cảm ra ngoài.",
    icon: <ShieldCheck className="text-emerald-400" size={24} />,
  },
  {
    // Trang 9 — Cài app + Zalo
    title: "Dùng trên điện thoại & nhận tin qua Zalo",
    content: "Cài GEM lên điện thoại như app thường — không cần vào cửa hàng app, không tốn bộ nhớ. Ra ngoài công trường mất mạng vẫn dùng được, về văn phòng có mạng là tự cập nhật lên máy chủ. Có sự cố an toàn, trễ thanh toán, nhắc họp giao ban — Zalo báo thẳng đến đúng người phụ trách.",
    icon: <Smartphone className="text-emerald-400" size={24} />,
  },
  {
    // Trang 10 — Tạo dự án
    title: "Sẵn sàng rồi — điền tên là bắt đầu!",
    content: "Điền tên công trình là xong — GEM chuẩn bị sẵn hết rồi: mẫu biên bản nghiệm thu, checklist an toàn, báo cáo tuần đầu. Anh không cần thiết lập gì thêm — vào là dùng được ngay.",
    icon: <Rocket className="text-orange-400" size={24} />,
  },
];

// ── Project type options — cập nhật đúng với hệ thống hiện tại ────────────────
const PROJECT_TYPES = [
  { value: 'nha_o',        label: '🏠 Nhà ở dân dụng' },
  { value: 'chung_cu',     label: '🏢 Chung cư / NƠXH' },
  { value: 'van_phong',    label: '🏗️ Văn phòng / TTTM' },
  { value: 'cong_nghiep',  label: '🏭 Công nghiệp / KCN' },
  { value: 'ha_tang',      label: '🛣️ Hạ tầng / Giao thông' },
  { value: 'in_progress',  label: '📋 Loại khác' },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface OnboardingTutorialProps {
  onClose: () => void;
  onComplete: (projectName: string, storagePath: string, projectType: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const OnboardingTutorial = ({ onClose, onComplete }: OnboardingTutorialProps) => {
  const [currentStep, setCurrentStep]   = useState(0);
  const [isOpen, setIsOpen]             = useState(true);
  const [isFinalStep, setIsFinalStep]   = useState(false);
  const [projectName, setProjectName]   = useState('');
  const [siteManager, setSiteManager]   = useState(''); // thay storagePath — CHT công trường
  const [projectType, setProjectType]   = useState('nha_o');
  const [isCreating, setIsCreating]     = useState(false);

  if (!isOpen) return null;

  const step        = tutorialSteps[currentStep];
  const isFirstStep = currentStep === 0 && !isFinalStep;
  const isLastTip   = currentStep === tutorialSteps.length - 1;

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (isLastTip) { setIsFinalStep(true); return; }
    setCurrentStep(s => s + 1);
  };

  const handlePrev = () => {
    if (isFinalStep)     { setIsFinalStep(false); return; }
    if (currentStep > 0) { setCurrentStep(s => s - 1); }
  };

  // Bỏ qua — nhảy thẳng đến form tạo dự án
  const handleSkip = () => {
    setCurrentStep(tutorialSteps.length - 1);
    setIsFinalStep(true);
  };

  // Xem lại từ đầu
  const handleRestart = () => {
    setCurrentStep(0);
    setIsFinalStep(false);
  };

  // ── Submit form tạo dự án ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setIsCreating(true);
    // storagePath được tạo tự động — không cần người dùng nhập
    const autoPath = `projects/${projectType}/${projectName.trim().replace(/\s+/g, '-').toLowerCase()}`;
    setTimeout(() => {
      setIsCreating(false);
      setIsOpen(false);
      onComplete(projectName.trim(), autoPath, projectType);
    }, 1200);
  };

  // ── Input style ─────────────────────────────────────────────────────────────
  const inputCls = "w-full bg-emerald-950/50 border border-emerald-700 rounded-lg px-3 py-2 text-sm text-white placeholder-emerald-500 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all";

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-emerald-900 text-white rounded-2xl shadow-2xl w-80 md:w-96 overflow-hidden border border-emerald-700">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="bg-emerald-950 px-4 py-3 flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center border border-emerald-600">
              <Sparkles size={16} className="text-orange-300" />
            </div>
            <span className="font-bold text-emerald-100">Nàng GEM</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Bỏ qua — ẩn khi đã ở form cuối */}
            {!isFinalStep && (
              <button
                onClick={handleSkip}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-orange-300 transition-colors px-2 py-1 rounded-lg hover:bg-emerald-800"
              >
                <SkipForward size={13} />
                Bỏ qua
              </button>
            )}
            {/* Nút đóng */}
            <button
              onClick={() => { setIsOpen(false); onClose(); }}
              className="text-emerald-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-emerald-800"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="p-5">
          {!isFinalStep ? (
            <>
              {/* Nội dung trang */}
              <div className="flex items-start gap-4 mb-4 min-h-[110px]">
                <div className="mt-1 shrink-0">{step.icon}</div>
                <div>
                  <h3 className="font-bold text-base text-emerald-50 mb-2 leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-emerald-200 text-sm leading-relaxed">
                    {step.content}
                  </p>
                </div>
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 mb-5 mt-2">
                {tutorialSteps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStep
                        ? 'w-5 bg-orange-400'
                        : idx < currentStep
                          ? 'w-1.5 bg-emerald-500'
                          : 'w-1.5 bg-emerald-700'
                    }`}
                  />
                ))}
              </div>
            </>
          ) : (
            /* ── Form tạo dự án ──────────────────────────────────────────────── */
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-3 mb-5">
                <div className="mt-0.5 shrink-0">
                  <FolderPlus className="text-orange-400" size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-emerald-50 mb-1">Khởi tạo công trình</h3>
                  <p className="text-emerald-300 text-xs leading-relaxed">
                    Điền tên công trình là xong — GEM lo phần còn lại.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 mb-4">
                {/* Tên công trình — bắt buộc */}
                <div>
                  <label className="block text-xs font-medium text-emerald-300 mb-1">
                    Tên công trình <span className="text-orange-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder="VD: Tòa nhà VP Sunrise Plaza"
                    className={inputCls}
                    required
                    autoFocus
                  />
                </div>

                {/* Loại công trình — cập nhật options mới */}
                <div>
                  <label className="block text-xs font-medium text-emerald-300 mb-1">
                    Loại công trình
                  </label>
                  <select
                    value={projectType}
                    onChange={e => setProjectType(e.target.value)}
                    className={inputCls + ' cursor-pointer'}
                  >
                    {PROJECT_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Chỉ huy trưởng — thay trường "Đường dẫn Cloud" lỗi thời */}
                <div>
                  <label className="block text-xs font-medium text-emerald-300 mb-1">
                    Chỉ huy trưởng công trường
                  </label>
                  <input
                    type="text"
                    value={siteManager}
                    onChange={e => setSiteManager(e.target.value)}
                    placeholder="VD: Ông Nguyễn Văn A"
                    className={inputCls}
                  />
                  <p className="text-[10px] text-emerald-600 mt-1">
                    Dữ liệu lưu tự động — anh không cần nhập đường dẫn thủ công.
                  </p>
                </div>

                {/* Loading */}
                {isCreating && (
                  <div className="flex items-center gap-2 text-orange-400 text-sm bg-orange-400/10 p-3 rounded-lg border border-orange-400/20">
                    <Loader2 size={15} className="animate-spin" />
                    <span>Đang khởi tạo công trình...</span>
                  </div>
                )}
              </form>

              {/* Nút xem lại từ đầu */}
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-300 transition-colors mb-1"
              >
                <RotateCcw size={12} />
                Xem lại hướng dẫn từ đầu
              </button>
            </div>
          )}

          {/* ── Actions bar ──────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mt-1">

            {/* Nút quay lại */}
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                isFirstStep
                  ? 'text-emerald-800 cursor-not-allowed'
                  : 'text-emerald-300 hover:bg-emerald-800 hover:text-white'
              }`}
            >
              <ChevronLeft size={20} />
            </button>

            {/* Counter — chỉ hiện khi đang xem tip */}
            {!isFinalStep && (
              <span className="text-xs font-medium text-emerald-500">
                {currentStep + 1} / {tutorialSteps.length}
              </span>
            )}

            {/* Nút tiếp theo / hoàn tất */}
            {!isFinalStep ? (
              <button
                onClick={handleNext}
                className="bg-orange-500 hover:bg-orange-400 text-orange-950 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors shadow-lg shadow-orange-500/20"
              >
                {isLastTip ? 'Bắt đầu' : 'Tiếp theo'}
                {!isLastTip && <ChevronRight size={15} />}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isCreating || !projectName.trim()}
                className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-orange-950 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-orange-500/20"
              >
                {isCreating ? 'Đang tạo...' : 'Tạo công trình'}
                {!isCreating && <Check size={15} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
