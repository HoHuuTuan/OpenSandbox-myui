# Triển Khai `admin-ui` Lên VPS

Tài liệu này hướng dẫn triển khai giao diện quản trị `admin-ui` trên VPS theo hai cách:

- Dùng `nginx` phục vụ file tĩnh
- Dùng `Docker` với image dựng sẵn từ `admin-ui/Dockerfile`

## 1. Yêu Cầu

- VPS Linux, ví dụ Ubuntu 22.04 hoặc 24.04
- Đã cài `git`
- Đã cài `node` nếu muốn build trực tiếp trên máy
- OpenSandbox backend đang chạy và có URL public hoặc nội bộ mà VPS truy cập được

Ví dụ API backend:

```bash
https://sandbox-api.example.com/v1
```

## 2. Cấu Hình Biến Môi Trường

Tạo file `.env` trong thư mục `admin-ui` trước khi build:

```bash
VITE_OPENSANDBOX_API_BASE_URL=https://sandbox-api.example.com/v1
VITE_OPENSANDBOX_AUTO_REFRESH_SECONDS=10
```

Lưu ý:

- Các biến `VITE_*` được nhúng lúc build
- Nếu đổi API URL, bạn cần build lại frontend

## 3. Cách 1: Build Trực Tiếp Và Phục Vụ Bằng Nginx

### Bước 1: Build frontend

```bash
cd admin-ui
npm install
npm run build
```

Sau khi build xong, output sẽ nằm trong thư mục `dist/`.

### Bước 2: Cài nginx trên VPS

```bash
sudo apt update
sudo apt install -y nginx
```

### Bước 3: Copy file build lên thư mục web

Ví dụ:

```bash
sudo mkdir -p /var/www/opensandbox-admin
sudo cp -r dist/* /var/www/opensandbox-admin/
```

### Bước 4: Tạo cấu hình nginx

Tạo file:

```bash
sudo nano /etc/nginx/sites-available/opensandbox-admin
```

Nội dung:

```nginx
server {
    listen 80;
    server_name your-admin-domain.com;

    root /var/www/opensandbox-admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /healthz {
        access_log off;
        add_header Content-Type text/plain;
        return 200 "ok";
    }
}
```

Kích hoạt site:

```bash
sudo ln -s /etc/nginx/sites-available/opensandbox-admin /etc/nginx/sites-enabled/opensandbox-admin
sudo nginx -t
sudo systemctl reload nginx
```

## 4. Cách 2: Chạy Bằng Docker

### Bước 1: Build image

Trong thư mục `admin-ui`:

```bash
docker build -t opensandbox-admin-ui:latest .
```

### Bước 2: Chạy container

```bash
docker run -d \
  --name opensandbox-admin-ui \
  -p 8088:80 \
  --restart unless-stopped \
  opensandbox-admin-ui:latest
```

Giao diện sẽ sẵn sàng tại:

```bash
http://<your-vps-ip>:8088
```

### Bước 3: Nếu muốn đi qua reverse proxy

Bạn có thể đặt `nginx` hoặc `caddy` bên ngoài để map domain vào container này.

## 5. HTTPS Với Nginx + Certbot

Nếu bạn dùng domain thật:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-admin-domain.com
```

## 6. CORS Và Backend

Frontend này gọi trực tiếp lifecycle API của OpenSandbox.

Bạn cần đảm bảo:

- `VITE_OPENSANDBOX_API_BASE_URL` trỏ đúng tới backend
- Backend cho phép CORS từ domain admin UI nếu frontend và backend khác domain
- Nếu backend bật API key, người dùng cần nhập API key trong giao diện phần `Cài Đặt`

## 7. Bảo Mật

Khuyến nghị:

- Chỉ mở admin UI trong mạng nội bộ, VPN hoặc sau lớp xác thực khác
- Không public rộng rãi nếu chưa có lớp xác thực frontend riêng
- Vì API key hiện được nhập ở trình duyệt, đây phù hợp hơn cho môi trường vận hành nội bộ

## 8. Cập Nhật Phiên Bản

Khi pull code mới:

```bash
cd admin-ui
npm install
npm run build
```

Nếu dùng nginx file tĩnh:

```bash
sudo rm -rf /var/www/opensandbox-admin/*
sudo cp -r dist/* /var/www/opensandbox-admin/
sudo systemctl reload nginx
```

Nếu dùng Docker:

```bash
docker build -t opensandbox-admin-ui:latest .
docker stop opensandbox-admin-ui
docker rm opensandbox-admin-ui
docker run -d \
  --name opensandbox-admin-ui \
  -p 8088:80 \
  --restart unless-stopped \
  opensandbox-admin-ui:latest
```

## 9. Kiểm Tra Nhanh

Kiểm tra nginx hoặc container:

```bash
curl http://127.0.0.1/healthz
```

hoặc nếu chạy container riêng:

```bash
curl http://127.0.0.1:8088/healthz
```

Kết quả mong đợi:

```bash
ok
```
