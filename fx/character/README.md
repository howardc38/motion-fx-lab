# 可重用 2D 角色

**圖像決定角色長相；JSON 決定分件怎樣接；動作模組決定怎樣動；畫法模組處理角色每一幀；scene 決定它在影片哪裏出現。**

模組使用 Canvas 2D，點陣取樣沿用 `fx/studio/point-field.js`。角色外觀由透明圖像素材提供，動作由 rig 配置及程式決定。

- [可換角色／動作／畫法的工作台](../../examples/character-workbench.html)

## 輸入與輸出

| 層 | 輸入 | 輸出／作用 |
|---|---|---|
| `rig.js` | PNG／atlas + version 1 rig JSON | 組合角色；rigid 旋轉、圖層及 mesh 綁定 |
| `motion.js` | rig、動作配置、絕對秒數 | 關節 pose、角色變換、位移與接觸資訊 |
| `styles.js` | 透明角色 Canvas + style | 透明的風格化角色 Canvas |
| `scene.js` | 角色來源 + actor 時間／位置／動作／畫法 | 可合成的場景 Canvas |
| Menu | 能力描述、code 入口及示例 | 讓 LLM 選能力、看動態並核實接口 |


## 最小用法

在 repo 根目錄開 localhost HTTP server，再載入 ES module：

```js
import { createCharacterSource, CharacterScene } from './fx/character/index.js';

const cat = await createCharacterSource('./assets/characters/apricot-cat/rig.json');
const robot = await createCharacterSource('./assets/characters/explorer-robot/rig.json');
const scene = new CharacterScene({ cat, robot }, { width: 1280, height: 720 });

// 每次用絕對時間直接取影格，可任意 seek，不必先跑前面的幀。
const frame = scene.frame(1.2, {
  background: '#f1eee7',
  actors: [
    { character: 'cat', motion: 'jump', style: 'poster', x: 330, y: 430, scale: 2, travel: false },
    { character: 'robot', motion: 'wave', style: 'dots', x: 940, y: 420, scale: 1.8 },
  ],
});
document.body.append(frame);
```

角色 source、styles 和 scene 都重用自己的 Canvas；下一次 `frame()` 會更新它。要保留某一幀，當下複製到另一個 Canvas 或輸出 PNG。

`actor.x/y` 是角色 rig 的原點位置，`scale` 同時作用於角色及其位移。`start/end` 控制出場區間；`offset/rate` 控制動作時間；`flip/rotation/opacity` 控制場景中的角色。`travel:false` 不套用動作位移，適合原地能力比較。`camera:[x,y]` 平移整個角色場景；背景畫面／地面另由影片 compositor 同步。角色 `flip` 也會翻轉場景位移方向。

## 換角色：更換素材與配置

準備需要的透明角色分件。對照 [四腳貓配置](../../assets/characters/apricot-cat/rig.json) 與 [兩腳機械人配置](../../assets/characters/explorer-robot/rig.json)：renderer 沒有寫死身體、頭、手或腳的數量，關節名亦由配置決定。

| `rig.json` 欄位 | 寫甚麼 |
|---|---|
| `version` | `1` |
| `canvas` | 正整數 `width/height`、`origin:[x,y]` |
| `assets` | 任意 asset ID → 圖像路徑，相對 rig JSON |
| `joints` | 任意關節 ID → 原點相對座標 `[x,y]`，Canvas +x 向右、+y 向下 |
| `parts` 共用 | 穩定 `id`、`asset`、原圖像素 `rect:[x,y,w,h]`、`layer`；可加 opacity／Canvas filter |
| rigid part | `from` 錨點、可選 `to` 方向關節、裁圖內 `pivot`、`scale`；`sourceAngle` 為裁圖本身的骨方向弧度 |
| mesh part | `mesh.grid`、`bindings`；每 binding 寫 `from/to`、裁圖內 `sourceA/sourceB`、可選 `widthScale` |
| mesh blend | 兩骨時用 `blend:{axis,start,end}`；多骨用每頂點 `weights`，按 grid 由上至下、由左至右排列 |
| terminal pin | 可選 `mesh.pin`：joint、裁圖內 source、blend axis/start/end、scale；例如保持接地腳掌方向 |
| `orientation` | 左右分件的 `side/sourceSide`，均是角色自身的 anatomical `left/right`；鏡像時兩值不同。validator 核對 binding／pin 的鏡像是否一致 |
| `pairs` | 可選成對分件清單：`{id,left:partID,right:partID}`；左右分件應填此資料 |
| `bones` | 可選 debug 顯示的關節對，不決定繪圖綁定 |
| `legs` | 動作使用的 root/knee/foot、upper/lower、bend ±1、phase；可兩條、四條或其他數量 |
| `motions` | 可用動作名 → 動作規格；每個角色只列合適且已配置的動作 |

crop、pivot、骨長與接位仍須按新素材配置。PNG 不會自帶關節；不能任意換一張圖便保證動作自然。比例不同要調配置，轉側／背面或露出被遮擋部分需要額外圖像。

角色自身的左／右與畫面左／右分開，例如正面朝向觀眾時，角色左手在畫面右方。機械人使用一張右臂素材及一張左腿素材；另一側明確鏡像，`pairs` 及 `orientation` 驗證配置。負的 mesh `widthScale` 翻轉骨旁的素材；rigid 的單軸負 scale 翻轉手性，雙軸負 scale 是旋轉而不是左右互換。

驗證不能讀出 PNG 中哪個是拇指，也不能判斷任何新角色的美術是否合理。新素材應用完整角色參考、靜止姿勢、關鍵動作連續畫面及實際播放核對；新角色不能只填標籤及跑數值測試便宣稱已檢查。

## 換動作：沿用同一 rig

| type | 配置 | 行為 |
|---|---|---|
| `keyframes` | duration、loop、joints／transform tracks | 任意關節或整體變換；`[{t,value}]`，value 是點或 scalar，time 嚴格遞增 |
| `gait` | legs、speed、cycle、stance、lift、bob | 支撐腳在世界座標固定，抬腳前移；負 speed 同時翻轉面向；回報 reachability |
| `jump` | legs、prep、flight、land、height、distance、crouch、tuck | 準備、拋物線離地、收腿與落地；可 loop |
| `wave` | arm 骨鏈、target、raise／lower、duration、amplitude／frequency | 抬手、往復擺動、放手；可 loop |

```js
import { sampleMotion } from './fx/character/index.js';
const pose = sampleMotion(cat.rig.definition, 'walk', 1.2, { speed: 70 });
const raw = cat.rig.frame(pose);
const styled = cat.styles.frame(raw, 'ink');
```

pose 中的 joints 是角色局部座標，transform 是局部的 bob／方向等；`meta.worldX` 是場景位移，由 `CharacterScene` 套用。`meta.contacts` 記 stance/swing 與世界腳位；`meta.unreachable` 不能忽略，應調步幅、骨長或目標。

這些是有接觸約束的 2D 運動方法，不是碰撞、重力、肌肉或全身力學模擬器。打鬥、轉身、對話或特殊表演需要相應的 keyframes／素材；沒有宣稱任意動作已現成可用。

## 換風格：角色本身改畫法

目前提供 `original / poster / ink / pixel / dots / ascii / etch / duotone` 八種 code 畫法。可用 style ID 或自訂 style 物件：

```js
const frame = cat.frame(1.2, {
  motion: 'run',
  style: { mode: 'poster', colors: ['#192932', '#975956', '#e3b783', '#fff0d5'] },
});
// 點陣密度與色彩亦可配置。
cat.frame(1.2, { motion: 'run', style: { mode: 'dots', step: 4, ink: '#294f48' } });
```

這些處理顏色、明暗、像素／點／字形及排線，不會自動重畫造型。要角色變成另一種筆觸、比例或美術外形，可以準備一致的新分件版本並載入相應 rig；也可以在透明來源後接其他 Menu 處理。風格預設不代表所有藝術家的畫風。

## 不同影片怎樣共用

角色與動作配置不含固定 storyboard。單角色廣告、雙角色互動、風格切換或其他影片，都可以重用 source，再以 actor 時間、鏡頭位置及 compositor 編排。`studies.js` 是示範內容，不是影片必須遵守的結構。

## 檢查與重建

```sh
node --test tests/character-math.test.mjs
npx playwright test tests/character.spec.cjs tests/organization.spec.cjs
```

