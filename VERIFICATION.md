# 驗收紀錄

## 已完成

- 完整可環繞的程序化 Three.js 建築模型，前、後、側面皆為立體幾何。
- 重建木構、磚牆、拱窗、石板瓦、露台、陽傘、櫻花、植栽與四輪底盤。
- 日夜、細節視角、自動環繞、旋轉縮放、動態輪組、落花與全螢幕控制。
- 自行生成木紋與磚牆材質；字體、JavaScript 與概念圖全數本機化，無執行期 CDN。
- 減少動態效果偏好、鍵盤視角操作與 WebGL 不可用時的誠實降級畫面。

## 實際驗證

- `npm test`：5 tests passed。
- `npm run test:e2e`：6 browser scenarios passed。
- `npm run build`：production build passed，無 warning。
- `npm audit`：0 vulnerabilities。
- `node scripts/verify-build.mjs`：正式 `dist` 在 1440×960、768×1024、390×844、320×568、900×500 五種視窗驗證通過。
- 正式版本上述五種視窗：無 JavaScript page errors、無 HTTP 4xx/5xx、無外站請求、無水平溢出。
- 已實際查看桌機日景、夜景、背面、屋頂近看、手機與平板截圖。
- 修正了視覺驗收發現的倒置屋頂、窗框／梁柱位移、櫻花稀疏、手機標題擠壓及背景色塊。
- 低效能裝置的日夜過渡改用真實 elapsed time；不以受限的物理步進延遲 UI 過渡。
- 截圖與機器可讀結果位於 `test-results/`。

## 界線與尚未做的事

- 這是依單張圖重新設計的微縮模型風格展示，不是掃描原物件或一比一 photogrammetry；未顯示的背面依同風格補建。
- 自動化測試使用 Chromium WebGL 2／SwiftShader，不代表 iOS Safari 與所有 GPU 均已實機驗證。效能依裝置而異。
- 沒有外部公開部署、網域設定、Git commit 或 push。部署包可直接交给靜態網站服務。
- 公開網址確認後，應將 Open Graph 圖片改成正式 absolute URL，以利社群爬蟲。

## 視覺自評

採 Explore 展覽表面、非通用 SaaS 卡片式版型。無科技漸層、制式功能卡片、假數據或玻璃擬態；使用自選襯線字體與留白。概念圖與 Three.js 渲染質感存在差異，不能把技術測試通過宣稱為「毫無瑕疵」或逐像素一致。
