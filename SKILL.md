---
name: xuong-phim-ai-flow-video
description: "Use when Long asks to làm/gen video, job xưởng phim, làm clip cho khách, or gives a Jobs/<Tên> path — end-to-end Google Flow (Veo) video generation via bundled CDP runner scripts, prompt recipe, and ad-writing patterns."
version: 1.0.0
author: Long (loggzix)
license: MIT
platforms: [windows]
metadata:
  hermes:
    tags: [video, google-flow, veo, cdp, playwright, content-creation]
    related_skills: []
---

# Skill: Xưởng Phim AI — Làm video bằng Google Flow (Veo)

**KHI NÀO DÙNG:** Long bảo "làm video", "gen video", "job xưởng phim", "làm clip cho khách", hoặc đưa 1 path `C:\Content-Creator-Project\Jobs\<Tên>`. Đọc skill này TRƯỚC khi thao tác.

**NGUYÊN TẮC TỐI THƯỢNG:** Làm theo TÀI LIỆU GỐC của job, KHÔNG làm theo trí nhớ. Tốc độ KHÔNG được đánh đổi bằng việc bỏ cấu trúc prompt. Skill này tự chứa đủ recipe — không cần tra MEMORY.md.

**⚡ CÓ BỘ RUNNER .JS (Phần G):** thao tác lặp (set config, fire nhiều cảnh, đếm trạng thái, tải hàng loạt) đã có script node chạy thẳng qua CDP — 0 token/bước, nhanh hơn MCP nhiều lần. Ưu tiên runner; việc chưa có runner (gắn frame/ingredient, tạo nhân vật, xử lý ảnh) → MCP hoặc script one-off theo mẫu job Kệ v4 (Phần G).

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
| 11 | Tự tắt Chrome automation | Mất CDP + phiên login | Hỏi Long trước (Phần F) |
| 12 | Tạo project rác khi test | Bừa workspace Flow | Test Project có sẵn (Phần F) |
| 13 | Viết prompt văn xuôi liền một đoạn — không tiền tố, không xuống dòng | Long bắt lỗi ngay (2026-07-06, MenhSo.AI) | Mỗi thành phần 1 dòng + tiền tố `Time:`/... (BƯỚC 3) |
| 14 | Re-fire 1 cảnh quá 2 lần, hoặc re-fire khi đang 403/reCAPTCHA | Đốt slot render, nuôi bão 403 | Counter per-cảnh, chạm 2 → loại; 403 → STOP báo Long (Phần B) |
| 15 | Map cảnh↔clip bằng prompt-match TOÀN grid khi project từng gen đợt cũ | prompts.md dán nguyên văn → prompt trùng 100% giữa các đợt → dính clip cũ | workflowId từ fire response; thiếu id → prompt-match CHỈ trong vùng tile mới (Phần G) |

---

# PHẦN A — QUY TRÌNH LÀM JOB (chạy theo thứ tự)

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
- **Recipe gen frame HÀNG LOẠT (verify job Kệ v4, 2026-07-06):** config image mode 🍌 Nano Banana 2 · tỉ lệ theo job · x2/cảnh → upload ảnh khách vào project (`input[type=file]`; alt trong dialog = TÊN FILE) → mỗi cảnh: attach ref qua add_2 (recipe dialog Phần B) + prompt mô tả frame đích (khớp Subject/Location/Lighting của prompts.md, thêm "không chữ không watermark") → fire liên tiếp → chọn tay bản đẹp → đặt tên `*_final.jpg` upload lại làm frame/ingredient (alt deterministic).
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

## BƯỚC 5 — CONFIG FLOW (recipe Phần B)
- **Config mặc định của Long:** Thành phần · 9:16 · x4 · Veo 3.1 - Lite [Lower Priority] (0 tín dụng) · 8s. TRỪ khi brief job yêu cầu khác (quảng cáo ngang → 16:9). Bám brief trước, mặc định sau.
- B-roll = Khung hình (frame đầu = ảnh đã xử lý). MC/talking = Thành phần + nhân vật + ảnh HERO.
- **⚠️ Job TRỘN B-roll + MC trong cùng project → GOM CẢNH THEO CHẾ ĐỘ, đừng đan xen.** Fire hết nhóm Khung hình → real-click đổi tab Thành phần → verify chip → fire nhóm còn lại. Mỗi lô fire chỉ 1 chế độ; quên đổi tab → cảnh MC rơi về text-to-video, MẤT mặt nhân vật. **Nhóm có nhân vật fire bằng MCP/script one-off theo Phần G, KHÔNG dùng `flow-fire.js`.**
- Set nhanh: `flow-config.js` (Phần G) — verify dòng `CHIP_AFTER:`.
- **⚠️ Project mới/lạ hay dính mode 🍌 (image):** chip `🍌 ... crop... xN` = bấm Tạo ra ẢNH. LUÔN verify chip trước khi fire.

## BƯỚC 6 — GEN ĐỒNG THỜI + VERIFY + TẢI VỀ (recipe Phần B/D/G)
- **⭐ LUẬT LONG: FIRE TẤT CẢ CẢNH LIÊN TIẾP, KHÔNG CHỜ.** Render là việc của server.
- Text-to-video thuần → `flow-fire.js`. Cảnh frame/ingredient → Phần G nhưng giữ nhịp fire liên tiếp.
- Fire hết mới verify: **Veo Lite [LowPri] HAY FAIL SILENT lúc tải cao** → `flow-status.js` đếm tile vs số cảnh; thiếu → xử theo cây quyết định FAIL SILENT (Phần B): cảnh còn ≥2 take → chấp nhận + ghi report, chỉ re-fire cảnh 0-1 take.
- Tải: `flow-download.js` về `Jobs/<Tên>/output/` + manifest.
- **🔴 CHECKPOINT · GHI ĐÈ OUTPUT:** output đích đã có .mp4 đợt trước → KHÔNG ghi đè/xóa. Tạo `output_<mô tả>/` mới hoặc hỏi Long.

## BƯỚC 7 — BÀN GIAO
- Output lưu `output/` + `README_output.md` map file↔cảnh. Nhắc hậu kỳ CapCut: dub/voice theo Line, overlay chữ Việt + logo, color grading, cắt theo beat.

---

# PHẦN B — RECIPE GEN VIDEO

## Chuyển sang chế độ Video
Chip config bottom bar (`🍌 model | crop | Nx`) → menu 2 tab đầu **Hình ảnh / Video** → chọn **Video**. Config đều là Radix `tablist`/`[role=tab]` → PHẢI real click Playwright (`locator.click()` trusted; `.click()` DOM trong evaluate KHÔNG ăn React).

## Các option config video
- **Chế độ:** `crop_free Khung hình` (frame đầu/cuối) vs `chrome_extension Thành phần` (ingredients). Text-to-video thuần chạy được cả hai.
- **Model** (dropdown `arrow_drop_down` → `[role=menuitem]`): Omni Flash · Veo 3.1 - Lite / Fast / Quality / Lite [Lower Priority]. Đều kèm audio.
- **Tỉ lệ:** 9:16 / 16:9. **Số lượng:** 1x–4x; **x4 = 4 edit id RIÊNG** = 4 request riêng/cảnh. **Thời lượng:** Omni Flash 4/6/8/10s; Veo 3.1 chỉ 4/6/8s.

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

## Gen
Escape đóng menu → gõ prompt vào `[data-slate-editor]` (`keyboard.insertText`) → verify chip (includes từng token rời — Phần G) → nút `arrow_forward Tạo`. Prompt tự xóa sau submit. Render ~45-60s server-bound → submit xong sang cảnh kế NGAY.

## Chế độ KHUNG HÌNH (frame đầu/cuối)
- Bật: tab Video → tab `crop_free Khung hình`. Ô prompt hiện 2 slot **`Bắt đầu` ⇄ `Kết thúc`** (nút `swap_horiz` đảo).
- **ATTACH FRAME:** click slot → dialog media picker → **recipe dialog bên dưới**. Thiếu `Thêm vào câu lệnh` → gen rơi về text-to-video. Verify slot đầy = label biến mất thành thumbnail.
- **BẮT BUỘC có frame ĐẦU:** chỉ gắn Kết thúc → nút Tạo disabled → `swap_horiz` đưa về Bắt đầu.

## Chế độ THÀNH PHẦN (ingredient/ref)
- Nút `add_2 Tạo` mở picker (tab Nhân vật / Hình ảnh...). Attach theo recipe dialog. Nút `close Xoá câu lệnh` = clear cả prompt + ingredients.

## ⭐ DIALOG MEDIA PICKER (add_2 / slot Khung hình) — recipe chuẩn (vá 2026-07-06, job Kệ v4)
- **Mọi click trong dialog = Playwright `locator.click()` trusted.** Click theo tọa độ (evaluate getBoundingClientRect + `mouse.click`) fail IM LẶNG trên React — đã mắc thật.
- **Dialog NHỚ tab lần mở trước** và **ô search `Tìm kiếm thành phần` CHỈ tìm trong tab hiện tại** → LUÔN click đúng tab (có verify) TRƯỚC rồi mới tìm item. Search match tên file có underscore (`ke_nen_trang` ra); gõ space thay underscore = không ra.
- **Pattern attach:** click tab → chờ `img[alt="<tên file>"]` (4s không thấy → fill search rồi chờ tiếp) → click item → poll chip/thumbnail trên prompt bar; **chưa có chip → bấm `Thêm vào câu lệnh`** (ảnh LUÔN cần; nhân vật thường tự gắn, có preview pane thì cũng phải bấm — poll chip làm chuẩn, đừng bấm thừa gây double).
- **Trùng tên item (vd 2 nhân vật cùng tên):** click có thể treo 30s dù ĐÃ select → poll chip trước; CHƯA có chip mới retry `{force:true}` + bấm `Thêm vào câu lệnh` (có chip rồi mà bấm nữa = double-attach).
- **Ingredient/frame bị CLEAR sau mỗi lần Tạo** → gắn lại trước từng cảnh; verify fire đầu bằng endpoint (bảng dưới).

## API endpoint theo chế độ (Bearer, cho runner)
- Text-to-video: `POST https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoText`
- Frame đầu: `.../video:batchAsyncGenerateVideoStartImage` · đầu+cuối: `...StartAndEndImage` · ingredient: `...ReferenceImages`
- Poll: `.../video:batchCheckAsyncVideoGenerationStatus`, body `{"media":[{"name":"<mediaId>","projectId":"..."}]}`, response media[] có `workflowId` + `mediaMetadata.mediaTitle` (= prompt) + `createTime`. Hook `page.on('response')` lọc `batchAsyncGenerateVideo` để verify fire (đừng nhầm `batchCheckAsync...Status`).

## FAIL SILENT (Lite Lower Priority)
Tải cao → lô fire có thể fail hẳn: không tile, không lỗi, chỉ thiếu trong grid. Phát hiện: đếm tile vs số cảnh fired (theo workflowId từng cảnh).
- **Cây quyết định khi phát hiện thiếu — xét TỪNG cảnh, đúng thứ tự:**
  1. Đợt fire có ≥1 phản hồi 403/reCAPTCHA → 🛑 STOP CỨNG (dòng dưới cùng), không xét tiếp.
  2. Cảnh còn **≥2 take dùng được** → CHẤP NHẬN thiếu, KHÔNG re-fire (đừng đốt slot cho đủ xN) — ghi rõ cảnh thiếu vào report/README.
  3. Cảnh chỉ còn **0-1 take dùng được** → re-fire cảnh đó (free, lần 2 thường ăn).
- **🛑 STOP · RE-FIRE QUÁ 2 LẦN:** cảnh re-fire 2 lần vẫn thiếu/FAILED → DỪNG cảnh đó, báo Long (cảnh nào, thử mấy lần, nghi vấn + phương án).
- **Counter PER-CẢNH:** ngưỡng 2 lần tính TỪNG cảnh (workflowId), không per-lô; cảnh chạm 2 → LOẠI khỏi lô re-fire kế.
- **🛑 STOP CỨNG · BÃO 403/reCAPTCHA:** gặp ≥1 phản hồi 403 trong đợt fire → DỪNG toàn bộ, KHÔNG re-fire (nuôi bão), báo Long chờ lắng.

## ⭐ Fire ĐỒNG THỜI nhiều cảnh (luật Long 2026-07-04)
- Vòng lặp mỗi cảnh: gắn frame/ingredient → dán prompt → Tạo → verify request `batchAsyncGenerateVideo` đã bắn → cảnh kế LUÔN. Không đợi render/tile.
- Số đo thực: cảnh 1-2 fire ~1s; sau đó cap đồng thời (~8 job) → ~20-45s/cảnh là bình thường, tool tự chờ. 3 cảnh x4 = 23s; render xong ~2-3 phút.
- Fire hết → `flow-status.js` bắt fail-silent → re-fire thiếu → `flow-download.js` tải một lượt. Trong lúc render: làm việc khác của job, đừng ngồi poll.
- **⚠️ JOB ≥6 CẢNH — FIRE THEO LÔ 3-4 CẢNH, đừng bơm 1 phát (bài học 2026-07-14, job mèo 8 cảnh x2):** bơm liên tiếp 8 cảnh → server KHÓA nút Tạo >10s → `flow-job`/`flow-fire` bỏ cuộc (`NOT_FIRED ... after 26s` / `JOB_ABORT`), rớt cảnh. Nút `refreshThử lại`/`closeHủy` xuất hiện trong `LAST_BUTTONS` = server đang nghẽn. Cách làm: chia scenes.json thành lô 3-4 cảnh → fire lô 1 → chờ ~25-30s cho throttle nhả → fire lô kế bằng `flow-fire.js` (KHÔNG poll giữa chừng, để clip đang render chạy tiếp). Cảnh rớt → gom vào scenes.json riêng chỉ chứa cảnh thiếu, fire bù.
- **⚠️ workflowId trống + "top-N grid" KHÔNG đủ khi 1 job nhiều cảnh (verify 2026-07-14):** response gen về muộn → fire-report thường 0 workflowId → map cảnh↔clip bằng `manifest.json` label (đã dịch tiếng Việt, đủ để nhóm theo cảnh). Cảnh fire SỚM render trước bị đẩy sâu, cảnh sau ra nhiều take chiếm top → "top-16" KHÔNG chứa đủ 8 cảnh → tải RỘNG (≥2× số clip kỳ vọng) rồi nhóm theo label, chọn 1 take/cảnh. Terminal cap 180s hay cắt giữa download nhiều clip → node vẫn chạy nền: chờ `manifest.json` xuất hiện + số file ổn định là xong, đừng tưởng fail.

---

# PHẦN C — RECIPE NHÂN VẬT

## Tạo
- Sidebar `accessibility_new Nhân vật` → `/project/<id>/characters`. Prompt phải có **nền TRẮNG**.
- 3 cách: (1) text vào `[data-slate-editor]` → 🍌 Nano Banana 2 → `arrow_forward Tạo`; (2) 6 mẫu sẵn; (3) từ ảnh (`Tải lên` / `Thêm từ dự án`).
- Sau Tạo: sang `/project/<id>/character/<charId>`, gen 3 biến thể (~15-30s). Endpoint `POST .../projects/{projectId}/flowMedia:batchGenerateImages`.

## Điền thông tin (trang chi tiết)
- **Tên:** `placeholder="Tên nhân vật"` → click → Ctrl+A → Delete → type → **Enter**. ⚠️ Tránh TRÙNG TÊN nhân vật đã có trong project (dialog attach ra 2 item cùng tên, click dễ treo).
- **Mô tả tính cách:** `placeholder="Mô tả tính cách..."` → click → type → Tab/blur.
- **⭐ BẮT BUỘC bấm `Xong`** mới commit — thoát ngang là MẤT.
- Xóa: `delete Xoá nhân vật` → confirm.

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

# PHẦN D — TẢI VIDEO VỀ & SCENE EDITOR

## Tải video
- **Hàng loạt (ưu tiên):** `flow-download.js` — lấy `src` từ thẻ `<video>` trong grid, fetch `ctx.request` (ăn cookie), ~2-8MB/clip, kèm `manifest.json`.
- **⚠️ Grid = VIRTUALIZED list:** tile ngoài khung nhìn bị unmount → đếm/gom PHẢI cuộn INNER scroll container (element `scrollHeight` LỚN NHẤT trong trang — `window.scrollBy` VÔ DỤNG) từng bước từ đỉnh, gom dần tới idle. flow-download/flow-status làm đúng sẵn; script tự viết PHẢI copy pattern. Snapshot 1 phát = số ảo (đã mắc 2026-07-06: chỉ thấy 8/18 tile mới).
- Lẻ 1 clip: mở `/edit/<id>` → `video.src` → fetch. Trang edit hiện prompt gốc → dùng map cảnh.
- Lưu `Jobs/<Tên>/output/` + `README_output.md`.

## Scene editor (`/project/<id>/edit/<sceneId>`)
- Có: Tải xuống · **`Lưu khung hình`** (trích frame làm ref) · **`Thêm đoạn trích video`** (nối/mở rộng cảnh) · ô "Mô tả nội dung chỉnh sửa" + Tạo (sửa/nối tiếp).

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

# PHẦN E — UPLOAD ẢNH & QUẢN LÝ PROJECT

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

# PHẦN F — MÔI TRƯỜNG & LỖI

## Browser — kiến trúc CDP MỘT Chrome (từ 2026-07-05)
- **MỘT Chrome automation** cho cả MCP lẫn runner: Chrome hệ thống + profile `chrome-nhi-profile` (login Flow sẵn), **CDP 9666**, tự start cùng Windows (`chrome-flow-cdp.vbs` Startup). Chrome cá nhân của Long là process khác — KHÔNG đụng.
- **MCP không tự spawn browser:** `@playwright/mcp --cdp-endpoint http://127.0.0.1:9666` → MCP + runner nhìn CÙNG browser/tab/login. (Kiến trúc 2 browser cũ = nguồn blank page/profile lock — ĐÃ BỎ.)
- **Tốc độ:** (1) thao tác lặp → runner Phần G; (2) điều khiển browser nhiều bước → gộp loop vào MỘT lệnh chạy JS trên page (browser tool hiện có), không snapshot xen giữa; (3) tab nền bị throttle → `bringToFront` trước khi nghe network/poll; (4) không mở tab mới thừa.
- **Bảng gỡ lỗi (X → làm Y, vẫn hỏng → Z):**

| Triệu chứng | Fix một lệnh | Vẫn hỏng thì |
|---|---|---|
| Blank page / tab trôi `about:blank` | `browser_navigate` lại URL Flow của project | Chrome CDP chết → relaunch KÈM URL (dưới) |
| Runner không connect được CDP 9666 | Chrome CDP chưa chạy → relaunch KÈM URL | `/json/version` vẫn trả 200 mà connect treo ~30s = tab crash tồn dư CHẶN connectOverCDP → cứu raw CDP: `PUT http://127.0.0.1:9666/json/new?<url Flow>` mở tab mới RỒI `GET /json/close/<targetId của tab xác>`; vẫn chết → check port 9666 bị chiếm |
| Script tìm chip `crop_` timeout dù Flow đang mở | Tab kẹt `/characters`/`/edit/` (URL vẫn chứa project id, trang cũng có ô prompt → tưởng đúng trang) → ép goto URL GỐC project trước khi config | Reload rồi verify chip lại |
| Tool `mcp__playwright__*` "No such tool available" | MCP rớt gateway → restart gateway | Xem log gateway, báo Long |
| Trang Flow đứng im | Tab nền bị throttle → `bringToFront` chờ lại | Reload (F5) rồi verify config từ đầu |
| Nút `Tạo` mờ/disabled | Mờ TẠM vài giây = cap đồng thời → CHỜ | Mờ MÃI = (a) prompt rỗng; (b) Khung hình thiếu frame Bắt đầu; (c) chip 🍌 → chuyển tab Video |
| Click item dialog treo 30s | Trùng tên item / bị che → item thực ra ĐÃ select → retry `{force:true}` + bấm `Thêm vào câu lệnh` | Escape, mở lại dialog, dùng ô search |
| `JSON.parse` nghẹn token lạ đầu file scenes.json | BOM của PowerShell `Out-File utf8` → viết spec bằng Write tool | Strip khi đọc: `content.replace(/^﻿/, '')` |

- **Relaunch Chrome CDP (BẮT BUỘC kèm URL Flow — launch trống từng chết ngay):**
  `Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList '--remote-debugging-port=9666','--user-data-dir=C:\Users\loggz\AppData\Local\chrome-nhi-profile','--no-first-run','--no-default-browser-check','<url Flow project>'`
- **Rule Long:** đừng tự tắt Chrome khi chưa hỏi. Profile cũ `ms-playwright-mcp\mcp-chrome-*` để nguyên không xóa nhưng KHÔNG dùng.

## Test Project
Training/test → "Test Project" id `a9e68afc-d6fc-4563-b428-e217cd47ef40`. Job thật → project riêng.

## Xem media (video/audio) — claude mù video, điếc audio
**⭐ QC HÌNH ẢNH (mặc định, chạy trong Hermes — không phụ thuộc agy):** trích frame giữa clip rồi đọc bằng `vision_analyze`:
`ffmpeg -y -ss <giây> -i clip.mp4 -vframes 1 frame.jpg` → `vision_analyze(frame.jpg, "con vật/cảnh gì, khớp prompt không?")`. Nhanh, không treo, đủ verify chủ thể/bố cục/watermark. Verify thật 2026-07-14 (job capybara): 2 frame → vision xác nhận đúng nội dung prompt.
**Chỉ dùng agy khi cần THOẠI/GIỌNG** (vision không nghe audio). Phân tích clip Veo / giọng → đẩy file cho **agy**:
`"C:/Users/loggz/AppData/Local/agy/bin/agy.exe" --dangerously-skip-permissions --add-dir "<thư mục>" -p "Look at the file <tên> in this directory. <câu hỏi>. If you truly cannot see the pixels, reply CANNOT SEE."` (cwd = thư mục file; **`--add-dir` PHẢI path tuyệt đối — dùng `.` là agy lạc sandbox**). agy đọc được cả .mp4 đã ghép (verified 2026-07-14).
- **⚠️ ĐỪNG truyền `--model` trừ khi chắc tên đúng** — tên model DRIFT theo bản cài; gọi sai (vd `gemini-3.5-flash`, fail 2026-07-14) → agy in MENU model rồi thoát (exit 0, KHÔNG phân tích, dễ tưởng chạy). Bỏ `--model` = dùng default, chạy ngay. Cần chỉ định thì chạy `agy models` lấy đúng tên trước.
- **agy treo (exit 124):** retry 1 lần → vẫn treo → đổi model khác trong menu → vẫn treo → fallback về QC hình ảnh bằng ffmpeg frame + `vision_analyze` ở trên.

---

# PHẦN G — RUNNER SCRIPTS (.js, chạy qua CDP — 0 token/bước)

**Scripts bundle sẵn trong skill: `<skill_dir>/scripts/*.js`** (self-contained; `playwright-core` đã cài trong `scripts/node_modules`). Chạy từ thư mục `scripts/`: `cd <skill_dir>/scripts && node flow-*.js ...`. Cần node ≥18. Nguyên lý: `playwright-core.connectOverCDP('http://127.0.0.1:9666')` → trusted click/network hook như MCP nhưng cả vòng lặp trong 1 lệnh shell, không tốn vòng model.

## Bảng lệnh runner

| Script | Cú pháp | Việc |
|---|---|---|
| `flow-config.js` | `node flow-config.js <projectId> [model] [aspect] [count] [duration]` | Set config video (mặc định Video · Thành phần · Veo 3.1 Lite [Lower Priority] · 9:16 · x4 · 8s). In `CHIP_AFTER:` để verify. `DEBUG=1` soi menu. |
| `flow-fire.js` | `node flow-fire.js <scenes.json> [report.json]` | Bơm N cảnh text-to-video LIÊN TIẾP không chờ render. Config lệch → exit 3. Report mặc định `last-fire-report.json`. |
| `flow-fire-char.js` | `node flow-fire-char.js <char-scenes.json> [report.json]` | Fire N cảnh KÈM NHÂN VẬT (ingredient, chế độ Thành phần); tự gắn lại ingredient trước từng cảnh. |
| `flow-status.js` | `node flow-status.js <projectId> [listenSeconds=20]` | `bringToFront` rồi nghe poll render + đếm grid (cuộn virtualized). `NO_POLLS_EARLY`/`ALL_TERMINAL` = xong. |
| `flow-download.js` | `node flow-download.js <projectId> <outDir> [maxCount] [idsFile]` | Gom video (cuộn-gom) tải song song 3 luồng + retry + `manifest.json`. `idsFile` = JSON array editId → chỉ tải đúng clip đó (an toàn job song song). **RESUME (2026-07-14): bỏ qua clip đã tải + ghi manifest tăng dần sau mỗi clip → terminal cắt giữa chừng thì chạy lại LỆNH Y HỆT để tải nốt, không mất manifest, không tải lại từ đầu.** |
| `flow-job.js` | `node flow-job.js <scenes.json> <outDir> [report.json]` | **⭐ Chạy TRỌN job:** fire (tự chọn text/char theo spec) → poll đủ SUCCESSFUL → download → đặt tên theo cảnh; tự RE-FIRE cảnh thiếu 1 lần; nguồn chuẩn = editId từ fire response → an toàn chạy song song cùng project. outDir phải MỚI (còn .mp4 cũ → tự ABORT). |
| `flow-voice.js` | `node flow-voice.js <descPath> <voiceName> <outWav>` | Tạo giọng custom + bắt audio Xem trước về wav (URL nhân vật hardcode trong file — sửa khi đổi nhân vật). |

`flow-lib.js` = code chung (connect CDP, tìm page, check chip, gõ prompt + fire, bắt request gen, tự chữa blank page); `flow-mytab.js` = helper page. Đừng gọi trực tiếp.

**⚠️ Chạy node qua git-bash (MSYS): file arg PHẢI là path Windows native `C:\...`, KHÔNG dùng `/c/...` hay `$HOME/...`.** MSYS mangle POSIX path khi truyền cho `node` → nhận `C:\c\Users\...` → MODULE_NOT_FOUND. Đúng: `cd 'C:\...\scripts' && node flow-job.js 'C:\...\scenes.json'`. Áp cho cả path scenes.json/report/outDir truyền vào runner.

**⚠️ Terminal cắt lệnh ở ~60s NHƯNG process node vẫn chạy nền tới xong.** Job dài (fire nhiều cảnh + fire bù, hoặc download nhiều clip) sẽ vượt 60s → terminal báo timeout, ĐỪNG coi là fail/chạy lại đè. Cứ để chạy, sau đó POLL kết quả bằng cách khác thay vì re-invoke:
- Download: `sleep 30 && ls <outDir>/*.mp4 | wc -l` lặp tới khi số file NGỪNG tăng + `manifest.json` xuất hiện (script ghi manifest ở bước cuối cùng) = xong.
- Fire/job: đọc `fire-report.json` / job report trong outDir.
- ⚠️ `background=true` của terminal tool NUỐT stdout (bug env "no job control") → KHÔNG dùng cho runner; chạy foreground rồi poll file như trên.

**⭐ Response 200 request gen chứa `workflowId` (=editId grid) + `mediaTitle` (=FULL prompt)** → fire-report ghi `workflowIds` theo cảnh = map cảnh↔clip TUYỆT ĐỐI, không lệ thuộc poll (poll bỏ sót video render nhanh). Response 403 reCAPTCHA thỉnh thoảng có → page tự retry, 200 về muộn 20-30s (waitBirths idle 15s, có 403 → nới 35s, trần 90s). ⚠️ **Bão 403 nuốt SẠCH đợt fire** (0 video thật dù tool báo FIRED) — `flow-job` tự cứu bằng re-fire.

## Quy trình job chuẩn bằng runner
1. `flow-config.js <projectId>` — ép config. Verify `CHIP_AFTER:`.
2. Soạn `scenes.json`: `{project, expectConfig:["Video","crop_9_16","x4"], scenes:[{id, prompt}]}` — prompt DÁN NGUYÊN VĂN (giữ `\n`, format tiền tố BƯỚC 3). **Viết bằng write_file — BOM của PowerShell `Out-File` làm `JSON.parse` chết.**
3. `flow-job.js scenes.json <outDir>` chạy NỀN → song song làm việc khác → job báo xong thì verify (đếm clip + agy xem mẫu). Muốn tay từng bước: `flow-fire.js` → `flow-status.js` → `flow-download.js`.
4. QC bulk: agy (Phần F).

**Timing (đo 2026-07-04):** fire text ~1-4s/cảnh · fire-char ~1s/cảnh · render ~2-3 phút (song song server-side) · status kết luận ~8s khi xong · download 8 clip/~7s. Cap đồng thời: sau ~2 cảnh x4, cảnh kế chờ ~20-45s — runner tự chờ, không phải lỗi.

**⭐ THROTTLE (fix 2026-07-14, verified 6 cảnh x2):** fire >2 cảnh liên tiếp → server khóa nút Tạo ~20-40s. `fireScene` (flow-lib) chờ enable tới 40s và KHÔNG BAO GIỜ throw — cảnh bị nghẽn trả `{ok:false, throttled:true}`, KHÔNG làm sập job. `flow-fire`/`flow-fire-char` gom cảnh throttled, chờ 30s rồi fire bù 1 lần. Nhờ vậy job ≥6 cảnh fire đủ trong 1 lần chạy; `totalFired` luôn được ghi → `flow-job` không còn `JOB_ABORT` oan. Bài học cũ (fire lô 3-4 cảnh thủ công) KHÔNG còn cần — cứ đưa cả job cho `flow-job`.

## Cảnh CÓ frame/ingredient — fire liên tiếp bằng MCP/script one-off (runner chưa phủ)
`flow-fire.js` chỉ text-to-video thuần. Cảnh có ảnh gắn → viết script one-off (mẫu tham khảo — nếu workspace còn — là `fire_khunghinh_v4.js`/`fire_thanhphan_v4.js` của job Kệ v4) hoặc dùng MCP, giữ luật fire liên tiếp, gộp cả loop 1 lệnh:
1. Verify chip đúng `expectConfig` (thấy 🍌 → chuyển tab Video).
2. Mỗi cảnh: gắn frame/ingredient theo **recipe dialog Phần B** → dán prompt → `arrow_forward Tạo` (chờ enabled) → verify request `batchAsyncGenerateVideo*` bắn → cảnh kế NGAY.
3. Ingredient/frame bị clear sau mỗi Tạo → gắn LẠI trước từng cảnh.
4. Fire hết → `flow-status.js` → `flow-download.js` (map theo workflowId, KHÔNG "top N grid").
Endpoint verify chế độ: frame đầu = `...StartImage`; đầu+cuối = `...StartAndEndImage`; ingredient = `...ReferenceImages`.

## Ghi chú kỹ thuật runner (bài học training)
- **Chip config = nguồn sự thật:** `button:has-text("crop_")` cuối. **VERIFY bằng `chipText.includes(token)` từng token rời, KHÔNG match nguyên chuỗi** — chip render có/không dấu `|` giữa token.
- Menu config: tabs `[role=tab]`, model dropdown `arrow_drop_down` → `[role=menuitem]`. Real click Playwright mới ăn React.
- Prompt: click `[data-slate-editor]` → Ctrl+A Delete → `keyboard.insertText` → nút `arrow_forward` cuối, chờ enabled.
- Verify fire = hook `ctx.on('request')` lọc `batchAsyncGenerateVideo` (loại `Status`). Không cần chờ response/render.
- Cap đồng thời: sau ~2 cảnh x4, cảnh kế chờ ~20-45s — runner tự chờ, không phải lỗi.
- Download: `<video>` grid có sẵn `src` → `ctx.request.get(src)` ăn cookie.
- **⭐ Vá workflowId thiếu (response fire về muộn/miss — 2026-07-06):** grid sort mới→cũ → vị trí XA NHẤT của các workflowId ĐÃ BIẾT = biên "vùng tile mới"; tile unknown TRONG vùng = clip đợt này → mở `/edit/<id>` match prompt gán cảnh. **KHÔNG prompt-match ngoài vùng** — đợt cũ trùng prompt nguyên văn (blacklist #15). Cross-check: mọi id đã biết phải nằm gọn trong vùng.

---

# PHẦN H — VIẾT PROMPTS.MD: PATTERN TỪ QUẢNG CÁO KINH ĐIỂN

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
