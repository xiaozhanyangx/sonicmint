/* ============================================================
 * 声刻 SonicMint · Demo 模式
 * 核心合约地址仍为 0x0 时自动启用：本地模拟发行 / 播放 / 订阅 / 结算全流程
 * 在 app.js 的 NETWORKS 填入真实地址后自动关闭，无需改本文件
 * ============================================================ */
(function () {
  const ZERO = "0x0000000000000000000000000000000000000000";
  const ACCOUNT = "0x9A7f3C2e5B1d84a06Ef2c7D3b91A45f8E0c6B274"; // 演示账号
  const CPU_ADDR = "0x00000000000000000000000000000000000000C0";
  const CONTAINER = "0x00000000000000000000000000000000000000C1";

  const FEE = ethers.parseEther("0.01");       // 月订阅费

  // 预置曲目：字段与链上 getTracks 返回一致，额外带 base 指向本地素材目录
  // 素材只有 cover.svg / demo.wav 两份，20 首共用（单片，不分片），用于预览列表排版
  // 列：[标题, 演唱者, 买断价 OKB（0 = 免费）, 播放次数, 待结算]
  const SEED = [
    ["声刻 Demo", "SonicMint", "0.05", 12, 3],
    ["午夜霓虹", "Neon Kid", "0.02", 148, 0],
    ["雾都清晨", "林弥", "0", 326, 0],
    ["磁带回声", "TapeEcho", "0.08", 57, 12],
    ["粒子之舞", "Particle", "0.03", 91, 0],
    ["旧胶片", "阿灰", "0", 512, 0],
    ["深蓝信号", "DeepBlue", "0.12", 23, 5],
    ["雨后便利店", "Kombini", "0.01", 204, 0],
    ["电子牧歌", "Pastoral 9", "0.06", 78, 9],
    ["月台末班车", "末班车", "0", 640, 0],
    ["光年之外的你", "L.Y.", "0.15", 45, 1],
    ["赛博茶馆", "CyberTea", "0.04", 132, 0],
    ["北纬四十度", "40°N", "0.02", 88, 7],
    ["像素心跳", "PixelBeat", "0", 271, 0],
    ["潮湿的夏", "Wet Summer", "0.09", 63, 0],
    ["霓虹废墟", "Ruin FM", "0.07", 39, 14],
    ["凌晨四点", "4AM", "0.03", 155, 0],
    ["云端列车", "CloudRail", "0.11", 27, 2],
    ["琉璃街", "Glaze St.", "0", 433, 0],
    ["熵增协奏曲", "Entropy", "0.2", 18, 6],
  ];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const tracks = SEED.map(([title, artistName, price, plays, pending], i) => ({
    artist: ACCOUNT, container: CONTAINER, tokenId: BigInt(i), cpu: BigInt(i),
    audioPath: "demo.wav", partCount: 1n, coverPath: "cover.svg",
    title, artistName,
    playCount: BigInt(plays),
    totalEarned: (ethers.parseEther(price) * BigInt(plays)) / 10n, // 演示用估算
    pendingPlays: BigInt(pending),
    createdAt: now - BigInt(i) * 86400n,
    price: ethers.parseEther(price), free: price === "0", exists: true,
    base: "./demo",
  }));

  let subscribed = false;
  let pool = ethers.parseEther("0.05");
  const purchased = {}; // 用户 => { idx: true }：演示账号的买断记录

  const okTx = (logs) => ({ wait: async () => ({ logs: logs || [] }) });

  // ───────── mock 合约（接口签名与 ethers 合约一致）─────────
  const music = () => ({
    async trackCount() { return BigInt(tracks.length); },
    async getTracks(offset, limit) { return tracks.slice(Number(offset), Number(offset) + Number(limit)); },
    async isSubscriber() { return subscribed; },
    async monthlyFee() { return FEE; },
    async subscriptionPool() { return pool; },
    async totalPendingPlays() { return tracks.reduce((s, t) => s + t.pendingPlays, 0n); },
    async getPurchased(user, offset, limit) {
      const end = Math.min(Number(offset) + Number(limit), tracks.length);
      const res = [];
      for (let i = Number(offset); i < end; i++) res.push(!!(purchased[user] || {})[i]);
      return res;
    },

    async subscribe(months) { subscribed = true; pool += FEE * BigInt(months); return okTx(); },

    async buy(idx) {
      const t = tracks[Number(idx)];
      if (!t || t.free) return okTx();
      purchased[ACCOUNT] = purchased[ACCOUNT] || {};
      purchased[ACCOUNT][Number(idx)] = true;
      t.totalEarned += t.price;
      return okTx();
    },

    async play(idx) {
      const t = tracks[Number(idx)];
      if (t) {
        t.playCount += 1n;
        const owned = !!(purchased[ACCOUNT] || {})[Number(idx)];
        // 仅「订阅中且未免费、未买断」的播放计入池子
        if (!t.free && !owned && subscribed) t.pendingPlays += 1n;
      }
      return okTx();
    },

    async settleTrack(idx) {
      const t = tracks[Number(idx)];
      if (t) t.pendingPlays = 0n;
      return okTx();
    },

    async registerTrack(_container, tokenId, cpu, audioPath, partCount, coverPath, title, artistName, price, free) {
      tracks.push({
        artist: ACCOUNT, container: CONTAINER,
        tokenId: BigInt(tokenId), cpu: BigInt(cpu),
        audioPath, partCount: BigInt(partCount), coverPath, title, artistName,
        playCount: 0n, totalEarned: 0n, pendingPlays: 0n,
        createdAt: BigInt(Math.floor(Date.now() / 1000)), price: free ? 0n : BigInt(price), free: !!free, exists: true,
      });
      const id = tracks.length - 1;
      return okTx([{ fragment: { name: "TrackRegistered" }, args: [BigInt(id)] }]);
    },
  });

  const registry = () => ({
    async putFile() { return okTx(); },
    async appendChunk() { return okTx(); },
    async fileInfo() { return [1n, "", ZERO, 0n, 0n]; },
  });

  const opener = () => ({
    async accountOf() { return CONTAINER; },
    async isOpened() { return true; },
  });

  const factory = () => ({ async cpuAt() { return CPU_ADDR; } });

  // ───────── 模拟发行：文件存为 blob URL，仅存活于当前会话 ─────────
  async function upload({ title, artistName, tokenId, cpu, file, coverFile, price, free }) {
    const id = tracks.length;
    tracks.push({
      artist: ACCOUNT, container: CONTAINER,
      tokenId: BigInt(tokenId), cpu: BigInt(cpu),
      audioPath: URL.createObjectURL(file),
      partCount: 1n,
      coverPath: coverFile ? URL.createObjectURL(coverFile) : "",
      title, artistName,
      playCount: 0n, totalEarned: 0n, pendingPlays: 0n,
      createdAt: BigInt(Math.floor(Date.now() / 1000)), price: free ? 0n : BigInt(price), free: !!free, exists: true,
    });
    return { trackId: id };
  }

  window.DEMO = {
    ACCOUNT,
    // 任一核心合约地址未配置 → 处于演示模式
    isActive() {
      const net = typeof NETWORKS !== "undefined" ? NETWORKS[196] : null;
      if (!net) return false;
      return [net.music, net.siteRegistry, net.containerOpener, net.processorFactory]
        .some((a) => !a || /^0x0+$/i.test(a));
    },
    music, registry, opener, factory, upload,
  };
})();