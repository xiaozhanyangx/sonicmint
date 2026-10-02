/* ============================================================
 * 声刻 SonicMint v4 · 前端逻辑
 * 特性：X Layer / 买断制 / 加密上链 / 分类 / 多方版税 / 无损分片
 * ============================================================ */

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
    music:            "0xDcFe709728E085cD59Bb10fd09AbA657BF68b087",
  },
};

let currentChainId = 196;
let currentNetwork = NETWORKS[196];

const CHUNK_MAX = 24000;
const FILE_MAX  = 8_400_000;
const GATEWAY   = "https://{id}-{cpu}.tapekit.org";

// 唯一允许发行的处理器编号（须与合约 allowedProcessor 一致）
const PROCESSOR_NO = 260;
// 音频分类：索引即合约里的 genre（0..MAX_GENRE），文案见 lang.js 的 genre.N
const GENRES = ["pop", "rock", "electronic", "hiphop", "folk", "jazz", "classical", "gufeng", "instrumental", "podcast"];
// 平台密钥管家（keeper）：封装/解封曲目内容密钥 K。部署后由 scripts/keeper-key.js 生成并回填
const KEEPER = {
  address: "0x0000000000000000000000000000000000000000",
  publicKey: "0x0000000000000000000000000000000000000000000000000000000000000000", // keeper 的 X25519 公钥
};
// 购买后通知 keeper 封装 vault；须替换为实际 Worker 地址（wrangler deploy 输出，形如 https://sonicmint-keeper.<账号子域>.workers.dev/sync）
const KEEPER_SYNC = "https://sonicmint-keeper.workers.dev/sync";
// 电路 NFT（处理器合约）只读接口
const CIRCUIT_ABI = [
  "function ownerOf(uint256) view returns (address)",
  "function nextId() view returns (uint256)",
];

// ───────── ABI（v2）─────────
const SITE_REGISTRY_ABI = [
  "function putFile(address container, string path, string contentType, bytes32 sha256Hash, bytes firstChunk)",
  "function appendChunk(address container, string path, uint256 expectIndex, bytes chunk)",
  "function fileInfo(address container, string path) view returns (uint256, string, bytes32, uint256, uint256)",
];
const CONTAINER_OPENER_ABI = [
  "function accountOf(address processor, uint256 tokenId) view returns (address)",
  "function isOpened(address processor, uint256 tokenId) view returns (bool)",
];
const PROCESSOR_FACTORY_ABI = [
  "function cpuAt(uint256 number) view returns (address)",
];
const SONICMINT_ABI = [
  "function registerTrack(address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, tuple(string title, string artistName, uint8 genre, uint256 price, bool free, bool encrypted, bytes32 artistPubKey) meta, bytes wrappedCEK, tuple(address addr, uint256 bps)[] royalties) returns (uint256)",
  "function play(uint256 trackId)",
  "function buy(uint256 trackId, bytes32 buyerPubKey) payable",
  "function trackCount() view returns (uint256)",
  "function vaultOf(address user) view returns (bytes)",
  "function userPubKey(address user) view returns (bytes32)",
  "function getPurchased(address user, uint256 offset, uint256 limit) view returns (bool[])",
  "function getTracks(uint256 offset, uint256 limit) view returns (tuple(address artist, address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, string title, string artistName, uint8 genre, uint256 playCount, uint256 totalEarned, uint256 createdAt, uint256 price, bool free, bool encrypted, bytes32 artistPubKey, bool exists)[])",
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

// 资源 URL：完整地址原样返回，链上曲目走网关
function fileUrl(t, path) {
  if (!path) return "";
  if (/^(blob:|data:|https?:)/.test(path)) return path;
  return `${GATEWAY.replace("{id}", t.tokenId).replace("{cpu}", t.cpu)}/${path}`;
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
async function connectWallet() {
  if (!window.ethereum) { toast("请安装 MetaMask / OKX Wallet 等 EVM 钱包", "err"); return; }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    account = await signer.getAddress();
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
    // 若发行页已渲染电路下拉，连接后重新加载
    if ($("inCircuit")) loadCircuits();
    if ($("refreshBtn")) loadTracks();
    else loadCreatorPanel(); // 发行页：只刷新创作者面板
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
function renderRoyaltyList() {
  const list = $("royaltyList");
  list.innerHTML = royaltyRecipients.map((r, i) => `
    <div class="royalty-item" data-idx="${i}">
      <input type="text" placeholder="收益方地址 0x..." value="${r.addr}" data-field="addr" />
      <input type="number" min="1" max="10000" placeholder="比例(%)" value="${(r.bps / 100).toFixed(1)}" data-field="bps" />
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
    });
    item.querySelector("button").addEventListener("click", () => {
      royaltyRecipients.splice(idx, 1);
      renderRoyaltyList();
    });
  });
}

// ───────── 上传音频 ─────────
// 成功后清空表单，恢复按钮
function resetUploadForm() {
  $("inTitle").value = ""; $("inArtist").value = ""; $("inFile").value = ""; $("inCover").value = "";
  if ($("inGenre")) $("inGenre").value = "0";
  if ($("inPrice")) $("inPrice").value = "";
  $("fileInfo").textContent = ""; $("coverInfo").textContent = "";
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

  // 版税校验
  const totalBps = royaltyRecipients.reduce((s, r) => s + r.bps, 0);
  if (totalBps > 10000) { toast(`版税比例总和 ${(totalBps/100).toFixed(1)}% 超过 100%`, "err"); return; }

  // 买断价（免费唱片可留空）
  const isFree = $("inFree") ? $("inFree").checked : false;
  const priceStr = $("inPrice") ? $("inPrice").value.trim() : "";
  if (!isFree && !(Number(priceStr) > 0)) { toast("请填写买断价（大于 0）", "err"); return; }
  const priceWei = isFree ? 0n : ethers.parseEther(priceStr);
  const encrypted = !isFree; // 付费曲目一律加密上链

  $("uploadBtn").disabled = true;
  status.style.color = "";

  try {
    status.textContent = "读取容器…";
    const processor = await factoryContract.cpuAt(cpu);
    const container = await openerContract.accountOf(processor, tokenId);
    if (!(await openerContract.isOpened(processor, tokenId)))
      throw new Error("该电路未开通容器，请先去 id.tapeout.link 开通");

    const basePath = `music/${tokenId}.${cpu}`;

    // ─── 上传封面图 ───
    let coverPath = "";
    if (coverFile) {
      status.textContent = "上传封面图…";
      const coverBuf = new Uint8Array(await coverFile.arrayBuffer());
      const ext = coverFile.name.split(".").pop() || "jpg";
      coverPath = `${basePath}.cover.${ext}`;
      const coverHash = await sha256Bytes(coverBuf);
      const coverChunks = Math.ceil(coverBuf.length / CHUNK_MAX);
      await registryContract.putFile(container, coverPath, coverFile.type, coverHash, coverBuf.slice(0, CHUNK_MAX));
      await new Promise(r => setTimeout(r, 2000));
      for (let i = 1; i < coverChunks; i++) {
        const s = i * CHUNK_MAX;
        await registryContract.appendChunk(container, coverPath, i, coverBuf.slice(s, s + CHUNK_MAX));
      }
    }

    // ─── 加密音频（付费曲目）：随机 K 加密，K 封给 keeper 后上链 ───
    let buf = new Uint8Array(await file.arrayBuffer());
    let wrappedCEK = "0x";
    let artistPubKey = ethers.ZeroHash;
    if (encrypted) {
      status.textContent = "生成内容密钥…";
      const lib = cryptoLib();
      const kp = await ensureKeyPair();
      const cfg = { hub: currentNetwork.music, chainId: currentChainId };
      const key = lib.randomKey();
      buf = lib.encryptBytes(key, buf);
      artistPubKey = lib.pubKeyHex(kp.publicKey);
      wrappedCEK = lib.bytesToHex(lib.wrapKeyFor(key, {
        address: KEEPER.address,
        publicKey: lib.pubKeyBytes(KEEPER.publicKey),
      }, cfg));
    }

    // ─── 上传音频（分片）───
    const partSize = FILE_MAX;
    const partCount = Math.ceil(buf.length / partSize);
    const ext = file.name.split(".").pop() || "mp3";

    for (let p = 0; p < partCount; p++) {
      const start = p * partSize;
      const partBuf = buf.slice(start, start + partSize);
      const path = partCount > 1 ? `${basePath}.part${p}` : `${basePath}.${ext}`;
      const hash = await sha256Bytes(partBuf);
      const totalChunks = Math.ceil(partBuf.length / CHUNK_MAX);

      status.textContent = `上传音频 ${p + 1}/${partCount} (1/${totalChunks})…`;
      const tx1 = await registryContract.putFile(container, path, "audio/mpeg", hash, partBuf.slice(0, CHUNK_MAX));
      await tx1.wait();

      for (let i = 1; i < totalChunks; i++) {
        const s = i * CHUNK_MAX;
        const tx = await registryContract.appendChunk(container, path, i, partBuf.slice(s, s + CHUNK_MAX));
        await tx.wait();
        status.textContent = `上传音频 ${p + 1}/${partCount} (${i + 1}/${totalChunks})…`;
      }
    }

    // 注册曲目
    status.textContent = "注册曲目…";
    const royalties = royaltyRecipients.map((r) => ({ addr: r.addr, bps: r.bps }));
    const audioPath = partCount > 1 ? basePath : `${basePath}.${ext}`;
    const meta = { title, artistName: artist, genre, price: priceWei, free: isFree, encrypted, artistPubKey };
    const tx = await musicContract.registerTrack(container, tokenId, cpu, audioPath, partCount, coverPath, meta, wrappedCEK, royalties);
    const rc = await tx.wait();
    const evt = rc.logs.find((l) => l.fragment && l.fragment.name === "TrackRegistered");
    const trackId = evt ? evt.args[0].toString() : "?";

    status.textContent = `✓ 发行成功！曲目 #${trackId}${partCount > 1 ? `（${partCount} 分片）` : ""}${encrypted ? " · 已加密" : ""}${coverPath ? " · 含封面" : ""}`;
    status.style.color = "var(--accent)";

    resetUploadForm();
    loadCreatorPanel();
  } catch (e) {
    console.error(e);
    status.textContent = "✗ " + (e.reason || e.message);
    status.style.color = "var(--danger)";
    $("uploadBtn").disabled = false;
  }
}

// ───────── 曲库 ─────────
// 拉取曲目与权限缓存（不渲染），曲库页与创作者面板共用
async function fetchTracks() {
  if (!musicContract) return;
  const count = Number(await musicContract.trackCount());
  tracksCache = count === 0 ? [] : await musicContract.getTracks(0, count);
  // 当前用户的买断状态（与 tracksCache 同索引）
  purchasedCache = account ? await musicContract.getPurchased(account, 0, count).catch(() => []) : [];
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
  try {
    list.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    await fetchTracks();
    if (tracksCache.length === 0) { list.innerHTML = '<p class="muted">' + T("lib.noTrack") + "</p>"; return; }
    renderTracks();
  } catch (e) {
    list.innerHTML = '<p class="muted">加载失败：' + e.message + "</p>";
  }
}

// 创作者面板：发行页无曲库列表，单独拉数据
async function loadCreatorPanel() {
  if (!musicContract) { updateCreatorPanel(); loadCircuits(); return; }
  try { await fetchTracks(); } catch (e) { console.error(e); }
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
  // 买断价：付费且未买断时显示在信息行
  const priceInfo = locked ? `<span class="tag tag--price">${ethers.formatEther(t.price)} ${sym()}</span>` : "";
  return `
    <div class="track${locked ? " is-locked" : ""}" data-track="${i}">
      <div class="track__icon">${coverUrl ? `<img src="${coverUrl}" class="track__cover" alt="封面" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><span style="display:none">🎵</span>` : "🎵"}</div>
      <div class="track__body">
        <div class="track__title">${escapeHtml(t.title)} ${stateTag}</div>
        <div class="track__meta">
          <span>${escapeHtml(t.artistName)}</span>
          <span class="track__plays">▶ ${Number(t.playCount)} 次</span>
          ${genreTag}
          ${priceInfo}
        </div>
      </div>
      ${locked ? `<div class="track__actions"><button class="btn btn--primary btn--sm" data-buy="${i}">${T("player.buy")}</button></div>` : ""}
    </div>`;
}

// 行点击：购买按钮 → 买断，其余 → 播放
function bindTrackRows(container) {
  container.querySelectorAll(".track").forEach((el) => {
    const idx = Number(el.dataset.track);
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-buy]")) { doBuy(idx, e.target.closest("[data-buy]")); return; }
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
function fillMini(t) {
  $("miniPlayer").hidden = false;
  document.body.classList.add("has-mini");   // 为底部浮窗留出空间
  $("miniTitle").textContent = t.title;
  $("miniArtist").textContent = t.artistName;
  const img = $("miniCover"), fb = $("miniCoverFallback");
  if (t.coverPath) {
    img.src = fileUrl(t, t.coverPath);
    img.hidden = false; fb.hidden = true;
    img.onerror = () => { img.hidden = true; fb.hidden = false; };
  } else {
    img.hidden = true; fb.hidden = false;
  }
  // 同步 Hero 黑胶中心封面
  const hc = $("heroCover"), hf = $("heroCoverFallback");
  if (hc) {
    if (t.coverPath) {
      hc.src = fileUrl(t, t.coverPath);
      hc.hidden = false; hf.hidden = true;
      hc.onerror = () => { hc.hidden = true; hf.hidden = false; };
    } else {
      hc.hidden = true; hf.hidden = false;
    }
  }
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
  if (!audio.src) { const p = playableIdx(); if (p.length) playTrack(p[0]); return; }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
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

// ───────── 播放（加密曲目解密 / 分片合并）─────────
// 下载完整音频字节（分片则合并）
async function fetchAudioBytes(t) {
  const partCount = Number(t.partCount);
  if (partCount <= 1) {
    const res = await fetch(fileUrl(t, t.audioPath));
    if (!res.ok) throw new Error("音频加载失败");
    return new Uint8Array(await res.arrayBuffer());
  }
  const baseUrl = GATEWAY.replace("{id}", t.tokenId).replace("{cpu}", t.cpu);
  const chunks = [];
  for (let i = 0; i < partCount; i++) {
    const res = await fetch(`${baseUrl}/${t.audioPath}.part${i}`);
    if (!res.ok) throw new Error(`分片 ${i} 加载失败`);
    chunks.push(new Uint8Array(await res.arrayBuffer()));
  }
  return concatBytes(chunks);
}

async function playTrack(idx) {
  const t = tracksCache[idx];
  if (!t) return;
  if (!canPlay(idx)) { toast(account ? T("player.locked") : "请先连接钱包", "err"); return; }

  currentTrackIdx = idx;
  markPlaying();
  fillMini(t);

  const audio = $("audio");
  audio.onplay = syncPlayIcon;
  audio.onpause = syncPlayIcon;
  audio.onended = () => playNext(); // 自动连播下一曲

  try {
    if (t.encrypted || Number(t.partCount) > 1) {
      let bytes = await fetchAudioBytes(t);
      if (t.encrypted) {
        // 取自己的内容密钥 K（keeper 未就绪时轮询等待）
        const keyHex = await vaultKeyFor(idx);
        if (!keyHex) throw new Error("密钥尚未就绪，请稍后重试");
        bytes = cryptoLib().decryptBytes(cryptoLib().hexToBytes(keyHex, 32), bytes);
      }
      audio.src = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    } else {
      audio.src = fileUrl(t, t.audioPath);
    }
    await audio.play();
  } catch (e) {
    toast("无法播放：" + e.message, "err");
    currentTrackIdx = null;
    markPlaying();
  }
  renderQueue();
}

// ───────── 买断 ─────────
async function doBuy(idx, btn) {
  const t = tracksCache[idx];
  if (!t || !musicContract) return;
  if (!account) { toast("请先连接钱包", "err"); return; }
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
  if (navigator.share) {
    try { await navigator.share({ title: t.title, text, url }); } catch (e) { /* 用户取消 */ }
  } else {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast("已复制分享信息", "ok");
    } catch {
      toast(`${text}\n${url}`);
    }
  }
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
      <span class="m">▶ ${Number(t.playCount)} 次 · 💰 ${ethers.formatEther(t.totalEarned)} ${sym()}</span>
    </div>`;
  }).join("");
}

// ───────── 电路下拉：枚举当前钱包在指定处理器下持有的电路 ─────────
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

    if (mine.length === 0) {
      sel.disabled = true;
      sel.innerHTML = `<option value="">${T("pub.circuitEmpty")}</option>`;
      syncCircuitInfo();
      return;
    }
    sel.innerHTML = mine
      .map((c) => `<option value="${c.id}" data-opened="${c.opened}">#${c.id} · ${c.opened ? T("pub.circuitOpened") : T("pub.circuitNotOpened")}</option>`)
      .join("");
    syncCircuitInfo();
  } catch (e) {
    sel.disabled = true;
    sel.innerHTML = `<option value="">${T("pub.circuitEmpty")}</option>`;
    info.textContent = "加载电路失败：" + (e.reason || e.message);
    info.style.color = "var(--danger)";
  }
}

// 选中电路的容器状态提示
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

// ───────── 初始化 ─────────
window.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  // 只读合约：曲库读取全是 view 调用，无需钱包即可浏览
  provider = new ethers.JsonRpcProvider(currentNetwork.rpc);
  musicContract = new ethers.Contract(currentNetwork.music, SONICMINT_ABI, provider);
  // 通用：所有页面
  const connectBtn = $("connectBtn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);

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
      // 电路下拉：切换时刷新容器状态提示
      const circuitSel = $("inCircuit");
      if (circuitSel) circuitSel.addEventListener("change", syncCircuitInfo);
      $("addRoyaltyBtn").addEventListener("click", () => {
        royaltyRecipients.push({ addr: "", bps: 0 });
        renderRoyaltyList();
      });
      $("inFile").addEventListener("change", (e) => {
        const f = e.target.files[0];
        const info = $("fileInfo");
        uploadBtn.disabled = !f;
        if (f) {
          const mb = (f.size / 1024 / 1024).toFixed(2);
          const parts = Math.ceil(f.size / FILE_MAX);
          info.textContent = `${f.name} · ${mb} MB${parts > 1 ? ` · 将分 ${parts} 片上传` : ""}`;
        } else info.textContent = "";
      });
      const coverInput = $("inCover");
      if (coverInput) coverInput.addEventListener("change", (e) => {
        const f = e.target.files[0];
        const info = $("coverInfo");
        if (f) { const mb = (f.size / 1024 / 1024).toFixed(2); info.textContent = `${f.name} · ${mb} MB`; }
        else info.textContent = "";
      });
    }

    // 首屏：拉曲库 → 按 hash 定位面板
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"; // 禁用刷新后的滚动恢复，避免 Hero 被吸顶栏遮住
    window.addEventListener("hashchange", () => { switchTab(); window.scrollTo(0, 0); }); // 切面板回到顶部
    window.scrollTo(0, 0);
    (async () => { await loadTracks(); switchTab(); })();
  }

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
  }
});
