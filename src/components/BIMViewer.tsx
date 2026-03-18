/**
 * BIMViewer.tsx — GEM&CLAUDE PM Pro
 * S21 — BIM/IFC 3D model viewer trong browser
 * Dùng web-ifc-viewer (IFC.js) load trực tiếp file .ifc từ Supabase Storage
 *
 * SETUP (một lần):
 *   npm install web-ifc-viewer web-ifc three
 *   Copy web-ifc.wasm → /public/wasm/web-ifc.wasm
 *   (file WASM ~6MB, Vercel tự serve từ /public)
 *
 * Usage:
 *   <BIMViewer projectId={projectId} projectName={projectName} />
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNotification } from './NotificationEngine';
import { StorageService } from './StorageService';
import { getSupabase } from './supabase';
import {
  Box, Upload, Loader2, AlertTriangle, ZoomIn, ZoomOut,
  RotateCcw, Layers, Eye, EyeOff, Download, X,
} from 'lucide-react';

interface BIMViewerProps {
  projectId:   string;
  projectName: string;
}

interface IFCFile {
  name:        string;
  uploadedAt:  string;
  size:        number;
  signedUrl?:  string;
}

export default function BIMViewer({ projectId, projectName }: BIMViewerProps) {
  const { ok, err } = useNotification();
  const containerRef  = useRef<HTMLDivElement>(null);
  const viewerRef     = useRef<any>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [loading, setLoading]       = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [ifcFiles, setIfcFiles]     = useState<IFCFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [wasmReady, setWasmReady]   = useState(false);
  const [wasmError, setWasmError]   = useState('');
  const [stats, setStats]           = useState<{ elements: number; types: string[] } | null>(null);

  // ── Init IFC viewer ────────────────────────────────────────────────────────
  useEffect(() => {
    let viewer: any = null;
    (async () => {
      try {
        // Dynamic import — tránh SSR crash và chỉ load khi cần
        const { IfcViewerAPI } = await import('web-ifc-viewer');
        if (!containerRef.current) return;

        viewer = new IfcViewerAPI({
          container: containerRef.current,
          backgroundColor: new (await import('three')).Color(0xf1f5f9),
        });

        // Path WASM phải khớp với /public/wasm/web-ifc.wasm
        await viewer.IFC.setWasmPath('/wasm/');
        viewer.axes.setAxes();
        viewer.grid.setGrid();

        // Responsive resize
        const onResize = () => viewer?.context?.ifcCamera?.updateAspect?.();
        window.addEventListener('resize', onResize);

        viewerRef.current = viewer;
        setWasmReady(true);

        return () => {
          window.removeEventListener('resize', onResize);
          viewer?.dispose?.();
        };
      } catch (e: any) {
        const msg = e.message?.includes('Cannot find module')
          ? 'Cần cài: npm install web-ifc-viewer web-ifc three'
          : `Lỗi khởi tạo IFC viewer: ${e.message}`;
        setWasmError(msg);
      }
    })();

    return () => { viewerRef.current?.dispose?.(); };
  }, []);

  // ── Load IFC files từ Supabase Storage ────────────────────────────────────
  const loadFileList = useCallback(async () => {
    setLoading(true);
    try {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.storage
        .from('gem-docs')
        .list(`${projectId}/drawings/`, {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' },
        });
      const ifc = (data ?? []).filter((f: any) => f.name.endsWith('.ifc'));
      setIfcFiles(ifc.map((f: any) => ({
        name: f.name,
        uploadedAt: new Date(f.created_at).toLocaleDateString('vi-VN'),
        size: f.metadata?.size ?? 0,
      })));
    } catch (e: any) {
      err(`Lỗi load file list: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadFileList(); }, [loadFileList]);

  // ── Load IFC model vào viewer ──────────────────────────────────────────────
  const loadModel = useCallback(async (fileName: string) => {
    if (!viewerRef.current || !wasmReady) {
      err('IFC Viewer chưa sẵn sàng.'); return;
    }
    setLoadingModel(true);
    setStats(null);
    try {
      // Lấy signed URL
      const url = await StorageService.getSignedUrl(projectId, 'drawings', fileName);
      if (!url) throw new Error('Không lấy được URL file.');

      // Clear model cũ
      await viewerRef.current.IFC.loader.ifcManager.dispose?.();

      // Load model
      const model = await viewerRef.current.IFC.loadIfcUrl(url);
      viewerRef.current.context.fitToFrame();

      // Đọc element count
      const manager = viewerRef.current.IFC.loader.ifcManager;
      const allIds  = await manager.getAllItemsOfType(model.modelID, 0, false);
      const types   = new Set<string>();
      // Sample first 20 elements for type list
      for (const id of allIds.slice(0, 20)) {
        try {
          const props = await manager.getItemProperties(model.modelID, id);
          if (props?.type) types.add(props.type);
        } catch {}
      }
      setStats({ elements: allIds.length, types: [...types].slice(0, 8) });
      setActiveFile(fileName);
      ok(`Đã load: ${fileName}`);
    } catch (e: any) {
      err(`Lỗi load model: ${e.message}`);
    } finally {
      setLoadingModel(false);
    }
  }, [projectId, wasmReady]);

  // ── Upload IFC file ────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.ifc')) { err('Chỉ hỗ trợ file .ifc'); return; }
    if (file.size > 100 * 1024 * 1024) { err('File quá lớn (tối đa 100MB)'); return; }

    setLoading(true);
    try {
      const { error } = await StorageService.uploadFile(
        projectId, 'drawings', file,
        { uploadedBy: 'bim_user', description: `BIM model — ${projectName}` }
      );
      if (error) throw new Error(error);
      ok(`Đã upload ${file.name}`);
      await loadFileList();
    } catch (e: any) {
      err(`Upload lỗi: ${e.message}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // ── Camera controls ────────────────────────────────────────────────────────
  const resetView   = () => viewerRef.current?.context?.fitToFrame?.();
  const toggleClip  = () => viewerRef.current?.clipper?.toggle?.();

  // ── WASM not available ─────────────────────────────────────────────────────
  if (wasmError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
        <AlertTriangle size={28} className="text-amber-500 mx-auto"/>
        <p className="text-sm font-bold text-amber-800">BIM Viewer chưa cài đặt</p>
        <p className="text-xs text-amber-700 font-mono bg-amber-100 rounded-lg px-3 py-2">{wasmError}</p>
        <div className="text-xs text-amber-700 space-y-1">
          <p>Chạy lệnh sau rồi copy WASM:</p>
          <code className="block bg-amber-100 rounded px-3 py-2 text-left">
            npm install web-ifc-viewer web-ifc three<br/>
            cp node_modules/web-ifc/web-ifc.wasm public/wasm/
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box size={16} className="text-violet-600"/>
          <span className="text-sm font-black text-slate-800">BIM Viewer — {projectName}</span>
          {!wasmReady && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Loader2 size={10} className="animate-spin"/> Đang khởi tạo...
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={resetView} disabled={!activeFile}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 text-slate-500" title="Fit to frame">
            <RotateCcw size={13}/>
          </button>
          <button onClick={toggleClip} disabled={!activeFile}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 text-slate-500" title="Toggle clipping planes">
            <Layers size={13}/>
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl px-3 py-1.5 transition-colors">
            <Upload size={12}/> Upload IFC
          </button>
          <input ref={fileInputRef} type="file" accept=".ifc" className="hidden" onChange={handleUpload}/>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* File list */}
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Model files</p>
          {loading ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 size={11} className="animate-spin"/> Đang tải...
            </div>
          ) : ifcFiles.length === 0 ? (
            <div className="text-xs text-slate-400 italic">Chưa có file IFC — upload để bắt đầu</div>
          ) : (
            <ul className="space-y-1">
              {ifcFiles.map(f => (
                <li key={f.name}>
                  <button
                    onClick={() => loadModel(f.name)}
                    disabled={loadingModel}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition-colors ${
                      activeFile === f.name
                        ? 'bg-violet-100 border-violet-300 text-violet-800 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-violet-50 hover:border-violet-200'
                    }`}
                  >
                    <p className="font-medium truncate">{f.name.replace('.ifc','')}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {f.uploadedAt} · {StorageService.formatSize(f.size)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Stats */}
          {stats && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 px-3 py-2 text-xs space-y-1">
              <p className="font-bold text-slate-700">{stats.elements.toLocaleString()} elements</p>
              <div className="flex flex-wrap gap-1">
                {stats.types.map(t => (
                  <span key={t} className="bg-violet-100 text-violet-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {t.replace('IFC','').replace('ELEMENT','')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3D viewport */}
        <div className="md:col-span-3">
          <div className="relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200"
               style={{ height: 480 }}>
            <div ref={containerRef} className="w-full h-full"/>

            {/* Loading overlay */}
            {loadingModel && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Loader2 size={18} className="animate-spin text-violet-600"/>
                  Đang load model 3D...
                </div>
              </div>
            )}

            {/* Empty state */}
            {!activeFile && !loadingModel && wasmReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Box size={40} className="opacity-30"/>
                <p className="text-sm">Chọn file IFC từ danh sách để xem model 3D</p>
              </div>
            )}

            {/* Controls hint */}
            {activeFile && (
              <div className="absolute bottom-3 left-3 text-[10px] text-slate-400 bg-white/80 rounded-lg px-2 py-1">
                Chuột trái: xoay · Chuột giữa: zoom · Chuột phải: pan
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
