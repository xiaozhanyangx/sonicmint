# 声刻 SonicMint · 链上音乐发行平台

> 基于 [TapeOut 协议](https://tapeout.link) 的去中心化音乐发行与版税结算平台。
> 音频永久上链，播放版税即时结算，无服务器、不可篡改。

---

## 目录

- [项目简介](#项目简介)
- [核心特性](#核心特性)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [合约部署](#合约部署)
- [前端发布到 TapeOut](#前端发布到-tapeout)
- [多链支持](#多链支持)
- [合约 API](#合约-api)
- [播放与结算规则](#播放与结算规则)
- [存储规格](#存储规格)
- [常见问题](#常见问题)

---

## 项目简介

声刻 SonicMint 让音乐人将唱片直接发行到区块链上：

1. **音频上链** — 音乐文件通过 TapeOut 的 `SiteRegistry` 合约存到链上容器，永久不可删除
2. **所有权可验证** — 每首歌绑定 Circuit NFT + ERC-6551 Container，归属清晰
3. **版税即时结算** — 播放付费按预设比例即时分流给艺人、制作人等多方收益方
4. **全链上无服务器** — 前端、音频、合约逻辑全部运行在链上

支持 **BNB Chain** 和 **X Layer** 两条链。

---

## 核心特性

| 特性 | 说明 |
|------|------|
| 曲库搜索 | 按曲目名 / 艺人名实时过滤 |
| 全部 / 我的切换 | 只看自己发行的曲目 |
| 播放队列 | 上一曲 / 下一曲，播放结束自动连播 |
| 播放历史 | 最近播放 5 条记录（localStorage，点击直接播放） |
| 曲目分享 | 一键分享 / 复制带 track 参数的深链 |
| 创作者面板 | 版税仪表盘：已发行数、累计版税、待结算播放统计与逐曲明细 |
| 深色模式 | 跟随系统偏好，手动切换并记忆 |
| 多语言 | 中文 / English 一键切换并记忆 |
| PWA | manifest + Service Worker，可安装到主屏幕、离线可用 |
| 移动端适配 | 汉堡菜单、全宽触摸目标（≥44px）、悬浮播放器 |

| 🎵 永久唱片 | 音频存于 BNB Chain / X Layer，链在数据在 |
| 💰 即时版税 | 付费播放按比例即时分流，无中间方拖欠 |
| 👥 多方版税 | 每首歌可配置多个收益方（艺人/制作人/作词/作曲） |
| 📡 订阅制 | 月费进池子，按播放占比月底分流给艺人 |
| 🛡️ 抗女巫 | 订阅免费播放需持有 TapeOut Circuit NFT |
| 🆓 免费唱片 | 可标记为免费，所有人可听（不分钱不计池） |
| 🎧 无损分片 | 单文件 >8.4MB 自动分片上传，前端合并播放 |
| 🌐 多链支持 | BNB Chain + X Layer，一键切换 |
| 🖼️ 封面图 | 支持上传唱片封面，存链上 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户层（前端 DeWEB）                    │
│  音乐播放器网站（HTML/JS/CSS 存链上，TapeKit Gateway 访问） │
└──────────────────────┬──────────────────────────────────┘
                       │ 加载音频 / 交互
┌──────────────────────▼──────────────────────────────────┐
│                  资产层（链上存储）                        │
│  SiteRegistry 记录音频文件路径 + SHA-256 哈希             │
│  单首歌分片：track_part0.mp3 (8.4MB) / part1.mp3 ...     │
└──────────────────────┬──────────────────────────────────┘
                       │ 所有权 / 版税
┌──────────────────────▼──────────────────────────────────┐
│                  所有权层（NFT + 账户）                    │
│  每张唱片 = Circuit NFT + Container（ERC-6551）           │
│  版税分流规则写入智能合约（艺人/制作人/平台/合作方）        │
└──────────────────────┬──────────────────────────────────┘
                       │ 播放计数 / 结算
┌──────────────────────▼──────────────────────────────────┐
│                  结算层（SonicMint 合约）                 │
│  付费播放 → 即时分流                                      │
│  订阅播放 → 按月按播放占比从订阅池分流                     │
│  免费播放 → 不计费不分钱                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 技术栈

- **智能合约**：Solidity ^0.8.20
- **前端**：原生 HTML / CSS / JavaScript（无框架，可直接上链）
- **钱包交互**：ethers.js v6
- **链上存储**：TapeOut SiteRegistry（DeWEB）
- **编译**：solc 0.8.28
- **支持链**：BNB Chain (56)、X Layer (196)

---

## 项目结构

```
tapeout-music/
├── contracts/
│   └── SonicMint.sol           # 核心合约：曲库 + 版税结算 + 订阅制
├── frontend/
│   ├── index.html              # 曲库首页（黑胶唱片 Hero + 播放器）
│   ├── publish.html            # 发行页面（上传音频/封面/配置版税）
│   ├── rules.html              # 发行规则说明页
│   ├── app.js                  # 前端逻辑（钱包/搜索/队列/播放/结算）
│   ├── lang.js                 # 多语言词典（中/英）与切换逻辑
│   ├── sw.js                   # Service Worker（PWA 离线缓存）
│   ├── manifest.json           # PWA 清单（安装到主屏幕）
│   ├── icon.svg                # PWA 应用图标
│   ├── style.css               # 样式（浅色/深色主题，参考 tapeout.link 视觉）
│   └── ethers.min.js           # ethers v6（本地化，支持链上部署）
├── scripts/
│   ├── compile.js              # solc 编译 → artifacts/
│   ├── deploy.js               # 部署合约到链
│   ├── publish-site.js         # 发布前端到 TapeOut 链上容器
│   └── upload-audio.js         # CLI 上传单个音频到容器
├── artifacts/
│   ├── SonicMint.abi.json      # 合约 ABI
│   └── SonicMint.bin           # 合约 Bytecode
└── package.json
```

---

## 快速开始

### 环境要求

- Node.js ≥ 18
- 一个 EVM 钱包（MetaMask / OKX Wallet 等）
- 钱包中有 BNB 或 OKB 用于支付 Gas

### 安装依赖

```bash
npm install
```

### 编译合约

```bash
npm run compile
```

输出到 `artifacts/SonicMint.abi.json` 和 `artifacts/SonicMint.bin`。

### 本地预览前端

```bash
npx serve frontend
# 打开 http://localhost:3000
```

> 本地预览可查看 UI，但区块链交互（上传/播放/订阅）需要部署合约后才能使用。

---

## 合约部署

### 部署到 BNB Chain

```bash
PRIVATE_KEY=0x你的私钥 \
PLATFORM=0x平台收款地址 \
PLATFORM_BPS=1000 \
MIN_PLAY_PRICE=0 \
MONTHLY_FEE=10000000000000000 \
npm run deploy
```

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `PRIVATE_KEY` | 必填 | 部署者私钥 |
| `PLATFORM` | 部署者地址 | 平台收益收款地址 |
| `PLATFORM_BPS` | `1000` (10%) | 付费播放时平台分成（基点） |
| `MIN_PLAY_PRICE` | `0` | 单次付费播放最低价（wei） |
| `MONTHLY_FEE` | `0.01 BNB` | 订阅月费（wei） |
| `RPC_URL` | BNB 主网 RPC | 可覆盖为其他链 RPC |

部署成功后会输出合约地址，将其填入 `frontend/app.js` 的 `NETWORKS[56].music`。

### 部署到 X Layer

```bash
PRIVATE_KEY=0x你的私钥 \
RPC_URL=https://rpc.xlayer.tech \
PROCESSOR_FACTORY=0xXLayer上的ProcessorFactory地址 \
npm run deploy
```

将输出的合约地址填入 `frontend/app.js` 的 `NETWORKS[196].music`，同时填入 X Layer 的核心合约地址。

---

## 前端发布到 TapeOut

部署完成后，将前端发布到 TapeOut 链上容器，实现全链上无服务器运行。

### 前置条件

1. 拥有一个已开通容器的 TapeOut Circuit（在 [id.tapeout.link](https://id.tapeout.link) 开通，月费 0.08 BNB）
2. 知道 Circuit 的 `tokenId` 和处理器编号 `cpu`

### 发布

```bash
PRIVATE_KEY=0x你的私钥 \
TOKEN_ID=4246 \
CPU=0 \
npm run publish-site
```

发布后访问：`https://{tokenId}-{cpu}.tapekit.org/`

例如 `tokenId=4246, cpu=0` → `https://4246-0.tapekit.org/`

---

## 多链支持

项目支持 **BNB Chain** 和 **X Layer**，在 `frontend/app.js` 中通过 `NETWORKS` 配置：

```js
const NETWORKS = {
  56: {  // BNB Chain
    name: "BNB Chain", symbol: "BNB",
    siteRegistry:     "0xd006ffdd...",
    containerOpener:  "0x021745DE...",
    processorFactory: "0x68224F66...",
    music:            "0x...",  // 部署后填入
  },
  196: {  // X Layer
    name: "X Layer", symbol: "OKB",
    rpc: "https://rpc.xlayer.tech",
    siteRegistry:     "0x...",  // 填入 X Layer 核心合约地址
    music:            "0x...",  // 部署后填入
  },
};
```

### 网络切换

- 导航栏有 **BNB / X Layer** 切换按钮
- 点击自动调用钱包 `wallet_switchEthereumChain`
- 未添加的网络会自动 `wallet_addEthereumChain`
- 切换后页面自动重载，加载对应链的合约
- 所有金额显示自动切换代币符号（BNB ↔ OKB）

### X Layer 部署须知

X Layer 的 TapeOut 核心合约地址（SiteRegistry / ContainerOpener / ProcessorFactory）需要从 TapeOut 官方文档获取，然后填入 `NETWORKS[196]`。

---

## 合约 API

### 核心函数

| 函数 | 说明 |
|------|------|
| `registerTrack(container, tokenId, cpu, audioPath, partCount, coverPath, title, artistName, free, royalties)` | 注册曲目，返回 trackId |
| `play(trackId)` payable | 播放曲目（付费/订阅/免费三种模式） |
| `subscribe()` payable | 订阅（支付月费，有效期 30 天） |
| `settleTrack(trackId)` | 结算订阅播放版税（从池子按比例分流） |
| `getTracks(offset, limit)` | 分页查询曲目列表 |
| `trackCount()` | 曲目总数 |
| `subscriptionPool()` | 当前订阅池余额 |
| `totalPendingPlays()` | 待结算的订阅播放总数 |
| `isSubscriber(user)` | 查询用户是否在订阅期内 |
| `monthlyFee()` | 订阅月费 |
| `minPlayPrice()` | 最低付费播放价 |

### 数据结构

```solidity
struct Track {
    address artist;          // 主艺人（注册者）
    address container;       // TapeOut 容器地址
    uint256 tokenId;         // 电路 #ID
    uint256 cpu;             // 处理器编号
    string  audioPath;       // 音频路径
    uint256 partCount;       // 分片数
    string  coverPath;       // 封面图路径
    string  title;
    string  artistName;
    uint256 playCount;       // 总播放次数
    uint256 totalEarned;     // 累计版税收入
    uint256 pendingPlays;    // 待结算播放次数
    uint256 createdAt;
    bool    free;            // 是否免费唱片
    bool    exists;
}

struct RoyaltyRecipient {
    address addr;   // 收益方地址
    uint256 bps;    // 分成比例（基点，10000 = 100%）
}
```

### 安全设计

- **重入保护**：`nonReentrant` 修饰器 + Checks-Effects-Interactions 模式
- **Gas 限制**：ETH 转账限定 100k gas，防止接收方合约吞噬 gas
- **即时结算**：`play()` 收到的金额全额即时分流，合约不留余额
- **参数校验**：版税比例总和 ≤ 100%，地址和路径非空校验

---

## 播放与结算规则

### 三种播放模式

| 模式 | 条件 | 结算方式 |
|------|------|---------|
| **免费播放** | 曲目标记为 `free` | 不分钱、不计入池子，任何人可听 |
| **付费播放** | 非订阅用户播放非免费曲目 | 按 `minPlayPrice` 即时分流给收益方 |
| **订阅播放** | 订阅用户（需持有 Circuit NFT）播放非免费曲目 | 计入 `pendingPlays`，按播放占比从订阅池分流 |

### 版税分配

- 付费播放金额先扣平台分成（`platformBps`，默认 10%）
- 剩余部分按曲目的 `royalties` 比例分流给各收益方
- 未分配的部分归主艺人（注册者）

### 订阅池结算

```
单曲应得 = 池子余额 × (该曲 pendingPlays / 总 pendingPlays)
```

任何人都可调用 `settleTrack(trackId)` 触发结算，结算后 `pendingPlays` 清零。

---

## 存储规格

| 项目 | 限制 |
|------|------|
| 单文件上限 | 8.4 MB（超过自动分片） |
| 支持格式 | MP3 / WAV / FLAC / OGG |
| 封面格式 | JPG / PNG / WebP（建议 1:1） |
| 存储网络 | BNB Chain / X Layer |
| 访问方式 | `https://{tokenId}-{cpu}.tapekit.org/{path}` |
| 容器月费 | 0.08 BNB（TapeOut 官方收费） |

### 分片机制

- 音频 > 8.4MB 时自动分片为 `.part0`、`.part1`...
- 播放时前端 `fetch` 所有分片 → `Blob` 合并 → 播放
- 注册时 `partCount` 记录分片数

---

## 常见问题

**Q: 发行一张唱片需要多少钱？**

A: 主要成本是 Gas 费（存储音频到链上）。一首 3-4 分钟 MP3（约 4MB）在 BNB Chain 上通常几美元。容器月费 0.08 BNB 由 TapeOut 收取。

**Q: 免费唱片艺人怎么赚钱？**

A: 免费唱片用于推广引流，不分钱。艺人可通过付费曲目、订阅池分成等其他曲目赚钱。

**Q: 可以删除已发行的唱片吗？**

A: 不可以。音频存在链上永久不可删。这是"永久唱片"的核心特性。

**Q: 如何支持无损音质？**

A: FLAC/WAV 文件超过 8.4MB 时会自动分片上传，播放时前端合并。

**Q: 外部平台如何接入结算？**

A: 外部播放平台只需集成合约的 `play(trackId)` 函数，调用时传入播放费，合约即时按比例分流版税。

**Q: 如何切换到 X Layer？**

A: 1) 在 X Layer 部署音乐合约；2) 填入 X Layer 核心合约地址到 `NETWORKS[196]`；3) 用户在导航栏点击 X Layer 切换。

---

## License

MIT
