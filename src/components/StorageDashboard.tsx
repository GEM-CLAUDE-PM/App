/**
 * StorageDashboard.tsx — GEM&CLAUDE PM Pro / Nàng GEM Siêu Việt
 * Full-featured document storage dashboard replacing fake OneDrive/GDrive.
 * Backed by Supabase Storage (dev: mock files).
 */

import { useNotification } from './NotificationEngine';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { genAI, GEM_MODEL, GEM_MODEL_QUALITY } from './gemini';
import { useAuth } from './AuthProvider';
import {
  StorageService, CATEGORY_META, MOCK_FILES,
  type StorageFile, type FileCategory, type UploadProgress,
} from './StorageService';
import {
  HardDrive, Upload, Download, Trash2, Search, Filter,
  FolderOpen, File, FileText, Eye, Plus, X, CheckCircle2,
  AlertTriangle, Loader2, Sparkles, Cloud, RefreshCw,
  Tag, Info, Clock, User, ChevronDown, MoreVertical,
  Check, Link, Copy, Archive, Zap, Building2,
} from 'lucide-react';

import { db } from './db';
import type { DashboardProps } from './types';

type Props = DashboardProps;

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300';

// ─── File row component ───────────────────────────────────────────────────────
function FileRow({
  file, onDelete, onDownload, onPreview,
}: {
  file: StorageFile;
  onDelete: (f: StorageFile) => void;
  onDownload: (f: StorageFile) => void;
  onPreview: (f: StorageFile) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cat = CATEGORY_META[file.category];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors group">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl ${cat.bg}`}>
        {StorageService.mimeIcon(file.mime_type)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">{file.name}</p>
          {file.version && file.version > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full shrink-0">v{file.version}</span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${cat.bg} ${cat.color}`}>{cat.icon} {cat.label}</span>
        </div>
        {file.description && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{file.description}</p>}
        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><User size={9}/>{file.uploaded_by}</span>
          <span className="flex items-center gap-1"><Clock size={9}/>{file.uploaded_at}</span>
          <span>{StorageService.formatSize(file.size)}</span>
        </div>
      </div>

      {/* Tags */}
      {file.tags && file.tags.length > 0 && (
        <div className="hidden md:flex gap-1 flex-wrap max-w-[140px]">
          {file.tags.slice(0, 2).map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">{t}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" ref={ref}>
        <button onClick={() => onPreview(file)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-700" title="Xem trước">
          <Eye size={14}/>
        </button>
        <button onClick={() => onDownload(file)} className="p-1.5 hover:bg-teal-100 rounded-lg text-slate-500 hover:text-teal-700" title="Tải về">
          <Download size={14}/>
        </button>
        <div className="relative">
          <button onClick={() => setMenuOpen(p=>!p)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400">
            <MoreVertical size={14}/>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
              <button onClick={() => { navigator.clipboard?.writeText(file.name); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 text-slate-600">
                <Copy size={12}/> Sao chép tên
              </button>
              <button onClick={() => { onDelete(file); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-rose-50 text-rose-600">
                <Trash2 size={12}/> Xóa file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({
  projectId, uploadedBy, onUploaded,
}: {
  projectId: string; uploadedBy: string; onUploaded: (f: StorageFile) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [category, setCategory] = useState<FileCategory>('other');
  const [description, setDescription] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const name = file.name;
      setProgress(p => [...p, { file_name: name, progress: 0, status: 'uploading' }]);
      const { file: stored, error } = await StorageService.uploadFile(
        projectId, category, file,
        { uploadedBy, description },
        (pct) => setProgress(p => p.map(x => x.file_name === name ? { ...x, progress: pct } : x)),
      );
      if (error) {
        setProgress(p => p.map(x => x.file_name === name ? { ...x, status: 'error', error } : x));
      } else {
        setProgress(p => p.map(x => x.file_name === name ? { ...x, status: 'done', progress: 100 } : x));
        if (stored) onUploaded(stored);
      }
    }
    setTimeout(() => setProgress([]), 2500);
  }, [projectId, category, description, uploadedBy, onUploaded]);

  return (
    <div className="space-y-3">
      {/* Category + description */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Phân loại</label>
          <select value={category} onChange={e => setCategory(e.target.value as FileCategory)} className={inputCls}>
            {(Object.keys(CATEGORY_META) as FileCategory[]).map(c => (
              <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Mô tả (tuỳ chọn)</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả ngắn về file..." className={inputCls}/>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all
          ${dragging ? 'border-teal-500 bg-teal-50' : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'}`}
      >
        <Upload size={28} className={`mb-3 ${dragging ? 'text-teal-500' : 'text-slate-400'}`}/>
        <p className="text-sm font-semibold text-slate-600">Kéo & thả file vào đây</p>
        <p className="text-xs text-slate-400 mt-1">hoặc click để chọn từ máy tính · PDF, DOCX, XLSX, DWG...</p>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); }}/>
      </div>

      {/* Progress list */}
      {progress.length > 0 && (
        <div className="space-y-2">
          {progress.map((p, i) => (
            <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border ${
              p.status === 'done' ? 'bg-emerald-50 border-emerald-200' :
              p.status === 'error' ? 'bg-rose-50 border-rose-200' :
              'bg-blue-50 border-blue-200'}`}>
              {p.status === 'uploading' && <Loader2 size={14} className="animate-spin text-blue-500 shrink-0"/>}
              {p.status === 'done'      && <CheckCircle2 size={14} className="text-emerald-500 shrink-0"/>}
              {p.status === 'error'     && <AlertTriangle size={14} className="text-rose-500 shrink-0"/>}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{p.file_name}</p>
                {p.status === 'uploading' && (
                  <div className="h-1 bg-blue-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${p.progress}%` }}/>
                  </div>
                )}
                {p.status === 'error' && <p className="text-[10px] text-rose-600 mt-0.5">{p.error}</p>}
              </div>
              <span className={`text-[10px] font-bold shrink-0 ${
                p.status === 'done' ? 'text-emerald-600' :
                p.status === 'error' ? 'text-rose-600' :
                'text-blue-600'}`}>
                {p.status === 'uploading' ? `${p.progress}%` : p.status === 'done' ? 'Xong' : 'Lỗi'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StorageDashboard({ project }: Props) {
  const { user } = useAuth();
  const projectId = project?.id ?? 'p1';

  const { ok: notifOk, err: notifErr, warn: notifWarn, info: notifInfo } = useNotification();
  const [files, setFiles]           = useState<StorageFile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [catFilter, setCatFilter]   = useState<FileCategory | 'all'>('all');
  const [search, setSearch]         = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview]       = useState<StorageFile | null>(null);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemText, setGemText]       = useState('');
  const [confirmDelete, setConfirmDelete] = useState<StorageFile | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await StorageService.listFiles(projectId);
      setFiles(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const filtered = files.filter(f =>
    (catFilter === 'all' || f.category === catFilter) &&
    (!search || f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.description?.toLowerCase().includes(search.toLowerCase()) ||
      f.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())))
  );

  // Stats
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const catCounts = (Object.keys(CATEGORY_META) as FileCategory[]).map(c => ({
    cat: c, count: files.filter(f => f.category === c).length,
  }));

  const handleDelete = async (f: StorageFile) => {
    const err = await StorageService.deleteFile(projectId, f.category, f.name);
    if (err) { notifErr(`❌ Xóa file thất bại: ${err}`); return; }
    setFiles(p => {
      const next = p.filter(x => x.id !== f.id);
      db.set('storage_files', projectId, next);
      return next;
    });
    setConfirmDelete(null);
    notifOk(`✅ Đã xóa: ${f.name}`);
  };

  const handleDownload = async (f: StorageFile) => {
    const url = await StorageService.getSignedUrl(projectId, f.category, f.name);
    if (url && url !== '#mock-download-url') {
      window.open(url, '_blank');
    } else {
      notifInfo(`[Dev mode] Tải về: ${f.name}\nSigned URL sẽ hoạt động khi kết nối Supabase.`);
    }
  };

  const analyzeWithGEM = async () => {
    setGemLoading(true); setGemText('');
    try {
      const model = genAI.getGenerativeModel({
        model: GEM_MODEL_QUALITY,
        systemInstruction: 'Bạn là GEM — chuyên gia quản lý hồ sơ xây dựng. Xưng "em", gọi "Anh/Chị". Phân tích ngắn gọn, chuyên nghiệp.',
      });
      const summary = catCounts.filter(c => c.count > 0)
        .map(c => `${CATEGORY_META[c.cat].label}: ${c.count} file`).join(', ');
      const missing = catCounts.filter(c => c.count === 0).map(c => CATEGORY_META[c.cat].label).join(', ');
      const r = await model.generateContent(
        `Phân tích tình trạng hồ sơ lưu trữ dự án "${project?.name ?? 'Villa PAT'}":\n` +
        `Tổng: ${files.length} file, ${StorageService.formatSize(totalSize)}\n` +
        `Hiện có: ${summary}\n` +
        `Chưa có hồ sơ: ${missing || 'Đủ tất cả'}\n\n` +
        `Hãy: (1) Đánh giá tình trạng hồ sơ tổng thể, (2) Cảnh báo danh mục thiếu quan trọng, ` +
        `(3) Khuyến nghị hành động ngay. Súc tích, dùng bullet points.`
      );
      setGemText(r.response.text());
    } catch { setGemText('❌ Không kết nối được GEM.'); }
    setGemLoading(false);
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <HardDrive size={20} className="text-teal-600"/>
            Cloud Storage — {project?.name ?? 'Dự án'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Supabase Storage · {files.length} tài liệu · {StorageService.formatSize(totalSize)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={analyzeWithGEM} disabled={gemLoading}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60">
            {gemLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
            GEM phân tích
          </button>
          <button onClick={loadFiles} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50">
            <RefreshCw size={16} className="text-slate-500"/>
          </button>
          <button onClick={() => setShowUpload(p => !p)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
            <Upload size={15}/> Upload
          </button>
        </div>
      </div>

      {/* GEM analysis */}
      {gemText && (
        <div className="bg-gradient-to-br from-teal-900 to-emerald-900 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-teal-100 flex items-center gap-2"><Sparkles size={14} className="text-teal-300"/>Nàng GEM — Phân tích hồ sơ</span>
            <button onClick={() => setGemText('')} className="p-1 hover:bg-white/10 rounded-lg"><X size={13}/></button>
          </div>
          <pre className="text-sm text-teal-100 whitespace-pre-wrap leading-relaxed font-sans">{gemText}</pre>
        </div>
      )}

      {/* Upload panel */}
      {showUpload && (
        <div className="bg-white rounded-2xl border-2 border-teal-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Upload size={16} className="text-teal-600"/>Upload tài liệu mới</h3>
            <button onClick={() => setShowUpload(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16}/></button>
          </div>
          <UploadZone
            projectId={projectId}
            uploadedBy={user?.full_name ?? 'Người dùng'}
            onUploaded={f => {
              setFiles(p => {
                const next = [f, ...p];
                db.set('storage_files', projectId, next);
                return next;
              });
            }}
          />
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng tài liệu', val: files.length, cls: 'bg-teal-100 text-teal-700' },
          { label: 'Dung lượng', val: StorageService.formatSize(totalSize), cls: 'bg-blue-100 text-blue-700' },
          { label: 'Bản vẽ', val: files.filter(f => f.category === 'drawings').length, cls: 'bg-indigo-100 text-indigo-700' },
          { label: 'Hợp đồng', val: files.filter(f => f.category === 'contracts').length, cls: 'bg-violet-100 text-violet-700' },
        ].map((k, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${k.cls}`}><HardDrive size={16}/></div>
            <div className="text-2xl font-bold text-slate-800">{k.val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><FolderOpen size={15} className="text-teal-600"/>Phân loại tài liệu</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCatFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
              ${catFilter === 'all' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            🗂 Tất cả ({files.length})
          </button>
          {(Object.keys(CATEGORY_META) as FileCategory[]).map(c => {
            const cnt = files.filter(f => f.category === c).length;
            const m = CATEGORY_META[c];
            return (
              <button key={c} onClick={() => setCatFilter(c)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                  ${catFilter === c ? `${m.bg} ${m.color} shadow-sm ring-1 ring-current` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {m.icon} {m.label} ({cnt})
              </button>
            );
          })}
        </div>
      </div>

      {/* File list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm file, mô tả, tag..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-300"/>
          </div>
          <span className="text-xs text-slate-400 font-medium">{filtered.length} tài liệu</span>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-teal-500"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Cloud size={40} className="text-slate-200 mx-auto mb-3"/>
            <p className="text-slate-400 text-sm font-medium">
              {search ? 'Không tìm thấy file phù hợp' : 'Chưa có tài liệu — Upload file đầu tiên'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(f => (
              <FileRow key={f.id} file={f}
                onDelete={f => setConfirmDelete(f)}
                onDownload={handleDownload}
                onPreview={f => setPreview(f)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="text-xl">{StorageService.mimeIcon(preview.mime_type)}</span>
                Chi tiết tài liệu
              </h3>
              <button onClick={() => setPreview(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16}/></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Tên file',      val: preview.name },
                { label: 'Phân loại',     val: `${CATEGORY_META[preview.category].icon} ${CATEGORY_META[preview.category].label}` },
                { label: 'Dung lượng',    val: StorageService.formatSize(preview.size) },
                { label: 'Phiên bản',     val: `v${preview.version ?? 1}` },
                { label: 'Upload bởi',    val: preview.uploaded_by },
                { label: 'Thời gian',     val: preview.uploaded_at },
                { label: 'Mô tả',         val: preview.description ?? '—' },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-slate-400 w-24 shrink-0 pt-0.5">{label}</span>
                  <span className="text-sm text-slate-700">{val}</span>
                </div>
              ))}
              {preview.tags && preview.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-slate-400 w-24 shrink-0 pt-1">Tags</span>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">{t}</span>)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { handleDownload(preview); setPreview(null); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700">
                <Download size={15}/> Tải về
              </button>
              <button onClick={() => setPreview(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                <Trash2 size={22} className="text-rose-600"/>
              </div>
              <div>
                <p className="font-bold text-slate-800">Xóa tài liệu?</p>
                <p className="text-xs text-slate-500 mt-0.5">Không thể khôi phục sau khi xóa</p>
              </div>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">
              <p className="text-sm font-semibold text-rose-800 truncate">{confirmDelete.name}</p>
              <p className="text-xs text-rose-600 mt-0.5">{StorageService.formatSize(confirmDelete.size)}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold">Hủy</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
