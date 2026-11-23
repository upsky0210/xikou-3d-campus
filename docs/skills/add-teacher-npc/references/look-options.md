# 造型選項（site/js/blocks.js 的 look.*）

要確定某個選項的實際做法，用 `grep -n "look\.選項名" site/js/blocks.js` 看那一段程式和註解。要找範例，用 `grep -n "選項名:" site/js/npcs.js`，看哪位老師用過。

## 基本顏色（每位都要有）
`skin` 膚色、`hair` 髮色、`top` 上衣、`pants` 褲子、`shoe` 鞋子（照片沒拍到就用深灰色 `#3a3a3a` 這類中性色）

## 頭
- 髮型：
  - `shortHair` 短髮、`spiky` 刺刺短髮
  - `bob` 齊下巴鮑伯頭、`lob` 及肩直髮、`longHair` 長髮
  - `bun` 低髮髻、`braids` 兩條辮子
- 帽子：
  - `cap: { color, logo }` 棒球帽
  - `beanie` 毛線帽（`beanieCuff` 反折帽緣的顏色）
  - `beret` 貝雷帽、`headband` 頭巾
- `headScale`：頭的大小（小朋友用）

## 上衣
- `longSleeve` 長袖、`sleeve` 袖子顏色（跟上衣不同時）、`sleeveless` 無袖
- 領子、扣子：
  - `collar` 領子或領口露出的內搭顏色
  - `topButtons` 上衣一排扣子、`buttonRow` 洋裝一整排扣子、`buttons` 兩顆扣子
- 條紋：`topStripes` 橫條紋顏色＋`stripeH` 條紋粗細（例如 0.07）
- 格子布：`plaid: [底色, 寬格線, 細格線]`，上衣、袖子、裙子（`skirt`／`shortSkirt`）都用同一塊布（格子襯衫、格子洋裝）
- 外套、背心：
  - `openShirt` 敞開穿的外套或襯衫（顏色）。`top` 會變成裡面那件。
  - `zip` 拉鍊、`hoodie` 連帽（`pocket` 口袋顏色）
  - `vest: [背心色, 滾邊色]`、`haori` 和服外褂
- 印字、圖案：
  - `teeText: { lines: [['Light Up', 17, 46], ['TAIWAN', 18, 68]], ink }` T 恤前面印字。每行是 [文字, 字級, y]，畫布 92×120。
  - `teeImg: { front, back }` 班服圖片，放在 `site/img/…`，要使用者給的設計稿。
  - `print` 線條圖案、`bear` 小熊、`minis` 一排小圖案、`sushi`
- 配件：
  - `tie` 領帶、`badge` 胸章、`lanyard` 識別證、`necklace` 項鍊、`whistle` 哨子
  - `shades` 領口的太陽眼鏡、`camera` 相機、`hanky` 手帕
  - `scarf: [主色, 垂下那端的顏色]` 圍巾、`scarfSpots` 豹紋斑點顏色
  - `neckerchief` 領巾、`bag` 斜背包顏色
  - `yoke` 幼兒園制服色塊

## 下半身
- 裙子：
  - `skirt` 長裙、`shortSkirt` 短裙
  - `skirtPlaid: [底色, 格線]` 格子裙、碎花裙看 `skirtPrint`（grep 確認參數）
- 褲子：
  - `widePants` 寬褲、`shorts` 短褲（`socks` 襪子）
  - `stripe` 運動褲側條、`pantsPrint`
- `belt` 皮帶

## 手上拿的
`holdL` / `holdR`：左右手拿東西，例如 `'bouquet'`、`'bubbles'`。可以用哪些值要看 blocks.js 的 `holdItem`。

## 表情
- 預設：打招呼、答對時會換成張嘴大笑的臉。
- `calm: true`：一直保持閉嘴微笑。照片是閉嘴笑、氣質安靜的老師用這個。

## 臉：pal 調色盤＋face 16×16
`face` 是 16 行、每行 16 個字元，字元對應 `pal` 的顏色。慣例：

| 字 | 意思 |
|---|---|
| `H` | 頭髮 |
| `h` | 頭髮亮部或分線 |
| `S` | 皮膚 |
| `E` | 眼珠 |
| `e` | 淺色眼珠 |
| `W` | 眼白，或眼鏡鏡片的反光 |
| `K` | 眼鏡框（細框、粗框、粉紫框都用這個字，換顏色就好） |
| `B` | 腮紅（粉色）。有些老師拿來當眉毛（深色）。 |
| `N` | 鼻子 |
| `M` | 嘴唇 |
| `T` | 牙齒（露齒笑才用） |

要點：
- 前 4～6 行決定瀏海和分線。
  - 齊瀏海：整排 `H`。
  - 中分：從第 2 行開始，中間用 `S` 一路往下挖寬。
  - 旁分：只挖一邊。
- 眼鏡：
  - 第 6～8 行用 `K` 框住眼睛，兩個鏡框中間用 `KKKK` 連起來當鼻樑。
  - 圓框可以把四個角改成 `S`。
- 嘴巴：
  - 微笑：`'HHSSSMMMMMMSSSHH'`。
  - 露齒：`'HHSSSMTTTTMSSSHH'`，下一行 `'HHHSSSMMMMSSSHHH'`。

最快的做法：找一位髮型、眼鏡最像的老師，複製他的 `pal` 和 `face` 再改。
