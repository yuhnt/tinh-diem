# tinh-diem — Bida · Bảng điểm

Web app tính điểm bida, chỉ có frontend, dựng từ design `Bida Scoreboard v2`: Pool đối kháng, Đánh đền 3 người, Xì dách, Lịch sử, 3 màu bàn (nỉ xanh / navy / đỏ rượu), VI/EN.

## Chạy

```bash
npm install
npm run dev        # dev server
npm run build      # build production vào dist/
npm run preview    # xem bản build tại http://localhost:4173
```

Khi deploy, đặt `SITE_URL` để build sinh thêm canonical, `og:url`, `og:image` tuyệt đối, `sitemap.xml` và `robots.txt` có trỏ tới sitemap:

```bash
SITE_URL=https://ten-mien-cua-ban.vn npm run build
```

## SEO và tốc độ

- **Prerender**: trang chủ được render sẵn thành HTML lúc build (`scripts/prerender.mjs`), Preact chỉ hydrate. Crawler đọc được nội dung mà không cần chạy JS.
- **Meta**: title/description tiếng Việt, Open Graph + Twitter card, JSON-LD `WebApplication`, `lang` của `<html>` đổi theo ngôn ngữ đang chọn.
- **Nhẹ**: Preact, JS ~16 KB gzip. CSS được inline vào HTML nên không có request CSS chặn render.
- **Font tự host** (`@fontsource`), có `unicode-range` nên chỉ tải subset cần dùng, preload 2 file woff2 cho lần hiển thị đầu, `font-display: swap`.
- **PWA / offline**: service worker precache app shell, cài được lên màn hình chính, dùng được khi mạng ở quán chập chờn.
- **Lưu trạng thái**: trận đang chơi và lịch sử nằm trong `localStorage`.

`?v=felt|navy|wine` trên URL dùng để chọn trước màu bàn.

Icon PNG và ảnh OG được sinh bằng `node scripts/gen-icons.mjs`, không cần thư viện ngoài.
