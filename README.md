# SWP07 地圖資訊：臺北 YouBike 即時地圖

使用 HTML、CSS、原生 JavaScript、Leaflet 1.9.4 與 OpenStreetMap 製作，無須 API Key、後端或建置工具。

**網頁程式已完成；GitHub Pages 尚未發布。請完成下方部署步驟後，繳交實際網址。**

## 作業要求對照

| 要求 | 本作品實作 |
| --- | --- |
| 合理的初始中心與縮放 | 臺北市政府 `[25.0375, 121.5637]`，zoom `13` |
| 串接含經緯度的 API／開放資料 | 臺北市政府 YouBike 2.0 JSON，使用 `latitude` 與 `longitude` |
| 每筆資料以 Marker 呈現，點擊顯示 Popup | 每個有效站點一個 `L.marker`；Popup 顯示站名、地址、可借／可還、營運狀態、總停車格與更新時間 |
| 部署到 GitHub Pages | 支援純靜態部署；需要上傳至自己的 GitHub 並啟用 Pages，步驟如下 |

## 使用方法

1. 完整解壓縮 ZIP，保留資料夾中的所有檔案。
2. 使用 Chrome、Safari、Edge 或 Firefox 開啟 `index.html`，並保持網路連線。
3. 地圖上的標記數字代表可借車輛。點擊標記查看可借與可還數量。
4. 預設每 60 秒重新取得資料，也可按「立即更新」。切到背景分頁時暫停自動讀取，回到頁面後按資料時間補更新。
5. 「回到市中心」恢復初始位置及縮放。

全市可借／可還總數只計入營運中的站點。暫停營運站點仍顯示在地圖上，但 Popup 不將車輛與空位當作可使用的數量。資料更新失敗時，保留上次成功取得的資料並明確提示；不會使用假資料。

若直接開啟檔案受到瀏覽器限制，可在本資料夾執行 `python3 -m http.server 8000`，再開啟 `http://localhost:8000`，或直接依下方步驟部署。

## GitHub Pages 部署（網頁介面）

1. 登入 GitHub，建立名稱為 `SWP07-youbike-map` 的新 repository。使用 GitHub Free 時選擇 **Public**，並勾選建立 README，讓 `main` 分支存在。
2. 在 repository 點選 **Add file → Upload files**。
3. 上傳解壓縮資料夾「裡面的內容」：`index.html`、`style.css`、`script.js`、`README.md` 以及整個 `vendor` 資料夾，然後按 **Commit changes**。ZIP 內也附有 `.nojekyll`；未上傳它不影響這份純靜態網站。
4. 確認 repository 根目錄能直接看到 `index.html`，而不是再多包一層 `SWP07-youbike-map` 資料夾。不要只上傳 ZIP。
5. 打開 **Settings → Pages**。
6. **Source** 選 **Deploy from a branch**；**Branch** 選 **main**，資料夾選 **/(root)**，按 **Save**。
7. 等待部署完成，在 Pages 頁面按 **Visit site**。GitHub 官方說明指出，更新發布可能需要最多 10 分鐘。
8. 在網站確認底圖、站點和 Popup 正常顯示，按「立即更新」確認資料可重新取得，接著繳交 Pages 頁面提供的實際網址。

一般專案網址格式：`https://你的GitHub帳號.github.io/SWP07-youbike-map/`。這是格式範例，並非已部署的網址。

部署教學來源：
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 程式與資料來源

| 檔案 | 功能 |
| --- | --- |
| `index.html` | 網頁結構、地圖容器、統計、更新操作與圖例 |
| `style.css` | 桌機／手機排版、數字標記與 Popup 樣式 |
| `script.js` | 建立地圖、fetch 資料、建立／更新／刪除 Marker、自動更新及錯誤處理 |
| `vendor/leaflet/` | Leaflet 1.9.4 程式、樣式與授權；使用本地副本，不依賴 CDN 載入程式 |

資料集：https://data.gov.tw/dataset/137993

即時 JSON：https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json

使用欄位：`sno`、`sna`、`sarea`、`ar`、`latitude`、`longitude`、`available_rent_bikes`、`available_return_bikes`、`Quantity`、`act`、`infoTime`。

提供機關：臺北市政府交通局。資料集標示每 1 分鐘更新，採政府資料開放授權條款第 1 版。

底圖：https://www.openstreetmap.org/ 。頁面保留 OpenStreetMap attribution。使用 `https://tile.openstreetmap.org/{z}/{x}/{y}.png` 載入地圖圖磚。

地圖套件：https://leafletjs.com/ 。Leaflet 的 BSD 2-Clause 授權包含在 `vendor/leaflet/LICENSE.txt`。

## 完成檢查

- 已檢查 JavaScript 語法、HTML 本地資源路徑。
- 2026-10-07 已成功取得官方即時 JSON，當次回傳 1,813 個站點，資料允許跨來源讀取。
- 已以當次真實資料驗證站點標記數量、統計加總，並模擬資料更新、移除站點、讀取失敗和外部文字跳脫。
- 尚未執行 GitHub Pages 線上驗收，也未完成瀏覽器視覺驗收；部署後請依上述步驟確認。
