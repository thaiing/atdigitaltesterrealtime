const express = require('express');
const {createProxyMiddleware} = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;

// Cấu hình API Target
const TARGET_8081 = process.env.API_TARGET_8081 || 'http://192.168.4.45:8081';
const TARGET_8888 = process.env.API_TARGET_8888 || 'http://192.168.4.45:8888';
// Target cho Network Service (Python)
const TARGET_NETWORK = process.env.API_TARGET_NETWORK || 'http://host.docker.internal:5000';

console.log('--- PROXY CONFIG ---');
console.log('Network Target:', TARGET_NETWORK);
console.log('Backend Target:', TARGET_8081);
console.log('OpenMUC Target:', TARGET_8888);

// --- CẤU HÌNH PROXY ---
// LƯU Ý: Phải đặt các route chi tiết lên TRƯỚC route chung

// 1. Proxy cho /api/schedule
app.use('/api/schedule', createProxyMiddleware({
  target: TARGET_8081,
  changeOrigin: true,
  pathRewrite: {'^/': '/soh-schedule/'},
  logger: console
}));

// 2. Proxy cho /api/latest-value
app.use('/api/latest-value', createProxyMiddleware({
  target: TARGET_8081,
  changeOrigin: true,
  pathRewrite: {'^/': '/latest-value/'},
  logger: console
}));

// 3. Proxy cho /api/network (MỚI - QUAN TRỌNG)
// Phải đặt TRƯỚC /api chung để không bị bắt nhầm
app.use('/api/network', createProxyMiddleware({
  target: TARGET_NETWORK,
  changeOrigin: true,
  // Không rewrite path, giữ nguyên /api/network chuyển sang Python
  logger: console
}));

// 4. Proxy cho /api (Generic)
// Các request api còn lại sẽ vào đây (OpenMUC)
app.use('/api', createProxyMiddleware({
  target: TARGET_8888,
  changeOrigin: true,
  pathRewrite: {'^/': '/rest/'},
  headers: {
    'Authorization': 'Basic YWRtaW46YWRtaW4=' // admin:admin base64
  },
  logger: console
}));

// --- CẤU HÌNH STATIC FILES (Angular) ---
const distPath = path.join(__dirname, 'dist/maxicom-bms/browser');

app.use(express.static(distPath));

// Xử lý Routing của Angular (SPA Fallback)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
