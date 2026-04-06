# OpenSandbox Admin UI - Fixed Lifecycle Version

Bản này sửa theo đúng Lifecycle API chính thức của OpenSandbox.

## Điểm đã sửa

- Bỏ toàn bộ giả định sai về các endpoint `/admin/.../note` và `/admin/.../tags`.
- Dùng đúng base URL mặc định: `http://127.0.0.1:8090/v1`.
- Gọi đúng các endpoint chuẩn:
  - `GET /sandboxes`
  - `POST /sandboxes`
  - `GET /sandboxes/{id}`
  - `DELETE /sandboxes/{id}`
  - `POST /sandboxes/{id}/pause`
  - `POST /sandboxes/{id}/resume`
  - `POST /sandboxes/{id}/renew-expiration`
  - `GET /sandboxes/{id}/endpoints/{port}`
- Thêm parse JSON an toàn để không còn lỗi `Unexpected end of JSON input` khi backend trả body rỗng cho `204 No Content`.
- Giữ auto refresh và cấu hình API key trong localStorage.

## Cách thay vào repo cũ

1. Sao lưu `admin-ui/` cũ.
2. Chép toàn bộ file trong thư mục này đè lên `admin-ui/`.
3. Chạy:

```bash
npm install
npm run dev
```

hoặc build Docker theo quy trình hiện tại của bạn.
