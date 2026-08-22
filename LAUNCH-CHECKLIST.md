# Launch Checklist — Monetization v2 (Free / Week Pass $2 / Pro $5 / Founding $3)

Code đã xong và build pass. Các bước dưới đây là việc **bắt buộc làm tay** trước khi deploy, theo đúng thứ tự.

## 1. Chạy migration Supabase

Mở Supabase Dashboard → SQL Editor → paste toàn bộ nội dung
`supabase/migrations/0002_monetization.sql` → Run.

Migration thêm: cột plan cho `users`, bảng `extractions` (usage log), bảng `email_log`,
unique index chống double-credit webhook, và 2 function `consume_page` / `refund_page`.

An toàn với user hiện có: credits cũ giữ nguyên và được ưu tiên tiêu trước quota free.

## 2. Tạo 4 price mới trên Paddle

Paddle Dashboard → Catalog → Products/Prices:

| Price | Loại | Env var (Vercel) |
|---|---|---|
| Week Pass — $2 | One-time | `NEXT_PUBLIC_PADDLE_PRICE_ID_WEEK_PASS` |
| Pro Monthly — $5/month | Subscription | `NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTHLY` |
| Pro Yearly — $39/year | Subscription | `NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEARLY` |
| Founding Member — $3/month | Subscription | `NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_FOUNDING` |

Giá 50-credit pack cũ (`NEXT_PUBLIC_PADDLE_PRICE_ID`) giữ nguyên.

**Quan trọng — webhook events:** Paddle Dashboard → Developer Tools → Notifications →
destination hiện tại: bật thêm các event
`subscription.activated`, `subscription.updated`, `subscription.canceled`,
`subscription.paused`, `subscription.past_due`
(hiện tại chắc chỉ có `transaction.completed`).

## 3. Setup Resend (email drip)

1. Đăng ký resend.com (free 100 email/ngày — quá đủ).
2. Verify domain `invoicetodata.com` (thêm DNS records họ đưa — SPF + DKIM, quyết định
   việc vào inbox hay spam).
3. Set env vars:
   - `RESEND_API_KEY` = key từ Resend
   - `EMAIL_FROM` = `Kivora - CEO of Invoicetodata <kivora@invoicetodata.com>`
   - `EMAIL_REPLY_TO` = `kivora.lynx@gmail.com` (mặc định trong code đã là địa chỉ này;
     người nhận bấm Reply là thư về Gmail)

**Lưu ý deliverability:** KHÔNG thể để FROM là `@gmail.com` — DMARC của Gmail sẽ đánh
spam mọi email giả sender gmail gửi qua dịch vụ thứ ba. FROM phải thuộc domain đã verify
(`invoicetodata.com`); Gmail cá nhân dùng làm Reply-To. Email viết dạng thư cá nhân
plain-text từ founder (không button, không ảnh, ít link) — đúng công thức tránh spam folder.

Chưa set thì drip tự skip, không crash cron — có thể deploy trước, setup email sau.

Drip chỉ gửi cho **user đăng ký trong 30 ngày gần nhất** (day 0 welcome / day 2 case study /
day 5 founding offer), tối đa 50 email/ngày, có unsubscribe link ký HMAC. User cũ hơn 30 ngày
không bị email tự động — nhóm đó nên email tay (xem mục 6).

## 4. Env vars mới trên Vercel

```
NEXT_PUBLIC_PADDLE_PRICE_ID_WEEK_PASS=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTHLY=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEARLY=pri_xxx
NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_FOUNDING=pri_xxx
RESEND_API_KEY=re_xxx            (bước 3)
EMAIL_FROM=InvoiceToData <hello@invoicetodata.com>
```

## 5. Verify sau khi deploy

1. **Tường phí đã kín:** gọi `curl -X POST https://www.invoicetodata.com/api/extract` 2 lần
   không cookie/auth với 1 file PDF — lần 2 (hoặc lần 4 cùng IP trong ngày) phải trả 402
   `{"reason":"guest_limit"}`. Trước đây endpoint này mở hoàn toàn.
2. **Sandbox checkout:** đặt `NEXT_PUBLIC_PADDLE_ENV=sandbox` trên preview deploy, mua thử
   Week Pass → check `users.plan='week_pass'`, `plan_expires_at` = +7 ngày.
3. **Subscription:** mua thử Pro sandbox → `users.plan='pro'`; với Founding price →
   `founding_member=true` và counter trên /pricing giảm.
4. **Webhook retry:** trong Paddle dashboard bấm re-send một notification → credits/plan
   KHÔNG được cộng đôi (check bảng `transactions` chỉ có 1 dòng).
5. **Watermark:** convert bằng account free → file Excel có dòng cuối
   "Converted free at invoicetodata.com…"; account Pro/Week Pass → không có.
6. **QuickBooks export:** account free bấm nút → modal upsell; account trả phí → tải CSV
   3 cột Date/Description/Amount.

## 6. Săn power user hiện có (làm tay, tuần đầu)

Sau vài ngày có data trong `extractions`, chạy trên Supabase SQL Editor:

```sql
select u.id, au.email, count(*) as conversions
from extractions e
join users u on u.id = e.user_id
join auth.users au on au.id = u.id
where e.status = 'success'
group by u.id, au.email
having count(*) >= 3
order by conversions desc;
```

Email tay từng người: tặng 1 tháng Pro miễn phí đổi lấy 15 phút feedback.
Đây là nguồn sub đầu tiên dễ nhất.

## Ghi chú kiến trúc

- `/api/extract` và `/api/gsheet` giờ enforce quota server-side (atomic, qua RPC
  `consume_page`), rate limit 6 req/phút/IP và 10 req/phút/user, log mọi extraction.
  AI lỗi thì tự refund quota.
- `POST /api/credits` thành no-op (client cũ cache JS không bị trừ tiền 2 lần).
- Guest: 1 lần miễn phí theo cookie + tối đa 3/ngày theo IP (chặn farm incognito).
- Free user: 3 trang/30 ngày, tự reset. Pro: 200 trang/30 ngày. Week Pass: soft cap
  300 trang/7 ngày (bảo vệ chi phí Claude API).
- Email drip chạy trong master cron hằng ngày (1h UTC), không cần cron mới trên Vercel.
