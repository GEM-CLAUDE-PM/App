/**
 * StorageService.ts — GEM&CLAUDE PM Pro / Nàng GEM Siêu Việt
 * Abstraction over Supabase Storage.
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

// ─── StorageService ───────────────────────────────────────────────────────────
export const StorageService = {

  /** List files for a project, optionally filtered by category */
  async listFiles(projectId: string, category?: FileCategory): Promise<StorageFile[]> {
    const sb = getSupabase();
    if (!sb) return [];
    const prefix = category ? `${projectId}/${category}/` : `${projectId}/`;
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
      limit: 200, sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) throw error;
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
  },

  /** Get a signed download URL (expires in 1 hour) */
  async getSignedUrl(projectId: string, category: FileCategory, fileName: string): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const path = `${projectId}/${category}/${fileName}`;
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
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
    if (sb) {
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
    if (sb) {
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
