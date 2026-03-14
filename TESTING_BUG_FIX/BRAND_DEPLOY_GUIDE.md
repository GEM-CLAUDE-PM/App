# Hướng dẫn tích hợp Logo & Icon — GEM & CLAUDE PM Pro

## 1. Copy file vào thư mục `public/`

```
public/
├── icon_app.png          ← icon gốc anh upload (dùng trực tiếp)
├── LOGO_web_app.png      ← logo gốc anh upload (dùng cho og:image)
├── favicon.ico           ← từ outputs/
├── icon-192x192.png      ← từ outputs/
├── icon-512x512.png      ← từ outputs/
└── apple-touch-icon.png  ← từ outputs/
```

## 2. Copy file vào `src/components/`

```
src/components/
└── SplashScreen.tsx      ← từ outputs/
```

## 3. Thay thế file gốc

| File outputs | Đích |
|---|---|
| `App.tsx` | `src/App.tsx` |
| `Taskbar.tsx` | `src/components/Taskbar.tsx` |
| `index.html` | `index.html` (root) |
| `manifest.json` | `public/manifest.json` |

## 4. Kết quả sau khi triển khai

### Splash Screen (2.2 giây khi mở app)
- App icon 112×112px bo góc với glow effect
- Brand text màu terra cotta + teal
- Progress bar gradient + loading dots
- Watermark "Powered by Gemini AI & Claude AI"

### Taskbar (góc dưới trái)
- Khi **thu gọn**: hiện `icon_app.png` thay vì icon mặc định
- Tooltip: "GEM & CLAUDE PM Pro"

### Header logo (góc trên trái — mới)
- Logo mini: icon 28px + text "GEM & CLAUDE / PM Pro"
- Background frosted glass: `bg-white/80 backdrop-blur`

### PWA (cài về Home Screen iOS/Android)
- Tên: "GEM PM Pro"
- Theme color: #1a8a7a (teal)
- Splash background: #e8eaec
- Shortcuts: Dashboard + Dự án

## 5. Màu brand chính thức

```css
--brand-teal:       #1a8a7a;   /* Header, accent chính */
--brand-terra:      #c47a5a;   /* Brand name text, accent phụ */
--brand-bg:         #e8eaec;   /* Nền app, splash background */
```
