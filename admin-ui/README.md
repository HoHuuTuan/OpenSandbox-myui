# Giao Diện Quản Trị OpenSandbox

Ứng dụng React tách riêng cho quản trị OpenSandbox, sử dụng trực tiếp lifecycle API và diagnostics API.

## Cách Chạy

```bash
cd admin-ui
npm install
npm run dev
```

Base URL mặc định của API được lấy từ `VITE_OPENSANDBOX_API_BASE_URL`.

## Biến Môi Trường

Có thể sao chép `.env.example` thành `.env` nếu muốn đổi giá trị mặc định.

```bash
VITE_OPENSANDBOX_API_BASE_URL=http://127.0.0.1:8080/v1
VITE_OPENSANDBOX_AUTO_REFRESH_SECONDS=10
```

## Các Màn Hình

- Tổng Quan
- Danh Sách Sandbox
- Chi Tiết Sandbox
- Nhật Ký / Terminal
- Cài Đặt

## Ghi Chú Backend

- `POST /sandboxes` tạo và tự động khởi động sandbox.
- `DELETE /sandboxes/{id}` sẽ chấm dứt sandbox.
- Backend hiện chưa có endpoint lifecycle riêng cho `start` hoặc `restart`.
