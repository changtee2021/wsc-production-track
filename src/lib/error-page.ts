// Dependency-free HTML error page used by src/server.ts wrapper.
// Must NOT import any app code — same module-init failure that triggered the
// wrapper could also break the error page.
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>เกิดข้อผิดพลาดของเซิร์ฟเวอร์</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Thai", sans-serif;
         margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #f8fafc; color: #0f172a; padding: 24px; }
  @media (prefers-color-scheme: dark) { body { background: #0f172a; color: #f1f5f9; } .card { background: #1e293b; } }
  .card { max-width: 480px; width: 100%; background: #fff; border-radius: 12px;
          padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); text-align: center; }
  h1 { margin: 0 0 8px; font-size: 22px; }
  p { margin: 0 0 24px; opacity: 0.7; line-height: 1.5; }
  .actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  button, a.btn { font: inherit; padding: 10px 18px; border-radius: 8px; cursor: pointer;
                  border: 1px solid currentColor; background: transparent; color: inherit;
                  text-decoration: none; display: inline-block; }
  button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
</style>
</head>
<body>
  <div class="card">
    <h1>เซิร์ฟเวอร์เกิดข้อผิดพลาด</h1>
    <p>ขออภัย เกิดปัญหาในการแสดงผลหน้านี้ ทีมงานได้รับแจ้งแล้ว กรุณาลองใหม่อีกครั้ง</p>
    <div class="actions">
      <button class="primary" onclick="location.reload()">โหลดใหม่</button>
      <a class="btn" href="/">กลับหน้าหลัก</a>
    </div>
  </div>
</body>
</html>`;
}
