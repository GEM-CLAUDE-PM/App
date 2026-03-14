import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    // Cho phép các Popup (như Google Login) liên lạc ngược lại với App
    //res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    // Cho phép tải tài nguyên từ các nguồn khác (Google API)
    //res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    next();
  });
  const PORT = 3000;

  // 1. CẤU HÌNH AI (Linh hồn Nàng GEM)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: "Em là Nàng GEM, trợ lý dự án của anh Tuấn. Em trả lời giọng miền Nam, dùng số (1, 2, 3...), ngày $dd/mm/yyyy$ và dùng LaTeX cho công thức. Em chuyên về QA/QC, QS và Dòng tiền tại Villa PAT. Em tin rằng: 'Không có cổ phiếu tốt nếu không tăng giá'.",
  });

  // API Chat để giao diện gọi được AI
  app.post('/api/chat', async (req, res) => {
    try {
      const { message } = req.body;
      const result = await model.generateContent(message);
      res.json({ reply: result.response.text() });
    } catch (error) {
      console.error("Lỗi AI:", error);
      res.status(500).json({ error: "Dạ hệ thống AI đang bận, anh đợi em xíu nha!" });
    }
  });

  // 2. ROUTE OAUTH MICROSOFT (OneDrive kết nối Villa PAT)
  app.get('/api/auth/microsoft/url', (req, res) => {
    const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const redirectUri = `${baseUrl}/auth/callback`;
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID || '',
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'offline_access user.read files.read.all',
    });
    res.json({ url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}` });
  });

  // 3. CẤU HÌNH GIAO DIỆN (Hợp nhất Vite & Express)
  let vite: any;
  if (process.env.NODE_ENV !== 'production') {
    // Chế độ phát triển: Dùng Vite để xử lý nóng các thay đổi
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Chế độ thực tế: Dùng thư mục dist đã đóng gói
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  // 4. XỬ LÝ ĐƯỜNG DẪN CẢNH CỬA CHÍNH (Catch-all route)
  app.get('*', async (req, res, next) => {
    const url = req.originalUrl;
    // Bỏ qua các đường dẫn API
    if (url.startsWith('/api')) return next();

    try {
      if (process.env.NODE_ENV !== 'production' && vite) {
        // Đọc index.html và để Vite "vẽ" giao diện lên
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } else {
        // Trả về file đã build sẵn
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      }
    } catch (e) {
      console.error("Lỗi điều hướng:", e);
      next(e);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Nàng GEM đang sẵn sàng tại cổng ${PORT}`);
    console.log(`Dự án Villa PAT: http://localhost:${PORT}`);
  });
}

startServer();