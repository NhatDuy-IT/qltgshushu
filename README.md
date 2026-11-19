# ShuShu — All-in-One Work, Booking & Life Workspace (Phase 2 — Bản Hoàn Chỉnh)

**ShuShu** là không gian làm việc & quản lý cuộc sống cá nhân (Single-User) theo phong cách **Modern Glassmorphism**, tích hợp đồng bộ dữ liệu **PC ↔ Mobile** miễn phí bằng **Vercel + Supabase**, bảo mật đăng nhập riêng tư 1 tài khoản duy nhất (không có nút Đăng ký), khóa mã **PIN 4 số (App Lock)**, nhắc lịch chuẩn xác qua **Web Push + Telegram Bot + Cron**, cùng bộ công cụ thông minh cho Booking & Công việc.

---

## Các tính năng chính (Phase 1 + Phase 2)

- **Xác thực riêng tư Single-User & App Lock:**
  - Màn hình đăng nhập tối giản (chỉ Login, loại bỏ hoàn toàn Sign Up), chặn toàn bộ truy cập khi chưa đăng nhập, tự động lưu phiên đăng nhập (**Persist Session**).
  - **Khóa mã PIN 4 số** trong `Cài đặt` để bảo vệ riêng cho tab `Finance` và `Quick Note`.
- **Đồng bộ PC ↔ Mobile Real-Time (Supabase + Offline-First):**
  - Tự động kết nối **Supabase** (9 bảng chuẩn hóa + **Row Level Security** nghiêm ngặt) khi có `SUPABASE_URL` và `SUPABASE_ANON_KEY`.
  - Nếu chưa điền biến môi trường, tự động chạy mượt mà bằng **IndexedDB / LocalStorage** mà không báo lỗi.
- **Công việc & Booking Thông minh:**
  - **Cảnh báo trùng lịch tự động (Conflict Detection)** trước khi lưu khi phát hiện khung giờ chồng lấn.
  - **Kéo thả đổi lịch trực tiếp (Drag & Drop Reschedule)** ngay trên lưới Lịch tháng / Tuần.
  - **Tự động liên kết Booking → Finance:** Chuyển Booking sang *"Đã cọc"* hoặc *"Hoàn thành"* sẽ hiện hộp thoại xác nhận đẩy doanh thu sang `Finance` trong 1 cú bấm.
  - **Danh bạ khách hàng Mini CRM:** Tự gợi ý khách cũ (Tên, SĐT/Zalo, ghi chú) khi tạo Booking và xem toàn bộ lịch sử Booking của từng khách.
  - **Xuất lịch `.ics` (1-Click Export):** Tải file `.ics` chuẩn để gửi khách hàng hoặc lưu ngay vào Apple/Google Calendar.
- **Nhắc lịch Điện thoại Chính xác (SMS Số điện thoại + Web Push + Cron):**
  - Chỉ cần điền **Số điện thoại** trong `Cài đặt` hoặc `Reminder` — khi đến ngày/giờ hẹn (Booking, Deadline, Reminder) hệ thống tự động gửi **tin nhắn SMS** thẳng về số điện thoại đó (hỗ trợ cổng **SpeedSMS.vn**, **eSMS.vn**, hoặc **Twilio**).
  - `POST /api/subscribe` — Lưu đăng ký Web Push của từng thiết bị (PC, iOS, Android).
  - `POST /api/sms` — Gửi tin nhắn SMS trực tiếp về số điện thoại.
  - `GET /api/check-reminders` — Chạy định kỳ mỗi 5 phút (bảo vệ bằng `CRON_SECRET`), quét Booking/Deadline/Reminder sắp tới và tự bắn **Web Push** + **SMS về số điện thoại**.
  - `GET /api/daily-briefing` — Gửi bản tin tổng hợp vào **8:00 sáng mỗi ngày** qua Push & SMS.
- **Power-User UX:**
  - **Tìm kiếm nhanh `Ctrl + K` / `⌘ + K` (Command Palette)** + nút kính lúp trên Mobile.
  - **Chế độ Tập trung (Focus Mode):** Ẩn Sidebar, giữ lại 1 việc duy nhất + đồng hồ Pomodoro + tiếng ồn trắng.
  - **Vuốt trên Mobile (Swipe Gestures):** Vuốt phải thẻ việc để Hoàn thành, vuốt trái để dời sang ngày mai hoặc xóa.

---

## Thông tin tài khoản chạy thử cục bộ (Local Offline-First)

- **Tài khoản:** `tuilashushu` *(hoặc `tuilashushu@shushu.app`)*
- **Mật khẩu:** `mocuachoanhdi`

---

## Hướng dẫn Deploy & Bàn giao chi tiết (5 Bước)

### Bước 1: Tạo Project Supabase miễn phí & chạy `supabase_schema.sql`

1. Đăng ký / đăng nhập tài khoản miễn phí tại [supabase.com](https://supabase.com) → bấm **New Project**.
2. Đặt tên project (ví dụ `shushu-workspace`), chọn khu vực **Southeast Asia (Singapore)** để tốc độ tại Việt Nam nhanh nhất, đặt mật khẩu Database và bấm **Create new project**.
3. Sau khi project khởi tạo xong, mở mục **SQL Editor** ở thanh bên trái → bấm **New query**.
4. Mở file [`supabase_schema.sql`](./supabase_schema.sql) ở thư mục gốc của dự án, sao chép toàn bộ nội dung dán vào SQL Editor và bấm **Run**.
   - Script sẽ tự động tạo đầy đủ 9 bảng (`tasks_bookings`, `reminders`, `finances`, `notes`, `projects`, `habits`, `clients`, `user_settings`, `push_subscriptions`), bật **Row Level Security (RLS)** đảm bảo chỉ tài khoản đã đăng nhập mới có quyền đọc/ghi, và bật **Supabase Realtime**.
5. Vào **Project Settings → API** để lấy 3 thông số sau (dùng cho Bước 4):
   - **Project URL** → `SUPABASE_URL`
   - **anon public key** → `SUPABASE_ANON_KEY`
   - **service_role secret key** → `SUPABASE_SERVICE_ROLE_KEY` *(tuyệt đối không lộ key này ra frontend, chỉ nhập trên Vercel)*

---

### Bước 2: Tắt đăng ký công khai & tạo 1 tài khoản Single-User duy nhất

Để đảm bảo không người lạ nào có thể tự tạo tài khoản vào hệ thống:

1. Trên Supabase Dashboard, vào **Authentication → Providers → Email**:
   - Đảm bảo **Enable Email provider** đang bật.
   - Tắt tùy chọn **Confirm email** (hoặc xác nhận thủ công ngay khi tạo user).
2. Vào **Authentication → Sign In / Up (hoặc Settings → User Signups)**:
   - **TẮT (Disable)** mục **"Allow new users to sign up"**, sau đó bấm **Save**.
3. Vào **Authentication → Users → Add user → Create new user**:
   - **Email:** `tuilashushu@shushu.app` *(nhờ biến `SINGLE_USER_EMAIL_DOMAIN=shushu.app`, khách chỉ cần gõ ngắn gọn `tuilashushu` ở màn hình đăng nhập là vào được!)*
   - **Password:** `mocuachoanhdi` *(hoặc mật khẩu riêng bạn muốn bàn giao)*
   - Tích chọn **Auto Confirm User** → bấm **Create user**.

---

### Bước 3: Tạo VAPID Keys (Push) & Cấu hình cổng gửi Tin nhắn SMS về Số điện thoại

1. **Web Push (miễn phí 100%):** Chạy lệnh sau để lấy `VAPID_PUBLIC_KEY` và `VAPID_PRIVATE_KEY`:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Điền thêm `VAPID_SUBJECT=mailto:email-cua-ban@gmail.com`.

2. **Gửi tin nhắn SMS thật về Số điện thoại:** Người dùng chỉ cần nhập duy nhất **Số điện thoại** trong ứng dụng (`Cài đặt` hoặc `Reminder`). Trên Vercel, bạn chỉ cần thêm biến môi trường của **1 trong 3 cổng SMS** sau:
   - **SpeedSMS.vn (khuyên dùng tại Việt Nam):** `SPEEDSMS_ACCESS_TOKEN`
   - **eSMS.vn (Việt Nam):** `ESMS_API_KEY`, `ESMS_SECRET_KEY`, `ESMS_BRANDNAME`
   - **Twilio (Quốc tế, có credit miễn phí dùng thử):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

---

### Bước 4: Deploy lên Vercel & cấu hình `cron-job.org` (Nhắc lịch mỗi 5 phút)

1. Đẩy toàn bộ mã nguồn dự án lên kho GitHub cá nhân (chọn **Private Repository** để bảo mật).
2. Truy cập [vercel.com](https://vercel.com) → **Add New → Project** → Import repository **ShuShu**.
3. Vercel sẽ tự nhận cấu hình từ `vercel.json` (`buildCommand: npm run build`, `outputDirectory: dist`, Cron tự động `/api/daily-briefing` lúc 8:00 sáng mỗi ngày).
4. Mở mục **Environment Variables** và nhập các biến (theo mẫu trong `.env.example`):
   ```env
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   SINGLE_USER_EMAIL_DOMAIN=shushu.app
   VAPID_PUBLIC_KEY=Bxxx...
   VAPID_PRIVATE_KEY=xxxx...
   VAPID_SUBJECT=mailto:your-email@gmail.com
   CRON_SECRET=shushu_secret_2026_bat_ky
   ```
5. Bấm **Deploy** và chờ ~30 giây để nhận đường link chính thức (VD: `https://shushu-workspace.vercel.app`).
6. **Cấu hình nhắc lịch chính xác mỗi 5 phút miễn phí bằng `cron-job.org`:**
   - Tạo tài khoản miễn phí tại [cron-job.org](https://cron-job.org) → bấm **Create Cronjob**.
   - **Title:** `ShuShu Check Reminders (5m)`
   - **URL:** `https://ten-mien-cua-ban.vercel.app/api/check-reminders?secret=shushu_secret_2026_bat_ky` *(hoặc truyền qua Header `Authorization: Bearer shushu_secret_2026_bat_ky`)*
   - **Execution schedule:** Chọn **Every 5 minutes** → bấm **Create**.
   - *(Bản tin sáng 8:00 AM `/api/daily-briefing` đã được cấu hình sẵn trong `vercel.json` chạy miễn phí hằng ngày trên Vercel!)*

---

### Bước 5: Cài đặt ShuShu ra màn hình chính Điện thoại (PWA) & Bật thông báo

- **Trên iPhone (iOS 16.4 trở lên):**
  1. Mở link ShuShu bằng trình duyệt **Safari**.
  2. Bấm biểu tượng **Chia sẻ (Share)** ở cạnh dưới → chọn **Thêm vào MH chính (Add to Home Screen)** → bấm **Thêm**.
  3. Mở ứng dụng **ShuShu** từ biểu tượng ngoài màn hình chính → đăng nhập 1 lần (`tuilashushu` / `mocuachoanhdi`).
  4. Vào mục **Reminder** → bấm **Bật thông báo điện thoại** → chọn **Cho phép (Allow)** → bấm **Gửi thông báo thử nghiệm** để kiểm tra.
- **Trên Android (Chrome):**
  1. Mở link ShuShu bằng **Chrome** → bấm menu `⋮` góc trên phải → chọn **Cài đặt ứng dụng / Thêm vào màn hình chính**.
  2. Mở app, đăng nhập 1 lần → vào **Reminder** → bấm **Bật thông báo điện thoại**.

---

## Chạy thử trên máy cá nhân (Local)

```bash
# Nếu đã cài Node.js:
npm install
npm run dev
# Truy cập http://localhost:3000

# Hoặc dùng máy chủ tĩnh bất kỳ tại thư mục gốc:
# (Ví dụ với Ruby có sẵn trên macOS)
ruby -rwebrick -e 'WEBrick::HTTPServer.new(Port: 4173, DocumentRoot: ".").start'
```
