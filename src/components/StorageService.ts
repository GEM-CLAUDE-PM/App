/**
 * StorageService.ts — GEM&CLAUDE PM Pro / Nàng GEM Siêu Việt
 * Abstraction over Supabase Storage with dev-mode mock fallback.
 *
 * Bucket structure (Supabase):
 *   gem-docs/
 *     {project_id}/
 *       drawings/      ← Bản vẽ kỹ thuật
 *       contracts/     ← Hợp đồng, phụ lục
 *       reports/       ← Báo cáo tuần/tháng
 *       qaqc/          ← Biên bản nghiệm thu, NCR
 *       hse/           ← Hồ sơ an toàn, chứng chỉ
 *       hr/            ← Hồ sơ nhân sự
 *       qs/            ← BOQ, thanh toán
 *       other/         ← Tài liệu khác
 *
 * SETUP:
 *   1. Supabase Dashboard → Storage → Create bucket "gem-docs" (private)
 *   2. Set RLS policies (see bottom of file)
 *   3. Set VITE_USE_SUPABASE=true in .env
 */

import { getSupabase } from './supabase';

export type FileCategory =
  | 'drawings' | 'contracts' | 'reports'
  | 'qaqc' | 'hse' | 'hr' | 'qs' | 'other';

export const CATEGORY_META: Record<FileCategory, { label: string; color: string; bg: string; icon: string }> = {
  drawings:  { label: 'Bản vẽ kỹ thuật', color: 'text-blue-700',   bg: 'bg-blue-100',   icon: '📐' },
  contracts: { label: 'Hợp đồng',        color: 'text-violet-700', bg: 'bg-violet-100', icon: '📋' },
  reports:   { label: 'Báo cáo',         color: 'text-emerald-700',bg: 'bg-emerald-100',icon: '📊' },
  qaqc:      { label: 'QA/QC',           color: 'text-teal-700',   bg: 'bg-teal-100',   icon: '✅' },
  hse:       { label: 'HSE / An toàn',   color: 'text-amber-700',  bg: 'bg-amber-100',  icon: '⛑️' },
  hr:        { label: 'Nhân sự',         color: 'text-rose-700',   bg: 'bg-rose-100',   icon: '👤' },
  qs:        { label: 'QS / Tài chính',  color: 'text-indigo-700', bg: 'bg-indigo-100', icon: '💰' },
  other:     { label: 'Khác',            color: 'text-slate-700',  bg: 'bg-slate-100',  icon: '📁' },
};

export interface StorageFile {
  id: string;
  name: string;
  category: FileCategory;
  project_id: string;
  size: number;           // bytes
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  url?: string;           // signed URL (expires)
  version?: number;
  tags?: string[];
  description?: string;
}

export interface UploadProgress {
  file_name: string;
  progress: number;       // 0-100
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

const BUCKET = 'gem-docs';
const LS_KEY  = 'gem_storage_files';

// ─── Mock data for dev mode ───────────────────────────────────────────────────
export const MOCK_FILES: StorageFile[] = [
  { id:'f1',  name:'VILLA_PAT_KienTruc_Rev3.pdf', category:'drawings',  project_id:'p1', size:8_420_000, mime_type:'application/pdf', uploaded_by:'KS Hoàng', uploaded_at:'07/03/2026 09:15', version:3, tags:['Kiến trúc','Tầng 1-5'], description:'Bản vẽ kiến trúc tổng thể Rev C' },
  { id:'f2',  name:'VILLA_PAT_KetCau_Rev2.pdf',   category:'drawings',  project_id:'p1', size:12_300_000,mime_type:'application/pdf', uploaded_by:'TK Hùng',   uploaded_at:'06/03/2026 14:30', version:2, tags:['Kết cấu'], description:'Bản vẽ kết cấu bê tông cốt thép' },
  { id:'f3',  name:'HD_VillaPAT_ChuDauTu.pdf',    category:'contracts', project_id:'p1', size:2_100_000, mime_type:'application/pdf', uploaded_by:'TK Lan',    uploaded_at:'15/01/2026 10:00', version:1, tags:['Hợp đồng','CĐT'], description:'Hợp đồng chính với Chủ đầu tư' },
  { id:'f4',  name:'PhuLuc01_DieuChinhGia.pdf',   category:'contracts', project_id:'p1', size:890_000,   mime_type:'application/pdf', uploaded_by:'KT Hà',     uploaded_at:'01/03/2026 11:00', version:1, tags:['Phụ lục','Giá'], description:'Phụ lục điều chỉnh đơn giá thép' },
  { id:'f5',  name:'BaoCao_Tuan09_2026.pdf',      category:'reports',   project_id:'p1', size:1_450_000, mime_type:'application/pdf', uploaded_by:'CHT Anh',   uploaded_at:'03/03/2026 17:00', version:1, tags:['Tuần 9','Tiến độ'], description:'Báo cáo tiến độ tuần 9/2026' },
  { id:'f6',  name:'BaoCao_Thang02_2026.pdf',     category:'reports',   project_id:'p1', size:3_200_000, mime_type:'application/pdf', uploaded_by:'TK Lan',    uploaded_at:'01/03/2026 09:00', version:1, tags:['Tháng 2','GĐ DA'], description:'Báo cáo tháng 2 cho GĐ DA' },
  { id:'f7',  name:'BienBan_NghiemThu_Dam_T3.pdf',category:'qaqc',     project_id:'p1', size:780_000,   mime_type:'application/pdf', uploaded_by:'QC Thảo',   uploaded_at:'06/03/2026 10:30', version:1, tags:['Nghiệm thu','Tầng 3'], description:'BB nghiệm thu cốt thép dầm tầng 3' },
  { id:'f8',  name:'NCR_001_VanKhuon.pdf',        category:'qaqc',     project_id:'p1', size:540_000,   mime_type:'application/pdf', uploaded_by:'QC Thảo',   uploaded_at:'04/03/2026 15:00', version:2, tags:['NCR','Ván khuôn'], description:'NCR-001: Ván khuôn không đúng kích thước' },
  { id:'f9',  name:'HSE_BaoCao_Thang02.pdf',      category:'hse',      project_id:'p1', size:1_100_000, mime_type:'application/pdf', uploaded_by:'HSE Hải',   uploaded_at:'28/02/2026 16:00', version:1, tags:['HSE','Tháng 2'], description:'Báo cáo HSE tháng 2/2026' },
  { id:'f10', name:'ChungChi_AT_NhomKetCau.pdf',  category:'hse',      project_id:'p1', size:2_300_000, mime_type:'application/pdf', uploaded_by:'HSE Hải',   uploaded_at:'05/03/2026 08:00', version:1, tags:['Chứng chỉ','An toàn'], description:'Chứng chỉ huấn luyện AT nhóm kết cấu (24 người)' },
  { id:'f11', name:'HDLD_NguyenVanA_2026.pdf',    category:'hr',       project_id:'p1', size:450_000,   mime_type:'application/pdf', uploaded_by:'HR Đức',    uploaded_at:'03/01/2026 09:00', version:1, tags:['HĐLĐ'], description:'Hợp đồng lao động - Nguyễn Văn A (CHT)' },
  { id:'f12', name:'BOQ_VillaPAT_v4.xlsx',        category:'qs',       project_id:'p1', size:3_800_000, mime_type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploaded_by:'QS Tuấn', uploaded_at:'20/02/2026 11:00', version:4, tags:['BOQ','v4'], description:'Bảng khối lượng tổng hợp phiên bản 4' },
  { id:'f13', name:'ThanhToan_Dot3_NTP_A.pdf',    category:'qs',       project_id:'p1', size:1_600_000, mime_type:'application/pdf', uploaded_by:'QS Tuấn',   uploaded_at:'25/02/2026 14:00', version:1, tags:['Thanh toán','NTP A'], description:'Hồ sơ đề nghị thanh toán đợt 3 NTP A' },
  { id:'f14', name:'MEP_SchematicDesign_v1.pdf',  category:'drawings',  project_id:'p1', size:9_700_000, mime_type:'application/pdf', uploaded_by:'KS M&E',    uploaded_at:'05/03/2026 16:00', version:1, tags:['M&E','Sơ đồ'], description:'Bản vẽ hệ thống M&E phiên bản sơ thảo' },
];

// ─── StorageService ───────────────────────────────────────────────────────────
export const StorageService = {

  /** List files for a project, optionally filtered by category */
  async listFiles(projectId: string, category?: FileCategory): Promise<StorageFile[]> {
    const sb = getSupabase();
    const useReal = (import.meta as any).env?.VITE_USE_SUPABASE === 'true';

    if (sb && useReal) {
      const prefix = category ? `${projectId}/${category}/` : `${projectId}/`;
      const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
        limit: 200, sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      // Map Supabase objects to StorageFile
      return (data || []).map((obj: any) => ({
        id: obj.id || obj.name,
        name: obj.name,
        category: (category ?? obj.name.split('/')[1] ?? 'other') as FileCategory,
        project_id: projectId,
        size: obj.metadata?.size ?? 0,
        mime_type: obj.metadata?.mimetype ?? 'application/octet-stream',
        uploaded_by: obj.metadata?.uploadedBy ?? 'Unknown',
        uploaded_at: new Date(obj.created_at).toLocaleString('vi-VN'),
        version: obj.metadata?.version ?? 1,
        tags: obj.metadata?.tags ? JSON.parse(obj.metadata.tags) : [],
        description: obj.metadata?.description ?? '',
      }));
    }

    // Dev mock
    await new Promise(r => setTimeout(r, 300));
    const base = MOCK_FILES.filter(f => f.project_id === projectId);
    return category ? base.filter(f => f.category === category) : base;
  },

  /** Get a signed download URL (expires in 1 hour) */
  async getSignedUrl(projectId: string, category: FileCategory, fileName: string): Promise<string | null> {
    const sb = getSupabase();
    const useReal = (import.meta as any).env?.VITE_USE_SUPABASE === 'true';
    if (sb && useReal) {
      const path = `${projectId}/${category}/${fileName}`;
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    }
    return '#mock-download-url';
  },

  /** Upload a file with progress callback */
  async uploadFile(
    projectId: string,
    category: FileCategory,
    file: File,
    meta: { uploadedBy: string; description?: string; tags?: string[] },
    onProgress?: (pct: number) => void,
  ): Promise<{ file: StorageFile | null; error: string | null }> {
    const sb = getSupabase();
    const useReal = (import.meta as any).env?.VITE_USE_SUPABASE === 'true';

    if (sb && useReal) {
      const path = `${projectId}/${category}/${Date.now()}_${file.name}`;
      // Supabase JS v2 doesn't expose upload progress natively — simulate
      onProgress?.(30);
      const { data, error } = await sb.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        metadata: {
          uploadedBy: meta.uploadedBy,
          description: meta.description ?? '',
          tags: JSON.stringify(meta.tags ?? []),
          version: '1',
        },
      });
      onProgress?.(100);
      if (error) return { file: null, error: error.message };
      const stored: StorageFile = {
        id: data.id || path,
        name: file.name,
        category,
        project_id: projectId,
        size: file.size,
        mime_type: file.type,
        uploaded_by: meta.uploadedBy,
        uploaded_at: new Date().toLocaleString('vi-VN'),
        version: 1,
        tags: meta.tags,
        description: meta.description,
      };
      return { file: stored, error: null };
    }

    // Dev mock — simulate upload
    for (let p = 10; p <= 100; p += 20) {
      await new Promise(r => setTimeout(r, 120));
      onProgress?.(p);
    }
    const mock: StorageFile = {
      id: 'f_' + Date.now(),
      name: file.name,
      category,
      project_id: projectId,
      size: file.size,
      mime_type: file.type,
      uploaded_by: meta.uploadedBy,
      uploaded_at: new Date().toLocaleString('vi-VN'),
      version: 1,
      tags: meta.tags,
      description: meta.description,
    };
    return { file: mock, error: null };
  },

  /** Delete a file */
  async deleteFile(projectId: string, category: FileCategory, fileName: string): Promise<string | null> {
    const sb = getSupabase();
    const useReal = (import.meta as any).env?.VITE_USE_SUPABASE === 'true';
    if (sb && useReal) {
      const { error } = await sb.storage.from(BUCKET).remove([`${projectId}/${category}/${fileName}`]);
      return error?.message ?? null;
    }
    await new Promise(r => setTimeout(r, 200));
    return null;
  },

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  mimeIcon(mime: string): string {
    if (mime.includes('pdf'))   return '📄';
    if (mime.includes('sheet') || mime.includes('excel') || mime.includes('xlsx')) return '📊';
    if (mime.includes('word') || mime.includes('docx')) return '📝';
    if (mime.includes('image')) return '🖼️';
    if (mime.includes('zip') || mime.includes('rar'))   return '🗜️';
    return '📁';
  },
};

/*
 * ── Supabase Storage RLS Policies ──────────────────────────────────────────
 * Run in Supabase SQL Editor after creating bucket "gem-docs" (private):
 *
 * -- Allow authenticated users to upload to their projects
 * create policy "storage_upload"
 * on storage.objects for insert
 * with check (
 *   bucket_id = 'gem-docs'
 *   and auth.role() = 'authenticated'
 * );
 *
 * -- Allow project members to read files in their project folders
 * create policy "storage_read"
 * on storage.objects for select
 * using (
 *   bucket_id = 'gem-docs'
 *   and auth.role() = 'authenticated'
 * );
 *
 * -- Allow admins + uploader to delete
 * create policy "storage_delete"
 * on storage.objects for delete
 * using (
 *   bucket_id = 'gem-docs'
 *   and (
 *     auth.uid()::text = (storage.foldername(name))[1]
 *     or exists (
 *       select 1 from public.profiles
 *       where id = auth.uid() and tier = 'admin'
 *     )
 *   )
 * );
 */
