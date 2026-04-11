*VPS
- Run VPS
  + B1: mở cmd 
  + B2: Đăng nhập -> ssh root@IP_VPS
  + B3: Nhập mật khẩu 

- Kiểm tra conect git: ssh -T git@github.com 
- clone dự án: git clone git@github.com:user_name/ten_project.git -> VD: git clone git@github.com:HoHuuTuan/OpenSandbox-myui.git
- MK khi kiểm tra conect và git về: tuan1234
- Kiểm tra docker container: docker ps
- Kiểm tra docker images: docker images

- Run OpenSandbox UI
 + B1: cd server 
 + B2: run server (Chạy backend) -> docker compose up --build
 + B2: cd admin-ui 
 + B3; Build UI-> docker build -t opensandbox-admin-ui:latest .
 + B4: run UI (Chạy UI) -> docker run -d --name opensandbox-admin-ui -p 8088:80 --restart unless-stopped opensandbox-admin-ui:latest

*Lưu ý khi UI đang chạy mà build UI lại thì nhớ xóa container UI -> docker rm -f opensandbox-admin-ui rồi mới run UI lại.