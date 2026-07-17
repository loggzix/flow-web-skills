---
name: xuong-phim-ai-flow-video
description: "Use when Long asks to làm/gen video, gen clip, render video, job xưởng phim, làm clip cho khách, or gives a Jobs/<Tên> path to run end-to-end Google Flow (Veo) video generation via bundled CDP runner scripts, prompt recipe, and ad-writing patterns."
version: 1.0.0
author: Long (loggzix)
license: MIT
platforms: [windows]
category: creative
metadata:
  hermes:
    tags: [video, google-flow, veo, cdp, playwright, content-creation]
    related_skills: [darwin-skill, ascii-video, youtube-content]
---

# Skill: Xưởng Phim AI — Làm video bằng Google Flow (Veo)

**KHI NÀO DÙNG:** Long bảo "làm video", "gen video", "job xưởng phim", "làm clip cho khách", hoặc đưa 1 path `C:\Content-Creator-Project\Jobs\<Tên>`. Đọc skill này TRƯỚC khi thao tác.

**NGUYÊN TẮC TỐI THƯỢNG:** Làm theo TÀI LIỆU GỐC của job, KHÔNG làm theo trí nhớ. Tốc độ KHÔNG được đánh đổi bằng việc bỏ cấu trúc prompt. Skill này tự chứa đủ recipe — không cần tra MEMORY.md.

**⚡ CÓ BỘ RUNNER .JS (Phần G):** thao tác lặp (set config, fire nhiều cảnh, đếm trạng thái, tải hàng loạt) đã có script node chạy thẳng qua CDP — 0 token/bước, nhanh hơn MCP nhiều lần. Ưu tiên runner; việc chưa có runner (gắn frame/ingredient, tạo nhân vật, xử lý ảnh) → MCP hoặc script one-off theo mẫu job Kệ v4 (Phần G).

---

## 📋 TL;DR — TRA NHANH (đọc chi tiết ở phần tương ứng)

### 🔍 Keyword Index (Ctrl+F → tìm section)
`fire` →§B4,§G · `config` →§B1,BƯỚC5 · `chip` →§B1,§G · `dialog` `picker` →§B2 · `ingredient` `frame` →§G · `nhân vật` `character` →§C · `prompt` →BƯỚC3,§H · `scenes.json` →§G · `download` `manifest` →§D,§G · `workflowId` →§G · `throttle` →§G · `403` `reCAPTCHA` →§B4 · `ffmpeg` `concat` →§D · `agy` `vision` `QC` →§F · `template` `quảng cáo` →§H5 · `checkpoint` `tín dụng` →§B1,BƯỚC6 · `mixed` →§G,TL;DR

### Quy trình job chuẩn
`BƯỚC 0` Đọc tài liệu gốc → `1` Xử lý ảnh khách → `2` Tạo nhân vật (nếu có MC) → `3` Prompt (DÁN NGUYÊN VĂN, format tiền tố) → `4` Logo/chữ → `5` Config Flow → `6` Fire + verify + tải → `7` Bàn giao

### Runner nhanh (text-to-video thuần)
```
node flow-config.js <projectId>          # set config, verify CHIP_AFTER
node flow-job.js <scenes.json> <outDir>  # fire → poll → download trọn job
```

### Cây quyết định nhanh
| Tình huống | Hành động |
|---|---|
| Text-to-video thuần | `flow-job.js` (tự fire + poll + download) |
| Có frame/ingredient | `flow-fire-frame.js` (Khung hình) hoặc MCP |
| Có nhân vật (MC) | `flow-fire-char.js` hoặc MCP |
| Mixed mode (frame + MC) | 🔴 CHECKPOINT nhóm → `flow-job-mixed.js` (1 lệnh: frame → char → poll → download) |
| Model có phí | 🔴 DỪNG — checkpoint tín dụng |
| 403/reCAPTCHA | 🛑 STOP CỨNG — báo Long |
| Viết mới prompts.md quảng cáo | Áp Phần H (5 pattern + 10 checklist) |
| Config chip còn 🍌 | Chuyển tab Video trước khi fire |
| Ghép clip | ffmpeg concat local, KHÔNG dùng Cảnh web |

### Map phần skill
| Phần | Nội dung | Khi nào đọc |
|---|---|---|
| A | Quy trình 7 bước | Mọi job |
| B | Recipe gen video (config, gen, dialog, API, fail) | Khi fire/config |
| C | Nhân vật (tạo, giọng, gắn) | Job có MC |
| D | Tải video, scene editor, ghép ffmpeg | Sau render |
| E | Upload ảnh, quản lý project | Khi cần upload/đổi tên |
| F | Môi trường, CDP, gỡ lỗi | Khi gặp lỗi |
| G | Runner scripts (bảng lệnh, kỹ thuật) | Mọi job (ưu tiên runner) |
| H | Viết prompts.md quảng cáo | Job mới chưa có prompts.md |

---

## ⛔ CẤM LÀM (blacklist — rà trước mỗi job, vi phạm là hỏng thật đã xảy ra)

| # | Cấm | Vì sao | Làm thay |
|---|---|---|---|
| 1 | Rút gọn / tự chế lại prompt khi job đã có `prompts.md` | Clip lệch giáo trình, Long phát hiện ngay (2026-07-04) | DÁN NGUYÊN VĂN |
| 2 | Dùng thẳng ảnh khách làm frame/ref | Mờ, dính logo → clip xấu | Xử lý + tạo ảnh MỚI (BƯỚC 1) |
| 3 | Cho Veo sinh chữ tiếng Việt có dấu | Veo bịa dấu, chữ méo | Overlay CapCut; trong cảnh chỉ chữ Anh/số ngắn |
| 4 | Ngồi chờ render xong cảnh này mới fire cảnh kế | Phí 2-3 phút/cảnh vô ích | Fire liên tiếp hết, làm việc khác lúc render |
| 5 | Fire VIDEO khi chip config còn `🍌` | Ra ẢNH chứ không phải video | Verify chip / `expectConfig` trước mọi lần Tạo. Ngoại lệ: gen ẢNH chủ đích (BƯỚC 1 frame lô) thì `🍌` mới là chip đúng |
| 6 | Đếm/tải "top N grid" khi có job khác render song song | Dính clip job khác, sai tên | Map theo `workflowId` từ fire-report; thiếu id → ngoại lệ #15: prompt-match trong vùng tile mới (Phần G), không bó tay |
| 7 | Thoát trang nhân vật mà chưa bấm `Xong` | MẤT nhân vật vừa tạo | Luôn bấm Xong để commit |
| 8 | Gen bằng model mất phí mà chưa hỏi Long | Đốt tín dụng | 🔴 checkpoint tín dụng (Phần B) |
| 9 | Bật nút `Tác nhân` (Agent mode) | Thanh config biến mất, gãy selector | GIỮ TẮT |
| 10 | `.click()` DOM trong evaluate / `mouse.click` theo tọa độ lên item dialog / JS set `.value` vào input | React không nhận — click tọa độ lên dialog add_2 fail im lặng (2026-07-06) | Playwright `locator.click()` trusted / gõ phím thật |
| 11 | Gán prompt trực tiếp qua DOM `.textContent` / `.innerHTML` vào Slate Editor | Trạng thái React nội bộ của Slate không nhận diện, nút Tạo vẫn bị disable/mờ | BẮT BUỘC focus ô editor trước, sau đó lấy React `editor` từ `__reactProps*`, gán `editor.selection = null`, gọi `editor.insertText(promptText)` và `editor.onChange()`. Không dùng các lệnh DOM thô hoặc execCommand thiếu sync |
| 12 | Tự tắt Chrome automation | Mất CDP + phiên login | Hỏi Long trước (Phần F) |
| 12 | Tạo project rác khi test | Bừa workspace Flow | Test Project có sẵn (Phần F) |
| 13 | Viết prompt văn xuôi liền một đoạn — không tiền tố, không xuống dòng | Long bắt lỗi ngay (2026-07-06, MenhSo.AI) | Mỗi thành phần 1 dòng + tiền tố `Time:`/... (BƯỚC 3) |
| 14 | Re-fire 1 cảnh quá 2 lần, hoặc re-fire khi đang 403/reCAPTCHA | Đốt slot render, nuôi bão 403 | Counter per-cảnh, chạm 2 → loại; 403 → STOP báo Long (Phần B) |
| 15 | Map cảnh↔clip bằng prompt-match TOÀN grid khi project từng gen đợt cũ | prompts.md dán nguyên văn → prompt trùng 100% giữa các đợt → dính clip cũ | workflowId từ fire response; thiếu id → prompt-match CHỈ trong vùng tile mới (Phần G) |
| 16 | Polling status bị kẹt vô thời hạn | Web Flow khi render xong ngắt gửi request check mạng → script nghe network bị treo | flow-status.js tự động thoát sớm sau 8s không có poll mới (NO_POLLS_EARLY_FALLBACK) và nhảy sang quét grid |
| 17 | Gán prompt trực tiếp qua DOM `.textContent` / `.innerHTML` vào Slate Editor | Trạng thái React nội bộ của Slate không nhận diện, nút Tạo vẫn bị disable/mờ | BẮT BUỘC focus ô editor trước, sau đó lấy React `editor` từ `__reactProps*`, gán `editor.selection = null`, gọi `editor.insertText(promptText)` và `editor.onChange()`. Không dùng các lệnh DOM thô hoặc execCommand thiếu sync |

---

# PHẦN A — QUY TRÌNH LÀM JOB {#phan-a} (chạy theo thứ tự)

## BƯỚC 0 — ĐỌC TÀI LIỆU GỐC (bắt buộc, mỗi job)
Đọc theo thứ tự, đừng bỏ qua vì "nhớ rồi":
1. `C:\Content-Creator-Project\CLAUDE.md` — quy ước + bài học mọi job.
2. `Jobs/<Tên>/prompts.md` — prompt chuẩn (DÁN NGUYÊN VĂN vào Flow).
3. `Jobs/<Tên>/ghi_chu_san_xuat.md` — ảnh gắn/first-frame theo cảnh, overlay, hậu kỳ (KHÔNG copy vào Flow).
4. `Jobs/<Tên>/Resources/` — ảnh khách + ảnh tự tạo.
5. Cần chi tiết giáo trình: `C:\Content-Creator-Project\Giáo Trình Khóa Học Làm Video AI.md` (~15MB → BẮT BUỘC đọc offset/grep, đừng đọc cả file).

## BƯỚC 1 — XỬ LÝ ẢNH KHÁCH (không xài thẳng ảnh khách)
- Ảnh khách thường mờ / dính logo / screenshot điện thoại → KHÔNG dùng trực tiếp làm frame Bắt đầu.
- Mờ/logo/watermark → Flow (Nano Banana 2): "làm nét, xóa logo/watermark, làm sạch" → **tạo ảnh MỚI đẹp hơn tương tự** (ảnh khách chỉ làm ref). Ảnh mới = frame Bắt đầu.
- **Recipe gen frame HÀNG LOẠT** (verify job Kệ v4, 2026-07-06):
  1. Upload ảnh khách vào project (`input[type=file]`; alt trong dialog = TÊN FILE).
  2. **Auto:** `node flow-gen-frames.js frames.json` — tự switch image mode, attach ref, fire prompt, collect workflowIds. Input: `{project, scenes: [{id, refImage: "ten_file.jpg", prompt: "mô tả frame đích, không chữ không watermark"}]}`.
  3. QC: download → chọn bản đẹp → đặt tên `*_final.jpg` upload lại làm frame/ingredient.
- **Map ảnh↔cảnh:** response `batchGenerateImages` có `media[].workflowId` + `requestData.promptInputs[0].textInput` = prompt GỐC + `fifeUrl`. ⚠️ `generatedImage.prompt` và alt tile bị DỊCH sang tiếng Anh — map bằng `textInput` hoặc edit-page, ĐỪNG map bằng alt.

## BƯỚC 2 — NHÂN VẬT (nếu job có MC/người) — recipe đầy đủ Phần C
- Prompt tạo nhân vật cho **nền TRẮNG** (studio trắng trơn) → Flow dễ tách khi làm Thành phần.
- Điền đủ: Tên → Mô tả tính cách → Chọn/Custom giọng → **BẮT BUỘC bấm "Xong"** (thoát ngang là mất).
- Tái dùng nhân vật làm ingredient để giữ mặt nhất quán qua các cảnh.

## BƯỚC 3 — PROMPT (điều Long nhấn mạnh nhất)
- **DÁN NGUYÊN VĂN prompt chuẩn từ `prompts.md`.** TUYỆT ĐỐI không rút gọn / tự chế lại để chạy nhanh. (Lỗi đã mắc 2026-07-04 — Long phát hiện ngay.)
- **🔴 XUNG ĐỘT prompts.md ↔ model:** prompts.md yêu cầu thời lượng model FREE không có (vd 10s mà Veo 3.1 chỉ tới 8s) → **DỪNG hỏi Long**, KHÔNG tự fire 8s. Phương án: Omni Flash (10s, mất phí → checkpoint tín dụng) hay chia lại cảnh 8s. "Dán nguyên văn" áp cho NỘI DUNG, không ép được ràng buộc model.
- **Cấu trúc Câu Lệnh Key (đủ 9 thành phần):** Time → Camera Angle → Subject → Action → Location → Lighting → Visual Style → (nếu có thoại) Line (8s ≈ 25–30 chữ) → Voice Tone.
- **⭐ FORMAT BẮT BUỘC (Long chốt 2026-07-06): mỗi thành phần 1 DÒNG riêng, tiền tố nhãn + hai chấm, hết ý là XUỐNG DÒNG. KHÔNG văn xuôi liền đoạn.** Áp cho MỌI prompt tự viết (prompts.md mới, scenes.json, prompt vá cảnh). Mẫu:
  ```
  Time: giữa trưa nắng gắt.
  Camera: top-down drone shot hạ thấp dần.
  Subject: chợ nổi trên sông.
  Action: ghe thuyền chở trái cây tấp nập, người mua kẻ bán trao đổi giữa các thuyền.
  Location: chợ nổi miền Tây sông nước.
  Lighting: nắng trưa chói, màu sắc trái cây rực rỡ.
  Visual Style: cinematic, bão hòa màu cao, sống động. No dialogue.
  Line: "..." (nguyên văn thoại — chỉ khi có thoại; không thoại → "No dialogue" cuối Visual Style)
  Voice Tone: mô tả giọng + nhạc (chỉ khi có thoại)
  ```
  Trong `scenes.json` giữ nguyên `\n` giữa các dòng. (Lỗi đã mắc 2026-07-06: MenhSo.AI viết liền đoạn — Long bắt.)
- Nhân vật có ảnh ref → Subject ghi gọn. Trang phục/bối cảnh lặp lại → copy y nguyên giữa các cảnh.
- Job có thoại → mục GIỌNG NÓI: gợi ý 3–4 giọng Veo + 1 giọng ⭐ chốt.
- **VIẾT MỚI prompts.md cho job quảng cáo → áp PHẦN H.**

## BƯỚC 4 — BÀI HỌC LOGO / CHỮ IN
- Text-to-video / thả ảnh ref để Veo tự sinh → AI bịa quần áo/logo méo.
- Cách đúng = image-to-video từ KHUNG ĐẦU cố định: (1) ảnh logo 1:1 nền trắng nét; (2) ảnh tĩnh từng phân cảnh (Nano Banana, ảnh thật + logo 1:1); (3) ảnh tĩnh làm first frame → animate.
- Chữ Việt có dấu → overlay CapCut. Số/tiếng Anh ngắn Flow sinh được.

## BƯỚC 5 — CONFIG FLOW
- **Config mặc định của Long:** Thành phần · 9:16 · x2 · Veo 3.1 - Lite [Lower Priority] (0 tín dụng) · 8s. TRỪ khi brief job yêu cầu khác (quảng cáo ngang → 16:9). Bám brief trước, mặc định sau.
- **Lệnh nhanh:** `node flow-config.js <projectId>` → verify `CHIP_AFTER:` khớp expectConfig.
- B-roll = Khung hình (frame đầu = ảnh đã xử lý). MC/talking = Thành phần + nhân vật + ảnh HERO.
- **⚠️ Job TRỘN B-roll + MC trong cùng project → GOM CẢNH THEO CHẾ ĐỘ, đừng đan xen.** Fire hết nhóm Khung hình (`flow-fire-frame.js`) → real-click đổi tab Thành phần → verify chip → fire nhóm MC (`flow-fire-char.js`). Mỗi lô fire chỉ 1 chế độ; quên đổi tab → cảnh MC rơi về text-to-video, MẤT mặt nhân vật.
- **🔴 CHECKPOINT · MIXED MODE:** job trộn frame + char → báo Long phương án nhóm (cảnh nào Khung hình, cảnh nào Thành phần) trước khi fire.
- **⚠️ ROLLBACK MIXED PARTIAL:** `flow-job-mixed.js` phase 1 (frame) OK nhưng phase 2 (char) fail → clip frame ĐÃ fire VẪN render bình thường. Đọc `fire-frame-report.json` + `fire-char-report.json` trong outDir xem cảnh nào thiếu → soạn lại spec chỉ chứa cảnh char fail → chạy `flow-fire-char.js` riêng → `flow-download.js` tải hết.
- **⚠️ Project mới/lạ hay dính mode 🍌 (image):** chip `🍌 ... crop... xN` = bấm Tạo ra ẢNH. LUÔN verify chip trước khi fire.

## BƯỚC 6 — GEN ĐỒNG THỜI + VERIFY + TẢI VỀ
- **🔴 CHECKPOINT · FIRST FIRE:** job mới/loại mới lần đầu → báo Long tóm tắt (số cảnh, config, model, tín dụng dự kiến) trước khi fire. Job training/test → bỏ qua checkpoint này.
- **⭐ LUẬT LONG: FIRE TẤT CẢ CẢNH LIÊN TIẾP, KHÔNG CHỜ.** Render là việc của server.
- **Lệnh nhanh (text-to-video):** `node flow-job.js <scenes.json> <outDir>` — tự fire → poll → download.
- Cảnh frame/ingredient → `flow-fire-char.js` hoặc MCP (giữ nhịp fire liên tiếp).
- Fail silent → `flow-status.js` đếm tile; cảnh ≥2 take → OK; 0-1 take → re-fire (runner tự xử). Chi tiết: Phần B §B4.
- Tải: `flow-download.js` về `Jobs/<Tên>/output/` + manifest.
- **🔴 CHECKPOINT · GHI ĐÈ OUTPUT:** output đích đã có .mp4 đợt trước → KHÔNG ghi đè/xóa. Tạo `output_<mô tả>/` mới hoặc hỏi Long.

## BƯỚC 7 — BÀN GIAO
- Output lưu `output/` + `README_output.md` map file↔cảnh. Nhắc hậu kỳ CapCut: dub/voice theo Line, overlay chữ Việt + logo, color grading, cắt theo beat.
- **Checklist bàn giao:**
  1. Đếm mp4 = số cảnh × multiplier (x2 = 2 clip/cảnh) — thiếu → re-fire hoặc download bù.
  2. `ffprobe -v error -show_entries format=duration` mỗi file — đảm bảo đủ 8s (hoặc 4/6/10s tùy config).
  3. `README_output.md` có map file↔cảnh + prompt gốc + config + ngày gen.
  4. Báo Long: số clip, tổng thời lượng, model đã dùng, link/path output.

---

# PHẦN B — RECIPE GEN VIDEO {#phan-b}

### B1. CONFIG

## Chuyển sang chế độ Video
Chip config bottom bar (`🍌 model | crop | Nx`) → menu 2 tab đầu **Hình ảnh / Video** → chọn **Video**. Config đều là Radix `tablist`/`[role=tab]` → PHẢI real click Playwright (`locator.click()` trusted; `.click()` DOM trong evaluate KHÔNG ăn React).

## Các option config video
- **Chế độ:** `crop_free Khung hình` (frame đầu/cuối) vs `chrome_extension Thành phần` (ingredients). Text-to-video thuần chạy được cả hai.
- **Nhập Prompt cho Slate Editor (Vá lỗi React State 2026-07-17):** Tránh thay đổi `.textContent` hoặc `.innerHTML` trực tiếp vì React Slate.js sẽ bỏ qua cập nhật state khiến nút "Tạo" bị disable/mờ. Cách xử lý chuẩn:
  1. Click/Focus vào phần tử `[data-slate-editor=true]`.
  2. Lấy đối tượng React Fiber `editor` qua: `const editor = el[Object.keys(el).find(k => k.startsWith('__reactProps'))].children.props.node;`
  3. Reset selection: `editor.selection = null;`
  4. Thực hiện chèn text: `editor.insertText(promptText);`
  5. Đồng bộ state React: `editor.onChange();`
  6. Hoặc mô phỏng gõ phím thật bằng CDP: click tọa độ trung tâm editor, gửi tuần tự sự kiện `Input.dispatchKeyEvent` với type: `'char'` cho từng ký tự (gửi `\r` thay cho `\n` khi xuống dòng).
  7. **Vá lỗi Dropdown chặn Selection (2026-07-17):** Khi click nút `Thêm` / `Tạo cảnh`, dropdown menu của Radix (DropdownMenuContent) có thuộc tính focus-trap/pointer-events chặn selection của editor. Cần phải đóng dropdown hoàn toàn bằng cách trigger hàm của DropdownMenu Parent React Props: `fiber.memoizedProps.onOpenChange(false)` hoặc trigger click trực tiếp clickHandler của nút. Nếu editor bị mờ hẳn không cho type, trỏ Selection của window Selection về text node của editor bằng:
     ```javascript
     const el = document.querySelector("[data-slate-editor=true]");
     const textNode = el.querySelector("[data-slate-string=true]") || el.firstChild;
     const range = document.createRange();
     range.selectNodeContents(textNode);
     const sel = window.getSelection();
     sel.removeAllRanges();
     sel.addRange(range);
     editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: textNode.textContent.length } };
     editor.onChange();
     ```
- **Model** (dropdown `arrow_drop_down` → `[role=menuitem]`): Omni Flash · Veo 3.1 - Lite / Fast / Quality / Lite [Lower Priority]. Đều kèm audio.
- **Tỉ lệ:** 9:16 / 16:9. **Số lượng:** 1x–4x; **x2 = 2 edit id RIÊNG** = 2 request riêng/cảnh. **Thời lượng:** Omni Flash 4/6/8/10s; Veo 3.1 chỉ 4/6/8s.

## BẢNG GIÁ TÍN DỤNG (mức 1x, đo 2026-07-03)
| Model | 4s | 6s | 8s | 10s |
|---|---|---|---|---|
| Omni Flash | 7 | 10 | 12 | 15 |
| Veo 3.1 - Lite | 5 | 5 | 5 | — |
| Veo 3.1 - Fast | 10 | 10 | 10 | — |
| Veo 3.1 - Quality | 100 | 100 | 100 | — |
| Veo 3.1 - Lite [Lower Priority] | 0 | 0 | 0 | — |
- Chi phí = giá bảng × số lượng. **Lite [Lower Priority] = FREE mọi mức** (render chậm hơn ~50s). Quality = 100/clip.
- **🔴 CHECKPOINT · TIÊU TÍN DỤNG:** gen bằng model giá > 0 → DỪNG, báo Long tổng tín dụng (giá × số lượng × số cảnh), chờ duyệt mới fire.

### B2. GEN + DIALOG

## Gen → gõ prompt vào `[data-slate-editor]` (`keyboard.insertText`) → verify chip (includes từng token rời — Phần G) → nút `arrow_forward Tạo`. Prompt tự xóa sau submit. Render ~45-60s server-bound → submit xong sang cảnh kế NGAY.

## Chế độ KHUNG HÌNH (frame đầu/cuối)
- Bật: tab Video → tab `crop_free Khung hình`. Ô prompt hiện 2 slot **`Bắt đầu` ⇄ `Kết thúc`** (nút `swap_horiz` đảo).
- **ATTACH FRAME:** click slot → dialog media picker → **recipe dialog bên dưới**. Thiếu `Thêm vào câu lệnh` → gen rơi về text-to-video. Verify slot đầy = label biến mất thành thumbnail.
- **BẮT BUỘC có frame ĐẦU:** chỉ gắn Kết thúc → nút Tạo disabled → `swap_horiz` đưa về Bắt đầu.

## Chế độ THÀNH PHẦN (ingredient/ref)
- Nút `add_2 Tạo` mở picker (tab Nhân vật / Hình ảnh...). Attach theo recipe dialog. Nút `close Xoá câu lệnh` = clear cả prompt + ingredients.

## ⭐ DIALOG MEDIA PICKER (add_2 / slot Khung hình) — recipe chuẩn (vá 2026-07-06, job Kệ v4) {#dialog-picker}
- **Mọi click trong dialog = Playwright `locator.click()` trusted.** Click theo tọa độ (evaluate getBoundingClientRect + `mouse.click`) fail IM LẶNG trên React — đã mắc thật.
- **Dialog NHỚ tab lần mở trước** và **ô search `Tìm kiếm thành phần` CHỈ tìm trong tab hiện tại** → LUÔN click đúng tab (có verify) TRƯỚC rồi mới tìm item. Search match tên file có underscore (`ke_nen_trang` ra); gõ space thay underscore = không ra.
- **Pattern attach:** click tab → chờ `img[alt="<tên file>"]` (4s không thấy → fill search rồi chờ tiếp) → click item → poll chip/thumbnail trên prompt bar; **chưa có chip → bấm `Thêm vào câu lệnh`** (ảnh LUÔN cần; nhân vật thường tự gắn, có preview pane thì cũng phải bấm — poll chip làm chuẩn, đừng bấm thừa gây double).
- **Trùng tên item (vd 2 nhân vật cùng tên):** click có thể treo 30s dù ĐÃ select → poll chip trước; CHƯA có chip mới retry `{force:true}` + bấm `Thêm vào câu lệnh` (có chip rồi mà bấm nữa = double-attach).
- **Ingredient/frame bị CLEAR sau mỗi lần Tạo** → gắn lại trước từng cảnh; verify fire đầu bằng endpoint (bảng dưới).

### B3. API + VERIFY

## API endpoint theo chế độ (Bearer, cho runner)
- Text-to-video: `POST https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText`
- Frame đầu: `.../video:batchAsyncGenerateVideoStartImage` · đầu+cuối: `...StartAndEndImage` · ingredient: `...ReferenceImages`
- Poll: `.../video:batchCheckAsyncVideoGenerationStatus`, body `{"media":[{"name":"<mediaId>","projectId":"..."}]}`, response media[] có `workflowId` + `mediaMetadata.mediaTitle` (= prompt) + `createTime`. Hook `page.on('response')` lọc `batchAsyncGenerateVideo` để verify fire (đừng nhầm `batchCheckAsync...Status`).

### B4. FAIL HANDLING + FIRE ĐỒNG THỜI

## FAIL SILENT
Tải cao → lô fire có thể fail hẳn: không tile, không lỗi, chỉ thiếu trong grid. Phát hiện: đếm tile vs số cảnh fired (theo workflowId từng cảnh).
- **Cây quyết định khi phát hiện thiếu — xét TỪNG cảnh, đúng thứ tự:**
  1. Đợt fire có ≥1 phản hồi 403/reCAPTCHA → 🛑 STOP CỨNG (dòng dưới cùng), không xét tiếp.
  2. Cảnh còn **≥2 take dùng được** → CHẤP NHẬN thiếu, KHÔNG re-fire (đừng đốt slot cho đủ xN) — ghi rõ cảnh thiếu vào report/README.
  3. Cảnh chỉ còn **0-1 take dùng được** → re-fire cảnh đó (free, lần 2 thường ăn).
- **🛑 STOP · RE-FIRE QUÁ 2 LẦN:** cảnh re-fire 2 lần vẫn thiếu/FAILED → DỪNG cảnh đó, báo Long (cảnh nào, thử mấy lần, nghi vấn + phương án).
- **Counter PER-CẢNH:** ngưỡng 2 lần tính TỪNG cảnh (workflowId), không per-lô; cảnh chạm 2 → LOẠI khỏi lô re-fire kế.
- **🛑 STOP CỨNG · BÃO 403/reCAPTCHA:** gặp ≥1 phản hồi 403 trong đợt fire → DỪNG toàn bộ, KHÔNG re-fire (nuôi bão), báo Long chờ lắng.

## ⭐ Fire ĐỒNG THỜI nhiều cảnh (luật Long 2026-07-04)
- **LUẬT: fire TẤT CẢ cảnh LIÊN TIẾP**, không chờ render. Verify request `batchAsyncGenerateVideo` bắn → cảnh kế LUÔN.
- Fire hết → `flow-status.js` → re-fire thiếu → `flow-download.js`. Trong lúc render: làm việc khác.
- **Throttle + timing + workflowId mapping → xem Phần G** (đã fix trong runner, `flow-job` tự xử).

---

# PHẦN C — RECIPE NHÂN VẬT {#phan-c}

## Tạo
- Sidebar `accessibility_new Nhân vật` → `/project/<id>/characters`. Prompt phải có **nền TRẮNG**.
- 3 cách: (1) text vào `[data-slate-editor]` → 🍌 Nano Banana 2 → `arrow_forward Tạo`; (2) 6 mẫu sẵn; (3) từ ảnh (`Tải lên` / `Thêm từ dự án`).
- Sau Tạo: sang `/project/<id>/character/<charId>`, gen 3 biến thể (~15-30s). Endpoint `POST .../projects/{projectId}/flowMedia:batchGenerateImages`.

## Điền thông tin (trang chi tiết)
- **Tên:** `placeholder="Tên nhân vật"` → click → Ctrl+A → Delete → type → **Enter**. ⚠️ Tránh TRÙNG TÊN nhân vật đã có trong project (dialog attach ra 2 item cùng tên, click dễ treo).
- **Mô tả tính cách:** `placeholder="Mô tả tính cách..."` → click → type → Tab/blur.
- **⭐ BẮT BUỘC bấm `Xong`** mới commit — thoát ngang là MẤT.
- Xóa: `delete Xoá nhân vật` → confirm.
- **🔴 CHECKPOINT · XÓA NHÂN VẬT:** hỏi Long trước khi xóa — nhân vật có thể đang dùng ở job khác cùng project.

## Giọng nói
- `voice_selection Chọn giọng nói` → dialog. Cột trái = ~30 giọng gốc (giọng NGOẠI). Chọn → `Thêm vào nhân vật`.
- **Giọng Việt custom → CỘT PHẢI:** mô tả vào ô **Tuỳ chỉnh phong cách giọng nói** → hiện ô **Tên giọng nói** + `save Lưu giọng nói mới` → đặt tên → Lưu → giọng custom lên đầu list → `Thêm vào nhân vật`. Có **Xem trước** + **Hội thoại mẫu** (max 120 ký tự).
- **⚠️ Sau `Lưu giọng nói mới` UI CHẬM:** nút `Thêm vào nhân vật` render trễ 10-20s → POLL chờ nút rồi mới bấm, đừng timeout sớm rồi bỏ (đã mắc 2026-07-06 — giọng lưu OK nhưng suýt không gắn).
- Tự động hóa: `flow-voice.js` (Phần G).

## 30 GIỌNG TEMPLATE GỐC (tra nhanh)
- NỮ: Achernar · Aoede · Autonoe · Callirrhoe · Despina · Erinome · Gacrux · Kore · Laomedeia · Leda · Sulafat · Vindemiatrix · Zephyr. NAM: Achird · Algenib · Algieba · Alnilam · Charon · Enceladus · Fenrir · Iapetus · Orus · Puck · Rasalgethi · Sadachbia · Sadaltager · Schedar · Umbriel · Zubenelgenubi. Khác: Pulcherrima.
- Map nhanh: nữ trẻ vui → Leda/Laomedeia/Autonoe/Zephyr; nữ ấm → Sulafat/Vindemiatrix; nam trầm uy → Charon/Umbriel/Algenib; nam trẻ năng động → Fenrir/Puck.

## Bắt audio "Xem trước" thành file
Preview trả `blob:` wav (~120KB/câu), Web Audio. (1) hook `page.on('response')` lọc `audio/*` giữ buffer; (2) bấm **Xem trước** (click trusted); (3) đẩy base64 vào page tạo Blob + `<a download>` → `download.saveAs(path)`.

---

# PHẦN D — TẢI VIDEO VỀ & SCENE EDITOR {#phan-d}

## Tải video
- **Hàng loạt (ưu tiên):** `flow-download.js` — lấy `src` từ thẻ `<video>` trong grid, fetch `ctx.request` (ăn cookie), ~2-8MB/clip, kèm `manifest.json`.
- **⚠️ Grid = VIRTUALIZED list:** tile ngoài khung nhìn bị unmount → đếm/gom PHẢI cuộn INNER scroll container (element `scrollHeight` LỚN NHẤT trong trang — `window.scrollBy` VÔ DỤNG) từng bước từ đỉnh, gom dần tới idle. flow-download/flow-status làm đúng sẵn; script tự viết PHẢI copy pattern. Snapshot 1 phát = số ảo (đã mắc 2026-07-06: chỉ thấy 8/18 tile mới).
- Lẻ 1 clip: mở `/edit/<id>` → `video.src` → fetch. Trang edit hiện prompt gốc → dùng map cảnh.
- Lưu `Jobs/<Tên>/output/` + `README_output.md`.

## Scene editor (`/project/<id>/edit/<sceneId>`)
- Mở: click tile video trong grid → trang edit. URL pattern: `https://labs.google/fx/tools/video-fx/edit/<editId>`.
- Có: Tải xuống · **`Lưu khung hình`** (trích frame làm ref) · **`Thêm đoạn trích video`** (nối/mở rộng cảnh) · ô "Mô tả nội dung chỉnh sửa" + Tạo (sửa/nối tiếp).
- **Prompt gốc:** hiện trên trang edit → dùng map cảnh↔clip khi workflowId thiếu (xem §G).
- **Trích frame:** `Lưu khung hình` → chọn timestamp → download .jpg — dùng làm frame Bắt đầu cho gen tiếp.

## ⭐ GHÉP/NỐI NHIỀU CLIP → FFMPEG LOCAL, KHÔNG dùng chức năng "Cảnh" của Flow (Long chốt 2026-07-14)
- Chức năng **Cảnh** (sidebar `movie Xem các cảnh` → view `/scene/<id>`) là trình dựng nối clip trên web. Luồng: view Cảnh → `add Thêm nội dung nghe nhìn` → menuitem `play_movies Tạo cảnh` → editor có timeline + nút `Thêm đoạn trích video` → picker → chọn tile → `Thêm vào cảnh` → `Xong`.
- **NHƯNG nút `Thêm đoạn trích video` = Radix dropdown (`[data-add-button=true]`, `data-state=open`) RẤT KHÓ TỰ ĐỘNG:** `.click()`/coord/JS dispatch bị React chặn hoặc `<html> intercepts pointer events`, menu đóng ngay; ô search picker dễ dính rác từ khóa cũ → "Không tìm thấy kết quả". Dò UI tốn cả chục vòng, không đáng.
- **LUẬT LONG: nối/ghép nhiều clip → TẢI VỀ RỒI GHÉP LOCAL bằng ffmpeg** (nhanh hơn nhiều, không phụ thuộc UI). Clip Veo cùng project + cùng config = cùng codec h264/độ phân giải/8s → concat copy 0 re-encode (~0.02s cho 2 clip):
  ```bash
  cd <outDir>
  printf "file 'a.mp4'\nfile 'b.mp4'\n" > concat.txt
  ffmpeg -y -f concat -safe 0 -i concat.txt -c copy ghep.mp4 && rm concat.txt
  ```
  Map clip↔cảnh trước khi ghép: đọc `manifest.json` field `label` (= prompt đã DỊCH, đủ nhóm theo cảnh), chọn 1 take/cảnh, xếp đúng thứ tự cốt truyện. Warning `Non-monotonic DTS` khi concat clip độc lập là VÔ HẠI. Khác codec/size → bỏ `-c copy` cho re-encode. Verify `ffprobe -show_entries format=duration`. Chỉ mở Cảnh web khi Long yêu cầu ĐÍCH DANH.
- **Recipe hậu kỳ ĐẦY ĐỦ** (map clip↔cảnh khi fire-report thiếu workflowId, vision fallback cho clip lẫn, tính clip thiếu để tải bù, concat, QC): `references/post-production-ghep-phim.md`.

---

# PHẦN E — UPLOAD ẢNH & QUẢN LÝ PROJECT {#phan-e}

## Upload ảnh ref
- `add_2 Tạo` → dialog → `Tải nội dung nghe nhìn lên` → file chooser. Hoặc `page.locator('input[type=file]').setInputFiles(absPath)` (không giới hạn root; MCP `browser_file_upload` chỉ nhận path trong workspace).
- **Upload grid = CHỈ upload; thả/gắn vào ô prompt = upload + ref.** Synthetic drag-drop KHÔNG ăn dropzone React → `setInputFiles` lên `input[type=file]` ẩn. Upload+ref: setInputFiles → right-click tile → `Thêm vào câu lệnh`.
- File upload hiện trong dialog với **alt = TÊN FILE** → đặt tên có nghĩa trước khi upload để attach deterministic.

## List/tìm project qua API
`GET https://labs.google/fx/api/trpc/project.searchUserProjects?input=<encoded>`, input = `encodeURIComponent(JSON.stringify({json:{pageSize:20, toolName:'PINHOLE', cursor:<token>}}))`. Phân trang bằng **`cursor`**. Không search tên server-side → paginate + filter client (`p.projectInfo.projectTitle`). Gọi qua fetch `credentials:'include'` ở tab labs.google.

## Đổi tên project qua API
1. `GET https://labs.google/fx/api/auth/session` → `access_token` (Bearer `ya29...`, hết hạn ~1h).
2. `PATCH https://aisandbox-pa.googleapis.com/v1/projects/{projectId}?clientContext.tool=PINHOLE&updateMask=projectTitle`, header `authorization: Bearer`, body `{"projectTitle":"<tên mới>"}`. Pattern `auth session → Bearer → aisandbox-pa` tái dùng mọi API Flow.
- **⚠️ Token hết hạn ~1h:** gặp 401 → KHÔNG coi là fail, KHÔNG re-fire → GET lại session lấy token mới, retry đúng request. Job dài → ưu tiên runner (cookie, miễn nhiễm).
- Đổi tên qua UI: input `aria-label="Văn bản có thể chỉnh sửa"` → Ctrl+A → type → Enter (JS set `.value` không lưu).

## Agent mode
Nút `Tác nhân`: bật = thanh config biến mất, gãy selector. GIỮ TẮT.

---

# PHẦN F — MÔI TRƯỜNG & LỖI {#phan-f}

## Browser — kiến trúc CDP MỘT Chrome (từ 2026-07-05)
- **MỘT Chrome automation** cho cả MCP lẫn runner: Chrome hệ thống + profile `chrome-nhi-profile` (login Flow sẵn), **CDP 9666**, tự start cùng Windows (`chrome-flow-cdp.vbs` Startup). Chrome cá nhân của Long là process khác — KHÔNG đụng.
- **Env vars (portability):**
  - `FLOW_CDP` — CDP endpoint (default `http://127.0.0.1:9666`). Đổi port hoặc remote: `export FLOW_CDP=http://192.168.1.5:9222`.
  - `FLOW_CHAR_URL` — URL nhân vật cho `flow-mytab.js` (default: project test Long). Đổi khi dùng nhân vật khác.
- **MCP không tự spawn browser:** `@playwright/mcp --cdp-endpoint http://127.0.0.1:9666` → MCP + runner nhìn CÙNG browser/tab/login. (Kiến trúc 2 browser cũ = nguồn blank page/profile lock — ĐÃ BỎ.)
- **Tốc độ:** (1) thao tác lặp → runner Phần G; (2) điều khiển browser nhiều bước → gộp loop vào MỘT lệnh chạy JS trên page (browser tool hiện có), không snapshot xen giữa; (3) tab nền bị throttle → `bringToFront` trước khi nghe network/poll; (4) không mở tab mới thừa.
- **Bảng gỡ lỗi (X → làm Y, vẫn hỏng → Z):**

| Triệu chứng | Fix một lệnh | Vẫn hỏng thì |
|---|---|---|
| Chrome CDP trỏ về trang login Google (`accounts.google.com`) | 🛑 DỪNG CỨNG — Chụp debug screenshot xác nhận, báo Long mở Chrome automation lên đăng nhập thủ công. | Không tự ý dùng Playwright nhập mật khẩu/vượt OAuth vì Google block automated sign-in. |
| Slate.js editor không nhận text / Nút Tạo bị disable | Thao tác trực tiếp qua Slate React API: lấy `editor` từ `__reactProps*` của `[data-slate-editor=true]`, thiết lập `editor.selection = null`, rồi gọi `editor.insertText(prompt)` và `editor.onChange()`. **Lưu ý:** Khi truyền prompt qua CDP `Runtime.evaluate`, bắt buộc double-escape các ký tự xuống dòng (thành `\\n` hoặc `\\\\n`) để tránh lỗi `SyntaxError: Invalid or unexpected token` | Giả lập gửi KeyEvents (char) native qua CDP (nhập chậm nhưng chắc chắn React nhận) |
| Video hiển thị = 0 / Không tìm thấy phần tử video sau khi render | Do tab "Xem video" chưa được chọn/chưa mount DOM. Tìm tab chứa text "Xem video" và click programmatically để các thẻ video mount | Tải lại trang hoặc chuyển tab thủ công |
| flow-download.js lỗi `TypeError: object is not iterable` | Do truyền file `fire-report.json` (dạng object) vào tham số `idsFile`. Script chỉ nhận JSON array (ví dụ `["id1", "id2"]`). | Trích xuất trường `unmatchedWorkflows` từ report ra file tạm chứa array sạch rồi truyền vào |
| Lỗi click Tạo / Nút Tạo bị disable mặc dù text editor đã đầy | Slate Selection bị null hoặc trôi sai DOM node bên ngoài. Gọi hàm window Selection gán trỏ thẳng vào text node: `const sel = window.getSelection(); const range = document.createRange(); range.selectNodeContents(editorEl.firstChild); sel.removeAllRanges(); sel.addRange(range);` sau đó gọi tiếp `editor.onChange()` để React nhận diện selection state. | Giả lập click direct React event handler: `arrowBtn[reactPropsKey].onClick({ nativeEvent: { isTrusted: true }, preventDefault: () => {}, stopPropagation: () => {} })` bypass cơ chế chặn click của UI. |
| React/Next.js bị crash (Application error: a client-side exception...) | Can thiệp DOM hoặc dispatchEvent không đúng chuẩn React/Slate gây crash. Gọi `location.reload()` qua CDP hoặc `browser_navigate` lại URL project | Relaunch Chrome CDP |
| Slate.js editor không nhận text / Nút Tạo bị disable (Radix Dropdown chặn focus) | Nếu dropdown menu còn mở che editor (VD: menu Thêm, Tạo cảnh), nút Tạo bị mờ do Selection trôi. Phải dispatch click hoặc trigger click của Radix Trigger cha (`Radix.onOpenChange(true/false)` hoặc React props click) trước khi focus editor. | Reload trang để reset menu state. |
| Blank page / tab trôi `about:blank` | `browser_navigate` lại URL Flow của project | Chrome CDP chết → relaunch KÈM URL (dưới) |
| Script status check bị kẹt / timeout im lặng | Do Google Flow ngắt gửi request check mạng khi đã render xong → script `flow-status.js` tự động fallback sang quét grid sau 8s im lặng (`NO_POLLS_EARLY_FALLBACK`) | Chạy thẳng `flow-download.js` để kéo grid thủ công |
| Runner không connect được CDP 9666 | Chrome CDP chưa chạy → relaunch KÈM URL | `/json/version` vẫn trả 200 mà connect treo ~30s = tab crash tồn dư CHẶN connectOverCDP → cứu raw CDP: `PUT http://127.0.0.1:9666/json/new?<url Flow>` mở tab mới RỒI `GET /json/close/<targetId của tab xác>`; vẫn chết → check port 9666 bị chiếm |
| Script tìm chip `crop_` timeout dù Flow đang mở | Tab kẹt `/characters`/`/edit/` (URL vẫn chứa project id, trang cũng có ô prompt → tưởng đúng trang) → ép goto URL GỐC project trước khi config | Reload rồi verify chip lại |
| Tool `mcp__playwright__*` "No such tool available" | MCP rớt gateway → restart gateway | Xem log gateway, báo Long |
| Trang Flow đứng im | Tab nền bị throttle → `bringToFront` chờ lại | Reload (F5) rồi verify config từ đầu |
| Nút `Tạo` mờ/disabled | Mờ TẠM vài giây = cap đồng thời → CHỜ | Mờ MÃI = (a) prompt rỗng; (b) Khung hình thiếu frame Bắt đầu; (c) chip 🍌 → chuyển tab Video |
| Click item dialog treo 30s | Trùng tên item / bị che → item thực ra ĐÃ select → retry `{force:true}` + bấm `Thêm vào câu lệnh` | Escape, mở lại dialog, dùng ô search |
| `JSON.parse` nghẹn token lạ đầu file scenes.json | BOM của PowerShell `Out-File utf8` → viết spec bằng Write tool | Strip khi đọc: `content.replace(/^﻿/, '')` |
| Network mất giữa fire/download (ETIMEDOUT/ECONNRESET) | Retry lệnh y hệt — `flow-download.js` RESUME tự bỏ qua clip đã tải; `flow-job.js` check fire-report có sẵn → chỉ fire cảnh thiếu | Mất mạng lâu → chờ mạng lên, `curl -s http://127.0.0.1:9666/json/version` verify CDP còn sống, rồi retry |
| Chrome crash giữa flow-job (node exit ECONNREFUSED đột ngột) | Relaunch Chrome KÈM URL (dưới) → chờ 5s → chạy lại `flow-job.js` CÙNG scenes.json + outDir MỚI (outDir cũ có mp4 → ABORT) | Nếu relaunch cũng crash → check RAM/GPU, kill chrome zombie processes |
| Fire bù sau Chrome crash (cảnh đã fire trước crash) | Đọc fire-report cũ xem cảnh nào đã fire → soạn scenes.json chỉ chứa cảnh thiếu → fire bù vào outDir MỚI | Clip cảnh cũ vẫn render trên server — `flow-download.js` tải riêng sau |
| flow-job/flow-fire exit 1 im lặng (no error) | `background=true` NUỐT stdout → chạy foreground `timeout 300` hoặc redirect `> log 2>&1` rồi đọc log | Đọc fire-report.json + media-map.json check tiến trình; cảnh thiếu → fire bù thủ công |
| Disk full giữa download (`ENOSPC`) | `flow-download.js` ghi manifest tăng dần → clip đã tải OK. Dọn dung lượng → chạy lại y hệt (RESUME skip clip cũ) | `df -h /c` check; xóa file rác trong output cũ hoặc di chuyển sang ổ khác |
| mp4 truncated/corrupt (file size < 500KB hoặc ffprobe fail) | `ffprobe -v error -show_entries format=duration <file>` — lỗi = corrupt → xóa file + chạy lại download (RESUME tải lại file thiếu) | Re-fire cảnh đó nếu clip gốc trên Flow cũng lỗi |
| Quota Flow hết giữa batch (429 Too Many Requests) | Tương tự 403 — DỪNG fire, báo Long. Clip đã fire trước đó vẫn render bình thường | Chờ reset quota (thường 24h), fire bù cảnh còn lại |
| Chrome profile corrupt (launch fail / crash loop) | Xóa `chrome-nhi-profile/Default/GPUCache` + `chrome-nhi-profile/Default/Cache` → relaunch | Xóa toàn bộ profile → relaunch → login lại Flow (hỏi Long trước vì mất session) |
| 401 Unauthorized / token expired giữa job | Runner dùng cookie (miễn nhiễm). API thủ công: `GET .../auth/session` lấy token mới → retry request. KHÔNG coi là fail, KHÔNG re-fire | Cookie cũng hết hạn (rất hiếm) → login lại Flow trong Chrome, runner tự nhận cookie mới |

- **Relaunch Chrome CDP (BẮT BUỘC kèm URL Flow — launch trống từng chết ngay):**
  Trong Git Bash, lệnh `Start-Process` gọi trực tiếp sẽ xịt im lặng. BẮT BUỘC bọc qua powershell:
  `powershell -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--remote-debugging-port=9666','--user-data-dir=C:\Users\loggz\AppData\Local\chrome-nhi-profile','--no-first-run','--no-default-browser-check','<url Flow project>'"`
- **Rule Long:** đừng tự tắt Chrome khi chưa hỏi. Profile cũ `ms-playwright-mcp\mcp-chrome-*` để nguyên không xóa nhưng KHÔNG dùng.

## Test Project
Training/test → "Test Project" id `a9e68afc-d6fc-4563-b428-e217cd47ef40`. Job thật → project riêng.

## Model providers Hermes (bối cảnh, verify 2026-07-15)
Hermes chạy 2 provider thật: `ikame` (Claude, proxy zegoplatform.ikameglobal.com) + `antigravity` (Gemini local 127.0.0.1:8317). ikame giờ đọc `${IKAME_API_KEY}`/`${IKAME_BASE_URL}` trong `.env` (KHÔNG còn `OPENAI_API_KEY` — biến đó + `OPENAI_BASE_URL` + `HF_TOKEN` đã comment vì Hermes tự probe /v1/models trên proxy → đẻ ghost provider anthropic/openai-api/gemini/huggingface đầy model chết trong picker). Nếu picker hiện lại model trùng/chết: chỉ là cache — blank `provider_models_cache.json` (cả root + profiles/imported), nhưng gốc là giữ mấy biến .env kia disabled.

## Xem media (video/audio) — claude mù video, điếc audio
**⭐ QC HÌNH ẢNH (mặc định, chạy trong Hermes — không phụ thuộc agy):** trích frame giữa clip rồi đọc bằng `vision_analyze`:
`ffmpeg -y -ss <giây> -i clip.mp4 -vframes 1 frame.jpg` → `vision_analyze(frame.jpg, "con vật/cảnh gì, khớp prompt không?")`. Nhanh, không treo, đủ verify chủ thể/bố cục/watermark.
*⚠️ Nếu vision_analyze báo lỗi `No LLM provider configured for task=vision provider=auto` → ĐỪNG loay hoay sửa config trong phiên đang chạy: model picker + vision provider được CACHE lúc khởi động session, `hermes config set vision.*` chỉ có tác dụng từ session SAU (verify 2026-07-15: set xong vẫn báo provider=auto). Trong phiên hiện tại → dùng THẲNG agy bên dưới (agy chạy độc lập, luôn xem được ảnh/video). Muốn fix bền cho session sau: `hermes config set vision.provider "custom:antigravity"` + `vision.model "gemini-3.1-flash-image"` + `vision.base_url "http://127.0.0.1:8317/v1"` rồi mở session mới. (KHÔNG trỏ vision vào `${OPENAI_API_KEY}` — biến đó đã bị vô hiệu, giờ ikame dùng `${IKAME_API_KEY}`.)*

**Phân tích clip Veo / giọng → đẩy file cho agy:**
`"C:/Users/longnv/AppData/Local/agy/bin/agy.exe" --dangerously-skip-permissions --add-dir "<thư mục>" -p "Look at the file <tên> in this directory. <câu hỏi>. If you truly cannot see the pixels, reply CANNOT SEE."` (cwd = thư mục file; **`--add-dir` PHẢI path tuyệt đối — dùng `.` là agy lạc sandbox**). agy đọc được cả .mp4 đã ghép (verified 2026-07-14).
*(Đường dẫn agy trên máy longnv: C:/Users/longnv/AppData/Local/agy/bin/agy.exe)*
`ffmpeg -y -ss <giây> -i clip.mp4 -vframes 1 frame.jpg` → `vision_analyze(frame.jpg, "con vật/cảnh gì, khớp prompt không?")`. Nhanh, không treo, đủ verify chủ thể/bố cục/watermark. Verify thật 2026-07-14 (job capybara): 2 frame → vision xác nhận đúng nội dung prompt.
**Chỉ dùng agy khi cần THOẠI/GIỌNG** (vision không nghe audio). Phân tích clip Veo / giọng → đẩy file cho **agy**:
`"C:/Users/loggz/AppData/Local/agy/bin/agy.exe" --dangerously-skip-permissions --add-dir "<thư mục>" -p "Look at the file <tên> in this directory. <câu hỏi>. If you truly cannot see the pixels, reply CANNOT SEE."` (cwd = thư mục file; **`--add-dir` PHẢI path tuyệt đối — dùng `.` là agy lạc sandbox**). agy đọc được cả .mp4 đã ghép (verified 2026-07-14).
- **⚠️ ĐỪNG truyền `--model` trừ khi chắc tên đúng** — tên model DRIFT theo bản cài; gọi sai (vd `gemini-3.5-flash`, fail 2026-07-14) → agy in MENU model rồi thoát (exit 0, KHÔNG phân tích, dễ tưởng chạy). Bỏ `--model` = dùng default, chạy ngay. Cần chỉ định thì chạy `agy models` lấy đúng tên trước.
- **agy treo (exit 124):** retry 1 lần → vẫn treo → đổi model khác trong menu → vẫn treo → fallback về QC hình ảnh bằng ffmpeg frame + `vision_analyze` ở trên.

---

# PHẦN G — RUNNER SCRIPTS {#phan-g} (.js, chạy qua CDP — 0 token/bước)

**Scripts bundle sẵn trong skill: `<skill_dir>/scripts/*.js`** (self-contained; `playwright-core` đã cài trong `scripts/node_modules`). Chạy từ thư mục `scripts/`: `cd <skill_dir>/scripts && node flow-*.js ...`. Cần node ≥18. Nguyên lý: `playwright-core.connectOverCDP('http://127.0.0.1:9666')` → trusted click/network hook như MCP nhưng cả vòng lặp trong 1 lệnh shell, không tốn vòng model.

**Unit tests:** `node --test scripts/test/flow-lib.test.js` — 21 tests cho `assignBirths`, `trackFires`, `trackBirths`, `checkConfig`, module exports. Mock playwright-core, chạy không cần Chrome. Zero deps (dùng `node:test` built-in).

## Bảng lệnh runner

| Script | Cú pháp | Việc |
|---|---|---|
| `flow-config.js` | `node flow-config.js <projectId> [model] [aspect] [count] [duration]` | Set config video (mặc định Video · Thành phần · Veo 3.1 Lite [Lower Priority] · 9:16 · x2 · 8s). In `CHIP_AFTER:` để verify. `DEBUG=1` soi menu. |
| `flow-fire.js` | `node flow-fire.js <scenes.json> [report.json]` | Bơm N cảnh text-to-video LIÊN TIẾP không chờ render. Config lệch → exit 3. Report mặc định `last-fire-report.json`. |
| `flow-fire-char.js` | `node flow-fire-char.js <char-scenes.json> [report.json]` | Fire N cảnh KÈM NHÂN VẬT (ingredient, chế độ Thành phần); tự gắn lại ingredient trước từng cảnh. |
| `flow-fire-frame.js` | `node flow-fire-frame.js <frame-scenes.json> [report.json]` | Fire N cảnh chế độ KHUNG HÌNH (frame đầu); tự gắn lại frame trước từng cảnh. scenes.json: `{project, expectConfig, scenes:[{id, prompt, frame:"tên_file.jpg"}]}`. |
| `flow-gen-frames.js` | `node flow-gen-frames.js <frames.json> [report]` | **BƯỚC 1 auto:** config image mode → attach ref ảnh khách → fire prompt gen frame → collect workflowIds. Input: `{project, scenes: [{id, refImage, prompt}]}`. Ref image phải upload trước. |
| `flow-job.js` | `node flow-job.js <scenes.json> <outDir> [report]` | **Job trọn vẹn**: fire → poll nền (adaptive 15/30/45s) → download → đặt tên. **Async spawn** — không block. |
| `flow-job-mixed.js` | `node flow-job-mixed.js <mixed.json> <outDir>` | **⭐ Job MIXED (frame+char):** tự chạy tuần tự Khung hình → Thành phần → poll → download. **Async spawn.** 1 lệnh cho toàn bộ job trộn chế độ. |
| `flow-status.js` | `node flow-status.js <projectId> [listenSeconds=20]` | `bringToFront` rồi nghe poll render + đếm grid. **Tối ưu:** tự động fallback quét DOM grid tìm clip xong (`NO_POLLS_GRID_FALLBACK`) sau 8s nếu server ngắt poll, cập nhật map đầy đủ. |
| `flow-download.js` | `node flow-download.js <projectId> <outDir> [maxCount] [idsFile]` | Gom video (cuộn-gom) tải song song **8 luồng** (`CONCURRENCY=8`) + retry + `manifest.json`. `idsFile` = JSON array editId. **RESUME:** bỏ qua clip đã tải + ghi manifest tăng dần. |
| `flow-job.js` | `node flow-job.js <scenes.json> <outDir> [report]` | **Job trọn vẹn**: fire → poll nền (adaptive 15/30/45s) → download → đặt tên. **Tối ưu:** timeout 15 phút, async spawn. |
| `flow-voice.js` | `node flow-voice.js <descPath> <voiceName> <outWav> [charUrl]` | Tạo giọng custom + bắt audio Xem trước về wav. `charUrl` = URL trang nhân vật (mặc định: project test của Long). |

`flow-lib.js` = code chung (connect CDP, tìm page, check chip, gõ prompt + fire, bắt request gen, tự chữa blank page); `flow-mytab.js` = helper page. Đừng gọi trực tiếp.

**📦 Đóng gói skill này lên git cho máy khác cài:** xem `references/git-distribution.md` (stage bản sạch, loại node_modules, .gitignore, README nêu npm install + CDP 9666, kiểm token thật trước khi push API).

**⚠️ Chạy node qua git-bash (MSYS): file arg PHẢI là path Windows native `C:\...`, KHÔNG dùng `/c/...` hay `$HOME/...`.** MSYS mangle POSIX path khi truyền cho `node` → nhận `C:\c\Users\...` → MODULE_NOT_FOUND. Đúng: `cd 'C:\...\scripts' && node flow-job.js 'C:\...\scenes.json'`. Áp cho cả path scenes.json/report/outDir truyền vào runner.

**⚠️ Terminal cắt lệnh khi vượt cap (~60-180s) — foreground timeout GIẾT process node (verify 2026-07-15).** ĐỪNG tin "process vẫn chạy nền tới xong": khi lệnh foreground bị công cụ terminal cắt vì timeout, OS process node bị KILL luôn → `flow-job.js` chết ĐANG DỞ ở bước POLL_ROUND, video render trên server vẫn xong nhưng KHÔNG được download/rename. Triệu chứng: log dừng ở `POLL_ROUND N`, `job-report.json` không sinh ra, output chỉ có `fire-report.json` + `media-map.json` + 0-1 .mp4.
- **PHÒNG:** fire xong (thấy `DONE fired=8/8` trong log) là phần khó nhất đã xong — render là việc server. ĐỪNG chạy lại `flow-job.js` (outDir có .mp4/report cũ → tự ABORT hoặc trùng).
- **CỨU (recipe verify 2026-07-15):** render đã xong trên web (grid full tile) → chạy THẲNG `flow-download.js <projectId> <outDir> 16` (count RỘNG ≥2× số cảnh) để cuộn-gom kéo hết clip về. Rồi map+rename thủ công bằng python: đọc `fire-report.json` (`scenes[].workflowIds`) + `media-map.json` (title→scene) → so khớp hash trong tên file `video_NN_<hash>.mp4` với editId → `os.rename` thành `<sceneId>_vK.mp4`. Cảnh nào chỉ ra 1 clip mà các cảnh khác đủ 2 → file `unknown_v1.mp4` còn lại chính là bản thiếu của cảnh đó.
- Poll tiến độ khi thực sự backgrounded: `sleep 30 && ls <outDir>/*.mp4 | wc -l` lặp tới khi số file NGỪNG tăng + `manifest.json` xuất hiện = xong.
- ⚠️ `background=true` của terminal tool NUỐT stdout (bug env "no job control") → KHÔNG dùng cho runner; chạy foreground và chấp nhận có thể bị cắt, rồi CỨU bằng flow-download như trên.

**⭐ Response 200 request gen chứa `workflowId` (=editId grid) + `mediaTitle` (=FULL prompt)** → fire-report ghi `workflowIds` theo cảnh = map cảnh↔clip TUYỆT ĐỐI, không lệ thuộc poll (poll bỏ sót video render nhanh). Response 403 reCAPTCHA thỉnh thoảng có → page tự retry, 200 về muộn 20-30s (waitBirths idle 15s, có 403 → nới 35s, trần 90s). ⚠️ **Bão 403 nuốt SẠCH đợt fire** (0 video thật dù tool báo FIRED) — `flow-job` tự cứu bằng re-fire.

## Quy trình job chuẩn bằng runner
1. `flow-config.js <projectId>` — ép config. Verify `CHIP_AFTER:`.
2. Soạn `scenes.json`: `{project, expectConfig:["Video","crop_9_16","x2"], scenes:[{id, prompt}]}` — prompt DÁN NGUYÊN VĂN (giữ `\n`, format tiền tố BƯỚC 3). **Viết bằng write_file — BOM của PowerShell `Out-File` làm `JSON.parse` chết.**
3. `flow-job.js scenes.json <outDir>` chạy NỀN → song song làm việc khác → job báo xong thì verify (đếm clip + agy xem mẫu). Muốn tay từng bước: `flow-fire.js` → `flow-status.js` → `flow-download.js`.
4. QC bulk: agy (Phần F).

**Timing (đo 2026-07-04):** fire text ~1-4s/cảnh · fire-char ~1s/cảnh · render ~2-3 phút (song song server-side) · status kết luận ~8s khi xong · download 8 clip/~7s. Cap đồng thời: sau ~2 cảnh x2, cảnh kế chờ ~20-45s — runner tự chờ, không phải lỗi.

**⭐ TRÁNH XUNG ĐỘT KHI PULL SKILL MỚI (Vá 2026-07-17):**
Khi `git pull` skill mới từ Git về máy, để tránh conflict với local changes tự phát sinh (như đổi file `SKILL.md` hoặc script status):
1. Stash changes trước khi pull:
   `cd /c/flow-web-skills && git stash && git pull && git stash pop`
2. Nếu muốn đè hoàn toàn bằng bản mới nhất trên remote (đập bỏ thay đổi local):
   `cd /c/flow-web-skills && git reset --hard origin/main && git clean -df`

**⭐ THROTTLE (fix 2026-07-14, verified 6 cảnh x2):** fire >2 cảnh liên tiếp → server khóa nút Tạo ~20-40s. `fireScene` (flow-lib) chờ enable tới 40s và KHÔNG BAO GIỜ throw — cảnh bị nghẽn trả `{ok:false, throttled:true}`, KHÔNG làm sập job. `flow-fire`/`flow-fire-char` gom cảnh throttled, chờ 30s rồi fire bù 1 lần. Nhờ vậy job ≥6 cảnh fire đủ trong 1 lần chạy; `totalFired` luôn được ghi → `flow-job` không còn `JOB_ABORT` oan. Bài học cũ (fire lô 3-4 cảnh thủ công) KHÔNG còn cần — cứ đưa cả job cho `flow-job`.

## Cảnh CÓ frame/ingredient — runner có sẵn
- **Khung hình (frame đầu):** `flow-fire-frame.js` — tự gắn frame từ dialog trước mỗi cảnh. Spec:
  ```json
  {
    "project": "a9e68afc-...",
    "expectConfig": ["Video", "crop_9_16", "x2"],
    "scenes": [
      {"id": "scene_1", "prompt": "Time: ...\nCamera: ...", "frame": "san_pham_final.jpg"},
      {"id": "scene_2", "prompt": "Time: ...\nCamera: ...", "frame": "mc_hero_final.jpg"}
    ]
  }
  ```
- **Thành phần (nhân vật):** `flow-fire-char.js` — tự gắn ingredient.
- Cả hai runner giữ luật fire liên tiếp, tự fire bù cảnh throttled.
- Verify endpoint: frame đầu = `...StartImage`; đầu+cuối = `...StartAndEndImage`; ingredient = `...ReferenceImages`.

## Ghi chú kỹ thuật runner (bài học training — NGUỒN CHÍNH cho chip verify, throttle, workflowId mapping)
- **Chip config = nguồn sự thật:** `button:has-text("crop_")` cuối. **VERIFY bằng `chipText.includes(token)` từng token rời, KHÔNG match nguyên chuỗi** — chip render có/không dấu `|` giữa token.
- Menu config: tabs `[role=tab]`, model dropdown `arrow_drop_down` → `[role=menuitem]`. Real click Playwright mới ăn React.
- Prompt: click `[data-slate-editor]` → Ctrl+A Delete → `keyboard.insertText` → nút `arrow_forward` cuối, chờ enabled.
- Verify fire = hook `ctx.on('request')` lọc `batchAsyncGenerateVideo` (loại `Status`). Không cần chờ response/render.
- Cap đồng thời: sau ~2 cảnh x2, cảnh kế chờ ~20-45s — runner tự chờ, không phải lỗi.
- Download: `<video>` grid có sẵn `src` → `ctx.request.get(src)` ăn cookie.
- **⭐ Vá workflowId thiếu (response fire về muộn/miss — 2026-07-06):** grid sort mới→cũ → vị trí XA NHẤT của các workflowId ĐÃ BIẾT = biên "vùng tile mới"; tile unknown TRONG vùng = clip đợt này → mở `/edit/<id>` match prompt gán cảnh. **KHÔNG prompt-match ngoài vùng** — đợt cũ trùng prompt nguyên văn (blacklist #15). Cross-check: mọi id đã biết phải nằm gọn trong vùng.

---

# PHẦN H — VIẾT PROMPTS.MD {#phan-h}: PATTERN TỪ QUẢNG CÁO KINH ĐIỂN

Nguồn: 5 ad kinh điển agy bóc tách 2026-07-04; phân tích đầy đủ + prompt Veo mẫu: `references/*.md`. Dùng khi PHẢI VIẾT MỚI prompts.md (đã có prompts.md chuẩn → dán nguyên văn, không sáng tác lại).

## H1. Khung xương 5 khối
| Khối | Vai trò | Tỉ lệ |
|---|---|---|
| Hook (0–3s) | Hình bất thường/tương phản khiến người xem dừng | 10–35% |
| Setup | Bối cảnh, nhân vật, vấn đề | 15–25% |
| Demo / Escalation | Chứng minh sản phẩm; cảnh sau "đắt" hơn cảnh trước | 25–40% |
| Climax / Twist | Stunt, biến đổi, cú lật | 10–25% |
| CTA / Packshot | Logo + slogan, TĨNH sau cao trào | 5–15% |

Quy trình: brief → chọn 1 pattern H2 → chia thời lượng theo bảng → mỗi cảnh 8s = 1 prompt đủ 9 thành phần, FORMAT TIỀN TỐ (BƯỚC 3).

**Chia số cảnh:** tổng giây ÷ 8, làm tròn LÊN (30s→4, 40s→5, 60s→8); dư → 1 cảnh 4/6s hoặc gộp CTA. Cần 10s → chỉ Omni Flash (mất phí → checkpoint tín dụng); mặc định chia 8s giữ FREE. Phân bổ cảnh vào 5 khối theo % H1.

## H2. 5 pattern cấu trúc (chọn theo loại job)
1. **MC Direct-Address One-Shot** (Old Spice): MC nhìn ống kính nói liên tục, giả one-shot bằng dolly-back/pan, bối cảnh biến đổi sau lưng, escalation phi lý, sản phẩm luôn trên tay. → Job có MC giới thiệu sản phẩm.
2. **Founder/Expert Walkthrough** (Dollar Shave Club): người dẫn đi xuyên không gian thật, camera dolly-back trước mặt suốt, mỗi câu thoại = 1 luận điểm bán, giọng deadpan, visual gag chạy nền → kết bùng nổ → packshot tối giản. → **Job xưởng/kho/hàng công nghiệp.**
3. **Spectacle Demo** (Volvo Epic Split): close-up + voiceover trầm → dolly-out RẤT chậm lộ dần setup → wide cực đại climax; tính năng chứng minh bằng stunt 1 cú máy; nhạc êm đè hành động căng; kết chữ trắng nền đen. → Chứng minh MỘT tính năng.
4. **Cinematic Story** (Apple 1984): thế giới xám vs 1 nhân vật MÀU RỰC; reveal gián tiếp; chậm → rượt đuổi → slow-mo climax → CTA chữ tĩnh. → Brand video.
5. **Skit ẩn dụ + Match-Cut** (Snickers): ẩn dụ tương phản ngay hook; match-cut trước/sau sản phẩm; double twist; packshot food-porn 3s. → Sản phẩm giải quyết xấu→tốt.

## H3. Checklist 10 nguyên tắc (rà từng prompt trước khi chốt)
1. Hook ≤3s bằng tương phản — không mở bằng logo/establishing dài.
2. Camera movement là chất keo: dolly/tracking cùng hướng giữa các prompt liền kề giả one-take; cảnh sau bắt đầu đúng chỗ cảnh trước kết thúc.
3. Escalation: cảnh sau "đắt" hơn; 2 cảnh ngang nhau → cắt 1.
4. Contrast màu: Subject mang 1 màu nổi đối lập nền; ghi trong Visual Style MỌI prompt.
5. Match-cut trước/sau: 2 prompt giữ NGUYÊN Camera/Location/Lighting, chỉ đổi Subject/trạng thái.
6. Product reveal organic: trên tay/trong hành động, không lơ lửng vô cớ.
7. Nhạc tương phản khi có stunt (ghi vào Voice Tone).
8. CTA tĩnh sau climax ồn: cảnh cuối hạ nhiệt, chữ/packshot tĩnh + giọng trầm.
9. Packshot chuẩn (prompt cuối): close-up slow-motion + slogan + jingle, nền màu thương hiệu.
10. Line nguyên văn (8s ≈ 25–30 chữ), không để AI tự chế; giọng tả kỹ trong Voice Tone.

Nhân vật lặp lại → Subject Y HỆT giữa các prompt hoặc ingredient. Không quá 1 beat hành động/8s. Luật chữ BƯỚC 4. **Mọi prompt theo FORMAT TIỀN TỐ + XUỐNG DÒNG — không văn xuôi liền mạch.**

## H4. Pipeline research thêm ad (đã chạy OK 2026-07-04)
1. Tải 480p: `python -m yt_dlp -f "mp4[height<=480]/best[height<=480]/best" --no-playlist --restrict-filenames -o "<ten>.%(ext)s" "ytsearch1:<tên ad> official commercial"`.
2. agy xem từng file (Phần F, 1 file/lượt, timeout 150s, song song bằng `&`), rubric 4 phần: TONG QUAN (timestamp theo H1) · BOC TACH TUNG CANH (9 thành phần + Line nguyên văn) · VIET LAI PROMPT VEO 8s/cảnh (tiếng Anh) · VI SAO HIEU QUA (3–5 nguyên tắc). Chốt "If you truly cannot see the pixels, reply CANNOT SEE".
3. grep "CANNOT SEE" kiểm; xóa preamble rác. Distill: nguyên tắc mới → H3, pattern mới → H2 (patch skill qua `skill_manage`). Phân tích thô lưu ngoài skill (thư mục job).

## H5. Template prompts.md — Copy & Fill (3 loại phổ biến)

### Template 1: Quảng cáo sản phẩm (40s = 5 cảnh × 8s)
```
# Cảnh 1 — HOOK
Time: [thời điểm tạo tương phản].
Camera: close-up, tĩnh.
Subject: [vật thể bất thường/tương phản gây tò mò].
Action: [hành động gây shock nhẹ, dừng scroll].
Location: [bối cảnh liên quan sản phẩm].
Lighting: [dramatic, tương phản cao].
Visual Style: cinematic, vibrant. No dialogue.
Voice Tone: none

# Cảnh 2 — SETUP
Time: [tiếp nối cảnh 1].
Camera: medium shot, dolly-back.
Subject: [nhân vật/người dùng + vấn đề].
Action: [thể hiện pain point].
Location: [bối cảnh đời thường].
Lighting: [tự nhiên, hơi u tối].
Visual Style: cinematic, muted colors. No dialogue.
Voice Tone: none

# Cảnh 3 — DEMO
Time: [tiếp nối].
Camera: tracking shot.
Subject: [sản phẩm in action].
Action: [sản phẩm giải quyết vấn đề, demo tính năng chính].
Location: [cùng bối cảnh, sáng hơn].
Lighting: [ấm, tích cực].
Visual Style: cinematic, warm tones, product focus. No dialogue.
Voice Tone: none

# Cảnh 4 — CLIMAX
Time: [tiếp nối].
Camera: slow-motion, dolly-out wide.
Subject: [kết quả wow / biến đổi].
Action: [reveal kết quả, reaction shot].
Location: [mở rộng không gian].
Lighting: [rực rỡ, golden hour].
Visual Style: cinematic, saturated, epic. No dialogue.
Voice Tone: none

# Cảnh 5 — CTA/PACKSHOT
Time: [tĩnh lặng sau cao trào].
Camera: close-up, tĩnh, slow-motion.
Subject: [sản phẩm + logo trên nền brand color].
Action: [sản phẩm đặt tĩnh, hiệu ứng ánh sáng nhẹ].
Location: [studio/nền đơn sắc].
Lighting: [soft, studio].
Visual Style: clean, minimal, product photography. No dialogue.
Voice Tone: none
```

### Template 2: Phim ngắn hoạt hình (30s = 4 cảnh × 8s, không thoại)
```
# Cảnh 1 — Establishing + Hook
Time: [thời điểm].
Camera: wide shot, slowly push in.
Subject: [nhân vật chính — mô tả chi tiết ngoại hình, trang phục].
Action: [hành động giới thiệu + chi tiết bất thường gây tò mò].
Location: [thế giới câu chuyện — mô tả chi tiết].
Lighting: [phù hợp mood — mô tả cụ thể].
Visual Style: 3D animation, Pixar style, ray tracing, vibrant. No dialogue.
Voice Tone: none

# Cảnh 2 — Development
Time: [tiếp nối cảnh 1].
Camera: medium shot, tracking theo nhân vật.
Subject: [Y HỆT cảnh 1].
Action: [nhân vật khám phá/gặp vật thể/bắt đầu nhiệm vụ].
Location: [cùng/kế bối cảnh cảnh 1].
Lighting: [thay đổi nhẹ phản ánh mood mới].
Visual Style: 3D animation, Pixar style, ray tracing, vibrant. No dialogue.
Voice Tone: none

# Cảnh 3 — Climax
Time: [tiếp nối].
Camera: close-up, slow-motion tại khoảnh khắc đỉnh.
Subject: [Y HỆT cảnh 1].
Action: [khoảnh khắc cao trào — biến đổi/thành công/bất ngờ lớn].
Location: [mở rộng không gian, tương phản với cảnh 1].
Lighting: [dramatic — rực rỡ hoặc tối tương phản].
Visual Style: 3D animation, Pixar style, ray tracing, epic, vibrant. No dialogue.
Voice Tone: none

# Cảnh 4 — Resolution
Time: [lắng đọng sau cao trào].
Camera: wide shot, slowly pull out.
Subject: [Y HỆT cảnh 1].
Action: [nhân vật thể hiện cảm xúc cuối — vui/bình yên/hài lòng].
Location: [quay về bối cảnh ban đầu, nhưng đã thay đổi].
Lighting: [ấm áp, golden hour].
Visual Style: 3D animation, Pixar style, ray tracing, warm, peaceful. No dialogue.
Voice Tone: none
```

**Ví dụ đã fill (Pixar robot phiêu lưu):**
```
# Cảnh 1 — Establishing + Hook
Time: golden hour, late afternoon.
Camera: wide shot, slowly push in.
Subject: a small rusty robot with big round glowing blue eyes, dented metal body, a bent antenna on its head, covered in dust and moss patches.
Action: the robot sits alone atop a towering pile of scrap metal in an endless junkyard, tilting its head curiously at a single glowing flower growing from the debris.
Location: a vast post-apocalyptic junkyard stretching to the horizon, mountains of crushed cars and twisted metal, a faint orange sky above.
Lighting: warm golden hour sunlight filtering through hazy clouds, long dramatic shadows across the junk piles, rim light on the robot's silhouette.
Visual Style: 3D animation, Pixar style, ray tracing, vibrant. No dialogue.
Voice Tone: none
```

### Template 3: Video giới thiệu MC (60s = 8 cảnh, có thoại)
```
# Cảnh 1 — Hook + MC xuất hiện
Time: [thời điểm].
Camera: close-up, tĩnh.
Subject: [tên MC, mô tả ngoại hình chi tiết, trang phục — Y HỆT mọi cảnh].
Action: [MC nhìn ống kính, cười, bắt đầu nói].
Location: [bối cảnh liên quan sản phẩm/chủ đề].
Lighting: [studio hoặc tự nhiên — mô tả cụ thể].
Visual Style: cinematic, professional. Dialogue.
Line: "[Câu hook gây tò mò, ≤25 chữ — VD: Bạn có biết 90% người dùng đang bỏ lỡ thứ này không?]"
Voice Tone: [mô tả giọng: trẻ/trầm/vui, tốc độ nhanh/chậm, cảm xúc — VD: giọng nam trẻ, năng động, tốc độ vừa, hơi bí ẩn]

# Cảnh 2 — Setup vấn đề
Time: [tiếp nối].
Camera: medium shot, dolly-back nhẹ.
Subject: [Y HỆT cảnh 1].
Action: [MC đi bộ/di chuyển, tay chỉ hoặc cầm sản phẩm, nói tiếp].
Location: [mở rộng bối cảnh — thấy được không gian xung quanh].
Lighting: [Y HỆT hoặc tương tự cảnh 1].
Visual Style: cinematic, professional. Dialogue.
Line: "[Nêu vấn đề/pain point, ≤25 chữ]"
Voice Tone: [Y HỆT cảnh 1]

# Cảnh 3 — Tính năng 1
Time: [tiếp nối].
Camera: over-the-shoulder, focus sản phẩm/demo.
Subject: [Y HỆT cảnh 1].
Action: [MC demo tính năng đầu tiên — cầm/chỉ/thao tác].
Location: [phù hợp demo — bàn/studio/ngoài trời].
Lighting: [sáng rõ, product-focused].
Visual Style: cinematic, professional. Dialogue.
Line: "[Giới thiệu tính năng 1, ≤25 chữ]"
Voice Tone: [Y HỆT cảnh 1, thêm hào hứng]

# Cảnh 4 — Tính năng 2
Time: [tiếp nối].
Camera: medium close-up, tĩnh hoặc pan nhẹ.
Subject: [Y HỆT cảnh 1].
Action: [MC demo tính năng thứ hai — so sánh trước/sau hoặc kết quả].
Location: [cùng hoặc chuyển bối cảnh mới].
Lighting: [Y HỆT hoặc tương tự cảnh 3].
Visual Style: cinematic, professional. Dialogue.
Line: "[Giới thiệu tính năng 2, ≤25 chữ]"
Voice Tone: [Y HỆT cảnh 1]

# Cảnh 5 — Social proof / Kết quả
Time: [tiếp nối].
Camera: wide shot, reveal không gian rộng.
Subject: [Y HỆT cảnh 1].
Action: [MC chỉ ra kết quả / bằng chứng / con số ấn tượng].
Location: [không gian mở, gợi ý quy mô].
Lighting: [tự nhiên, sáng].
Visual Style: cinematic, professional. Dialogue.
Line: "[Social proof hoặc kết quả, ≤25 chữ]"
Voice Tone: [Y HỆT cảnh 1, tự tin]

# Cảnh 6 — Xử lý phản đối
Time: [tiếp nối].
Camera: close-up, MC nhìn ống kính.
Subject: [Y HỆT cảnh 1].
Action: [MC giơ tay/lắc đầu nhẹ, rồi gật — xử lý phản đối phổ biến].
Location: [studio hoặc cùng bối cảnh].
Lighting: [ấm, gần gũi].
Visual Style: cinematic, professional. Dialogue.
Line: "[Xử lý phản đối, ≤25 chữ — VD: Nhiều người nghĩ quá đắt. Nhưng thực ra chỉ bằng ly cà phê mỗi ngày.]"
Voice Tone: [Y HỆT cảnh 1, chân thành]

# Cảnh 7 — Urgency / Scarcity
Time: [tiếp nối].
Camera: medium shot, MC bước tới gần ống kính.
Subject: [Y HỆT cảnh 1].
Action: [MC giơ tay đếm/chỉ, tạo cảm giác cấp bách].
Location: [cùng bối cảnh, hơi zoom in].
Lighting: [tăng contrast nhẹ, dramatic hơn].
Visual Style: cinematic, professional. Dialogue.
Line: "[Urgency/scarcity, ≤25 chữ — VD: Chỉ còn 50 suất ưu đãi tuần này.]"
Voice Tone: [Y HỆT cảnh 1, gấp gáp hơn]

# Cảnh 8 — CTA
Time: [tĩnh lặng].
Camera: close-up, tĩnh.
Subject: [Y HỆT cảnh 1 + sản phẩm/logo trên tay hoặc bên cạnh].
Action: [MC cười, nói câu CTA, giơ sản phẩm hoặc chỉ xuống link].
Location: [studio/nền brand color].
Lighting: [soft, ấm].
Visual Style: clean, professional, product focus. Dialogue.
Line: "[CTA ngắn gọn, ≤20 chữ — VD: Tải app ngay — link ở dưới!]"
Voice Tone: [Y HỆT cảnh 1, thêm tự tin, kết thúc dứt khoát]
```

**Fill rule:** thay `[...]` bằng nội dung brief. Giữ nguyên format tiền tố + xuống dòng. Rà H3 checklist trước khi chốt.

## 📋 VERIFICATION CHECKLIST (Kiểm thử & Bàn giao) {#phan-i}
Sau khi chạy xong Runner / script tạo video, thực hiện tuần tự:
1. **Kiểm tra file output:**
   - [ ] Đủ số lượng clip `.mp4` tương ứng số cảnh (đối chiếu `scenes.json`).
   - [ ] Có file `manifest.json` trong thư mục output (chứa log render và mapping).
   - [ ] Tên file đúng định dạng: `<sceneId>_vK.mp4` (hoặc định dạng map của job).
2. **Kiểm tra chất lượng (QC):**
   - [ ] Trích xuất frame giữa của các clip bằng ffmpeg:
     ```bash
     ffmpeg -y -ss 00:00:02 -i clip.mp4 -vframes 1 frame.jpg
     ```
   - [ ] Chạy `vision_analyze(frame.jpg)` để verify nội dung (chủ thể, watermark, lỗi bố cục).
   - [ ] Nếu lỗi vision provider, dùng `agy` để verify từ xa:
     ```bash
     "C:/Users/longnv/AppData/Local/agy/bin/agy.exe" --dangerously-skip-permissions --add-dir "C:/path/to/job/dir" -p "Verify clip.mp4 in this folder"
     ```
3. **Kiểm tra tích hợp:**
   - [ ] Đảm bảo không còn file rác `unknown_vK.mp4`.
   - [ ] Đảm bảo video không bị cắt nửa chừng (dưới 3-5s).
   - [ ] Đọc lại `ghi_chu_san_xuat.md` để chắc chắn không sót yêu cầu hậu kỳ.
