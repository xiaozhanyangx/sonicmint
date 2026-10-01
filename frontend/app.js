/* ============================================================
 * 声刻 SonicMint v2 · 前端逻辑
 * 特性：多链(BNB+X Layer) / 订阅制 / 抗女巫 / 多方版税 / 无损分片
 * ============================================================ */

// ───────── 多链配置 ─────────
// BNB Chain 主网地址已确认；X Layer 地址需从官方部署文档获取
const NETWORKS = {
  56: {
    name: "BNB Chain",
    symbol: "BNB",
    rpc: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
    siteRegistry:     "0xd006ffdd5Ae313B17729621A00999cD3C71CE5e6",
    containerOpener:  "0x021745DE2f42A7839d96f2d3634d0294487D81F1",
    processorFactory: "0x68224F668083c29e9800Be2a646d42d18cedF7e2",
    music:            "0x0000000000000000000000000000000000000000", // ← BNB 部署后替换
  },
  196: {
    name: "X Layer",
    symbol: "OKB",
    rpc: "https://rpc.xlayer.tech",
    explorer: "https://www.okx.com/web3/explorer/xlayer",
    siteRegistry:     "0x0000000000000000000000000000000000000000", // ← X Layer 部署后替换
    containerOpener:  "0x0000000000000000000000000000000000000000",
    processorFactory: "0x0000000000000000000000000000000000000000",
    music:            "0x0000000000000000000000000000000000000000",
  },
};

const SUPPORTED_CHAINS = [56, 196];
let currentChainId = 56;
let currentNetwork = NETWORKS[56];

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
  "function registerTrack(address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, string title, string artistName, bool free, tuple(address addr, uint256 bps)[] royalties) returns (uint256)",
  "function play(uint256 trackId) payable",
  "function subscribe() payable",
  "function settleTrack(uint256 trackId)",
  "function trackCount() view returns (uint256)",
  "function subscriptionPool() view returns (uint256)",
  "function monthlyFee() view returns (uint256)",
  "function minPlayPrice() view returns (uint256)",
  "function totalPendingPlays() view returns (uint256)",
  "function isSubscriber(address) view returns (bool)",
  "function getTracks(uint256 offset, uint256 limit) view returns (tuple(address artist, address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, string title, string artistName, uint256 playCount, uint256 totalEarned, uint256 pendingPlays, uint256 createdAt, bool free, bool exists)[])",
];

// ───────── 状态 ─────────
let provider, signer, account;
let musicContract, registryContract, openerContract, factoryContract;
let tracksCache = [];
let currentTrackIdx = null;
let searchQuery = "";
let filterMine = false;
let royaltyRecipients = []; // [{addr, bps}]

const $ = (id) => document.getElementById(id);
const shortAddr = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const escapeHtml = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
const sym = () => currentNetwork.symbol;

async function sha256Bytes(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return "0x" + Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ───────── 钱包 ─────────
async function connectWallet() {
  if (!window.ethereum) { alert("请安装 MetaMask / OKX Wallet 等 EVM 钱包"); return; }
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
  } catch (e) {
    console.error(e);
    alert("连接失败：" + e.message);
  }
}

// ───────── 切换网络 ─────────
async function switchNetwork(chainId) {
  if (!window.ethereum) { alert("请先连接钱包"); return; }
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
      alert("切换网络失败：" + e.message);
    }
  }
}
window.switchNetwork = switchNetwork;

// 更新所有显示原生代币符号的文案
function updateNetworkLabels() {
  const s = sym();
  document.querySelectorAll("[data-sym]").forEach((el) => {
    el.textContent = el.textContent.replace(/BNB|OKB/g, s);
  });
}

async function refreshSubscription() {
  if (!musicContract) return;
  try {
    const subscribed = await musicContract.isSubscriber(account);
    const monthlyFee = await musicContract.monthlyFee();
    $("subscribeBtn").hidden = subscribed;
    $("subBadge").hidden = !subscribed;
    if (!subscribed) {
      $("subscribeBtn").textContent = `订阅 (${ethers.formatEther(monthlyFee)} ${sym()}/月)`;
    }
    const pool = await musicContract.subscriptionPool();
    const pending = await musicContract.totalPendingPlays();
    $("poolInfo").textContent = `池子 ${ethers.formatEther(pool)} ${sym()} · ${pending} 次待结算`;
  } catch (e) { console.warn(e); }
}

// ───────── 订阅 ─────────
async function subscribe() {
  try {
    const fee = await musicContract.monthlyFee();
    $("subscribeBtn").disabled = true;
    $("subscribeBtn").textContent = "支付中…";
    const tx = await musicContract.subscribe({ value: fee });
    await tx.wait();
    $("subscribeBtn").textContent = "✓ 订阅成功";
    setTimeout(refreshSubscription, 1000);
  } catch (e) {
    console.error(e);
    alert("订阅失败：" + (e.reason || e.message));
    $("subscribeBtn").disabled = false;
    $("subscribeBtn").textContent = "订阅";
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
async function uploadAudio() {
  const title = $("inTitle").value.trim();
  const artist = $("inArtist").value.trim();
  const tokenId = parseInt($("inTokenId").value);
  const cpu = parseInt($("inCpu").value);
  const file = $("inFile").files[0];
  const coverFile = $("inCover").files[0];
  const status = $("uploadStatus");

  if (!title || !artist || !tokenId || !file) { alert("请填写完整信息并选择音频文件"); return; }

  // 版税校验
  const totalBps = royaltyRecipients.reduce((s, r) => s + r.bps, 0);
  if (totalBps > 10000) { alert(`版税比例总和 ${(totalBps/100).toFixed(1)}% 超过 100%`); return; }

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
    const isFree = $("inFree") ? $("inFree").checked : false;
    const tx = await musicContract.registerTrack(container, tokenId, cpu, audioPath, partCount, coverPath, title, artist, isFree, royalties);
    const rc = await tx.wait();
    const evt = rc.logs.find((l) => l.fragment && l.fragment.name === "TrackRegistered");
    const trackId = evt ? evt.args[0].toString() : "?";

    status.textContent = `✓ 发行成功！曲目 #${trackId}${partCount > 1 ? `（${partCount} 分片）` : ""}${coverPath ? " · 含封面" : ""}`;
    status.style.color = "var(--accent)";

    $("inTitle").value = ""; $("inArtist").value = ""; $("inFile").value = ""; $("inCover").value = "";
    $("fileInfo").textContent = ""; $("coverInfo").textContent = "";
    royaltyRecipients = []; renderRoyaltyList();
    $("uploadBtn").disabled = false;
    loadTracks();
  } catch (e) {
    console.error(e);
    status.textContent = "✗ " + (e.reason || e.message);
    status.style.color = "var(--danger)";
    $("uploadBtn").disabled = false;
  }
}

// ───────── 曲库 ─────────
async function loadTracks() {
  const list = $("trackList");
  if (!musicContract) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🎧</div>
        <p>${T("empty.title")}</p>
        <button class="btn btn--primary" onclick="connectWallet()">${T("empty.btn")}</button>
      </div>`;
    updateCreatorPanel();
    return;
  }
  try {
    const count = Number(await musicContract.trackCount());
    if (count === 0) { list.innerHTML = '<p class="muted">' + T("lib.noTrack") + "</p>"; updateCreatorPanel(); return; }
    const tracks = await musicContract.getTracks(0, count);
    tracksCache = tracks;
    renderTracks();
    updateCreatorPanel();
    renderRecent();
  } catch (e) {
    list.innerHTML = '<p class="muted">加载失败：' + e.message + "</p>";
  }
}

// 按搜索词 / 我的 过滤后的可见曲目（保留真实 trackId = 合约索引）
function visibleTracks() {
  const mine = (account || "").toLowerCase();
  const q = searchQuery.trim().toLowerCase();
  return tracksCache
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => {
      if (filterMine && t.artist.toLowerCase() !== mine) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.artistName.toLowerCase().includes(q)) return false;
      return true;
    });
}

function renderTracks() {
  const list = $("trackList");
  if (!list || !musicContract) return;
  const vis = visibleTracks();
  if (vis.length === 0) {
    list.innerHTML = '<p class="muted">' + (filterMine ? T("lib.noMine") : T("lib.noMatch")) + "</p>";
    return;
  }
  list.innerHTML = vis.map(({ t, i }) => {
    const pending = Number(t.pendingPlays);
    const coverUrl = t.coverPath
      ? GATEWAY.replace("{id}", t.tokenId).replace("{cpu}", t.cpu) + "/" + t.coverPath
      : "";
    return `
      <div class="track" data-track="${i}">
        <div class="track__icon">${coverUrl ? `<img src="${coverUrl}" class="track__cover" alt="封面" onerror="this.style.display='none';this.nextElementSibling.style.display='block'" /><span style="display:none">🎵</span>` : "🎵"}</div>
        <div class="track__body">
          <div class="track__title">${escapeHtml(t.title)}${Number(t.partCount) > 1 ? ` <span class="tag">${t.partCount}分片</span>` : ""}${t.free ? ` <span class="tag tag--free">免费</span>` : ""}</div>
          <div class="track__meta">
            <span>${escapeHtml(t.artistName)}</span>
            <span class="track__plays">▶ ${Number(t.playCount)} 次</span>
            <span>💰 ${ethers.formatEther(t.totalEarned)} ${sym()}</span>
            ${pending > 0 ? `<span class="track__pending">⏳ ${pending} 次待结算</span>` : ""}
          </div>
        </div>
        <div class="track__actions">
          ${pending > 0 ? `<button class="btn btn--ghost" onclick="event.stopPropagation();settleTrack(${i})">结算</button>` : ""}
          <button class="btn btn--primary">播放</button>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".track").forEach((el) =>
    el.addEventListener("click", () => playTrack(Number(el.dataset.track)))
  );
}

// ───────── 播放（支持分片合并）─────────
async function playTrack(idx) {
  const t = tracksCache[idx];
  if (!t) return;
  currentTrackIdx = idx;

  $("playerSection").hidden = false;
  $("playerTitle").textContent = t.title;
  $("playerArtist").textContent = `${t.artistName} · ${Number(t.playCount)} 次播放`;
  $("playerStats").textContent = `累计版税 ${ethers.formatEther(t.totalEarned)} ${sym()}${t.pendingPlays > 0 ? ` · ${t.pendingPlays} 次待结算` : ""}`;

  // 封面（播放器 + Hero 黑胶）
  const coverImg = $("playerCover");
  const coverFallback = $("playerCoverFallback");
  const heroCover = $("heroCover");
  const heroFallback = $("heroCoverFallback");
  const disc = document.querySelector(".vinyl__disc");
  if (t.coverPath) {
    const coverUrl = GATEWAY.replace("{id}", t.tokenId).replace("{cpu}", t.cpu) + "/" + t.coverPath;
    coverImg.src = coverUrl;
    coverImg.hidden = false; coverFallback.hidden = true;
    coverImg.onerror = () => { coverImg.hidden = true; coverFallback.hidden = false; };
    if (heroCover) {
      heroCover.src = coverUrl; heroCover.hidden = false;
      if (heroFallback) heroFallback.hidden = true;
    }
  } else {
    coverImg.hidden = true; coverFallback.hidden = false;
    if (heroCover) heroCover.hidden = true;
    if (heroFallback) heroFallback.hidden = false;
  }

  const baseUrl = GATEWAY.replace("{id}", t.tokenId).replace("{cpu}", t.cpu);
  const partCount = Number(t.partCount);
  const audio = $("audio");

  // 黑胶随播放状态旋转
  audio.onplay = () => disc && disc.classList.add("is-playing");
  audio.onpause = () => disc && disc.classList.remove("is-playing");
  audio.onended = () => {
    disc && disc.classList.remove("is-playing");
    playNext(); // 自动连播下一曲
  };

  try {
    if (partCount > 1) {
      // 分片下载并合并
      $("playerStats").textContent = "正在合并分片…";
      const blobs = [];
      for (let i = 0; i < partCount; i++) {
        const res = await fetch(`${baseUrl}/${t.audioPath}.part${i}`);
        if (!res.ok) throw new Error(`分片 ${i} 加载失败`);
        blobs.push(await res.blob());
      }
      const combined = new Blob(blobs, { type: "audio/mpeg" });
      audio.src = URL.createObjectURL(combined);
    } else {
      audio.src = `${baseUrl}/${t.audioPath}`;
    }
    await audio.play();
    recordRecent(idx);
  } catch (e) {
    $("playerStats").textContent = "⚠ 无法播放：" + e.message + "（请确认容器已开通）";
  }

  // 播放按钮状态
  const btn = $("playBtn");
  if (t.free) {
    btn.textContent = "免费播放";
  } else {
    const subscribed = account ? await musicContract.isSubscriber(account).catch(() => false) : false;
    if (subscribed) btn.textContent = "订阅免费播放（记录）";
    else btn.textContent = `付费播放 (0.001 ${sym()})`;
  }
}

// ───────── 播放（付费/订阅/免费）─────────
async function doPlay() {
  if (currentTrackIdx === null) return;
  const btn = $("playBtn");
  const t = tracksCache[currentTrackIdx];
  try {
    btn.disabled = true; btn.textContent = "处理中…";
    let resetText;

    if (t.free) {
      // 免费唱片：任何人免费播放，不分钱不计池
      const tx = await musicContract.play(currentTrackIdx);
      await tx.wait();
      btn.textContent = "✓ 免费播放";
      resetText = "免费播放";
    } else {
      const subscribed = await musicContract.isSubscriber(account);
      if (subscribed) {
        const tx = await musicContract.play(currentTrackIdx);
        await tx.wait();
        btn.textContent = "✓ 已记录播放";
        resetText = "订阅免费播放（记录）";
      } else {
        const minPrice = await musicContract.minPlayPrice();
        const payAmount = minPrice > 0n ? minPrice : ethers.parseEther("0.001");
        const tx = await musicContract.play(currentTrackIdx, { value: payAmount });
        await tx.wait();
        btn.textContent = "✓ 已支付";
        resetText = `付费播放 (${ethers.formatEther(payAmount)} ${sym()})`;
      }
    }
    setTimeout(() => { btn.disabled = false; btn.textContent = resetText; }, 2000);
    loadTracks();
  } catch (e) {
    console.error(e);
    btn.textContent = "失败：" + (e.reason || e.message).slice(0, 20);
    btn.disabled = false;
    setTimeout(() => { btn.textContent = t.free ? "免费播放" : `付费播放 (0.001 ${sym()})`; }, 2500);
  }
}

// ───────── 结算 ─────────
async function settleTrack(idx) {
  const t = tracksCache[idx];
  if (!t || Number(t.pendingPlays) === 0) return;
  try {
    const tx = await musicContract.settleTrack(idx);
    await tx.wait();
    loadTracks();
  } catch (e) {
    console.error(e);
    alert("结算失败：" + (e.reason || e.message));
  }
}
window.settleTrack = settleTrack;

// ───────── 播放队列：上/下一曲 ─────────
function playNext() {
  const vis = visibleTracks();
  if (vis.length === 0) return;
  const pos = vis.findIndex((v) => v.i === currentTrackIdx);
  const next = vis[(pos + 1) % vis.length];
  playTrack(next.i);
}
window.playNext = playNext;

function playPrev() {
  const vis = visibleTracks();
  if (vis.length === 0) return;
  const pos = vis.findIndex((v) => v.i === currentTrackIdx);
  const prev = vis[(pos - 1 + vis.length) % vis.length];
  playTrack(prev.i);
}
window.playPrev = playPrev;

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
      alert("已复制分享信息");
    } catch {
      alert(`${text}\n${url}`);
    }
  }
}
window.shareCurrent = shareCurrent;

// ───────── 播放历史（localStorage）─────────
const RECENT_KEY = "tapeout_recent";
function recordRecent(idx) {
  const t = tracksCache[idx];
  if (!t) return;
  let rec = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  rec = rec.filter((r) => r.id !== idx);
  rec.unshift({ id: idx, title: t.title, artist: t.artistName, ts: Date.now() });
  rec = rec.slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(rec));
  renderRecent();
}

function renderRecent() {
  const section = $("recentSection");
  const listEl = $("recentList");
  if (!section || !listEl) return;
  const rec = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  section.hidden = rec.length === 0 || !musicContract;
  listEl.innerHTML = rec.map((r) => `
    <div class="track track--recent" data-recent="${r.id}">
      <div class="track__icon">🎵</div>
      <div class="track__body">
        <div class="track__title">${escapeHtml(r.title)}</div>
        <div class="track__meta"><span>${escapeHtml(r.artist)}</span></div>
      </div>
    </div>`).join("");
  listEl.querySelectorAll(".track--recent").forEach((el) =>
    el.addEventListener("click", () => playTrack(Number(el.dataset.recent)))
  );
}

// ───────── 创作者面板：我的曲目 + 版税统计 ─────────
function updateCreatorPanel() {
  const panel = $("creatorPanel");
  if (!panel) return;
  if (!musicContract || !account || tracksCache.length === 0) { panel.hidden = true; return; }
  const mine = tracksCache.filter((t) => t.artist.toLowerCase() === account.toLowerCase());
  if (mine.length === 0) { panel.hidden = true; return; }
  panel.hidden = false;
  $("creatorName").textContent = shortAddr(account);
  $("statTracks").textContent = mine.length;
  const earned = mine.reduce((s, t) => s + Number(ethers.formatEther(t.totalEarned)), 0);
  const pending = mine.reduce((s, t) => s + Number(t.pendingPlays), 0);
  $("statEarned").textContent = `${earned.toFixed(4)} ${sym()}`;
  $("statPending").textContent = pending;
  $("creatorDetailList").innerHTML = mine.map((t) => `
    <div class="creator__row">
      <span class="t">${escapeHtml(t.title)}</span>
      <span class="m">▶ ${Number(t.playCount)} 次 · 💰 ${ethers.formatEther(t.totalEarned)} ${sym()}${Number(t.pendingPlays) > 0 ? ` · ⏳ ${t.pendingPlays} 待结算` : ""}</span>
    </div>`).join("");
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

// ───────── 深色模式 ─────────
function initTheme() {
  const btn = $("themeToggle");
  if (!btn) return;
  const dark = document.documentElement.classList.contains("dark");
  btn.textContent = dark ? "☀️" : "🌙";
  btn.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("tapeout_theme", isDark ? "dark" : "light");
    btn.textContent = isDark ? "☀️" : "🌙";
  });
}

// ───────── 初始化 ─────────
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  // 通用：所有页面
  const connectBtn = $("connectBtn");
  if (connectBtn) connectBtn.addEventListener("click", connectWallet);
  const subBtn = $("subscribeBtn");
  if (subBtn) subBtn.addEventListener("click", subscribe);

  // 网络切换按钮（桌面 + 移动菜单）
  const netBnb = $("netBnb");
  if (netBnb) netBnb.addEventListener("click", () => switchNetwork(56));
  const netXlayer = $("netXlayer");
  if (netXlayer) netXlayer.addEventListener("click", () => switchNetwork(196));
  const netBnbM = $("netBnbM");
  if (netBnbM) netBnbM.addEventListener("click", () => switchNetwork(56));
  const netXlayerM = $("netXlayerM");
  if (netXlayerM) netXlayerM.addEventListener("click", () => switchNetwork(196));

  // 汉堡菜单开关
  const navToggle = $("navToggle");
  const navMenu = $("navMenu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const open = navMenu.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", open);
    });
    // 点击菜单项后关闭菜单
    navMenu.addEventListener("click", (e) => {
      if (e.target.closest("a")) { navMenu.classList.remove("is-open"); navToggle.classList.remove("is-open"); }
    });
  }

  // 发行页元素
  const uploadBtn = $("uploadBtn");
  if (uploadBtn) {
    uploadBtn.addEventListener("click", uploadAudio);
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

  // 曲库页元素
  const refreshBtn = $("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => { loadTracks(); refreshSubscription(); });
    $("playBtn").addEventListener("click", doPlay);
    $("prevBtn").addEventListener("click", playPrev);
    $("nextBtn").addEventListener("click", playNext);
    $("shareBtn").addEventListener("click", shareCurrent);
    $("searchInput").addEventListener("input", (e) => { searchQuery = e.target.value; renderTracks(); });
    $("filterAll").addEventListener("click", () => { filterMine = false; $("filterAll").classList.add("is-active"); $("filterMine").classList.remove("is-active"); renderTracks(); });
    $("filterMine").addEventListener("click", () => {
      if (!account) { alert("请先连接钱包"); return; }
      filterMine = true; $("filterMine").classList.add("is-active"); $("filterAll").classList.remove("is-active"); renderTracks();
    });
    renderRecent();
    loadTracks();
  }

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
  }
});
