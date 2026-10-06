# 声刻 SonicMint · 链上音乐发行平台

> 基于 [TapeOut 协议](https://tapeout.link) 的去中心化音乐发行平台。
> 音频永久上链，一次买断永久可听，版税即时结算，无服务器。

- **线上站点**：https://music.tapeout.link
- **密钥管家（keeper）**：https://keeper.tapeout.link
- **运行链**：X Layer（chainId 196），原生币 OKB

> 想把它推广到写真集、视频、会员卡等品类？见 [DESIGN.md](./DESIGN.md)（系统设计展望，含各类媒体的成本边界）。

---

## 目录

- [功能与特点](#功能与特点)
- [核心机制](#核心机制)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [已部署地址](#已部署地址)
- [快速开始](#快速开始)
- [部署](#部署)
- [合约 API](#合约-api)
- [存储规格](#存储规格)
- [密钥体系（TAP-10）](#密钥体系tap-10)
- [已知限制](#已知限制)

---

## 功能与特点

### 已实现功能

| 模块 | 功能 |
|---|---|
| 发行 | 上传音频、封面、歌词；单文件超 8.4MB 自动分片；免费或付费两种模式 |
| 加密发行 | 付费曲目在浏览器端用随机内容密钥 K 加密后上链，歌词共用同一把 K |
| 买断 | 一次付费永久可听，无订阅无月费；买断后立即可播 |
| 版税 | 每首可配多个收益方（地址 + 基点比例），付款当场分流，合约不留余额 |
| 分类 | 10 个分类：流行 / 摇滚 / 电子 / 嘻哈 / 民谣 / 爵士 / 古典 / 国风 / 纯音乐 / 播客 |
| 密钥交付 | 买断后 keeper 自动把 K 重新封装写入链上 vault，前端本地解密 |
| 播放 | 免费曲目直读链上明文；付费曲目本地解密；记录播放次数 |
| 个人 | 我的曲库（已购可播）、我发行的音乐与累计收入、按曲名或艺人搜索 |
| 界面 | 中英双语、深浅色主题、迷你播放条、播放队列、歌词跟随高亮、分享、PWA 离线缓存 |

### 技术特点

| 特点 | 说明 |
|---|---|
| 字节永久上链 | 音频、封面、歌词写进 TapeOut 容器（ERC-6551），每块 24,000 字节，一块一笔交易 |
| 免逐笔签名 | 临时操作员机制：用户只签 4 笔，其余上百笔由内存热密钥静默签发 |
| 流水线发交易 | 显式递增 nonce 连发，不逐笔等回执，每块耗时从约 4 秒降到 0.3 秒 |
| 无状态 keeper | 单个 Cloudflare Worker，vault 完全由链上 `sealedCEK` 重建，幂等可重试 |
| 密钥不落盘 | 钱包签名 → HKDF-SHA256 → X25519，密钥只存内存，换账户或换链即失效 |
| 合约自查容器 | 处理器由合约自行从工厂查询，不接受调用方传入；校验容器归属与开启状态 |
| 即时结算 | 付款当场按「平台抽成 → 版税 → 余数归平台」分完，合约不留余额 |
| 无自建服务器 | 前端纯静态，链上直读 + Worker 分发密钥，没有业务后端 |
| 费用前置可见 | 选中文件即算出块数、gas 与耗时，超阈值提示压缩 |
| 安全约束 | `nonReentrant` + Checks-Effects-Interactions；对外转账限 100k gas |

---

## 核心机制

### 发行：一次授权，静默写几百块

音频不存服务器，逐块写进 TapeOut 的 ERC-6551 容器。瓶颈在于 **每个 24KB 块都是一次独立的合约部署**，一首 6.7MB 的歌约 293 笔交易。

直接让钱包逐笔签会弹 293 次确认，所以走 **临时操作员** 机制：

1. 前端用 `ethers.Wallet.createRandom()` 生成一个临时密钥（只存内存，刷新即丢）
2. 你的钱包签 **第 1 笔**：转入预付 gas（按最大费率估算，用不完传完退回）
3. 你的钱包签 **第 2 笔**：`setOperator(容器, 临时地址, 3600)` 授权 1 小时
4. 临时密钥直连 RPC，静默签完所有块
5. 收尾：撤销授权、退回临时密钥剩余余额
6. 你的钱包签 **最后一笔**：`registerTrack` 把曲目登记上链

**293 次点击 → 4 次点击**，总 gas 不变，只是换了签名者。

交易发送走流水线：显式递增 nonce 连发、不逐笔等收据、末尾只等最后一笔（nonce 有序，最后一笔落块即前面全部落块）。实测每块从约 4 秒降到约 0.3 秒。

### 播放：付费曲目加密上链

- **免费唱片**：明文存链，任何人可播
- **付费唱片**：上传前用随机内容密钥 K 做 XChaCha20-Poly1305 加密，K 用 keeper 公钥封装成 `sealedCEK` 存合约；歌词用**同一把 K** 加密

买断后播放时，前端从链上 vault 取出属于自己的一份 K 解密。没有 K 只有密文。

### 买断：一次付费，永久可听

无订阅、无月费。`buy(trackId, buyerPubKey)` 付款即入账，收入按「平台抽成 → 版税分配 → 余数归平台」的顺序当场分完，合约不留余额。

买家提交自己的 X25519 公钥，keeper 据此把 K 重新封装成该买家的 vault 写回链上。

### 密钥分发：keeper

keeper 是一个 Cloudflare Worker，唯一职责是 `POST /sync { user, chainId }`：

读链上 `sealedCEK` → 用 keeper 私钥解出 K → 用买家公钥重新封装 → `setVault` 写链。

幂等无状态：vault 完全由链上数据重建，可重复调用；内容一致时不发交易。

---

## 技术架构

```
┌──────────────────────────────────────────────────────────┐
│  前端   https://music.tapeout.link                        │
│  Cloudflare Pages，纯静态 HTML/JS/CSS（无构建）+ PWA        │
│  ethers v6 本地化 · 加密模块 esbuild 打包为 crypto.js       │
└───────────────┬──────────────────────────┬───────────────┘
                │ 读写容器                  │ 请求封装 vault
┌───────────────▼──────────────┐  ┌────────▼───────────────┐
│  TapeOut 容器（ERC-6551）      │  │  keeper Worker          │
│  SiteRegistry 逐块存音频/封面/  │  │  keeper.tapeout.link    │
│  歌词，路径与哈希上链          │  │  解 sealedCEK → setVault │
└───────────────┬──────────────┘  └────────┬───────────────┘
                │                          │
┌───────────────▼──────────────────────────▼───────────────┐
│  SonicMint 合约（X Layer）                                 │
│  曲目登记 · 买断收款 · 版税分流 · sealedCEK / vault 存储    │
└──────────────────────────────────────────────────────────┘
```

---

## 项目结构

```
tapeout-music/
├── contracts/
│   └── SonicMint.sol          # 核心合约：曲目登记 + 买断 + 版税 + 密钥分发
├── frontend/
│   ├── index.html             # 单页应用：音乐广场 / 发行 / 我的（hash 路由）
│   ├── publish.html           # 跳转到 index.html#publish
│   ├── rules.html             # 发行规则说明
│   ├── app.js                 # 前端逻辑（钱包 / 上传 / 播放 / 买断）
│   ├── lang.js                # 中英文案与切换
│   ├── crypto.js              # vendor/tap10 的打包产物（IIFE，全局 TapeCrypto）
│   ├── style.css              # 样式（浅色 / 深色）
│   ├── sw.js                  # Service Worker（PWA 离线缓存）
│   ├── ethers.min.js          # ethers v6（本地化）
│   ├── og.png                 # 分享图（Open Graph / Twitter Card）
│   ├── robots.txt             # 抓取规则
│   ├── sitemap.xml            # 站点地图
│   └── vendor/tap10/          # TAP-10 密钥派生与载荷（fork 自 TapeKit）
├── keeper/
│   ├── src/worker.js          # keeper Worker 源码
│   ├── dist/worker.js         # 打包产物（部署用）
│   └── wrangler.toml          # Worker 配置（自定义域名 + 合约地址）
├── scripts/
│   ├── compile.js             # solc 编译 → artifacts/
│   ├── deploy.js              # 部署合约并登记 keeper
│   ├── keeper-key.js          # 派生 keeper 公钥并回填 app.js
│   ├── build-crypto.js        # vendor/tap10 → frontend/crypto.js
│   ├── build-keeper.js        # keeper/src → keeper/dist
│   ├── build-og.js            # og.svg → frontend/og.png（分享图）
│   ├── upload-audio.js        # CLI：直接上传音频到容器（自用，零点击）
│   └── publish-site.js        # CLI：把前端发到 TapeOut 容器
├── artifacts/                 # 编译产物（ABI + bytecode）
└── TapeKit/                   # TapeOut 协议实现（SPEC 与参考代码）
```

---

## 已部署地址

均为 X Layer（196）。

| 名称 | 地址 |
|---|---|
| SonicMint（本平台合约） | `0x243000a1BA9058E6A856d5AFAbAE575f9E549130` |
| SiteRegistry（TapeOut 容器存储） | `0xd6efb7adcc9c83dc4924ad56f6a8e4e969b9adb6` |
| ContainerOpener（TapeOut 容器开启器） | `0x536add8f30f03b69f6fbf29d425a816a0dc50106` |
| ProcessorFactory（TapeOut 处理器工厂） | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| 处理器 #260 | `0x0AbBcbCd6d822C79480fe8abe01952197a399008` |
| keeper（Worker 签名地址） | `0xE2f67d8AaefDfe8622E8dDDEF6f0D9fcda2db750` |

---

## 快速开始

环境要求：Node.js ≥ 18、EVM 钱包、钱包内有 OKB。

```bash
npm install
npm run compile          # 编译合约 → artifacts/
npx serve frontend       # 本地预览（链上交互需先部署合约）
```

---

## 部署

### 1. 合约

```bash
PRIVATE_KEY=0x... \
PROCESSOR=0x... \                    # 唯一允许发行的处理器地址（当前 #260）
PLATFORM=0x... \                     # 平台收款地址，默认取部署者
PLATFORM_BPS=300 \                   # 平台抽成（基点）
KEEPER=0x... \                       # 可选：顺带登记 keeper
npm run deploy
```

### 2. 重部署后的连锁改动

合约地址是密钥派生的输入（`hub`），**改地址必须走完这 4 步**，否则 keeper 封装出来的 vault 前端解不开：

```bash
# a. 更新 frontend/app.js 的 NETWORKS[196].music 与 keeper/wrangler.toml 的 CONTRACT
# b. 重算 keeper 公钥并回填 app.js
KEEPER_PRIVATE_KEY=0x... npm run keeper:key
# c. 重建并部署 Worker
npm run build:keeper
npm run deploy:keeper
# d. 部署前端
npm run deploy:web
```

> 上面是逐条执行。PowerShell 5 不支持 `&&`，要串行写用 `;`。

### 3. keeper Worker

```bash
# 首次需写入私钥（用 stdin 管道，避免 BOM 污染）
npx wrangler secret put KEEPER_PRIVATE_KEY --config keeper/wrangler.toml
npm run deploy:keeper
```

验证：

```bash
curl https://keeper.tapeout.link/info
# {"address":"0x...","publicKey":"0x...","chainId":196,"hub":"0x..."}
```

返回的 `publicKey` 必须与 `frontend/app.js` 里的 `KEEPER.publicKey` 一致。

### 4. 前端

```bash
npm run deploy:web       # Cloudflare Pages（当前生产）
```

自定义域名在 Pages 项目里绑定 `music.tapeout.link`；若 zone 与 Pages 同账号，还需手动加一条 CNAME 指向 `sonicmint.pages.dev`（代理开启）。

> 本机部署若报 `Unable to resolve Cloudflare's API hostname`，是 DNS 只返回 IPv6 导致的，加 `NODE_OPTIONS=--dns-result-order=ipv4first` 即可。

改动前端静态资源后要**同步升两处版本号**，否则客户端会一直吃旧缓存：

- `sw.js` 的 `CACHE`（`sonicmint-vNN`）—— 决定 Service Worker 何时换缓存
- `app.js` 的 `APP_VERSION` —— 显示在侧边栏底部，用来确认页面实际跑的是哪一版

两者不一致时，侧边栏会显示「页面 v50 · 缓存 v52（请刷新）」，提示用户重载。

---

## 合约 API

### 写入

| 函数 | 说明 |
|---|---|
| `registerTrack(container, tokenId, cpu, audioPath, partCount, coverPath, meta, wrappedCEK, royalties)` | 登记曲目。校验处理器白名单、容器归属与开启状态；返回 `trackId` |
| `play(trackId)` | 记录一次播放（不收费）。需免费或已买断 |
| `buy(trackId, buyerPubKey)` payable | 买断，收入即时分流。加密曲目必传买家 X25519 公钥 |
| `setVault(user, payload)` | 写入某用户的全量 vault（仅 keeper 或平台） |
| `setPlatform` / `setPlatformBps` / `setKeeper` / `setAllowedProcessor` | 平台管理（仅平台） |

### 读取

| 函数 | 说明 |
|---|---|
| `trackCount()` | 曲目总数 |
| `getTracks(offset, limit)` | 分页取曲目 |
| `getTrack(trackId)` / `getTrackRoyalties(trackId)` | 单曲详情与版税配置 |
| `getPurchased(user, offset, limit)` | 批量查买断状态 |
| `vaultOf(user)` | 用户的 vault 载荷 |
| `userPubKey(user)` | 用户登记的 X25519 公钥 |
| `sealedCEK(trackId)` | 封给 keeper 的内容密钥载荷 |
| `tracks(trackId)` / `purchased(user, trackId)` | 自动生成的 public 映射 |

### 数据结构

```solidity
struct TrackMeta {          // registerTrack 的入参
    string  title;
    string  artistName;
    uint8   genre;          // 0..9
    uint256 price;          // 买断价（wei）；free 时忽略
    bool    free;
    bool    encrypted;      // 加密曲目必须付费
    bytes32 artistPubKey;   // 艺人 X25519 公钥
    string  lyricsPath;     // 歌词路径，空串 = 无歌词
}

struct Track {
    address artist;
    address container;      // TapeOut 容器地址
    uint256 tokenId;        // 唱片容器 #ID
    uint256 cpu;            // 处理器编号
    string  audioPath;      // partCount > 1 时为 base path
    uint256 partCount;      // 0/1 = 单文件，>1 = 分片
    string  coverPath;
    string  lyricsPath;
    string  title;
    string  artistName;
    uint8   genre;
    uint256 playCount;
    uint256 totalEarned;
    uint256 createdAt;
    uint256 price;
    bool    free;
    bool    encrypted;
    bytes32 artistPubKey;
    bool    exists;
}

struct RoyaltyRecipient { address addr; uint256 bps; }  // 10000 = 100%
```

### 版税分配

`_distributeRoyalties` 的顺序：

1. 平台抽成 `amount × platformBps / 10000`
2. 剩余部分按 `trackRoyalties` 的 bps 分配
3. 取整余数归平台，确保金额全部分出

`royalties` 为空数组时默认艺人拿 100%。

### 安全设计

- `nonReentrant` + Checks-Effects-Interactions
- 外部转账限定 100k gas，防接收方合约吞噬
- 处理器由合约自行从工厂查询，不接受调用方传入，无法绕过白名单
- 容器地址必须等于 `opener.accountOf(cpuAt(cpu), tokenId)` 且已开启

---

## 存储规格

音频、封面、歌词全部存进 TapeOut 容器，路径与 SHA-256 上链。

| 项目 | 值 |
|---|---|
| 块大小 | 24,000 字节（协议常量 `CHUNK_MAX`） |
| 单文件上限 | 350 块 = 8,400,000 字节 |
| 超过 8.4MB | 自动分片为 `.part0` / `.part1`…，`partCount` 记分片数 |
| 支持音频 | MP3 · WAV · FLAC · AAC/M4A |
| 支持图片 | JPG · PNG · WebP · GIF |
| 歌词 | 纯文本或 LRC 时间轴；付费曲目随音频一同加密 |
| 读取方式 | 浏览器直连 `SiteRegistry.readRange` 取字节（**不要用 `{tokenId}-{cpu}.tapekit.org`**，那个域名只返回引导页，拿不到文件字节） |
| 容器月费 | 约 0.08 OKB（TapeOut 官方收取） |

### 路径约定

```
music/{tokenId}.{cpu}.{ext}          # 音频（单文件）
music/{tokenId}.{cpu}.part{N}        # 音频（分片）
music/{tokenId}.{cpu}.cover.{ext}    # 封面
music/{tokenId}.{cpu}.lrc            # 歌词
```

### 上传成本

| 项目 | 实测 |
|---|---|
| 满块 24KB | 5,501,546 gas |
| gasPrice | 0.02 gwei |
| 单块成本 | 约 0.00011 OKB |
| X Layer 出块 / 区块 gas 上限 | 1 秒 / 210,000,000 |

费用 ≈ `块数 × 0.00011 OKB`，6.7MB 约 0.032 OKB。界面会在选择文件后显示预估。

授权时预转的金额按 `maxFeePerGas` 估算，约为实际花费的 2.5 倍，传完自动退回。

---

## 密钥体系（TAP-10）

固定密钥域，**改动会让所有已派生的密钥失效**：

| 参数 | 值 |
|---|---|
| `KEY_DOMAIN` | `music.tapeout.link` |
| `chainId` | 196 |
| `tokenId` / `cpuIndex` | `1` / `0` |
| `container` / `holder` | 用户（或 keeper）自身地址 |
| `hub` | SonicMint 合约地址 |

派生方式：钱包对固定文案签一次名（EIP-191），由签名经 HKDF-SHA256 导出 X25519 密钥对。前端与 keeper 用同一套 `frontend/vendor/tap10/keys.js`，结果确定性一致。

密钥只存内存，不落盘。换账户或换链后立即失效。

---

## 已知限制

- **上传中途关闭页面会锁死预付的 gas**：临时密钥只存内存，页面销毁后无法退回。上传期间有 `beforeunload` 拦截提醒。
- **流水线的在途交易**：上传中断后已发出的几百笔仍会陆续上链。此时不要立刻重试，否则两个写入方会互相踩 `appendChunk` 的 `expectIndex` 校验。新版结尾有字节数核对，写不完整会明确报错。
- **单账号发送速率受 RPC 限制**：实测约 3.5 笔/秒，并发与多端点均无收益（RPC 按发送方串行处理）。
- **只能发行处理器 #260 下的容器**：合约 `allowedProcessor` 限制，需先在 [id.tapeout.link](https://id.tapeout.link) 开通容器。
- 仅支持 X Layer。

---

## License

MIT，见 [LICENSE](./LICENSE)。
