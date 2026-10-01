/* ============================================================
 * 声刻 SonicMint · 多语言（zh / en）
 * HTML 静态文案：data-i18n（文本）/ data-i18n-ph（placeholder）/ data-i18n-html（富文本）
 * JS 动态文案：window.T(key)
 * ============================================================ */

window.I18N = {
  zh: {
    // 导航
    "nav.brand": "声刻",
    "nav.library": "曲库",
    "nav.publish": "发行唱片",
    "nav.rules": "发行规则",
    "nav.home": "返回首页",
    "nav.net": "网络",
    "nav.connect": "连接钱包",
    "nav.unconnected": "未连接",
    "nav.subscribed": "订阅中 ✓",
    "nav.subscribe": "订阅",
    "nav.menuLibrary": "🎧 曲库",
    "nav.menuPublish": "💿 发行唱片",
    "nav.menuRules": "📋 发行规则",
    // 首页
    "hero.title1": "链上曲库",
    "hero.title2": "永久可播放的音乐",
    "hero.desc": "所有音频存于 TapeOut 链上容器，版税由智能合约即时结算。订阅可免费播放，或按次付费点播。",
    "hero.cta1": "发行我的唱片",
    "hero.cta2": "了解规则",
    "lib.title": "曲库",
    "lib.refresh": "刷新",
    "lib.searchPh": "搜索曲目 / 艺人…",
    "lib.all": "全部",
    "lib.mine": "我的",
    "lib.recent": "最近播放",
    "creator.title": "创作者面板",
    "creator.mine": "已发行",
    "creator.earned": "累计版税",
    "creator.pending": "待结算播放",
    "player.share": "分享",
    // JS 动态文案
    "empty.title": "连接钱包，探索链上音乐",
    "empty.btn": "连接钱包",
    "lib.noTrack": "还没有曲目，成为第一个发行唱片的人！",
    "lib.noMatch": "没有匹配的曲目",
    "lib.noMine": "你还没有发行曲目",
    // 发行页
    "pub.title": "发行唱片",
    "pub.desc": "把你的音乐永久刻在链上。音频存入 TapeOut 链上容器，永久不可删；版税由智能合约即时结算。",
    "pub.trackName": "曲目名",
    "pub.trackNamePh": "例如：夜空中最亮的星",
    "pub.artist": "艺人名",
    "pub.artistPh": "你的名字或艺名",
    "pub.circuit": "电路 #ID",
    "pub.circuitPh": "如 4246",
    "pub.cpu": "处理器编号",
    "pub.audio": "音频文件",
    "pub.cover": "封面图（可选，建议 1:1，≤8.4MB）",
    "pub.royalty": "版税分配（可选，留空则艺人 100%）",
    "pub.addRoyalty": "+ 添加收益方",
    "pub.free": "免费唱片（所有人免费听，不分钱、不计入订阅池子，仅用于推广）",
    "pub.submit": "上传并注册",
    "pub.tip": "<strong>提示：</strong>上传需消耗当前链的 Gas（BNB Chain 用 BNB，X Layer 用 OKB）。发行前请确保电路已在对应链上开通容器（<a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>），并阅读 <a href=\"./rules.html\">发行规则</a>。",
    // 规则页
    "rules.title": "发行规则",
    "rules.desc": "把你的音乐永久刻在链上。所有音频、封面、版税逻辑全部上链，无服务器、无中介、永久可播放。",
    "rule.storage.title": "永久上链存储",
    "rule.storage.desc": "音频文件通过 TapeOut DeWEB 协议直接存入 BNB Chain，只要链在运行，你的音乐就在。不依赖 IPFS、Arweave 或任何中心化服务器。",
    "rule.royalty.title": "版税即时结算",
    "rule.royalty.desc": "每次付费播放的收入，由智能合约按你设定的比例即时分流给各收益方（艺人、制作人、作词、作曲…），无拖欠、无对账。",
    "rule.ownership.title": "可验证所有权",
    "rule.ownership.desc": "每首唱片绑定一个 Circuit NFT + ERC-6551 容器账户，所有权链上可查，收益权可组合、可转让。",
    "rule.external.title": "外部播放结算",
    "rule.external.desc": "第三方播放器只需调用合约 <code>play(trackId)</code> 即可触发版税结算，适合嵌入式播放场景。",
    "rule.sharding.title": "无损分片支持",
    "rule.sharding.desc": "单文件超过 8.4MB 自动分片上传，播放时前端合并还原，支持高品质音频。",
    "rule.multiparty.title": "多方版税分流",
    "rule.multiparty.desc": "一首歌可配置多个收益方（艺人、制作人、作词、作曲、发行方），按基点比例自动分配。",
    "rules.flow.title": "发行流程",
    "rules.flow.callout": "发行前请确保你已拥有一个开通了容器的 TapeOut 电路（可在 <a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a> 开通，约 0.08 BNB/月）。",
    "rules.step1.title": "准备素材",
    "rules.step1.desc": "音频文件（MP3/WAV/FLAC）、封面图（建议 1:1，≤8.4MB）、曲目名、艺人名。",
    "rules.step2.title": "填写发行信息",
    "rules.step2.desc": "在首页填写曲目名、艺人名、电路 #ID、处理器编号，上传音频和封面图。可选择性添加多个版税收益方。",
    "rules.step3.title": "上链存储",
    "rules.step3.desc": "点击“上传并注册”，音频和封面将逐块写入你的 TapeOut 容器，同时在合约中注册曲目信息。",
    "rules.step4.title": "上架完成",
    "rules.step4.desc": "曲目出现在曲库中，任何人都可以播放。每次播放触发版税结算，收入即时到账。",
    "rules.settle.title": "播放与结算规则",
    "rules.settle.modes": "三种播放模式",
    "settle.free.title": "免费播放",
    "settle.free.desc": "艺人勾选“免费唱片”后，任何人无需付费、无需订阅即可播放。不分钱、不计入订阅池子，纯推广用途。",
    "settle.paid.title": "付费播放",
    "settle.paid.desc": "非订阅用户每次播放支付一定 BNB（默认 0.001 BNB）。收入即时按版税比例分流给各收益方，剩余归平台。",
    "settle.sub.title": "订阅播放",
    "settle.sub.desc": "订阅用户（月费默认 0.01 BNB）可免费播放非免费曲目，播放次数计入池子，按占比结算给艺人。",
    "rules.sybil": "<strong>抗女巫机制：</strong>订阅用户的免费播放需持有至少一个 TapeOut Circuit NFT，防止刷量稀释版税池。",
    "rules.royalty.title2": "版税分配",
    "rules.royalty.desc2": "注册时可配置多个收益方及其分成比例（基点，10000 = 100%）。例如艺人 70%、制作人 20%、平台 10%。若未配置，默认艺人拿 100%。所有分流均通过智能合约 <code>.call{value: share}</code> 即时执行，合约不留余额，无资金沉淀风险。",
    "rules.storage.title": "存储规格与限制",
    "storage.item": "项目",
    "storage.spec": "规格",
    "storage.size": "单文件上限",
    "storage.sizeV": "8.4 MB（超出自动分片）",
    "storage.audioFmt": "支持音频格式",
    "storage.audioFmtV": "MP3 · WAV · FLAC",
    "storage.imgFmt": "支持图片格式",
    "storage.imgFmtV": "JPG · PNG · WebP · GIF",
    "storage.network": "存储网络",
    "storage.networkV": "BNB Chain（TapeOut DeWEB 容器）",
    "storage.fee": "容器月费",
    "storage.feeV": "约 0.08 BNB（由 TapeOut 收取，非本平台）",
    "storage.permanent": "存储永久",
    "storage.permanentV": "✓ 链上数据不可删除，永久可访问",
    "rules.notes.title": "注意事项",
    "rules.note1": "上传需消耗 BNB Gas 费，文件越大 Gas 越高（建议单首歌控制在 8.4MB 以内）。",
    "rules.note2": "请确保你拥有上传音频的版权或已获得授权，平台不对内容版权负责。",
    "rules.note3": "版税分配比例一旦注册不可修改，请仔细核对后再提交。",
    "rules.note4": "订阅池子的结算需手动触发 <code>settleTrack</code>，建议定期结算。",
    "rules.note5": "本平台处于早期阶段，合约代码已审计思路但未经过正式安全审计，建议小额测试。",
    "rules.cta": "我已了解，去发行 →",
    // 页脚
    "footer.text": "音频存于 TapeOut 链上容器 · 版税合约即时结算 · 无服务器",
  },

  en: {
    "nav.brand": "SonicMint",
    "nav.library": "Library",
    "nav.publish": "Publish",
    "nav.rules": "Rules",
    "nav.home": "Home",
    "nav.net": "Network",
    "nav.connect": "Connect Wallet",
    "nav.unconnected": "Not connected",
    "nav.subscribed": "Subscribed ✓",
    "nav.subscribe": "Subscribe",
    "nav.menuLibrary": "🎧 Library",
    "nav.menuPublish": "💿 Publish",
    "nav.menuRules": "📋 Rules",
    "hero.title1": "On-chain Music",
    "hero.title2": "Playable Forever",
    "hero.desc": "All audio lives in TapeOut on-chain containers; royalties are settled instantly by smart contract. Subscribe to play free, or pay per play.",
    "hero.cta1": "Publish My Record",
    "hero.cta2": "Learn the Rules",
    "lib.title": "Library",
    "lib.refresh": "Refresh",
    "lib.searchPh": "Search tracks / artists…",
    "lib.all": "All",
    "lib.mine": "Mine",
    "lib.recent": "Recently played",
    "creator.title": "Creator Panel",
    "creator.mine": "Released",
    "creator.earned": "Total Royalties",
    "creator.pending": "Pending Settle",
    "player.share": "Share",
    "empty.title": "Connect your wallet to explore on-chain music",
    "empty.btn": "Connect Wallet",
    "lib.noTrack": "No tracks yet — be the first to publish!",
    "lib.noMatch": "No matching tracks",
    "lib.noMine": "You haven't published any tracks",
    "pub.title": "Publish a Record",
    "pub.desc": "Carve your music onto the chain forever. Audio is stored in a TapeOut on-chain container, permanent and undeletable; royalties are settled instantly by smart contract.",
    "pub.trackName": "Track name",
    "pub.trackNamePh": "e.g. The Brightest Star",
    "pub.artist": "Artist name",
    "pub.artistPh": "Your name or stage name",
    "pub.circuit": "Circuit #ID",
    "pub.circuitPh": "e.g. 4246",
    "pub.cpu": "Processor #",
    "pub.audio": "Audio file",
    "pub.cover": "Cover image (optional, 1:1 recommended, ≤8.4MB)",
    "pub.royalty": "Royalty split (optional; defaults to artist 100%)",
    "pub.addRoyalty": "+ Add recipient",
    "pub.free": "Free record (anyone can listen for free — no payouts, not counted in the subscription pool; purely for promotion)",
    "pub.submit": "Upload & Register",
    "pub.tip": "<strong>Note:</strong> Uploading consumes Gas on the active chain (BNB on BNB Chain, OKB on X Layer). Make sure the circuit container is opened on the chain (<a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>) and read the <a href=\"./rules.html\">release rules</a>.",
    "rules.title": "Release Rules",
    "rules.desc": "Carve your music onto the chain forever. Audio, covers and royalty logic all live on-chain — no servers, no middlemen, playable forever.",
    "rule.storage.title": "Permanent On-chain Storage",
    "rule.storage.desc": "Audio is stored directly on BNB Chain via the TapeOut DeWEB protocol. As long as the chain runs, your music lives. No IPFS, Arweave or any centralized server.",
    "rule.royalty.title": "Instant Royalty Settlement",
    "rule.royalty.desc": "Each paid play is split instantly by smart contract to your configured recipients (artist, producer, lyricist, composer…) — no arrears, no reconciliation.",
    "rule.ownership.title": "Verifiable Ownership",
    "rule.ownership.desc": "Every record binds a Circuit NFT + ERC-6551 container account. Ownership is on-chain and verifiable; revenue rights are composable and transferable.",
    "rule.external.title": "External Play Settlement",
    "rule.external.desc": "Third-party players can settle royalties by simply calling <code>play(trackId)</code> — ideal for embedded playback.",
    "rule.sharding.title": "Lossless Sharding",
    "rule.sharding.desc": "Files over 8.4MB are uploaded in shards automatically and merged back in the frontend when played — high-quality audio supported.",
    "rule.multiparty.title": "Multi-party Royalty Split",
    "rule.multiparty.desc": "A track can configure multiple recipients (artist, producer, lyricist, composer, label) split automatically by basis points.",
    "rules.flow.title": "Release Flow",
    "rules.flow.callout": "Before releasing, make sure you own a TapeOut circuit with an opened container (open at <a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>, ~0.08 BNB/month).",
    "rules.step1.title": "Prepare materials",
    "rules.step1.desc": "Audio file (MP3/WAV/FLAC), cover image (1:1 recommended, ≤8.4MB), track name and artist name.",
    "rules.step2.title": "Fill in release info",
    "rules.step2.desc": "Enter track name, artist, circuit #ID and processor #, then upload audio and cover. Optionally add multiple royalty recipients.",
    "rules.step3.title": "Store on-chain",
    "rules.step3.desc": "Click “Upload & Register” — audio and cover are written chunk-by-chunk into your TapeOut container and the track is registered on the contract.",
    "rules.step4.title": "Listed",
    "rules.step4.desc": "The track appears in the library and anyone can play it. Every play triggers royalty settlement with instant payouts.",
    "rules.settle.title": "Play & Settlement Rules",
    "rules.settle.modes": "Three play modes",
    "settle.free.title": "Free Play",
    "settle.free.desc": "If the artist marks a record “free”, anyone can play it without paying or subscribing. No payouts, not counted in the pool — purely promotional.",
    "settle.paid.title": "Paid Play",
    "settle.paid.desc": "Non-subscribers pay a small amount per play (default 0.001 BNB). Revenue is split instantly per royalty config; the remainder goes to the platform.",
    "settle.sub.title": "Subscription Play",
    "settle.sub.desc": "Subscribers (default 0.01 BNB/month) play non-free tracks free; plays are counted into the pool and settled to artists by share.",
    "rules.sybil": "<strong>Anti-sybil:</strong> Subscribers must hold at least one TapeOut Circuit NFT for free plays, preventing abuse that dilutes the royalty pool.",
    "rules.royalty.title2": "Royalty Split",
    "rules.royalty.desc2": "Configure multiple recipients and shares in basis points (10000 = 100%) at registration, e.g. artist 70%, producer 20%, platform 10%. If unset, artist gets 100%. All payouts run instantly via smart contract <code>.call{value: share}</code> — no balance is held, no custody risk.",
    "rules.storage.title": "Storage Specs & Limits",
    "storage.item": "Item",
    "storage.spec": "Spec",
    "storage.size": "Max file size",
    "storage.sizeV": "8.4 MB (auto-sharded beyond)",
    "storage.audioFmt": "Audio formats",
    "storage.audioFmtV": "MP3 · WAV · FLAC",
    "storage.imgFmt": "Image formats",
    "storage.imgFmtV": "JPG · PNG · WebP · GIF",
    "storage.network": "Storage network",
    "storage.networkV": "BNB Chain (TapeOut DeWEB containers)",
    "storage.fee": "Container fee",
    "storage.feeV": "~0.08 BNB/month (charged by TapeOut, not this platform)",
    "storage.permanent": "Permanent storage",
    "storage.permanentV": "✓ On-chain data can't be deleted — always accessible",
    "rules.notes.title": "Notes",
    "rules.note1": "Uploading consumes BNB Gas — the bigger the file, the higher the Gas (keep a single track under 8.4MB).",
    "rules.note2": "Make sure you own the rights or have authorization for the audio you upload; the platform is not responsible for content copyright.",
    "rules.note3": "Royalty splits can't be changed after registration — double-check before submitting.",
    "rules.note4": "Pool settlement is triggered manually via <code>settleTrack</code> — settle regularly.",
    "rules.note5": "This platform is early-stage; contract code follows audited patterns but hasn't passed a formal security audit. Test with small amounts.",
    "rules.cta": "I understand — let's publish →",
    "footer.text": "Audio on TapeOut on-chain containers · Instant royalty settlement · Serverless",
  },
};

// 当前语言
let _lang = localStorage.getItem("tapeout_lang") || "zh";

// JS 动态文案翻译
window.T = (k) => {
  const d = window.I18N[_lang] || window.I18N.zh;
  return d[k] || window.I18N.zh[k] || k;
};

// 应用语言到静态文案
function applyLang(lang) {
  _lang = lang;
  const dict = window.I18N[lang] || window.I18N.zh;
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const k = el.getAttribute("data-i18n");
    if (dict[k] != null && !(k === "nav.connect" && typeof account !== "undefined" && account)) el.textContent = dict[k];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const k = el.getAttribute("data-i18n-ph");
    if (dict[k] != null) el.placeholder = dict[k];
  });
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const k = el.getAttribute("data-i18n-html");
    if (dict[k] != null) el.innerHTML = dict[k];
  });
}

// 语言切换按钮
window.addEventListener("DOMContentLoaded", () => {
  applyLang(_lang); // 页面加载时应用已存储语言
  const btn = document.getElementById("langToggle");
  if (!btn) return;
  btn.textContent = _lang === "zh" ? "中" : "EN";
  btn.addEventListener("click", () => {
    const next = _lang === "zh" ? "en" : "zh";
    localStorage.setItem("tapeout_lang", next);
    applyLang(next);
    btn.textContent = next === "zh" ? "中" : "EN";
  });
});
