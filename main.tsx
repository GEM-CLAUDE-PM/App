import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css' // File này chứa các cấu hình màu sắc cơ bản

// Tìm cái khung có tên "root" trong HTML để nhúng giao diện vào
const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} else {
  console.error("Không tìm thấy khung 'root' để hiển thị Nàng GEM!");
}
