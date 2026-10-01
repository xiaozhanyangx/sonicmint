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
    "nav.connect": "连接钱包",
    "nav.unconnected": "未连接",
    "nav.subscribed": "订阅中",
    "nav.subscribe": "订阅",
    "nav.demo": "演示数据",
    // 顶部 Tab
    "tab.library": "音乐广场",
    "tab.publish": "发行",
    "tab.profile": "个人",
    // 发行页 Hero
    "hero.title1": "链上曲库",
    "hero.title2": "永久可播放的音乐",
    "hero.desc": "所有音频存于 TapeOut 链上容器，版税由智能合约即时结算。订阅可免费播放，或按次付费点播。",
    "hero.cta1": "发行我的唱片",
    "hero.cta2": "了解规则",
    // 首页
    "lib.title": "音乐广场",
    "lib.refresh": "刷新",
    "lib.searchPh": "搜索曲目 / 艺人…",
    "queue.title": "我的曲库",
    "queue.empty": "暂无可播放的歌曲，买断或订阅后加入列表",
    "creator.title": "我发行的音乐",
    "creator.mine": "已发行",
    "creator.earned": "累计版税",
    "creator.pending": "待结算播放",
    // 个人面板
    "profile.subTitle": "我的订阅",
    "profile.subscribe": "订阅",
    "profile.renew": "续订",
    "profile.subStateOn": "订阅中",
    "profile.subStateOff": "未订阅",
    "profile.notConnected": "未连接钱包",
    "profile.subTip": "订阅后畅听全站音乐；单曲也可一次买断永久可听。",
    "profile.purchased": "我购买的音乐",
    "profile.noPurchased": "还没有买断的音乐",
    "profile.connectTip": "连接钱包后查看",
    // JS 动态文案
    "empty.title": "连接钱包，探索链上音乐",
    "empty.btn": "连接钱包",
    "lib.noTrack": "还没有曲目，成为第一个发行唱片的人！",
    "lib.noMatch": "没有匹配的曲目",
    "lib.free": "免费",
    "lib.owned": "已买断",
    // 播放器按钮
    "player.buy": "购买",
    "player.locked": "未解锁：买断或订阅后可播放",
    // 订阅弹层
    "sub.title": "选择订阅时长",
    "sub.desc": "订阅期内可无限畅听全部非免费曲目",
    "sub.unit": "个月",
    "sub.cancel": "取消",
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
    "pub.price": "买断价（OKB）",
    "pub.priceTip": "用户一次购买后永久可听；订阅用户可直接播放",
    "pub.submit": "上传并注册",
    "pub.tip": "<strong>提示：</strong>上传需消耗 X Layer 的 Gas（OKB）。发行前请确保电路已在对应链上开通容器（<a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>），并阅读 <a href=\"./rules.html\">发行规则</a>。",
    // 规则页
    "rules.title": "发行规则",
    "rules.desc": "把你的音乐永久刻在链上。所有音频、封面、版税逻辑全部上链，无服务器、无中介、永久可播放。",
    "rule.storage.title": "永久上链存储",
    "rule.storage.desc": "音频文件通过 TapeOut DeWEB 协议直接存入 X Layer，只要链在运行，你的音乐就在。不依赖 IPFS、Arweave 或任何中心化服务器。",
    "rule.royalty.title": "版税即时结算",
    "rule.royalty.desc": "每次买断的收入，由智能合约按你设定的比例即时分流给各收益方（艺人、制作人、作词、作曲…），无拖欠、无对账。",
    "rule.ownership.title": "可验证所有权",
    "rule.ownership.desc": "每首唱片绑定一个 Circuit NFT + ERC-6551 容器账户，所有权链上可查，收益权可组合、可转让。",
    "rule.external.title": "外部播放结算",
    "rule.external.desc": "第三方播放器只需调用合约 <code>play(trackId)</code> 即可触发版税结算，适合嵌入式播放场景。",
    "rule.sharding.title": "无损分片支持",
    "rule.sharding.desc": "单文件超过 8.4MB 自动分片上传，播放时前端合并还原，支持高品质音频。",
    "rule.multiparty.title": "多方版税分流",
    "rule.multiparty.desc": "一首歌可配置多个收益方（艺人、制作人、作词、作曲、发行方），按基点比例自动分配。",
    "rules.flow.title": "发行流程",
    "rules.flow.callout": "发行前请确保你已拥有一个开通了容器的 TapeOut 电路（可在 <a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a> 开通，约 0.08 OKB/月）。",
    "rules.step1.title": "准备素材",
    "rules.step1.desc": "音频文件（MP3/WAV/FLAC）、封面图（建议 1:1，≤8.4MB）、曲目名、艺人名。",
    "rules.step2.title": "填写发行信息",
    "rules.step2.desc": "在首页填写曲目名、艺人名、电路 #ID、处理器编号，上传音频和封面图。可选择性添加多个版税收益方。",
    "rules.step3.title": "上链存储",
    "rules.step3.desc": "点击“上传并注册”，音频和封面将逐块写入你的 TapeOut 容器，同时在合约中注册曲目信息。",
    "rules.step4.title": "上架完成",
    "rules.step4.desc": "曲目出现在曲库中，订阅用户可直接播放，其他人可买断。买断收入即时分流到账。",
    "rules.settle.title": "播放与结算规则",
    "rules.settle.modes": "三种播放模式",
    "settle.free.title": "免费播放",
    "settle.free.desc": "艺人勾选“免费唱片”后，任何人无需付费、无需订阅即可播放。不分钱、不计入订阅池子，纯推广用途。",
    "settle.buy.title": "买断播放",
    "settle.buy.desc": "非订阅用户可一次付清买断价，永久可听。收入即时按版税比例分流给各收益方，剩余归平台。",
    "settle.sub.title": "订阅播放",
    "settle.sub.desc": "订阅用户（月费默认 0.01 OKB，可选 1/3/12 个月）可免费播放非免费曲目，播放次数计入池子，按占比结算给艺人。",
    "rules.pool": "<strong>结算说明：</strong>播放本身不收费。仅当用户处于订阅期内、且曲目非免费且未买断时，播放次数才计入订阅池子，由 <code>settleTrack</code> 按占比结算给艺人。",
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
    "storage.networkV": "X Layer（TapeOut DeWEB 容器）",
    "storage.fee": "容器月费",
    "storage.feeV": "约 0.08 OKB（由 TapeOut 收取，非本平台）",
    "storage.permanent": "存储永久",
    "storage.permanentV": "✓ 链上数据不可删除，永久可访问",
    "rules.notes.title": "注意事项",
    "rules.note1": "上传需消耗 OKB Gas 费，文件越大 Gas 越高（建议单首歌控制在 8.4MB 以内）。",
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
    "nav.connect": "Connect Wallet",
    "nav.unconnected": "Not connected",
    "nav.subscribed": "Subscribed",
    "nav.subscribe": "Subscribe",
    "nav.demo": "Demo data",
    // Tabs
    "tab.library": "Music Plaza",
    "tab.publish": "Publish",
    "tab.profile": "Profile",
    // Publish hero
    "hero.title1": "On-chain Music",
    "hero.title2": "Playable Forever",
    "hero.desc": "All audio lives in TapeOut on-chain containers; royalties are settled instantly by smart contract. Subscribe to play free, or pay per play.",
    "hero.cta1": "Publish My Record",
    "hero.cta2": "Learn the Rules",
    "lib.title": "Music Square",
    "lib.refresh": "Refresh",
    "lib.searchPh": "Search tracks / artists…",
    "queue.title": "My Library",
    "queue.empty": "Nothing to play yet — buy or subscribe to add songs",
    "creator.title": "My Releases",
    "creator.mine": "Released",
    "creator.earned": "Total Royalties",
    "creator.pending": "Pending Settle",
    // Profile panel
    "profile.subTitle": "My Subscription",
    "profile.subscribe": "Subscribe",
    "profile.renew": "Renew",
    "profile.subStateOn": "Subscribed",
    "profile.subStateOff": "Not subscribed",
    "profile.notConnected": "Wallet not connected",
    "profile.subTip": "Subscribe to stream everything; or buy a track once to keep it forever.",
    "profile.purchased": "My Purchases",
    "profile.noPurchased": "No purchased tracks yet",
    "profile.connectTip": "Connect your wallet to view",
    "empty.title": "Connect your wallet to explore on-chain music",
    "empty.btn": "Connect Wallet",
    "lib.noTrack": "No tracks yet — be the first to publish!",
    "lib.noMatch": "No matching tracks",
    "lib.free": "Free",
    "lib.owned": "Owned",
    "player.buy": "Buy",
    "player.locked": "Locked — buy or subscribe to play",
    "sub.title": "Choose subscription length",
    "sub.desc": "Play every non-free track unlimited during your subscription",
    "sub.unit": "months",
    "sub.cancel": "Cancel",
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
    "pub.price": "Buyout price (OKB)",
    "pub.priceTip": "Buy once, play forever; subscribers can play directly",
    "pub.submit": "Upload & Register",
    "pub.tip": "<strong>Note:</strong> Uploading consumes Gas on X Layer (OKB). Make sure the circuit container is opened on the chain (<a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>) and read the <a href=\"./rules.html\">release rules</a>.",
    "rules.title": "Release Rules",
    "rules.desc": "Carve your music onto the chain forever. Audio, covers and royalty logic all live on-chain — no servers, no middlemen, playable forever.",
    "rule.storage.title": "Permanent On-chain Storage",
    "rule.storage.desc": "Audio is stored directly on X Layer via the TapeOut DeWEB protocol. As long as the chain runs, your music lives. No IPFS, Arweave or any centralized server.",
    "rule.royalty.title": "Instant Royalty Settlement",
    "rule.royalty.desc": "Each buyout is split instantly by smart contract to your configured recipients (artist, producer, lyricist, composer…) — no arrears, no reconciliation.",
    "rule.ownership.title": "Verifiable Ownership",
    "rule.ownership.desc": "Every record binds a Circuit NFT + ERC-6551 container account. Ownership is on-chain and verifiable; revenue rights are composable and transferable.",
    "rule.external.title": "External Play Settlement",
    "rule.external.desc": "Third-party players can settle royalties by simply calling <code>play(trackId)</code> — ideal for embedded playback.",
    "rule.sharding.title": "Lossless Sharding",
    "rule.sharding.desc": "Files over 8.4MB are uploaded in shards automatically and merged back in the frontend when played — high-quality audio supported.",
    "rule.multiparty.title": "Multi-party Royalty Split",
    "rule.multiparty.desc": "A track can configure multiple recipients (artist, producer, lyricist, composer, label) split automatically by basis points.",
    "rules.flow.title": "Release Flow",
    "rules.flow.callout": "Before releasing, make sure you own a TapeOut circuit with an opened container (open at <a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>, ~0.08 OKB/month).",
    "rules.step1.title": "Prepare materials",
    "rules.step1.desc": "Audio file (MP3/WAV/FLAC), cover image (1:1 recommended, ≤8.4MB), track name and artist name.",
    "rules.step2.title": "Fill in release info",
    "rules.step2.desc": "Enter track name, artist, circuit #ID and processor #, then upload audio and cover. Optionally add multiple royalty recipients.",
    "rules.step3.title": "Store on-chain",
    "rules.step3.desc": "Click “Upload & Register” — audio and cover are written chunk-by-chunk into your TapeOut container and the track is registered on the contract.",
    "rules.step4.title": "Listed",
    "rules.step4.desc": "The track appears in the library; subscribers can play it directly and others can buy it out. Buyout revenue is split and paid out instantly.",
    "rules.settle.title": "Play & Settlement Rules",
    "rules.settle.modes": "Three play modes",
    "settle.free.title": "Free Play",
    "settle.free.desc": "If the artist marks a record “free”, anyone can play it without paying or subscribing. No payouts, not counted in the pool — purely promotional.",
    "settle.buy.title": "Buyout",
    "settle.buy.desc": "Non-subscribers can pay the buyout price once to own the track forever. Revenue is split instantly per royalty config; the remainder goes to the platform.",
    "settle.sub.title": "Subscription",
    "settle.sub.desc": "Subscribers (default 0.01 OKB/month, choose 1/3/12 months) play non-free tracks free; plays are counted into the pool and settled to artists by share.",
    "rules.pool": "<strong>Settlement:</strong> playing itself is free. Only when a user is within a subscription period and the track is non-free and unowned are plays counted into the subscription pool, settled to artists by share via <code>settleTrack</code>.",
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
    "storage.networkV": "X Layer (TapeOut DeWEB containers)",
    "storage.fee": "Container fee",
    "storage.feeV": "~0.08 OKB/month (charged by TapeOut, not this platform)",
    "storage.permanent": "Permanent storage",
    "storage.permanentV": "✓ On-chain data can't be deleted — always accessible",
    "rules.notes.title": "Notes",
    "rules.note1": "Uploading consumes OKB Gas — the bigger the file, the higher the Gas (keep a single track under 8.4MB).",
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
