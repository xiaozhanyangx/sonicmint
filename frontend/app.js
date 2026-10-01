/* ============================================================
 * 声刻 SonicMint v2 · 前端逻辑
 * 特性：X Layer / 订阅制 / 抗女巫 / 多方版税 / 无损分片
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
  "function registerTrack(address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, string title, string artistName, uint256 price, bool free, tuple(address addr, uint256 bps)[] royalties) returns (uint256)",
  "function play(uint256 trackId)",
  "function buy(uint256 trackId) payable",
  "function subscribe(uint256 months) payable",
  "function settleTrack(uint256 trackId)",
  "function trackCount() view returns (uint256)",
  "function subscriptionPool() view returns (uint256)",
  "function monthlyFee() view returns (uint256)",
  "function totalPendingPlays() view returns (uint256)",
  "function subscriptionExpiry(address) view returns (uint256)",
  "function isSubscriber(address) view returns (bool)",
  "function getPurchased(address user, uint256 offset, uint256 limit) view returns (bool[])",
  "function getTracks(uint256 offset, uint256 limit) view returns (tuple(address artist, address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, string title, string artistName, uint256 playCount, uint256 totalEarned, uint256 pendingPlays, uint256 createdAt, uint256 price, bool free, bool exists)[])",
];

// ───────── 状态 ─────────
let provider, signer, account;
let musicContract, registryContract, openerContract, factoryContract;
let tracksCache = [];
let currentTrackIdx = null;
let searchQuery = "";
let royaltyRecipients = []; // [{addr, bps}]
let isSubscriberNow = false;   // 当前用户订阅是否有效
let purchasedCache = [];       // bool[]，与 tracksCache 同索引

const $ = (id) => document.getElementById(id);
const shortAddr = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const escapeHtml = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
const sym = () => currentNetwork.symbol;

// ───────── Demo 模式（核心合约地址未配置时自动启用）─────────
const isDemo = () => !!(window.DEMO && DEMO.isActive());

// 资源 URL：完整地址（demo 上传的 blob）原样返回，demo 预置走本地目录，链上曲目走网关
function fileUrl(t, path) {
  if (!path) return "";
  if (/^(blob:|data:|https?:)/.test(path)) return path;
  if (t.base) return `${t.base}/${path}`;
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
  if (isDemo()) { enterDemo(); return; } // 演示模式无需钱包
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
    // 若发行页已填处理器编号，自动解析
    if ($("inCpu")) resolveProcessor();
    await refreshSubscription();
    if ($("refreshBtn")) loadTracks();
    else loadCreatorPanel(); // 发行页：只刷新创作者面板
  } catch (e) {
    console.error(e);
    toast("连接失败：" + e.message, "err");
  }
}

// ───────── 进入演示模式：用本地 mock 合约替换真实合约 ─────────
function enterDemo() {
  account = DEMO.ACCOUNT;
  musicContract    = DEMO.music();
  registryContract = DEMO.registry();
  openerContract   = DEMO.opener();
  factoryContract  = DEMO.factory();

  $("connectBtn").textContent = shortAddr(account);
  const badge = $("chainBadge");
  if (badge) {
    badge.setAttribute("data-i18n", "nav.demo"); // 切换语言时同步
    badge.textContent = T("nav.demo");
    badge.classList.add("badge--ok");
  }

  updateNetworkLabels();
  if ($("inCpu")) resolveProcessor();
  refreshSubscription();
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

async function refreshSubscription() {
  if (!musicContract) return;
  const subBtn = $("subscribeBtn"), subBadge = $("subBadge"), poolInfo = $("poolInfo");
  if (!subBtn || !subBadge) return; // 发行页/规则页无此区域
  try {
    const subscribed = await musicContract.isSubscriber(account);
    const monthlyFee = await musicContract.monthlyFee();
    subBtn.hidden = subscribed;
    subBadge.hidden = !subscribed;
    if (!subscribed) subBtn.textContent = `订阅 (${ethers.formatEther(monthlyFee)} ${sym()}/月)`;
    if (poolInfo) {
      const pool = await musicContract.subscriptionPool();
      const pending = await musicContract.totalPendingPlays();
      poolInfo.textContent = `池子 ${ethers.formatEther(pool)} ${sym()} · ${pending} 次待结算`;
    }
    updateSubCard();
  } catch (e) { console.warn(e); }
}

// ───────── 订阅（可选 1/3/12 个月）─────────
const SUB_MONTHS = [1, 3, 12];
let subFee = 0n;

// 动态注入订阅弹层，三页共用
function ensureSubModal() {
  if ($("subModal")) return;
  const el = document.createElement("div");
  el.id = "subModal";
  el.className = "modal";
  el.hidden = true;
  el.innerHTML = `
    <div class="modal__box">
      <h3>${T("sub.title")}</h3>
      <p class="muted small">${T("sub.desc")}</p>
      <div class="sub-opts">
        ${SUB_MONTHS.map((m) => `
          <button class="sub-opt" data-months="${m}">
            <span class="sub-opt__m">${m}</span>
            <span class="sub-opt__unit">${T("sub.unit")}</span>
            <span class="sub-opt__price" data-months="${m}"></span>
          </button>`).join("")}
      </div>
      <button class="btn btn--ghost" id="subCancel">${T("sub.cancel")}</button>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener("click", (e) => { if (e.target === el) closeSubModal(); });
  $("subCancel").addEventListener("click", closeSubModal);
  el.querySelectorAll(".sub-opt").forEach((b) =>
    b.addEventListener("click", () => doSubscribe(Number(b.dataset.months)))
  );
}

function closeSubModal() { const m = $("subModal"); if (m) m.hidden = true; }

async function openSubscribe() {
  if (!musicContract) { toast("请先连接钱包", "err"); return; }
  ensureSubModal();
  try {
    subFee = await musicContract.monthlyFee();
    $("subModal").querySelectorAll(".sub-opt__price").forEach((s) => {
      s.textContent = `${ethers.formatEther(subFee * BigInt(s.dataset.months))} ${sym()}`;
    });
    $("subModal").hidden = false;
  } catch (e) {
    toast("读取月费失败：" + (e.reason || e.message), "err");
  }
}

async function doSubscribe(months) {
  closeSubModal();
  const subBtn = $("subscribeBtn");
  try {
    if (subBtn) { subBtn.disabled = true; subBtn.textContent = "支付中…"; }
    const tx = await musicContract.subscribe(months, { value: subFee * BigInt(months) });
    await tx.wait();
    toast(`订阅成功：${months} 个月`, "ok");
  } catch (e) {
    console.error(e);
    toast("订阅失败：" + (e.reason || e.message), "err");
  } finally {
    if (subBtn) subBtn.disabled = false;
    refreshSubscription();
    loadTracks();
  }
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
  if ($("inPrice")) $("inPrice").value = "";
  $("fileInfo").textContent = ""; $("coverInfo").textContent = "";
  royaltyRecipients = []; renderRoyaltyList();
  $("uploadBtn").disabled = false;
}

async function uploadAudio() {
  const title = $("inTitle").value.trim();
  const artist = $("inArtist").value.trim();
  const tokenId = parseInt($("inTokenId").value);
  const cpu = parseInt($("inCpu").value);
  const file = $("inFile").files[0];
  const coverFile = $("inCover").files[0];
  const status = $("uploadStatus");

  if (!title || !artist || !tokenId || !file) { toast("请填写完整信息并选择音频文件", "err"); return; }

  // 版税校验
  const totalBps = royaltyRecipients.reduce((s, r) => s + r.bps, 0);
  if (totalBps > 10000) { toast(`版税比例总和 ${(totalBps/100).toFixed(1)}% 超过 100%`, "err"); return; }

  // 买断价（免费唱片可留空）
  const isFree = $("inFree") ? $("inFree").checked : false;
  const priceStr = $("inPrice") ? $("inPrice").value.trim() : "";
  if (!isFree && !(Number(priceStr) > 0)) { toast("请填写买断价（大于 0）", "err"); return; }
  const priceWei = isFree ? 0n : ethers.parseEther(priceStr);

  $("uploadBtn").disabled = true;
  status.style.color = "";

  // 演示模式：本地模拟发行，不上链
  if (isDemo()) {
    try {
      status.textContent = "演示模式：本地模拟上传…";
      const r = await DEMO.upload({
        title, artistName: artist, tokenId, cpu, file, coverFile,
        price: priceWei, free: isFree,
      });
      status.textContent = `✓ 发行成功！曲目 #${r.trackId}（演示数据，仅本次会话可见）`;
      status.style.color = "var(--accent)";
      resetUploadForm();
      loadCreatorPanel();
    } catch (e) {
      console.error(e);
      status.textContent = "✗ " + e.message;
      status.style.color = "var(--danger)";
      $("uploadBtn").disabled = false;
    }
    return;
  }

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

    // ─── 上传音频（分片）───
    const buf = new Uint8Array(await file.arrayBuffer());
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
    const tx = await musicContract.registerTrack(container, tokenId, cpu, audioPath, partCount, coverPath, title, artist, priceWei, isFree, royalties);
    const rc = await tx.wait();
    const evt = rc.logs.find((l) => l.fragment && l.fragment.name === "TrackRegistered");
    const trackId = evt ? evt.args[0].toString() : "?";

    status.textContent = `✓ 发行成功！曲目 #${trackId}${partCount > 1 ? `（${partCount} 分片）` : ""}${coverPath ? " · 含封面" : ""}`;
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
  // 当前用户的播放权限：订阅状态 + 各曲目买断状态（与 tracksCache 同索引）
  isSubscriberNow = account ? await musicContract.isSubscriber(account).catch(() => false) : false;
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
  if (!musicContract) { updateCreatorPanel(); return; }
  try { await fetchTracks(); } catch (e) { console.error(e); }
  updateCreatorPanel();
}

// 按搜索词过滤后的可见曲目（保留真实索引 = 合约 trackId）
function visibleTracks() {
  const q = searchQuery.trim().toLowerCase();
  return tracksCache
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !q || t.title.toLowerCase().includes(q) || t.artistName.toLowerCase().includes(q));
}

// 播放权限：免费 / 已买断 / 订阅有效期内
function canPlay(idx) {
  const t = tracksCache[idx];
  return !!t && (t.free || !!purchasedCache[idx] || isSubscriberNow);
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
  // 状态标签：免费 | 已买断
  const stateTag = t.free
    ? `<span class="tag tag--free">${T("lib.free")}</span>`
    : purchasedCache[i]
      ? `<span class="tag tag--own">${T("lib.owned")}</span>`
      : "";
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

// ───────── 个人面板：我的订阅 + 我购买的音乐 ─────────
async function loadProfile() {
  const list = $("purchasedList");
  if (!list) return;
  if (!musicContract) { list.innerHTML = `<p class="muted">${T("profile.connectTip")}</p>`; updateSubCard(); return; }
  if (tracksCache.length === 0) { try { await fetchTracks(); } catch (e) { console.error(e); } }
  // 只列买断过的（免费曲目不算购买）
  const bought = tracksCache.map((_, i) => i).filter((i) => purchasedCache[i]);
  list.innerHTML = bought.length
    ? bought.map((i) => trackRowHtml(i)).join("")
    : `<p class="muted">${T("profile.noPurchased")}</p>`;
  if (bought.length) bindTrackRows(list);
  updateSubCard();
}

// 订阅卡：状态文字 + 月费
async function updateSubCard() {
  const state = $("subState"), btn = $("subActionBtn");
  if (!state || !btn) return;
  if (!musicContract || !account) { state.textContent = T("profile.notConnected"); btn.hidden = true; return; }
  let fee = "";
  try { fee = ` · ${ethers.formatEther(await musicContract.monthlyFee())} ${sym()}/月`; } catch (e) {}
  state.textContent = (isSubscriberNow ? T("profile.subStateOn") : T("profile.subStateOff")) + fee;
  btn.hidden = false;
  btn.textContent = isSubscriberNow ? T("profile.renew") : T("profile.subscribe");
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

// ───────── 播放（支持分片合并）─────────
async function playTrack(idx) {
  const t = tracksCache[idx];
  if (!t) return;
  if (!canPlay(idx)) { toast(T("player.locked"), "err"); return; }

  currentTrackIdx = idx;
  markPlaying();
  fillMini(t);

  const audio = $("audio");
  audio.onplay = syncPlayIcon;
  audio.onpause = syncPlayIcon;
  audio.onended = () => playNext(); // 自动连播下一曲

  try {
    const partCount = Number(t.partCount);
    if (partCount > 1) {
      // 分片下载并合并
      const baseUrl = GATEWAY.replace("{id}", t.tokenId).replace("{cpu}", t.cpu);
      const blobs = [];
      for (let i = 0; i < partCount; i++) {
        const res = await fetch(`${baseUrl}/${t.audioPath}.part${i}`);
        if (!res.ok) throw new Error(`分片 ${i} 加载失败`);
        blobs.push(await res.blob());
      }
      audio.src = URL.createObjectURL(new Blob(blobs, { type: "audio/mpeg" }));
    } else {
      audio.src = fileUrl(t, t.audioPath);
    }
    await audio.play();
    // 记账：订阅畅听且非免费未买断时，静默上报一次播放
    if (isSubscriberNow && !t.free && !purchasedCache[idx]) musicContract.play(idx).catch(() => {});
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
  const label = btn ? btn.textContent : "";
  try {
    if (btn) { btn.disabled = true; btn.textContent = "支付中…"; }
    const tx = await musicContract.buy(idx, { value: t.price });
    await tx.wait();
    purchasedCache[idx] = true;
    toast(`买断成功：${t.title}`, "ok");
  } catch (e) {
    console.error(e);
    toast("买断失败：" + (e.reason || e.message), "err");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
  if (purchasedCache[idx]) { renderTracks(); playTrack(idx); } // 买断后立即播放
}

// ───────── 结算 ─────────
async function settleTrack(idx) {
  const t = tracksCache[idx];
  if (!t || Number(t.pendingPlays) === 0) return;
  try {
    const tx = await musicContract.settleTrack(idx);
    await tx.wait();
    toast("结算完成", "ok");
    loadTracks();
    if ($("creatorPanel")) loadCreatorPanel();
  } catch (e) {
    console.error(e);
    toast("结算失败：" + (e.reason || e.message), "err");
  }
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
  const pending = mine.reduce((s, t) => s + Number(t.pendingPlays), 0);
  $("statEarned").textContent = `${earned.toFixed(4)} ${sym()}`;
  $("statPending").textContent = pending;
  const listEl = $("creatorDetailList");
  listEl.innerHTML = mineIdx.map((i) => {
    const t = tracksCache[i];
    const hasPending = Number(t.pendingPlays) > 0;
    return `
    <div class="creator__row">
      <span class="t">${escapeHtml(t.title)}</span>
      <span class="m">▶ ${Number(t.playCount)} 次 · 💰 ${ethers.formatEther(t.totalEarned)} ${sym()}${hasPending ? ` · ⏳ ${t.pendingPlays} 待结算` : ""}</span>
      ${hasPending ? `<button class="btn btn--ghost btn--sm" data-settle="${i}">结算</button>` : ""}
    </div>`;
  }).join("");
  listEl.querySelectorAll("[data-settle]").forEach((b) =>
    b.addEventListener("click", () => settleTrack(Number(b.dataset.settle)))
  );
}

// ───────── 处理器解析（显式指定处理器）─────────
async function resolveProcessor() {
  const cpuInput = $("inCpu");
  const info = $("processorInfo");
  if (!cpuInput || !info) return;
  const cpu = parseInt(cpuInput.value);
  if (isNaN(cpu) || cpu < 0 || !factoryContract) {
    info.textContent = "";
    return;
  }
  try {
    info.textContent = "查询中…";
    info.style.color = "var(--muted)";
    const processor = await factoryContract.cpuAt(cpu);
    info.innerHTML = `处理器 <code>${shortAddr(processor)}</code>`;
    info.style.color = "var(--success)";
  } catch (e) {
    info.textContent = "查询失败：" + (e.reason || e.message);
    info.style.color = "var(--danger)";
  }
}

// ───────── 初始化 ─────────
window.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  // 合约地址未配置 → 直接进入演示模式，无需连接钱包
  if (isDemo()) enterDemo();
  // 通用：所有页面
  const connectBtn = $("connectBtn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);
  const subBtn = $("subscribeBtn");
  if (subBtn) subBtn.addEventListener("click", openSubscribe);

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
    $("refreshBtn").addEventListener("click", () => { loadTracks(); refreshSubscription(); });
    $("searchInput").addEventListener("input", (e) => { searchQuery = e.target.value; renderTracks(); });
    // 个人面板：订阅
    $("subActionBtn").addEventListener("click", openSubscribe);

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
      // 处理器编号输入变化时自动解析处理器地址
      const cpuInput = $("inCpu");
      if (cpuInput) {
        cpuInput.addEventListener("change", resolveProcessor);
        cpuInput.addEventListener("blur", resolveProcessor);
      }
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

    // 首屏：拉曲库 → 订阅状态 → 按 hash 定位面板
    if ("scrollRestoration" in history) history.scrollRestoration = "manual"; // 禁用刷新后的滚动恢复，避免 Hero 被吸顶栏遮住
    window.addEventListener("hashchange", () => { switchTab(); window.scrollTo(0, 0); }); // 切面板回到顶部
    window.scrollTo(0, 0);
    (async () => { await loadTracks(); refreshSubscription(); switchTab(); })();
  }

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
  }
});
