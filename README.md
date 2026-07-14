# Xưởng Phim AI — Google Flow (Veo) video runner skill

Skill cho Hermes Agent: quy trình + runner CDP để gen video hàng loạt bằng Google Flow (Veo), viết prompt theo pattern quảng cáo kinh điển, QC bằng vision/agy.

## Nội dung

- `SKILL.md` — quy trình job (Phần A–H), blacklist, recipe gen video/nhân vật, bảng lệnh runner, cách né lỗi.
- `scripts/flow-*.js` — bộ runner Node chạy qua Chrome DevTools Protocol (CDP), 0 token/bước.
- `references/*.md` — phân tích 5 ad kinh điển + ghi chú hậu kỳ.

## Cài trên máy mới

### 1. Đặt skill vào Hermes

Clone repo vào thư mục skill của Hermes (giữ tên thư mục `xuong-phim-ai-flow-video`):

```bash
git clone <repo-url> "$HOME/.hermes/skills/creative/xuong-phim-ai-flow-video"
# Windows (Hermes desktop): C:\Users\<user>\AppData\Local\hermes\skills\creative\xuong-phim-ai-flow-video
```

### 2. Cài dependency runner

Runner cần Node ≥18 + `playwright-core` (không commit trong repo):

```bash
cd <skill_dir>/scripts
npm install
```

### 3. Dựng Chrome CDP (bắt buộc để runner kết nối)

Runner nối vào Chrome mở sẵn ở **CDP port 9666**, dùng một profile ĐÃ ĐĂNG NHẬP Google Flow:

```bash
# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --remote-debugging-port=9666 \
  --user-data-dir="C:\Users\<user>\AppData\Local\chrome-flow-cdp" \
  --no-first-run --no-default-browser-check \
  "https://labs.google/fx/vi/tools/flow/project/<projectId>"
```

Lần đầu: đăng nhập Google trong cửa sổ này. Profile lưu login cho các lần sau.

### 4. Chạy thử

```bash
cd <skill_dir>/scripts
node flow-config.js <projectId> "Lower Priority" 16:9 x2 8   # set config, verify CHIP_AFTER
# soạn scenes.json rồi:
node flow-job.js scenes.json <outDir>                         # fire → poll → download
```

## Yêu cầu môi trường

| Thứ | Dùng cho | Bắt buộc? |
|---|---|---|
| Node ≥18 + `npm install` | chạy runner | ✅ |
| Chrome + CDP 9666 + profile login Flow | mọi thao tác Flow | ✅ |
| Tài khoản Google Flow (Veo) | gen video | ✅ |
| `ffmpeg`/`ffprobe` | ghép clip local, QC | nên có |
| `agy` (Gemini CLI) | QC thoại/giọng | tuỳ chọn (vision_analyze thay được cho hình) |

## Lưu ý

- `scripts/flow-voice.js` và `flow-mytab.js` chứa URL nhân vật ví dụ (project id cũ) — sửa lại theo nhân vật của bạn khi dùng tính năng giọng.
- CDP port 9666 và tên profile Chrome là quy ước; đổi được nhưng phải sửa `CDP` trong `scripts/flow-lib.js` cho khớp.
- Xem `SKILL.md` Phần F (môi trường & lỗi) + Phần G (runner) để biết chi tiết.
