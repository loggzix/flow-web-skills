# Hậu kỳ: ghép clip đã tải thành 1 phim (ffmpeg local)

Dùng SAU khi `flow-download`/`flow-job` đã tải clip về `output/`. Nhanh + ổn định hơn nhiều so với chức năng **Cảnh** của Flow web (Radix menu picker khó tự động, click coordinate/JS bị React chặn — verified fail 2026-07-14; đừng cố dùng Cảnh để nối, tải về ghép local).

## 1. Map clip ↔ cảnh (khi fire-report thiếu workflowId)

Response gen về muộn → `fire-report.json` có cảnh `fired:false` hoặc `workflowIds:[]` dù clip VẪN render thật. Nguồn map, ưu tiên giảm dần:
1. `fire-report.json` `scenes[].workflowIds` — khớp `editId` (8 hex đầu tên file `video_NN_<hex>.mp4`) → scene id. Tin cậy nhất.
2. `media-map.json` (từ `flow-status`) — `{workflowId: {title, status}}`, title = prompt gốc.
3. **Vision fallback cho clip "?"**: trích frame giữa (`ffmpeg -ss 4 -i clip.mp4 -vframes 1 f.jpg`) → `vision_analyze` hỏi "cảnh này là cảnh nào trong N cảnh: <liệt kê>". Vision KHÓ tách 2 cảnh bố cục giống nhau (vd cùng "bầy + ao nước") → phân biệt bằng chi tiết đắt (vd cảnh climax = "bùng nổ tia sáng" vs cảnh kết = "đàn bình yên phản chiếu nước").

## 2. Tính clip THIẾU để tải bù (không tải lại từ đầu)

```python
import os, json
d = r"<outDir>"
allids = json.load(open(os.path.join(d,"<ids>.json")))          # 16 id kỳ vọng
have  = set(f.split("_")[2][:8] for f in os.listdir(d) if f.endswith(".mp4"))
missing = [i for i in allids if i[:8] not in have]
json.dump(missing, open(os.path.join(d,"missing.json"),"w"))
```
Rồi `flow-download <proj> <bù-dir> <n> missing.json`. (Từ 2026-07-14 flow-download đã RESUME sẵn — chạy lại LỆNH Y HỆT cũng tự bỏ qua clip đã có; bước tính missing chỉ cần khi muốn tải sang thư mục khác.)

## 3. Ghép — ffmpeg concat, KHÔNG re-encode

Clip Veo cùng project luôn đồng nhất h264 1280×720 → nối `-c copy` (tức thì, ~0.3s):
```python
import subprocess, os
seq = [ ... ]   # 1 take/cảnh, ĐÚNG THỨ TỰ cốt truyện
lst = os.path.join(d,"_c.txt")
open(lst,"w",encoding="utf-8").write("".join("file '%s'\n" % os.path.join(d,f).replace("\\","/") for f in seq))
subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i",lst,"-c","copy","<out>.mp4"])
os.remove(lst)
```
Warning "Non-monotonic DTS" khi nối clip độc lập = vô hại. Verify: `ffprobe -show_entries format=duration` (8 cảnh×8s = ~64s). Xong → gợi ý CapCut cho dub/nhạc/overlay chữ Việt (BƯỚC 7).

## 4. QC phim ghép
- Hình/bố cục/nhất quán nhân vật → `vision_analyze` từng frame (nhanh, không treo).
- Cốt truyện + audio/thoại → agy: `agy --dangerously-skip-permissions --add-dir "<dir tuyệt đối>" -p "..."` (BỎ `--model`). agy đọc được cả .mp4 đã ghép (verified 2026-07-14).
