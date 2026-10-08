/* ============================================================
 * 声刻 SonicMint v4 · 前端逻辑
 * 特性：X Layer / 买断制 / 加密上链 / 分类 / 多方版税 / 无损分片
 * ============================================================ */

// 前端版本：与 sw.js 的 CACHE 版本同步维护，展示在侧边栏底部
const APP_VERSION = "v83";

// ───────── 链配置（仅 X Layer）─────────
// 核心合约地址需从 TapeOut 官方 X Layer 部署文档获取后填入
const NETWORKS = {
  196: {
    name: "X Layer",
    symbol: "OKB",
    rpc: "https://rpc.xlayer.tech",
    explorer: "https://www.okx.com/web3/explorer/xlayer",
    siteRegistry:     "0xd6efb7adcc9c83dc4924ad56f6a8e4e969b9adb6", // TapeOut 网站注册表（Base / X Layer 同址）
    containerOpener:  "0x536add8f30f03b69f6fbf29d425a816a0dc50106", // TapeOut 容器开启器
    processorFactory: "0x1f09daefa827f02cbb40967cc91b259763760761", // TapeOut 处理器工厂
    music:            "0x243000a1BA9058E6A856d5AFAbAE575f9E549130",
  },
};

let currentChainId = 196;
let currentNetwork = NETWORKS[196];

const CHUNK_MAX = 24000;
const FILE_MAX  = 8_400_000;

// 浏览器对 AAC/M4A 的 MIME 判定不一致，统一按扩展名兜底
const AUDIO_MIME = {
  mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac",
  aac: "audio/aac", m4a: "audio/mp4", ogg: "audio/ogg", opus: "audio/ogg",
};
const extOf = (name) => String(name).split(".").pop().toLowerCase();
// 上传：优先用浏览器给的 type，缺失或不对时按扩展名映射
const uploadMime = (ext, fileType) =>
  (fileType && fileType.startsWith("audio/") ? fileType : AUDIO_MIME[ext]) || "audio/mpeg";
// 播放：链上只存路径，按路径扩展名还原；分片路径没有扩展名，退回 audio/mpeg
const pathMime = (path) => AUDIO_MIME[extOf(path)] || "audio/mpeg";

// 唯一允许发行的处理器编号（须与合约 allowedProcessor 一致）
const PROCESSOR_NO = 260;
// TapeOut 链区号（X Layer = 2）：容器名 = tokenId.区号.cpu，如 1.2.260
const CHAIN_AREA = 2;
// 音频分类：索引即合约里的 genre（0..MAX_GENRE），文案见 lang.js 的 genre.N
const GENRES = ["pop", "rock", "electronic", "hiphop", "folk", "jazz", "classical", "gufeng", "instrumental", "podcast"];
// 平台密钥管家（keeper）：封装/解封曲目内容密钥 K。部署后由 scripts/keeper-key.js 生成并回填
const KEEPER = {
  address: "0xE2f67d8AaefDfe8622E8dDDEF6f0D9fcda2db750",
  publicKey: "0x1bbd22220442da7847773465fe5dc4d3c27a63a176a6148a393645d811b0651c", // keeper 的 X25519 公钥
};
// 购买后通知 keeper 封装 vault；走自定义域名（workers.dev 在大陆被 DNS 污染）
const KEEPER_SYNC = "https://keeper.tapeout.link/sync";
// 电路 NFT（处理器合约）只读接口
const CIRCUIT_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function nextId() view returns (uint256)",
];

// ───────── ABI（v2）─────────
const SITE_REGISTRY_ABI = [
  "function putFile(address container, string path, string contentType, bytes32 sha256Hash, bytes firstChunk)",
  "function appendChunk(address container, string path, uint256 expectIndex, bytes chunk)",
  "function setOperator(address container, address op, uint256 ttl)",
  "function fileInfo(address container, string path) view returns (uint256, string, bytes32, uint256, uint256)",
  "function readRange(address container, string path, uint256 offset, uint256 len) view returns (bytes)",
];
const CONTAINER_OPENER_ABI = [
  "function accountOf(address processor, uint256 tokenId) view returns (address)",
  "function isOpened(address processor, uint256 tokenId) view returns (bool)",
];
const PROCESSOR_FACTORY_ABI = [
  "function cpuAt(uint256 number) view returns (address)",
];
const SONICMINT_ABI = [
  "function registerTrack(address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, tuple(string title, string artistName, uint8 genre, uint256 price, bool free, bool encrypted, bytes32 artistPubKey, string lyricsPath) meta, bytes wrappedCEK, tuple(address addr, uint256 bps)[] royalties) returns (uint256)",
  "function play(uint256 trackId)",
  "function buy(uint256 trackId, bytes32 buyerPubKey) payable",
  "function trackCount() view returns (uint256)",
  "function vaultOf(address user) view returns (bytes)",
  "function userPubKey(address user) view returns (bytes32)",
  "function getPurchased(address user, uint256 offset, uint256 limit) view returns (bool[])",
  "function getTracks(uint256 offset, uint256 limit) view returns (tuple(address artist, address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, string lyricsPath, string title, string artistName, uint8 genre, uint256 playCount, uint256 totalEarned, uint256 createdAt, uint256 price, bool free, bool encrypted, bytes32 artistPubKey, bool exists)[])",
];

// ───────── 状态 ─────────
let provider, signer, account;
let musicContract, registryContract, openerContract, factoryContract;
let tracksCache = [];
let currentTrackIdx = null;
let searchQuery = "";
let royaltyRecipients = []; // [{addr, bps}]
let purchasedCache = [];       // bool[]，与 tracksCache 同索引
let myKeyPair = null;          // 当前钱包派生的 X25519 密钥对（仅存内存，不落地）
let vaultKeys = null;          // {trackId: K 的 hex}，来自链上 vault
let walletReady = false;       // 完成一次连接握手后才响应钱包事件，屏蔽握手期的噪声

const $ = (id) => document.getElementById(id);
const shortAddr = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const escapeHtml = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
const sym = () => currentNetwork.symbol;

// 拼接字节数组（分片下载后合并）
function concatBytes(chunks) {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// ───────── 链上读取 ─────────
// tapekit.org 是指南页网关：它对每条路径都返回同一个引导页，拿不到文件字节，
// 所以音频/封面/歌词一律自己从 SiteRegistry.readRange 读。
const READ_SEG = 1_200_000; // 单次 readRange 实测可返回约 1.2MB

let readProvider = null;
const fileCache = new Map();  // `${container}:${path}` → { bytes, type }
const blobCache = new Map();  // 同上 → blob URL（给 img / audio 用）

// 专用只读 provider：不借钱包节点，避免几十次 view 调用被钱包限流
function chainReader() {
  if (!readProvider) readProvider = new ethers.JsonRpcProvider(currentNetwork.rpc);
  return readProvider;
}

// 读一个链上文件，带内存缓存；onProgress(已读, 总长) 用于展示读取进度
async function chainFile(t, path, onProgress) {
  const key = `${t.container}:${path}`;
  const hit = fileCache.get(key);
  if (hit) return hit;
  const reg = new ethers.Contract(currentNetwork.siteRegistry, SITE_REGISTRY_ABI, chainReader());
  const info = await reg.fileInfo(t.container, path);
  const size = Number(info[0]);
  if (!size) throw new Error(`容器里没有 ${path}`);
  const parts = [];
  for (let off = 0; off < size; off += READ_SEG) {
    const raw = await reg.readRange(t.container, path, off, Math.min(READ_SEG, size - off));
    parts.push(ethers.getBytes(raw));
    if (onProgress) onProgress(Math.min(off + READ_SEG, size), size);
  }
  const out = { bytes: concatBytes(parts), type: info[1] || "" };
  fileCache.set(key, out);
  if (path === t.coverPath) idbSet(key, out); // 封面落盘，二次打开直接本地读
  return out;
}

// 读成 blob URL（图片用；audio 直接拿 bytes 解密后再建 blob）
async function chainBlobUrl(t, path) {
  const key = `${t.container}:${path}`;
  const hit = blobCache.get(key);
  if (hit) return hit;
  const { bytes, type } = await chainFile(t, path);
  const url = URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
  blobCache.set(key, url);
  return url;
}

// 资源 URL：只认已就绪的 blob；未命中返回空串（模板显示占位），后台读完再重绘
function fileUrl(t, path) {
  if (!path) return "";
  if (/^(blob:|data:|https?:)/.test(path)) return path;
  return blobCache.get(`${t.container}:${path}`) || "";
}

let coverRefreshPending = false;
function refreshAfterAsset() {
  if (coverRefreshPending) return;
  coverRefreshPending = true;
  setTimeout(() => {
    coverRefreshPending = false;
    renderTracks();
    renderQueue();
    // 迷你播放条已显示时同步刷新封面（不主动展开，避免没播放就冒出来）
    const mini = $("miniPlayer");
    if (currentTrackIdx != null && mini && !mini.hidden && tracksCache[currentTrackIdx]) {
      fillMini(tracksCache[currentTrackIdx]);
      syncLyrics(); // fillMini 会写回艺人名，歌词行要立刻补回来
    }
  }, 50);
}

// 后台把封面读进 blob 缓存；到达后重绘（此时重绘是瞬时的）
function preloadCovers(tracks) {
  tracks.forEach((t) => {
    if (!t.coverPath || blobCache.has(`${t.container}:${t.coverPath}`)) return;
    chainBlobUrl(t, t.coverPath).then(refreshAfterAsset).catch((e) => console.warn("封面读取失败", e));
  });
}

// ───────── 本地持久化缓存（二次打开免等链）─────────
// 曲目元数据存 localStorage，封面字节存 IndexedDB；只作首屏兜底，随后一律用链上数据覆盖
const CACHE_KEY = "sm.tracks.v1";
const IDB_NAME = "sonicmint";
const IDB_STORE = "files";
// getTracks 的 tuple 字段顺序（Result 的具名属性不进 JSON，须显式映射成普通对象）
const TRACK_FIELDS = ["artist", "container", "tokenId", "cpu", "audioPath", "partCount", "coverPath", "lyricsPath",
  "title", "artistName", "genre", "playCount", "totalEarned", "createdAt", "price", "free", "encrypted", "artistPubKey", "exists"];
const TRACK_BIGINTS = new Set(["tokenId", "cpu", "partCount", "genre", "playCount", "totalEarned", "createdAt", "price"]);

let idbPromise = null;
function idb() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(() => null); // 隐私模式等禁用 IndexedDB 时降级为无缓存
  }
  return idbPromise;
}

async function idbGet(key) {
  const db = await idb();
  if (!db) return null;
  return new Promise((resolve) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key, val) {
  const db = await idb();
  if (!db) return;
  const tx = db.transaction(IDB_STORE, "readwrite");
  tx.onerror = () => {};
  tx.objectStore(IDB_STORE).put(val, key);
}

// 曲目当前状态指纹：比对缓存与链上数据是否一致，避免无谓重绘
function tracksSignature() {
  return JSON.stringify(tracksCache.map((t) => TRACK_FIELDS.map((k) => (typeof t[k] === "bigint" ? t[k].toString() : t[k]))));
}

// 已购状态与账号绑定：换账号时缓存里的已购标记不能复用
function readTracksCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.tracks)) return null;
    const tracks = data.tracks.map((row) => {
      const o = {};
      TRACK_FIELDS.forEach((k, i) => { o[k] = TRACK_BIGINTS.has(k) && row[i] != null ? BigInt(row[i]) : row[i]; });
      return o;
    });
    return { tracks, account: data.account || "", purchased: Array.isArray(data.purchased) ? data.purchased : [] };
  } catch {
    return null;
  }
}

function writeTracksCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      account: account || "",
      purchased: account ? purchasedCache : [],
      tracks: tracksCache.map((t) => TRACK_FIELDS.map((k) => (typeof t[k] === "bigint" ? t[k].toString() : t[k]))),
    }));
  } catch { /* 超出配额等情况忽略，只是没缓存 */ }
}

// 用 IndexedDB 里的封面字节建 blob URL，使首屏渲染就有图
async function hydrateCachedCovers(tracks) {
  await Promise.all(tracks.map(async (t) => {
    if (!t.coverPath) return;
    const key = `${t.container}:${t.coverPath}`;
    if (blobCache.has(key)) return;
    const hit = await idbGet(key);
    if (!hit || !hit.bytes) return;
    fileCache.set(key, hit);
    blobCache.set(key, URL.createObjectURL(new Blob([hit.bytes], { type: hit.type || "application/octet-stream" })));
  }));
}

// ───────── 轻提示（替代 alert，不阻塞交互）─────────
let toastWrap;
function toast(msg, type) {
  if (!toastWrap) {
    toastWrap = document.createElement("div");
    toastWrap.className = "toast-wrap";
    document.body.appendChild(toastWrap);
  }
  const el = document.createElement("div");
  el.className = "toast" + (type ? ` toast--${type}` : "");
  el.textContent = msg;
  toastWrap.appendChild(el);
  setTimeout(() => {
    el.classList.add("toast--out");
    setTimeout(() => el.remove(), 220);
  }, 2600);
}
window.toast = toast;

async function sha256Bytes(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return "0x" + Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ───────── 钱包 ─────────
async function connectWallet(silent) {
  if (!window.ethereum) { toast("请安装 MetaMask / OKX Wallet 等 EVM 钱包", "err"); return; }
  try {
    // 自动重连（silent）已授权，跳过 eth_requestAccounts，避免钱包补发事件造成干扰
    if (silent !== true) await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    walletReady = true; // 握手完成，之后钱包事件才生效
    $("connectBtn").textContent = shortAddr(account);

    const net = await provider.getNetwork();
    currentChainId = Number(net.chainId);
    currentNetwork = NETWORKS[currentChainId] || null;

    const badge = $("chainBadge");
    if (currentNetwork) {
      badge.textContent = `${currentNetwork.name} ✓`;
      badge.classList.add("badge--ok");
      badge.style.color = "";
      // 高亮当前网络按钮（桌面 + 移动菜单）
      document.querySelectorAll(".btn--net").forEach((b) => {
        b.classList.toggle("is-active", Number(b.dataset.chain) === currentChainId);
      });
    } else {
      badge.textContent = `链 ${currentChainId}（不支持）`;
      badge.style.color = "var(--danger)";
      musicContract = null;
      // 只支持 X Layer，连上即请求切链（成功后 chainChanged 刷新页面）
      toast(`检测到链 ${currentChainId}，正在切换到 X Layer…`);
      switchNetwork(196);
      return;
    }

    musicContract    = new ethers.Contract(currentNetwork.music, SONICMINT_ABI, signer);
    registryContract = new ethers.Contract(currentNetwork.siteRegistry, SITE_REGISTRY_ABI, signer);
    openerContract   = new ethers.Contract(currentNetwork.containerOpener, CONTAINER_OPENER_ABI, provider);
    factoryContract  = new ethers.Contract(currentNetwork.processorFactory, PROCESSOR_FACTORY_ABI, provider);

    // 更新网络相关显示
    updateNetworkLabels();
    // 换账户/换链后旧密钥失效
    myKeyPair = null; vaultKeys = null;
    // 连接后刷新依赖账户的视图（曲库与发行面板可能同时存在，不能二选一）
    if ($("refreshBtn")) await loadTracks();
    if ($("inCircuit")) loadCreatorPanel(false); // 曲库已刷新，这里跳过重复拉取
    else if (!$("refreshBtn")) loadCreatorPanel();
  } catch (e) {
    console.error(e);
    toast("连接失败：" + e.message, "err");
  }
}

// ───────── 切换网络 ─────────
async function switchNetwork(chainId) {
  if (!window.ethereum) { toast("请先连接钱包", "err"); return; }
  const net = NETWORKS[chainId];
  if (!net) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + chainId.toString(16) }],
    });
  } catch (e) {
    // 钱包未添加该网络，尝试添加
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x" + chainId.toString(16),
          chainName: net.name,
          nativeCurrency: { name: net.symbol, symbol: net.symbol, decimals: 18 },
          rpcUrls: [net.rpc],
          blockExplorerUrls: [net.explorer],
        }],
      });
    } else {
      toast("切换网络失败：" + e.message, "err");
    }
  }
}
window.switchNetwork = switchNetwork;

// 更新所有显示原生代币符号的文案
function updateNetworkLabels() {
  const s = sym();
  document.querySelectorAll("[data-sym]").forEach((el) => {
    el.textContent = el.textContent.replace(/OKB/g, s);
  });
}

// ───────── 加密：钱包密钥对 / 内容密钥 / vault ─────────
function cryptoLib() {
  if (!window.TapeCrypto) throw new Error("加密模块未加载（crypto.js）");
  return window.TapeCrypto;
}

// 派生（并缓存）当前钱包的 X25519 密钥对；需一次钱包签名，私钥仅存内存
async function ensureKeyPair() {
  if (myKeyPair) return myKeyPair;
  if (!signer || !account) throw new Error("请先连接钱包");
  myKeyPair = await cryptoLib().deriveWalletKeyPair({
    signMessage: (text) => signer.signMessage(text),
    holder: account,
    hub: currentNetwork.music,
    chainId: currentChainId,
  });
  return myKeyPair;
}

// 读取并解开自己的 vault → {trackId: K 的 hex}
async function loadVaultKeys(refresh) {
  if (vaultKeys && !refresh) return vaultKeys;
  const lib = cryptoLib();
  const payload = await musicContract.vaultOf(account);
  if (!payload || payload === "0x") { vaultKeys = {}; return vaultKeys; }
  const kp = await ensureKeyPair();
  vaultKeys = lib.openVault(lib.hexToBytes(payload), kp.secretKey, account, {
    hub: currentNetwork.music,
    chainId: currentChainId,
  });
  return vaultKeys;
}

// 取某曲目的内容密钥；keeper 尚未写入时轮询等待（最多 ~12s）
async function vaultKeyFor(idx) {
  for (let i = 0; i < 7; i++) {
    const keys = await loadVaultKeys(true);
    if (keys[idx]) return keys[idx];
    if (i < 6) await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

// 通知 keeper 立即为该用户封装 vault（购买后调用，失败不阻塞）
async function syncVault() {
  try {
    await fetch(KEEPER_SYNC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user: account, chainId: currentChainId }),
    });
  } catch (e) { console.warn("keeper sync failed", e); }
}

// ───────── 版税分配 UI ─────────
// 合计提示：合约把「抽成 3% 后未按版税分完的部分」都归平台（见 _distributeRoyalties），
// 所以没配满 100% 时剩余部分不会留给艺人——在提交前就把这件事显示出来
function updateRoyaltyTotal() {
  const el = $("royaltyTotal");
  if (!el) return;
  if (royaltyRecipients.length === 0) { el.textContent = ""; return; }
  const total = royaltyRecipients.reduce((s, r) => s + r.bps, 0);
  const diff = 10000 - total;
  el.style.color = diff === 0 ? "var(--muted)" : diff > 0 ? "var(--accent)" : "var(--danger)";
  el.textContent = diff === 0
    ? "已分配 100%"
    : diff > 0
      ? `已分配 ${(total / 100).toFixed(1)}%，剩余 ${(diff / 100).toFixed(1)}% 将归平台`
      : `已分配 ${(total / 100).toFixed(1)}%，超出 ${(-diff / 100).toFixed(1)}%`;
}

function renderRoyaltyList() {
  const list = $("royaltyList");
  list.innerHTML = royaltyRecipients.map((r, i) => `
    <div class="royalty-item" data-idx="${i}">
      <input type="text" placeholder="收益方地址 0x..." value="${r.addr}" data-field="addr" />
      <input type="number" min="1" max="100" placeholder="比例(%)" value="${(r.bps / 100).toFixed(1)}" data-field="bps" />
      <button data-idx="${i}">✕</button>
    </div>
  `).join("");
  list.querySelectorAll(".royalty-item").forEach((item) => {
    const idx = Number(item.dataset.idx);
    item.querySelector('input[data-field="addr"]').addEventListener("change", (e) => {
      royaltyRecipients[idx].addr = e.target.value;
    });
    item.querySelector('input[data-field="bps"]').addEventListener("change", (e) => {
      royaltyRecipients[idx].bps = Math.round(Number(e.target.value) * 100);
      updateRoyaltyTotal();
    });
    item.querySelector("button").addEventListener("click", () => {
      royaltyRecipients.splice(idx, 1);
      renderRoyaltyList();
    });
  });
  updateRoyaltyTotal();
}

// ───────── 上传音频 ─────────
// 容器写入逐块部署合约（24KB/块），若用钱包逐笔签会弹出几百次。
// 这里改走 TapeOut 的操作员机制：钱包签 1 笔 setOperator 后，
// 由内存里的临时密钥静默签完所有块，上传结束再撤销。
const OP_TTL = 3600;                  // 临时授权时长（秒）
const OP_GAS_LIMIT = 7_000_000n;      // 单块固定 gas 上限（实测满块 24KB 约 5.5M）
const OP_REFUND_RESERVE = 30_000n;    // 退回余额时留给临时密钥自身的 gas
const GAS_PER_CHUNK = 5_600_000n;     // 预估算力用的单块耗量
const FALLBACK_GAS_PRICE = 20_000_001n; // 未连钱包时的兜底 gas 价（X Layer 实测值）
const KEEP_OPEN = "，请勿关闭窗口…";   // 逐块写入期间离开页面会中断上传
let pendingOp = null;                 // { burner, container }：中断时供手动撤销
let uploading = false;                // 上传进行中：拦截关闭/刷新

// 授权临时密钥写容器并注入 gas，返回可静默签名的 registry 实例
// 注资按最大费率预付，实际用量约一半，差额在 closeOperator 里退回
async function openOperator(container, chunkCount, onStatus) {
  // connect 一次，之后既当签名者又当合约 runner；不 connect 的话收尾退款会报 missing provider
  const burner = ethers.Wallet.createRandom().connect(provider); // 仅存内存，刷新即丢
  // 先登记，后续任一步失败都能在失败分支里把余额退回
  pendingOp = { burner, container, authorized: false };
  syncRevokeBtn();

  const fee = await provider.getFeeData();
  const fund = OP_GAS_LIMIT * BigInt(chunkCount + 8) * (fee.maxFeePerGas || fee.gasPrice);

  onStatus(`第 1 步：转入约 ${Number(ethers.formatEther(fund)).toFixed(4)} OKB 作为 gas（用不完传完退回）…`);
  await (await signer.sendTransaction({ to: burner.address, value: fund })).wait();

  onStatus(`第 2 步：授权临时上传密钥（有效期 ${Math.round(OP_TTL / 60)} 分钟）…`);
  await (await registryContract.setOperator(container, burner.address, OP_TTL)).wait();
  pendingOp.authorized = true;

  return new ethers.Contract(currentNetwork.siteRegistry, SITE_REGISTRY_ABI, burner);
}

// 收尾：撤销授权（ttl 传 0 即立即过期），并把没花完的 gas 退回；密钥随即丢弃
// authorized 为假时跳过撤销——授权压根没成功，不必多弹一笔钱包确认
async function closeOperator() {
  if (!pendingOp) return;
  const { burner, container, authorized } = pendingOp;
  if (authorized) {
    await (await registryContract.setOperator(container, burner.address, 0)).wait();
  }
  const bal = await provider.getBalance(burner.address);
  const fee = await provider.getFeeData();
  const reserve = OP_REFUND_RESERVE * (fee.maxFeePerGas || fee.gasPrice);
  if (bal > reserve) {
    await (await burner.sendTransaction({ to: account, value: bal - reserve })).wait();
  }
  pendingOp = null;
  syncRevokeBtn();
}

function syncRevokeBtn() {
  const btn = $("revokeOpBtn");
  if (btn) btn.hidden = !pendingOp;
}

// ─── 文件信息与 gas 预估（音频 + 封面合计）───
const SIZE_WARN_BYTES = 3 * 1024 * 1024; // 超过此体积提示压缩
const SEC_PER_CHUNK = 0.4;               // 每块约 0.3~0.5s：发送串行 + 出块，取中值

async function gasPriceNow() {
  if (!provider) return FALLBACK_GAS_PRICE;
  try { return (await provider.getFeeData()).gasPrice || FALLBACK_GAS_PRICE; }
  catch (e) { return FALLBACK_GAS_PRICE; }
}

async function renderFileInfo() {
  const audio = $("inFile") && $("inFile").files[0];
  const cover = $("inCover") && $("inCover").files[0];
  const aInfo = $("fileInfo"), cInfo = $("coverInfo"), warn = $("sizeWarn");
  const chunks = audio ? Math.ceil(audio.size / CHUNK_MAX) + (cover ? Math.ceil(cover.size / CHUNK_MAX) : 0) : 0;

  if (aInfo) {
    if (!audio) aInfo.textContent = "";
    else {
      const mb = (audio.size / 1024 / 1024).toFixed(2);
      const parts = Math.ceil(audio.size / FILE_MAX);
      const okb = Number(ethers.formatEther(GAS_PER_CHUNK * BigInt(chunks) * (await gasPriceNow()))).toFixed(4);
      const secs = Math.round(chunks * SEC_PER_CHUNK);
      const eta = secs < 60 ? `${secs} 秒` : `${Math.ceil(secs / 60)} 分钟`;
      aInfo.textContent = `${audio.name} · ${mb} MB${parts > 1 ? ` · 将分 ${parts} 片上传` : ""} · ${chunks} 块 · 预计 gas ≈ ${okb} OKB · 约 ${eta}`;
    }
  }
  if (cInfo) {
    cInfo.textContent = cover ? `${cover.name} · ${(cover.size / 1024 / 1024).toFixed(2)} MB` : "";
  }
  if (warn) {
    if (audio && audio.size > SIZE_WARN_BYTES) {
      warn.hidden = false;
      warn.style.color = "var(--accent)";
      warn.textContent = `体积偏大：约 ${chunks} 次链上写入。块数与 gas 按体积等比上升，压到 128 kbps 左右再传可省一半以上。`;
    } else {
      warn.hidden = true;
      warn.textContent = "";
    }
  }
}

// 成功后清空表单，恢复按钮
function resetUploadForm() {
  $("inTitle").value = ""; $("inArtist").value = ""; $("inFile").value = ""; $("inCover").value = "";
  if ($("inLyrics")) $("inLyrics").value = "";
  if ($("inGenre")) $("inGenre").value = "0";
  if ($("inPrice")) $("inPrice").value = "";
  $("fileInfo").textContent = ""; $("coverInfo").textContent = "";
  if ($("sizeWarn")) { $("sizeWarn").hidden = true; $("sizeWarn").textContent = ""; }
  royaltyRecipients = []; renderRoyaltyList();
  $("uploadBtn").disabled = false;
}

async function uploadAudio() {
  const title = $("inTitle").value.trim();
  const artist = $("inArtist").value.trim();
  const tokenId = parseInt($("inCircuit").value);
  const cpu = PROCESSOR_NO;
  const genre = Number($("inGenre") ? $("inGenre").value : 0);
  const file = $("inFile").files[0];
  const coverFile = $("inCover").files[0];
  const status = $("uploadStatus");

  if (!tokenId) { toast(T("pub.circuitPick"), "err"); return; }
  if (!title || !artist || !file) { toast("请填写完整信息并选择音频文件", "err"); return; }
  if (!Number.isInteger(genre) || genre < 0 || genre >= GENRES.length) { toast(T("pub.genrePick"), "err"); return; }

  // 版税校验：列表非空时必须正好凑满 100%，否则未配满的部分会被合约分给平台
  const totalBps = royaltyRecipients.reduce((s, r) => s + r.bps, 0);
  if (royaltyRecipients.length > 0 && totalBps !== 10000) {
    toast(`版税比例需凑满 100%（当前 ${(totalBps/100).toFixed(1)}%），未配满的部分会归平台`, "err"); return;
  }
  for (const r of royaltyRecipients) {
    if (!ethers.isAddress((r.addr || "").trim())) { toast("收益方地址无效，请填写 0x 开头的完整地址", "err"); return; }
  }

  // 买断价（免费唱片可留空）
  const isFree = $("inFree") ? $("inFree").checked : false;
  const priceStr = $("inPrice") ? $("inPrice").value.trim() : "";
  if (!isFree && !(Number(priceStr) > 0)) { toast("请填写买断价（大于 0）", "err"); return; }
  const priceWei = isFree ? 0n : ethers.parseEther(priceStr);
  const encrypted = !isFree; // 付费曲目一律加密上链

  $("uploadBtn").disabled = true;
  uploading = true;
  status.style.color = "";

  try {
    status.textContent = "读取容器…";
    const processor = await factoryContract.cpuAt(cpu);
    const container = await openerContract.accountOf(processor, tokenId);
    if (!(await openerContract.isOpened(processor, tokenId)))
      throw new Error("该唱片容器未开通，请先去 id.tapeout.link 开通");

    const basePath = `music/${tokenId}.${cpu}`;
    const coverBuf = coverFile ? new Uint8Array(await coverFile.arrayBuffer()) : null;

    // ─── 加密音频（付费曲目）：随机 K 加密，K 封给 keeper 后上链 ───
    let buf = new Uint8Array(await file.arrayBuffer());
    let wrappedCEK = "0x";
    let artistPubKey = ethers.ZeroHash;
    let cek = null; // 内容密钥 K，歌词复用同一把
    if (encrypted) {
      status.textContent = "生成内容密钥…";
      const lib = cryptoLib();
      const kp = await ensureKeyPair();
      const cfg = { hub: currentNetwork.music, chainId: currentChainId };
      cek = lib.randomKey();
      buf = lib.encryptBytes(cek, buf);
      artistPubKey = lib.pubKeyHex(kp.publicKey);
      wrappedCEK = lib.bytesToHex(lib.wrapKeyFor(cek, {
        address: KEEPER.address,
        publicKey: lib.pubKeyBytes(KEEPER.publicKey),
      }, cfg));
    }

    // ─── 歌词：付费曲目与音频共用内容密钥 K ───
    const lyricsText = $("inLyrics") ? $("inLyrics").value.trim() : "";
    let lbuf = lyricsText ? new TextEncoder().encode(lyricsText) : null;
    if (lbuf && encrypted) lbuf = cryptoLib().encryptBytes(cek, lbuf);

    const partSize = FILE_MAX;
    const partCount = Math.ceil(buf.length / partSize);
    const ext = extOf(file.name) || "mp3";
    const mime = uploadMime(ext, file.type);

    // ─── 授权临时密钥，之后所有容器写入免钱包确认 ───
    const estChunks = Math.ceil(((coverBuf ? coverBuf.length : 0) + buf.length + (lbuf ? lbuf.length : 0)) / CHUNK_MAX) + partCount;
    const writer = await openOperator(container, estChunks, (msg) => { status.textContent = msg; });

    // 连续发、末尾统一等：不再逐笔等收据（逐笔 wait 要等轮询周期，实测每笔约 4s）。
    // 显式递增 nonce 保证上链顺序满足 appendChunk 的 expectIndex 校验；
    // 也正因此不能逐笔 estimateGas（前序未上链时模拟必然失败），统一用固定 gasLimit。
    // 手续费一次取好随每笔带上，避免逐笔再查。并发发送实测无收益（RPC 按发送方串行），故保持串行。
    const txs = [];
    const fee = await provider.getFeeData();
    let nonce = await provider.getTransactionCount(pendingOp.burner.address, "pending");
    const next = () => ({
      nonce: nonce++,
      gasLimit: OP_GAS_LIMIT,
      maxFeePerGas: fee.maxFeePerGas,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
    });
    const written = []; // [{path, size}]，落块后逐个核对字节数

    // ─── 上传封面图 ───
    let coverPath = "";
    if (coverBuf) {
      status.textContent = "上传封面图" + KEEP_OPEN;
      const coverExt = coverFile.name.split(".").pop() || "jpg";
      coverPath = `${basePath}.cover.${coverExt}`;
      const coverHash = await sha256Bytes(coverBuf);
      const coverChunks = Math.ceil(coverBuf.length / CHUNK_MAX);
      txs.push(await writer.putFile(container, coverPath, coverFile.type, coverHash, coverBuf.slice(0, CHUNK_MAX), next()));
      for (let i = 1; i < coverChunks; i++) {
        const s = i * CHUNK_MAX;
        txs.push(await writer.appendChunk(container, coverPath, i, coverBuf.slice(s, s + CHUNK_MAX), next()));
      }
      written.push({ path: coverPath, size: coverBuf.length });
    }

    // ─── 上传音频（分片）───
    for (let p = 0; p < partCount; p++) {
      const start = p * partSize;
      const partBuf = buf.slice(start, start + partSize);
      const path = partCount > 1 ? `${basePath}.part${p}` : `${basePath}.${ext}`;
      const hash = await sha256Bytes(partBuf);
      const totalChunks = Math.ceil(partBuf.length / CHUNK_MAX);

      status.textContent = `上传音频 ${p + 1}/${partCount} (1/${totalChunks}) · 免确认` + KEEP_OPEN;
      txs.push(await writer.putFile(container, path, mime, hash, partBuf.slice(0, CHUNK_MAX), next()));
      for (let i = 1; i < totalChunks; i++) {
        const s = i * CHUNK_MAX;
        txs.push(await writer.appendChunk(container, path, i, partBuf.slice(s, s + CHUNK_MAX), next()));
        if (i % 10 === 0 || i === totalChunks - 1) {
          status.textContent = `上传音频 ${p + 1}/${partCount} (${i + 1}/${totalChunks}) · 免确认` + KEEP_OPEN;
        }
      }
      written.push({ path, size: partBuf.length });
    }

    // ─── 上传歌词 ───
    let lyricsPath = "";
    if (lbuf) {
      status.textContent = "上传歌词" + KEEP_OPEN;
      lyricsPath = `${basePath}.lrc`;
      const lHash = await sha256Bytes(lbuf);
      txs.push(await writer.putFile(container, lyricsPath, "text/plain", lHash, lbuf.slice(0, CHUNK_MAX), next()));
      for (let i = 1; i * CHUNK_MAX < lbuf.length; i++) {
        const s = i * CHUNK_MAX;
        txs.push(await writer.appendChunk(container, lyricsPath, i, lbuf.slice(s, s + CHUNK_MAX), next()));
      }
      written.push({ path: lyricsPath, size: lbuf.length });
    }

    // ─── 等最后一笔落块（nonce 有序，最后一笔落块即前面全部落块）───
    status.textContent = `等待 ${txs.length} 块写入完成` + KEEP_OPEN;
    await txs[txs.length - 1].wait();

    // 核对字节数，避免个别块失败被静默吞掉
    for (const w of written) {
      const info = await registryContract.fileInfo(container, w.path);
      if (Number(info[0]) !== w.size) throw new Error(`写入不完整：${w.path}（${info[0]}/${w.size} 字节）`);
    }

    // ─── 上传完毕，撤销临时授权并退回剩余 gas ───
    // 收尾失败不阻断发行：内容已经写完，不该为一笔退款让整次上传作废
    status.textContent = "撤销临时授权，退回剩余 gas…";
    try { await closeOperator(); } catch (e) { console.warn("closeOperator failed", e); }

    // 注册曲目
    status.textContent = "注册曲目…";
    const royalties = royaltyRecipients.map((r) => ({ addr: r.addr.trim(), bps: r.bps }));
    const audioPath = partCount > 1 ? basePath : `${basePath}.${ext}`;
    const meta = { title, artistName: artist, genre, price: priceWei, free: isFree, encrypted, artistPubKey, lyricsPath };
    const tx = await musicContract.registerTrack(container, tokenId, cpu, audioPath, partCount, coverPath, meta, wrappedCEK, royalties);
    const rc = await tx.wait();
    const evt = rc.logs.find((l) => l.fragment && l.fragment.name === "TrackRegistered");
    const trackId = evt ? evt.args[0].toString() : "?";

    status.textContent = `✓ 发行成功！曲目 #${trackId}${partCount > 1 ? `（${partCount} 分片）` : ""}${encrypted ? " · 已加密" : ""}${coverPath ? " · 含封面" : ""}${lyricsPath ? " · 含歌词" : ""}`;
    status.style.color = "var(--accent)";

    resetUploadForm();
    loadCreatorPanel();
  } catch (e) {
    console.error(e);
    status.textContent = "✗ " + (e.reason || e.message);
    status.style.color = "var(--danger)";
    toast("发行失败：" + (e.reason || e.message), "err"); // 切到其他菜单时也要能看到
    // 失败也要把临时密钥里的 gas 退回，否则密钥一丢余额就永久锁死
    try { await closeOperator(); } catch (e2) { console.warn("refund failed", e2); }
    $("uploadBtn").disabled = false;
    syncRevokeBtn(); // 退款没成功时授权仍在，提示用户可手动撤销
  } finally {
    uploading = false;
  }
}

// 逐块写入期间关闭/刷新会中断上传，交给浏览器弹确认框
window.addEventListener("beforeunload", (e) => {
  if (!uploading) return;
  e.preventDefault();
  e.returnValue = ""; // 旧浏览器要靠它触发提示，文案由浏览器决定
});

// ───────── 曲库 ─────────
// 拉取曲目与权限缓存（不渲染），曲库页与创作者面板共用
async function fetchTracks() {
  if (!musicContract) return;
  const count = Number(await musicContract.trackCount());
  // 曲目表与已购状态互不依赖，并行省一个往返
  const [tracks, purchased] = await Promise.all([
    count === 0 ? [] : musicContract.getTracks(0, count),
    account ? musicContract.getPurchased(account, 0, count).catch(() => []) : [],
  ]);
  tracksCache = tracks;
  purchasedCache = purchased; // 与 tracksCache 同索引
  writeTracksCache();
  preloadCovers(tracksCache); // 封面后台读链，到达后自动重绘
}

async function loadTracks() {
  const list = $("trackList");
  if (!list) return; // 非曲库页无列表
  if (!musicContract) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎧</div>
        <p>${T("empty.title")}</p>
        <button class="btn btn--primary" onclick="connectWallet()">${T("empty.btn")}</button>
      </div>`;
    return;
  }
  // 1. 先显缓存：列表从 localStorage 恢复、封面从 IndexedDB 恢复，均为本地读
  const cached = readTracksCache();
  let cachedSig = null;
  if (cached && cached.tracks.length) {
    tracksCache = cached.tracks;
    purchasedCache = cached.account === (account || "") ? cached.purchased : [];
    cachedSig = tracksSignature();
    await hydrateCachedCovers(tracksCache);
    renderTracks();
  } else {
    list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  }
  // 2. 后台刷新：与缓存一致就不重绘，避免画面闪动
  try {
    await fetchTracks();
    if (tracksCache.length === 0) { list.innerHTML = '<p class="muted">' + T("lib.noTrack") + "</p>"; return; }
    if (cachedSig === tracksSignature()) return;
    renderTracks();
  } catch (e) {
    if (!cached) list.innerHTML = '<p class="muted">加载失败：' + e.message + "</p>";
  }
}

// 创作者面板：发行页无曲库列表，单独拉数据（refetch=false 表示曲目数据已是最新）
async function loadCreatorPanel(refetch = true) {
  if (!musicContract) { updateCreatorPanel(); loadCircuits(); return; }
  if (refetch) { try { await fetchTracks(); } catch (e) { console.error(e); } }
  updateCreatorPanel();
  loadCircuits();
}

// 按搜索词过滤后的可见曲目（保留真实索引 = 合约 trackId）
function visibleTracks() {
  const q = searchQuery.trim().toLowerCase();
  return tracksCache
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !q || t.title.toLowerCase().includes(q) || t.artistName.toLowerCase().includes(q));
}

// 播放权限：免费 / 已买断
function canPlay(idx) {
  const t = tracksCache[idx];
  return !!t && (t.free || !!purchasedCache[idx]);
}

// 可播放曲目的索引（「我的曲库」列表数据源）
function playableIdx() {
  return tracksCache.map((_, i) => i).filter((i) => canPlay(i));
}

// 单条曲目行（曲库 / 已购列表共用）
function trackRowHtml(i) {
  const t = tracksCache[i];
  const coverUrl = fileUrl(t, t.coverPath);
  const locked = !canPlay(i);
  // 状态标签：免费 | 已买断 | 分类
  const stateTag = t.free
    ? `<span class="tag tag--free">${T("lib.free")}</span>`
    : purchasedCache[i]
      ? `<span class="tag tag--own">${T("lib.owned")}</span>`
      : "";
  const genreTag = `<span class="tag">${T("genre." + Number(t.genre))}</span>`;
  // 买断价：付费且未买断时与购买按钮同一行显示
  const priceInfo = locked ? `<span class="tag tag--price">${ethers.formatEther(t.price)} ${sym()}</span>` : "";
  // TapeOut 容器名：tokenId.区号.cpu，显示在封面右上角，便于在 TapeOut 侧定位该容器
  const containerId = `${Number(t.tokenId)}.${CHAIN_AREA}.${Number(t.cpu)}`;
  return `
    <div class="track${locked ? " is-locked" : ""}" data-track="${i}">
      <div class="track__art">
        ${coverUrl
          ? `<img src="${coverUrl}" class="track__cover" alt="封面" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><span class="track__fallback" style="display:none">🎵</span>`
          : `<span class="track__fallback">🎵</span>`}
        ${stateTag ? `<div class="track__state">${stateTag}</div>` : ""}
        <span class="track__cid" title="TapeOut 容器">${containerId}</span>
      </div>
      <div class="track__body">
        <div class="track__title">${escapeHtml(t.title)}</div>
        <div class="track__artist">${escapeHtml(t.artistName)}</div>
        <div class="track__meta">
          ${genreTag}
        </div>
      </div>
      ${locked ? `<div class="track__actions">${priceInfo}<button class="btn btn--primary btn--sm" data-buy="${i}" onclick="doBuy(${i}, this)">${T("player.buy")}</button></div>` : ""}
    </div>`;
}

// 行点击：点击卡片播放；买断按钮自行处理（见 trackRowHtml 的 onclick）
function bindTrackRows(container) {
  container.querySelectorAll(".track").forEach((el) => {
    const idx = Number(el.dataset.track);
    el.addEventListener("click", (e) => {
      // 买断按钮自带 onclick（直接绑定在移动端 WebView 里更可靠），这里只管播放入口
      if (e.target.closest("[data-buy]")) return;
      playTrack(idx);
    });
  });
  markPlaying();
}

function renderTracks() {
  const list = $("trackList");
  if (!list || !musicContract) return;
  const vis = visibleTracks();
  if (vis.length === 0) {
    list.innerHTML = '<p class="muted">' + (searchQuery.trim() ? T("lib.noMatch") : T("lib.noTrack")) + "</p>";
    return;
  }
  list.innerHTML = vis.map(({ i }) => trackRowHtml(i)).join("");
  bindTrackRows(list);
  renderQueue();
}

// 列表重建后同步「播放中」高亮
function markPlaying() {
  document.querySelectorAll(".track[data-track]").forEach((el) =>
    el.classList.toggle("is-playing", Number(el.dataset.track) === currentTrackIdx)
  );
}

// ───────── 顶部 Tab（hash 路由）─────────
const TAB_LOADERS = { publish: () => loadCreatorPanel(), profile: () => loadProfile() };

function switchTab() {
  const raw = location.hash.replace("#", "");
  const name = document.querySelector(`.panel[data-panel="${raw}"]`) ? raw : "library";
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.dataset.panel !== name));
  document.querySelectorAll(".side-item").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  const load = TAB_LOADERS[name];
  if (load) load();
  // 上传不因切菜单而中断，只是进度看不见，提示一句
  if (uploading && name !== "publish") toast("上传仍在进行，回到「发行」可查看进度");
}

// ───────── 个人面板：我购买的音乐 ─────────
async function loadProfile() {
  const list = $("purchasedList");
  if (!list) return;
  if (!musicContract) { list.innerHTML = `<p class="muted">${T("profile.connectTip")}</p>`; return; }
  if (tracksCache.length === 0) { try { await fetchTracks(); } catch (e) { console.error(e); } }
  // 只列买断过的（免费曲目不算购买）
  const bought = tracksCache.map((_, i) => i).filter((i) => purchasedCache[i]);
  list.innerHTML = bought.length
    ? bought.map((i) => trackRowHtml(i)).join("")
    : `<p class="muted">${T("profile.noPurchased")}</p>`;
  if (bought.length) bindTrackRows(list);
}

// ───────── 迷你播放条 ─────────
// 同步一个 Hero 黑胶中心的封面（音乐广场、发行页各有一个）
function syncHeroCover(imgId, fbId, t) {
  const img = $(imgId), fb = $(fbId);
  if (!img || !fb) return;
  const url = t && t.coverPath ? fileUrl(t, t.coverPath) : "";
  if (url) {
    img.src = url;
    img.hidden = false; fb.hidden = true;
    img.onerror = () => { img.hidden = true; fb.hidden = false; };
  } else {
    img.hidden = true; fb.hidden = false;
  }
}

function fillMini(t) {
  $("miniPlayer").hidden = false;
  document.body.classList.add("has-mini");   // 为底部浮窗留出空间
  $("miniTitle").textContent = t.title;
  $("miniArtist").textContent = t.artistName;
  // 封面从链上异步读，未就绪时先显示占位（避免 img 拿到空 src 报错）
  const img = $("miniCover"), fb = $("miniCoverFallback");
  const coverUrl = t.coverPath ? fileUrl(t, t.coverPath) : "";
  if (coverUrl) {
    img.src = coverUrl;
    img.hidden = false; fb.hidden = true;
    img.onerror = () => { img.hidden = true; fb.hidden = false; };
  } else {
    img.hidden = true; fb.hidden = false;
  }
  // 两个 Hero 的黑胶中心封面
  syncHeroCover("heroCover", "heroCoverFallback", t);       // 发行页
  syncHeroCover("libHeroCover", "libHeroCoverFallback", t); // 音乐广场
}

// 同步播放/暂停图标（svg 无 hidden 属性，须用 attribute 控制）
function syncPlayIcon() {
  const paused = $("audio").paused;
  $("iconPlay").toggleAttribute("hidden", !paused);
  $("iconPause").toggleAttribute("hidden", paused);
  $("miniCover").classList.toggle("is-spinning", !paused);
  // Hero 黑胶随播放加速/停转（曲库 + 发行各一处）
  document.querySelectorAll(".vinyl__disc").forEach((d) => d.classList.toggle("is-playing", !paused));
}

// 播放/暂停切换
function togglePlay() {
  const audio = $("audio");
  if (!audio.src) {
    // 有选中曲目就重试它：链上读取期间点 ▶ 时 src 仍为空，不能回落到第一首
    const idx = currentTrackIdx != null && tracksCache[currentTrackIdx] ? currentTrackIdx : playableIdx()[0];
    if (idx != null) playTrack(idx);
    return;
  }
  if (audio.paused) {
    // 之前被自动播放策略拦下留下的提示，在用户点播时换回艺人名
    const mini = $("miniArtist");
    if (mini && currentTrackIdx != null && mini.textContent === T("player.ready"))
      mini.textContent = tracksCache[currentTrackIdx].artistName;
    audio.play().catch(() => {});
  } else audio.pause();
}

// ───────── 「我的曲库」抽屉 ─────────
function renderQueue() {
  const el = $("queueList");
  if (!el) return;
  const idxs = playableIdx();
  if (idxs.length === 0) { el.innerHTML = `<p class="muted queue-empty">${T("queue.empty")}</p>`; return; }
  el.innerHTML = idxs.map((i) => {
    const t = tracksCache[i];
    const coverUrl = fileUrl(t, t.coverPath);
    const on = i === currentTrackIdx;
    return `
      <div class="queue-item${on ? " is-playing" : ""}" data-track="${i}">
        <div class="queue-item__icon">${coverUrl ? `<img src="${coverUrl}" alt="" onerror="this.remove()" />` : "🎵"}</div>
        <div class="queue-item__body">
          <div class="queue-item__title">${escapeHtml(t.title)}</div>
          <div class="queue-item__meta">${escapeHtml(t.artistName)}</div>
        </div>
        <span class="queue-item__flag">${on ? "♪" : ""}</span>
      </div>`;
  }).join("");
  el.querySelectorAll(".queue-item").forEach((n) =>
    n.addEventListener("click", () => { playTrack(Number(n.dataset.track)); closeQueue(); })
  );
}

function openQueue() { const q = $("queue"); if (!q) return; renderQueue(); q.hidden = false; }
function closeQueue() { const q = $("queue"); if (q) q.hidden = true; }

// ───────── 播放（链上读取 / 加密解密 / 分片合并）─────────
// 取完整音频字节（分片则依次读回后合并）
// onProgress(进度值, 总份数)：两者之比即整体完成比例，单文件按字节、分片按片数细分
async function fetchAudioBytes(t, onProgress) {
  const partCount = Number(t.partCount);
  if (partCount <= 1) {
    const { bytes } = await chainFile(t, t.audioPath, onProgress);
    return bytes;
  }
  const chunks = [];
  for (let i = 0; i < partCount; i++) {
    const { bytes } = await chainFile(t, `${t.audioPath}.part${i}`, (read, size) =>
      onProgress && onProgress(i + read / size, partCount)
    );
    chunks.push(bytes);
  }
  return concatBytes(chunks);
}

let playToken = 0; // 每次 playTrack 自增，用于丢弃过期的链上读取结果

async function playTrack(idx) {
  const t = tracksCache[idx];
  if (!t) return;
  if (!canPlay(idx)) { toast(account ? T("player.locked") : "请先连接钱包", "err"); return; }

  const token = ++playToken; // 换曲令牌：慢的旧读取不得覆盖新选择
  currentTrackIdx = idx;
  lyricsLines = []; // 换曲后旧歌词作废
  lyricsFor = null;
  activeLyric = -1;
  seeking = false;
  markPlaying();
  fillMini(t);
  // 后台取歌词：播放条副标题会随进度逐行跟随，无需打开歌词面板
  ensureLyrics(idx).then((ok) => { if (ok) syncLyrics(); });

  const audio = $("audio");
  audio.onplay = syncPlayIcon;
  audio.onpause = syncPlayIcon;
  audio.onended = () => playNext(); // 自动连播下一曲

  const playBtn = $("playToggle");
  if (playBtn) playBtn.disabled = true; // 读取期间禁用 ▶
  // 读取进度写进播放条副标题；留 1% 给解密与解码
  const showReadProgress = (done, total) => {
    if (token !== playToken || !total) return;
    const pct = Math.min(99, Math.round((done / total) * 100));
    if ($("miniArtist")) $("miniArtist").textContent = `正在从链上读取… ${pct}%`;
  };
  try {
    // 链上读取需要几秒（2.4MB 约 5s），先在播放条上给出反馈
    if ($("miniArtist")) $("miniArtist").textContent = "正在从链上读取…";
    let bytes = await fetchAudioBytes(t, showReadProgress);
    if (t.encrypted) {
      // 取自己的内容密钥 K（keeper 未就绪时轮询等待）
      const keyHex = await vaultKeyFor(idx);
      if (!keyHex) throw new Error("密钥尚未就绪，请稍后重试");
      bytes = cryptoLib().decryptBytes(cryptoLib().hexToBytes(keyHex, 32), bytes);
    }
    if (token !== playToken) return; // 读取期间已切到别的曲目，丢弃本次结果
    fillMini(t); // 读完了，把「正在读取」换回曲目信息
    audio.src = URL.createObjectURL(new Blob([bytes], { type: pathMime(t.audioPath) }));
    syncSeek(); // 立刻归零，时长就绪后再由 loadedmetadata 补齐
    await audio.play();
  } catch (e) {
    if (token !== playToken) return; // 过期的读取失败，与当前曲目无关
    // NotAllowedError：链上读取耗时超出用户手势有效期，自动播放被浏览器策略拦下。
    // 音频此时已就绪，点 ▶ 即可，不算失败，也不该打断播放条状态。
    if (e.name === "NotAllowedError") {
      if ($("miniArtist")) $("miniArtist").textContent = T("player.ready");
    } else {
      toast("无法播放：" + e.message, "err");
      currentTrackIdx = null;
      markPlaying();
    }
  } finally {
    if (token === playToken && playBtn) playBtn.disabled = false; // 只有最新一次读取负责恢复
  }
  renderQueue();
}

// ───────── 播放进度条 ─────────
let seeking = false; // 拖动中不随播放回写，避免抖动

// 播放位置 → 进度条（0..1000，与时长无关，换曲自动适配）
function syncSeek() {
  const el = $("seekBar"), a = $("audio");
  if (!el) return;
  const dur = a.duration;
  const ok = Number.isFinite(dur) && dur > 0;
  el.disabled = !ok; // 时长未知（读取中）时不可拖
  if (seeking) return;
  el.value = ok ? String(Math.round((a.currentTime / dur) * 1000)) : "0";
}

// 拖动 → 跳转播放位置
function bindSeek() {
  const el = $("seekBar");
  if (!el) return;
  el.addEventListener("input", () => {
    const a = $("audio");
    if (!Number.isFinite(a.duration) || !a.duration) return;
    seeking = true;
    a.currentTime = (Number(el.value) / 1000) * a.duration;
  });
  const done = () => { seeking = false; };
  el.addEventListener("change", done);
  el.addEventListener("pointerup", done);
}

// ───────── 歌词（LRC 时间轴 / 纯文本）─────────
let lyricsLines = []; // [{ t: 起始秒, text }]，纯文本时 t = -1
let activeLyric = -1;

// 整段含 [mm:ss.xx] 则按 LRC 解析，否则逐行纯文本
function parseLyrics(text) {
  const lines = text.split(/\r?\n/);
  if (!lines.some((l) => /\[\d+:\d+(?:\.\d+)?\]/.test(l))) {
    return lines.map((l) => ({ t: -1, text: l.trim() })).filter((l) => l.text);
  }
  const out = [];
  for (const raw of lines) {
    const body = raw.replace(/\[[^\]]*\]/g, "").trim();
    if (!body) continue; // 纯元信息行（[ti:] / [ar:] 等）
    for (const m of raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)) {
      out.push({ t: Number(m[1]) * 60 + Number(m[2]), text: body });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

function renderLyrics() {
  const list = $("lyricsList");
  if (!list) return;
  activeLyric = -1;
  list.innerHTML = lyricsLines.length
    ? lyricsLines.map((l) => `<div class="lyrics-line">${escapeHtml(l.text)}</div>`).join("")
    : `<p class="muted">${T("lyrics.none")}</p>`;
}

// 取歌词并解析（按曲目缓存，播放条与歌词面板共用同一份）
let lyricsFor = null;
async function ensureLyrics(idx) {
  if (lyricsFor === idx && lyricsLines.length) return true;
  lyricsLines = [];
  activeLyric = -1;
  lyricsFor = null;
  const t = tracksCache[idx];
  if (!t || !t.lyricsPath || !canPlay(idx)) return false;
  try {
    let { bytes } = await chainFile(t, t.lyricsPath);
    if (t.encrypted) {
      // 歌词与音频共用同一把 K，来自链上 vault
      const keyHex = await vaultKeyFor(idx);
      if (!keyHex) return false;
      bytes = cryptoLib().decryptBytes(cryptoLib().hexToBytes(keyHex, 32), bytes);
    }
    lyricsLines = parseLyrics(new TextDecoder().decode(bytes));
    lyricsFor = idx;
    return lyricsLines.length > 0;
  } catch (e) {
    console.warn("lyrics failed", e);
    return false;
  }
}

// 播放进度变化：播放条逐行跟随 + 歌词面板高亮居中
function syncLyrics() {
  if (!lyricsLines.length) return;
  const cur = $("audio").currentTime;
  let idx = -1;
  for (let i = 0; i < lyricsLines.length; i++) {
    if (lyricsLines[i].t < 0) continue; // 纯文本歌词没有时间轴，不参与滚动
    if (lyricsLines[i].t <= cur) idx = i;
    else break;
  }
  // 播放条副标题跟随当前行；没到第一句（或纯文本）时仍显示艺人名
  const mini = $("miniArtist");
  if (mini && currentTrackIdx != null && !$("miniPlayer").hidden) {
    const t = tracksCache[currentTrackIdx];
    const want = idx >= 0 ? lyricsLines[idx].text : (t ? t.artistName : "");
    if (mini.textContent !== want) mini.textContent = want;
  }
  // 歌词面板：高亮并居中
  const list = $("lyricsList"), sheet = $("lyricsSheet");
  if (!list || !sheet || sheet.hidden) return;
  if (idx === activeLyric) return;
  activeLyric = idx;
  list.querySelectorAll(".lyrics-line").forEach((el, i) => el.classList.toggle("is-active", i === idx));
  const el = list.children[idx];
  if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
}

function closeLyrics() { const s = $("lyricsSheet"); if (s) s.hidden = true; }

async function openLyrics() {
  const sheet = $("lyricsSheet"), list = $("lyricsList");
  if (!sheet || !list) return;
  if (currentTrackIdx == null) { toast(T("lyrics.noTrack"), "err"); return; }
  sheet.hidden = false;
  list.innerHTML = `<p class="muted">${T("lyrics.loading")}</p>`;

  const t = tracksCache[currentTrackIdx];
  if (!t || !t.lyricsPath) { lyricsLines = []; renderLyrics(); return; }
  if (!canPlay(currentTrackIdx)) { list.innerHTML = `<p class="muted">${T("lyrics.locked")}</p>`; return; }
  if (await ensureLyrics(currentTrackIdx)) {
    renderLyrics();
    syncLyrics();
  } else {
    lyricsLines = [];
    list.innerHTML = `<p class="muted">${T("lyrics.fail")}</p>`;
  }
}

// ───────── 买断 ─────────
async function doBuy(idx, btn) {
  const t = tracksCache[idx];
  // 每条提前返回都必须给出提示，否则移动端点击会表现为「完全没反应」
  if (!t) { toast("曲目不存在，请刷新列表", "err"); return; }
  if (!account) { toast("请先连接钱包", "err"); return; }
  if (!musicContract) {
    // 不在 X Layer：请求钱包切链，成功后 chainChanged 会整页刷新，再点一次即可购买
    toast(`检测到链 ${currentChainId}，正在切换到 X Layer…`);
    await switchNetwork(196);
    return;
  }
  const label = btn ? btn.textContent : "";
  try {
    if (btn) { btn.disabled = true; btn.textContent = "支付中…"; }
    // 加密曲目须提交买家 X25519 公钥，keeper 据此封装 vault
    let buyerPubKey = ethers.ZeroHash;
    if (t.encrypted) {
      const kp = await ensureKeyPair();
      buyerPubKey = cryptoLib().pubKeyHex(kp.publicKey);
    }
    const tx = await musicContract.buy(idx, buyerPubKey, { value: t.price });
    await tx.wait();
    purchasedCache[idx] = true;
    writeTracksCache(); // 已购状态落盘，下次打开不再显示为锁定
    // 通知 keeper 封装 vault，并清空本地缓存以便重新读取
    if (t.encrypted) { vaultKeys = null; syncVault(); }
    toast(`买断成功：${t.title}`, "ok");
  } catch (e) {
    console.error(e);
    toast("买断失败：" + (e.reason || e.message), "err");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
  if (purchasedCache[idx]) { renderTracks(); playTrack(idx); } // 买断后立即播放
}
window.doBuy = doBuy; // 供卡片按钮的 inline onclick 调用

// ───────── 播放队列：上/下一曲（在可播放曲目内循环）─────────
function playNext() {
  const p = playableIdx();
  if (p.length === 0) return;
  playTrack(p[(p.indexOf(currentTrackIdx) + 1) % p.length]);
}

function playPrev() {
  const p = playableIdx();
  if (p.length === 0) return;
  const pos = p.indexOf(currentTrackIdx);
  playTrack(p[(pos - 1 + p.length) % p.length]);
}

// ───────── 分享当前曲目 ─────────
async function shareCurrent() {
  const t = tracksCache[currentTrackIdx];
  if (!t) return;
  const url = location.origin + location.pathname + "?track=" + currentTrackIdx;
  const text = `🎵 ${t.title} — ${t.artistName} · 声刻 SonicMint 链上音乐`;
  // 桌面端（尤其 Windows）系统分享面板常不可用，只弹报错；仅移动端用原生分享
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (mobile && navigator.share) {
    try { await navigator.share({ title: t.title, text, url }); return; }
    catch (e) { if (e.name === "AbortError") return; } // 用户取消，不再兜底
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast("已复制分享信息", "ok");
  } catch {
    toast(`${text}\n${url}`);
  }
}

// ───────── 分享链接 ?track=N：定位曲目，能播则播 ─────────
function applySharedTrack() {
  const id = new URLSearchParams(location.search).get("track");
  if (id == null) return;
  const idx = Number(id);
  if (!Number.isInteger(idx) || !tracksCache[idx]) return;
  const t = tracksCache[idx];
  const card = document.querySelector(`#trackList .track[data-track="${idx}"]`);
  if (card) card.scrollIntoView({ block: "center" });
  toast(`来自分享：${t.title} · ${t.artistName}`, "ok");
  if (canPlay(idx)) playTrack(idx); // 桌面端自动播放多被拦截，playTrack 会落到「已就绪，点 ▶」
}

// ───────── 创作者面板：我的曲目 + 版税统计 ─────────
function updateCreatorPanel() {
  const panel = $("creatorPanel");
  if (!panel) return;
  if (!musicContract || !account || tracksCache.length === 0) { panel.hidden = true; return; }
  const mineIdx = tracksCache.map((t, i) => i).filter((i) => tracksCache[i].artist.toLowerCase() === account.toLowerCase());
  const mine = mineIdx.map((i) => tracksCache[i]);
  if (mine.length === 0) { panel.hidden = true; return; }
  panel.hidden = false;
  $("creatorName").textContent = shortAddr(account);
  $("statTracks").textContent = mine.length;
  const earned = mine.reduce((s, t) => s + Number(ethers.formatEther(t.totalEarned)), 0);
  $("statEarned").textContent = `${earned.toFixed(4)} ${sym()}`;
  const listEl = $("creatorDetailList");
  listEl.innerHTML = mineIdx.map((i) => {
    const t = tracksCache[i];
    return `
    <div class="creator__row">
      <span class="t">${escapeHtml(t.title)}</span>
      <span class="m">💰 ${ethers.formatEther(t.totalEarned)} ${sym()}</span>
    </div>`;
  }).join("");
}

// ───────── 唱片容器下拉：枚举当前钱包在指定处理器下持有的容器 ─────────
async function loadCircuits() {
  const sel = $("inCircuit"), info = $("circuitInfo");
  if (!sel) return;
  if (!musicContract || !factoryContract || !openerContract || !account) {
    sel.disabled = true;
    sel.innerHTML = `<option value="">${T("pub.circuitConnect")}</option>`;
    syncCircuitInfo();
    return;
  }
  sel.disabled = false;
  sel.innerHTML = `<option value="">${T("pub.circuitLoading")}</option>`;
  try {
    const processor = await factoryContract.cpuAt(PROCESSOR_NO);
    if (!processor || /^0x0+$/.test(processor)) throw new Error(`处理器 #${PROCESSOR_NO} 不存在`);
    const circuits = new ethers.Contract(processor, CIRCUIT_ABI, provider);
    const nextId = Number(await circuits.nextId()); // #ID 从 1 开始，nextId 为已发出的最大编号

    const mine = [];
    for (let id = 1; id <= nextId + 5; id++) {
      let owner;
      try { owner = await circuits.ownerOf(id); } catch (e) { continue; } // 未铸造的 #ID 会 revert
      if (owner.toLowerCase() !== account.toLowerCase()) continue;
      const opened = await openerContract.isOpened(processor, id).catch(() => false);
      mine.push({ id, opened });
    }

    // 已发行过的容器不可再选：音频路径固定为 music/{tokenId}.{cpu}，
    // 而 putFile 是整体覆盖，重复发行会覆盖上一首的音频与封面
    const usedIds = new Set(
      tracksCache.filter((t) => Number(t.cpu) === PROCESSOR_NO).map((t) => Number(t.tokenId))
    );
    const available = mine.filter((c) => !usedIds.has(c.id));
    const usedCount = mine.length - available.length;

    if (available.length === 0) {
      // 保持可点击（禁用会让用户以为点了没反应），把原因写在提示里
      sel.disabled = false;
      sel.innerHTML = `<option value="">${T("pub.circuitEmpty")}</option>`;
      info.textContent = usedCount > 0
        ? `名下 ${usedCount} 个容器都已发行过，请到 id.tapeout.link 开通新容器`
        : `处理器 #${PROCESSOR_NO} 下未找到 ${shortAddr(account)} 持有的唱片容器`;
      info.style.color = "var(--danger)";
      return;
    }
    sel.innerHTML = available
      .map((c) => `<option value="${c.id}" data-opened="${c.opened}">#${c.id} · ${c.opened ? T("pub.circuitOpened") : T("pub.circuitNotOpened")}</option>`)
      .join("");
    syncCircuitInfo();
    if (usedCount > 0) info.textContent += ` · 已过滤 ${usedCount} 个已发行容器`;
  } catch (e) {
    sel.disabled = false;
    sel.innerHTML = `<option value="">${T("pub.circuitEmpty")}</option>`;
    info.textContent = "加载唱片容器失败：" + (e.reason || e.message);
    info.style.color = "var(--danger)";
  }
}

// 选中唱片容器的状态提示
function syncCircuitInfo() {
  const sel = $("inCircuit"), info = $("circuitInfo");
  if (!sel || !info) return;
  const opt = sel.selectedOptions[0];
  if (!opt || !opt.value) {
    info.textContent = T("pub.circuitHint");
    info.style.color = "var(--muted)";
    return;
  }
  const opened = opt.dataset.opened === "true";
  info.textContent = `#${opt.value} · ${opened ? T("pub.circuitOpened") : T("pub.circuitNotOpened")}`;
  info.style.color = opened ? "var(--success)" : "var(--danger)";
}

// ───────── 版本号（侧边栏底部）─────────
// 显示 app.js 自身的版本；再拿 Service Worker 缓存名比对，
// 只有「缓存比页面新」才算过期（说明 SW 已更新但页面没重载）。
// 反过来「缓存比页面旧」是正常的：Unregister 过的旧缓存会残留成孤儿条目。
async function renderVersion() {
  const el = $("appVersion");
  if (!el) return;
  let swNum = 0;
  try {
    const vers = (await caches.keys())
      .filter((k) => k.startsWith("sonicmint-"))
      .map((k) => Number(k.replace("sonicmint-v", "")))
      .filter((n) => !Number.isNaN(n));
    if (vers.length) swNum = Math.max(...vers);
  } catch (e) { /* 非安全上下文没有 caches */ }
  const pageNum = Number(APP_VERSION.replace("v", ""));
  const stale = swNum > pageNum;
  el.textContent = stale ? `页面 ${APP_VERSION} · 缓存 v${swNum}（请刷新）` : APP_VERSION;
  el.style.color = stale ? "var(--accent)" : "";
}

// ───────── 初始化 ─────────
window.addEventListener("DOMContentLoaded", () => {
  renderVersion();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  // 只读合约：曲库读取全是 view 调用，无需钱包即可浏览
  provider = new ethers.JsonRpcProvider(currentNetwork.rpc);
  musicContract = new ethers.Contract(currentNetwork.music, SONICMINT_ABI, provider);
  // 通用：所有页面
  const connectBtn = $("connectBtn");
  if (connectBtn) connectBtn.addEventListener("click", () => connectWallet());

  // 网络切换按钮
  const netXlayer = $("netXlayer");
  if (netXlayer) netXlayer.addEventListener("click", () => switchNetwork(196));

  // 首页：侧栏导航 + 迷你播放条 + 发行表单 + 个人面板
  const uploadBtn = $("uploadBtn");
  if (document.querySelector(".sidebar")) {
    // 移动端抽屉
    const sidebar = $("sidebar"), scrim = $("sidebarScrim"), navToggle = $("navToggle");
    if (navToggle && sidebar && scrim) {
      const closeDrawer = () => { sidebar.classList.remove("is-open"); scrim.hidden = true; };
      navToggle.addEventListener("click", () => {
        const open = sidebar.classList.toggle("is-open");
        scrim.hidden = !open;
      });
      scrim.addEventListener("click", closeDrawer);
      sidebar.querySelectorAll(".side-item").forEach((a) => a.addEventListener("click", closeDrawer));
    }
    // 迷你播放条
    $("playToggle").addEventListener("click", togglePlay);
    $("prevBtn").addEventListener("click", playPrev);
    $("nextBtn").addEventListener("click", playNext);
    $("shareBtn").addEventListener("click", shareCurrent);
    $("queueBtn").addEventListener("click", openQueue);
    $("mySongsBtn").addEventListener("click", openQueue);
    $("queueClose").addEventListener("click", closeQueue);
    $("queue").querySelector("[data-close]").addEventListener("click", closeQueue);
    // 歌词抽屉：高亮行随播放进度滚动
    $("lyricsBtn").addEventListener("click", openLyrics);
    $("lyricsClose").addEventListener("click", closeLyrics);
    $("lyricsSheet").querySelector("[data-close]").addEventListener("click", closeLyrics);
    $("audio").addEventListener("timeupdate", syncLyrics);
    // 进度条：跟随时长与位置更新，拖动即跳转
    $("audio").addEventListener("timeupdate", syncSeek);
    $("audio").addEventListener("loadedmetadata", syncSeek);
    bindSeek();
    // 曲库
    $("refreshBtn").addEventListener("click", loadTracks);
    $("searchInput").addEventListener("input", (e) => { searchQuery = e.target.value; renderTracks(); });

    // 发行页 Hero：CTA 展开上传表单并滚动到位
    const heroCta = $("heroCta"), pubForm = $("publishForm");
    if (heroCta && pubForm) heroCta.addEventListener("click", () => {
      pubForm.hidden = false;
      pubForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // 发行表单
    if (uploadBtn) {
      uploadBtn.addEventListener("click", uploadAudio);
      // 免费唱片时隐藏买断价
      const inFree = $("inFree"), priceRow = $("priceRow");
      if (inFree && priceRow) {
        const syncPrice = () => { priceRow.hidden = inFree.checked; };
        inFree.addEventListener("change", syncPrice);
        syncPrice();
      }
      // 唱片容器下拉：切换时刷新开通状态提示
      const circuitSel = $("inCircuit");
      if (circuitSel) circuitSel.addEventListener("change", syncCircuitInfo);
      // 上传中断后临时授权仍在，提供手动撤销
      const revokeBtn = $("revokeOpBtn");
      if (revokeBtn) revokeBtn.addEventListener("click", async () => {
        revokeBtn.disabled = true;
        try {
          await closeOperator();
          toast("已撤销临时上传授权，剩余 gas 已退回", "ok");
        } catch (e) {
          toast("撤销失败：" + (e.reason || e.message), "err");
        } finally {
          revokeBtn.disabled = false;
        }
      });
      $("addRoyaltyBtn").addEventListener("click", () => {
        royaltyRecipients.push({ addr: "", bps: 0 });
        renderRoyaltyList();
      });
      $("inFile").addEventListener("change", (e) => {
        uploadBtn.disabled = !e.target.files[0];
        renderFileInfo(); // 音频行带「音频 + 封面」合计 gas 预估
      });
      const coverInput = $("inCover");
      if (coverInput) coverInput.addEventListener("change", () => renderFileInfo());
    }

    // 首屏：拉曲库 → 按 hash 定位面板
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"; // 禁用刷新后的滚动恢复，避免 Hero 被吸顶栏遮住
    window.addEventListener("hashchange", () => { switchTab(); window.scrollTo(0, 0); }); // 切面板回到顶部
    window.scrollTo(0, 0);
    (async () => { await loadTracks(); switchTab(); applySharedTrack(); })();
  }

  if (window.ethereum) {
    // 仅在确实变化时才 reload，避免与自动重连互触发形成刷新死循环
    window.ethereum.on("accountsChanged", (accs) => {
      const next = String((accs && accs[0]) || "").toLowerCase();
      // 集成为空数组属握手噪声，忽略；只有真正换到别的账户才刷新
      if (walletReady && next && next !== (account || "").toLowerCase()) location.reload();
    });
    window.ethereum.on("chainChanged", (id) => {
      if (walletReady && Number(id) !== currentChainId) location.reload();
    });
    // 已授权则自动重连：切链或刷新后无需再点「连接钱包」
    if ($("connectBtn")) {
      window.ethereum.request({ method: "eth_accounts" })
        .then((accs) => { if (accs && accs.length) connectWallet(true); })
        .catch(() => {});
    }
  }
});
