/**
 * CameraCapture.tsx — GEM & CLAUDE PM Pro
 * S19 — Camera inline cho mobile PWA
 * Dùng trong: HSEWorkspace (incident), GiamSatDashboard (ghi chú thực địa), QaQcDashboard (defect photo)
 *
 * Features:
 *   - Chụp ảnh trực tiếp từ camera thiết bị (MediaDevices API)
 *   - Geotag tự động (lat/lng gắn vào metadata)
 *   - Preview + retake
 *   - Upload lên Supabase Storage bucket gem-docs/{projectId}/{category}/
 *   - Fallback: input[type=file accept="image/*" capture="environment"] nếu browser không hỗ trợ
 *
 * Usage:
 *   <CameraCapture
 *     projectId={projectId}
 *     category="hse"
 *     uploadedBy={user.full_name}
 *     onCapture={(file, geoTag) => { ... }}
 *     onClose={() => setShowCamera(false)}
 *   />
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Check, X, MapPin, Upload, AlertTriangle } from 'lucide-react';
import { StorageService, type FileCategory } from './StorageService';

export interface CaptureResult {
  file:      File;
  dataUrl:   string;       // base64 preview
  geoTag?:   { lat: number; lng: number; accuracy: number };
  storedUrl?: string;      // Supabase signed URL sau khi upload
}

interface CameraCaptureProps {
  projectId:  string;
  category:   FileCategory;
  uploadedBy: string;
  onCapture:  (result: CaptureResult) => void;
  onClose:    () => void;
  description?: string;    // metadata cho Supabase
}

export default function CameraCapture({
  projectId, category, uploadedBy, onCapture, onClose, description = '',
}: CameraCaptureProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  const [mode, setMode]       = useState<'camera' | 'preview' | 'fallback'>('camera');
  const [preview, setPreview] = useState<string>('');
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [geoTag, setGeoTag]   = useState<CaptureResult['geoTag']>(undefined);
  const [uploading, setUploading] = useState(false);
  const [error, setError]     = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // ── Geo tag — lấy vị trí khi mount ──────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setGeoTag({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {}, // không bắt buộc — silent fail
      { timeout: 5000, enableHighAccuracy: true }
    );
  }, []);

  // ── Start camera stream ──────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode('camera');
      setError('');
    } catch (e: any) {
      // MediaDevices không khả dụng → fallback input[file]
      console.warn('[CameraCapture] getUserMedia failed:', e.message);
      setMode('fallback');
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [startCamera]);

  // ── Chụp ảnh từ video frame ──────────────────────────────────────────────────
  const handleCapture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Thêm timestamp + geotag lên ảnh
    const now = new Date().toLocaleString('vi-VN');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`GEM PM Pro · ${now}`, 10, canvas.height - 24);
    if (geoTag) {
      ctx.fillText(`${geoTag.lat.toFixed(5)}, ${geoTag.lng.toFixed(5)} ±${Math.round(geoTag.accuracy)}m`, 10, canvas.height - 6);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setPreview(dataUrl);

    // Convert dataUrl → File
    const byteStr = atob(dataUrl.split(',')[1]);
    const arr = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
    const blob = new Blob([arr], { type: 'image/jpeg' });
    const ts   = Date.now();
    const file  = new File([blob], `capture_${ts}.jpg`, { type: 'image/jpeg' });
    setCapturedFile(file);

    // Dừng stream camera
    streamRef.current?.getTracks().forEach(t => t.stop());
    setMode('preview');
  };

  // ── Retake ───────────────────────────────────────────────────────────────────
  const handleRetake = () => {
    setPreview('');
    setCapturedFile(null);
    startCamera();
  };

  // ── Confirm + upload ─────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!capturedFile) return;
    setUploading(true);
    try {
      const { file: stored, error: uploadErr } = await StorageService.uploadFile(
        projectId, category, capturedFile,
        { uploadedBy, description, tags: ['camera', 'field'] }
      );
      if (uploadErr) throw new Error(uploadErr);

      let storedUrl: string | undefined;
      if (stored) {
        storedUrl = await StorageService.getSignedUrl(projectId, category, capturedFile.name) ?? undefined;
      }
      onCapture({ file: capturedFile, dataUrl: preview, geoTag, storedUrl });
    } catch (e: any) {
      setError(`Upload lỗi: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  // ── Fallback: input[file] ────────────────────────────────────────────────────
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setCapturedFile(file);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  };

  // ── Flip camera ──────────────────────────────────────────────────────────────
  const handleFlip = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setFacingMode(m => m === 'environment' ? 'user' : 'environment');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button onClick={onClose} className="text-white p-1"><X size={22}/></button>
        <span className="text-white text-sm font-bold">Chụp ảnh hiện trường</span>
        {mode === 'camera' && (
          <button onClick={handleFlip} className="text-white p-1"><RefreshCw size={20}/></button>
        )}
        {mode !== 'camera' && <div className="w-8"/>}
      </div>

      {/* Camera / Preview */}
      <div className="flex-1 relative overflow-hidden">
        {mode === 'camera' && (
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted/>
        )}
        {mode === 'preview' && (
          <img src={preview} alt="preview" className="w-full h-full object-contain bg-black"/>
        )}
        {mode === 'fallback' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white px-6 text-center">
            <AlertTriangle size={40} className="text-amber-400"/>
            <p className="text-sm">Camera không khả dụng trên thiết bị này.</p>
            <label className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-sm font-bold cursor-pointer">
              Chọn ảnh từ thư viện
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput}/>
            </label>
          </div>
        )}

        {/* Geotag badge */}
        {geoTag && mode === 'camera' && (
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">
            <MapPin size={10} className="text-emerald-400"/>
            {geoTag.lat.toFixed(4)}, {geoTag.lng.toFixed(4)}
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden"/>

      {/* Error */}
      {error && (
        <div className="bg-red-900 text-red-200 text-xs px-4 py-2 text-center">{error}</div>
      )}

      {/* Controls */}
      <div className="bg-black/90 px-6 py-5 flex items-center justify-center gap-8">
        {mode === 'camera' && (
          <button
            onClick={handleCapture}
            className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 active:scale-95 transition-transform"
          >
            <Camera size={24} className="text-slate-800 mx-auto"/>
          </button>
        )}
        {mode === 'preview' && (
          <>
            <button onClick={handleRetake}
              className="flex flex-col items-center gap-1 text-white">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                <RefreshCw size={20}/>
              </div>
              <span className="text-[10px]">Chụp lại</span>
            </button>
            <button onClick={handleConfirm} disabled={uploading}
              className="flex flex-col items-center gap-1 text-white">
              <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center">
                {uploading ? <Upload size={20} className="animate-pulse"/> : <Check size={20}/>}
              </div>
              <span className="text-[10px]">{uploading ? 'Đang lưu...' : 'Xác nhận'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
