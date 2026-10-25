# Gia Đình Số v3: cài đặt trong Visual Studio Code và đưa lên Vercel

## A. Chạy trên máy (VS Code)
1. Cài **Node.js 20 LTS** và **VS Code**. Giải nén zip, `File > Open Folder` chọn thư mục `gia-dinh-so`.
2. Mở Terminal (`Ctrl+\``) và chạy: `npm install`
3. Sao chép `.env.example` thành `.env.local`, điền các khóa (xem mục B). Để trống `NEXT_PUBLIC_APP_URL` hoặc đặt `http://localhost:3000`.
4. `npm run dev`, mở http://localhost:3000 và http://localhost:3000/api/health (mọi mục phải `ok: true`).

## B. Supabase (làm 1 lần)
1. Tạo project. **SQL Editor > New query**, dán toàn bộ `supabase/schema.sql`, Run (dự án mới).
   **Dự án cũ đang chạy:** chỉ cần chạy `supabase/migration_v3.sql` (sửa bộ đếm lượt, thêm hàm thanh toán và chỉ mục tăng tốc).
2. **Project Settings > API:** lấy URL, anon key, service_role key.
3. **Authentication > URL Configuration** (sửa lỗi email xác nhận trỏ về localhost):
   - **Site URL** = địa chỉ thật của app, ví dụ `https://ten-app.vercel.app`
   - **Redirect URLs** thêm: `https://ten-app.vercel.app/**` và `http://localhost:3000/**`
   Supabase chỉ cho phép chuyển hướng tới địa chỉ nằm trong danh sách này. Mã app tự dùng đúng địa chỉ, nhưng nếu Site URL vẫn là localhost thì email vẫn sai.
4. Chạy `npm run seed:genz` một lần để nạp từ điển (không bắt buộc).

## C. Khóa AI và PayOS
- **Gemini:** tạo khóa ở https://aistudio.google.com/apikey, dán vào `GEMINI_API_KEY`. Không cần điền `GEMINI_MODEL`.
- **PayOS:** `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` (my.payos.vn > Kênh thanh toán). Webhook = `https://ten-app.vercel.app/api/payos/webhook`.

## D. Đưa lên Vercel
1. Đẩy mã lên GitHub: `git init && git add -A && git commit -m "v3" && git branch -M main && git remote add origin <URL-repo> && git push -u origin main`
2. https://vercel.com/new > Import repo > thêm các biến môi trường của `.env.example` (không điền `NEXT_PUBLIC_APP_URL` nếu dùng tên miền vercel.app; chỉ điền khi có tên miền riêng).
3. Vào **Settings > Environment Variables**, bật **Automatically expose System Environment Variables** (để app biết địa chỉ Vercel). Deploy.
4. Mở `/api/health`, rồi làm theo mục E.

## E. Danh sách kiểm tra sau khi deploy
- Dùng 1 lượt AI: thanh trên cùng giảm từ 5 xuống 4 ngay lập tức, tải lại trang vẫn 4.
- 2 thiết bị cùng gia đình: Lật bài chạy mượt, không báo "đã có ván" hay "chưa đến lượt".
- Vòng quay (có ≥ 3 thành viên): quay xong hiện hộp chúc mừng và thông báo ở mọi máy.
- Cây ký ức: mở tab nhanh; bấm một năm để xem 8 câu chuyện, "Xem thêm" để tải tiếp.
- Nút "Trò chuyện cùng cháu" ở góc phải dưới. Thêm nhắc nhở "Uống thuốc" 5 phút sau, chờ đến giờ: cháu tự nhắc trong khung chat.
- Thanh toán 39.000đ: quét QR, app tự mở khóa PRO trong vài giây.

## F. Lưu ý vận hành
- Mỗi tin nhắn với Cháu Ngoan tính 1 lượt dùng thử (5 lượt chung của gia đình). Gói PRO không giới hạn. Muốn đổi, sửa `consumeUsage` trong `src/app/api/ai/chat/route.ts`.
- Tin nhắn khẩn cấp (đau ngực, khó thở...) được trả lời cố định, miễn phí, không qua AI.
- Tài khoản PRO gắn với **gia đình** (mã gia đình), không phải từng người.
- Vercel Hobby chỉ dành cho dự án phi thương mại: khi thu tiền hãy dùng gói Pro.
