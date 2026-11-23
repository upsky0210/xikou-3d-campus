# 小遊戲怎麼做、要改哪裡

## 先決定：沿用還是新寫

`site/js/app.js` 的 `GAME_FILE` 列出每個種類（kind）在哪個檔案（`site/js/games/*.js`）。使用者指定的遊戲如果已經有了（例如「猜拳」`rps`、「立體拼圖」`puzzle3d`），NPC 寫 `game: 'rps'` 就好。題目一樣、只是換老師的遊戲，同一個 kind 可以給好幾位老師用。

## 新遊戲一定要改的 4 個地方

漏掉任何一個，遊戲就打不開，或提示會出現「🛝 溜undefined」。`tools/check.mjs` 會抓第 3、4 項。

1. **遊戲本身**：
   - 在對應的檔案裡寫遊戲物件。
   - 讓 `play[kind]` 叫得到它。kg.js 是在 `KG_GAMES` 加一個 `get kind() { return KG_X; }`；獨立檔案則 `export const play = { kind: (s) => start(s.npc) }`。
2. **`site/js/app.js` 的 `GAME_FILE`**：把 kind 加進那個檔案那一行（新檔案就加一行 `檔名: 'kind'`）。
3. **`site/js/app.js` 的互動提示**：在 `sp.kind === '...' ? T(...)` 那一長串加一行：
   ```js
   : sp.kind === 'factor' ? T(`🔢 跟${sp.npc.name}挑戰因數與倍數 <kbd>F</kbd>`, `🔢 Factors & multiples with ${sp.npc.name} <kbd>F</kbd>`)
   ```
4. **`site/js/game-info.js`**：加 `kind: [['中文名', 'English'], 'campus-xxx-best', ans]`。校園護照和學生進度頁（teacher.html）都靠這裡，`campus-xxx-best` 要跟遊戲存紀錄用的 key 一樣。

## 做法 A：三選一題庫（最常用、最省事）

在 `site/js/games/kg.js` 用 `mcGame`。一回從題庫隨機抽 5 題，答完會顯示解說：

```js
const HEALTH_ITEMS = [
  { e: '🌡️', q: '耳溫量到幾度以上，就算是發燒？', a: ['38 度', '37.5 度', '36.5 度'], why: '耳溫 38 度以上就是發燒…' },
  // a 的第一個是正確答案（畫面上會打亂）；至少 10 題以上，抽起來才有變化
];
const KG_HEALTH = mcGame({
  key: 'campus-healthqa-best', title: ['🩺 健康 Q&A', '🩺 Health Q&A'], label: ['🩺 健康 Q&A…', '🩺 Health Q&A…'], icon: '🩺', items: HEALTH_ITEMS,
  intro: () => T('健康小知識考考你！', 'A little health quiz!'),
  good: '答對 4 題以上時老師說的話', keep: '答得不好時老師說的鼓勵',
});
```

- 使用者給了範例題，就放在第一題，一字不改。
- 讓老師自己改題目（Google 試算表）：
  1. 把 `[kind, ITEMS, icon]` 加進 kg.js 底下的 `useSheet` 迴圈。
  2. 在 `site/js/sheet-config.js` 加 `kind: ''` 和註解。
  3. 範本 CSV 放 `C:\AI\Claude\3Dmap\題庫範本\kind_名稱.csv`，用 UTF-8 BOM。欄位：圖示、題目、正確答案、錯的選項1、錯的選項2、解說。
  4. 兩份 `題庫試算表說明.md`（`site/docs/` 和根目錄）的表格各加一行，標題的題庫數量也要改。

## 做法 B：二選一（對／錯、可以吃／不能吃）

看 `site/js/games/quiz.js`，用 `useSheet` 加上 `trueFalse`。題目要「對」「錯」各 3 題以上。

## 做法 C：程式出題（數學）

寫產生器，每題算出正確答案，錯的選項也用規則算，例如差 1、因數、倍數。範例是 kg.js 的 `KG_FACTOR`（因數與倍數）、`KG_DECIMAL`。

寫完在 scratchpad 用 node 跑幾萬題，確認三件事：
- 正確答案只有一個；
- 錯的選項不會剛好也是對的；
- 數字在合理範圍內。

回報時說驗算了幾題。

## 做法 D：自己的畫面（拼圖、棋類、3D）

參考：
- `site/js/games/puzzle3d.js`：周周老師的立體拼圖，三選一、選錯可以再選。
- `site/js/games/taiwan3d.js`：趙老師的立體臺灣地形拼圖。它借用 `#p3d` 面板，加上 `.tw` 樣式；小畫布拍 3D 圖片放進按鈕；老師前面的小桌子上也放一份模型。

固定要有的：
- `faceTeacher(n)`；
- `act.busy = { label, tick }`；
- `gameState.duel = { quit }`；
- 按 Esc 可以結束；
- 數字鍵 1～3 可以作答；
- 結束時用 `toast` 顯示分數和最好紀錄；
- 最好紀錄存 `localStorage`（用 try/catch 包起來）。

## 題目品質

- 符合那個年級的課程（例如四年級社會：山地、平原、盆地、台地）。
- 知識不確定的時候，寫一般衛教或教科書的保守說法。回報時請那位老師看一下答案和解說。
- 語氣跟台詞一致（使用者說「偏正向鼓勵」，結束的話也要鼓勵）。
