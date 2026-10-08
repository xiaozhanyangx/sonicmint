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
    // 顶部 Tab
    "tab.library": "音乐广场",
    "tab.publish": "发行",
    "tab.profile": "个人",
    // 发行页 Hero
    "hero.title1": "链上曲库",
    "hero.title2": "永久可播放的音乐",
    "hero.desc": "所有音频存于 TapeOut 链上容器，付费曲目加密上链；一次买断永久可听，版税由智能合约即时结算。",
    "hero.cta1": "发行我的唱片",
    "hero.cta2": "了解规则",
    // 音乐分类（索引 = 合约 genre）
    "pub.genre": "分类",
    "pub.genrePick": "请选择音乐分类",
    "genre.0": "流行",
    "genre.1": "摇滚",
    "genre.2": "电子",
    "genre.3": "嘻哈",
    "genre.4": "民谣",
    "genre.5": "爵士",
    "genre.6": "古典",
    "genre.7": "国风",
    "genre.8": "纯音乐",
    "genre.9": "播客",
    // 首页
    "lib.title": "音乐广场",
    "lib.refresh": "刷新",
    "lib.searchPh": "搜索曲目 / 艺人…",
    "queue.title": "我的曲库",
    "queue.empty": "暂无可播放的歌曲，买断后加入列表",
    // 歌词
    "lyrics.title": "歌词",
    "lyrics.loading": "加载歌词…",
    "lyrics.none": "这首曲目没有歌词",
    "lyrics.locked": "买断后即可查看歌词",
    "lyrics.noKey": "密钥尚未就绪，请稍后重试",
    "lyrics.noTrack": "请先播放一首曲目",
    "lyrics.fail": "歌词加载失败",
    "creator.title": "我发行的音乐",
    "creator.mine": "已发行",
    "creator.earned": "累计版税",
    // 个人面板
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
    "player.locked": "未解锁：买断后可播放",
    "player.ready": "已就绪，点 ▶ 播放",
    // 发行页
    "pub.title": "发行唱片",
    "pub.desc": "把你的音乐永久刻在链上。音频存入 TapeOut 链上容器，永久不可删；版税由智能合约即时结算。",
    "pub.trackName": "曲目名",
    "pub.trackNamePh": "例如：夜空中最亮的星",
    "pub.artist": "艺人名",
    "pub.artistPh": "你的名字或艺名",
    "pub.circuit": "唱片容器",
    "pub.circuitHint": "仅列出处理器 #260 下你持有的唱片容器；未开通的需先去 id.tapeout.link 开通。",
    "pub.circuitNote": "<strong>特别说明：</strong>“唱片容器”是 SonicMint 产品专用的链上容器，仅支持 X Layer 链上 260 号 SonicMint 处理器的容器，其他链或其他处理器的容器无法在本平台发行。",
    "pub.circuitLoading": "加载中…",
    "pub.circuitEmpty": "没有找到你持有的唱片容器",
    "pub.circuitConnect": "连接钱包后选择唱片容器",
    "pub.circuitPick": "请选择要发行的唱片容器",
    "pub.circuitOpened": "容器已开通",
    "pub.circuitNotOpened": "容器未开通，请先去 id.tapeout.link 开通",
    "pub.audio": "音频文件（支持 MP3 · WAV · FLAC · AAC/M4A）",
    "pub.cover": "封面图（可选，建议 1:1，≤8.4MB）",
    "pub.lyrics": "歌词（可选，支持 LRC 时间轴）",
    "pub.lyricsPh": "[00:12.00]第一句歌词\n[00:15.30]第二句歌词\n（无时间轴则按纯文本显示）",
    "pub.lyricsHint": "付费曲目的歌词会用与音频相同的内容密钥加密，仅购买者可查看。",
    "pub.royalty": "版税分配（可选，留空则艺人 100%）",
    "pub.addRoyalty": "+ 添加收益方",
    "pub.free": "免费唱片（所有人免费听，不加密、不分钱，仅用于推广）",
    "pub.price": "买断价（OKB）",
    "pub.priceTip": "用户一次购买后永久可听；付费曲目会上链加密，仅购买者可播放。",
    "pub.submit": "上传并注册",
    "pub.revokeOp": "撤销临时上传授权",
    "pub.tip": "<strong>提示：</strong>上传需消耗 X Layer 的 Gas（OKB）。发行前请确保唱片容器已在对应链上开通（<a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>），并阅读 <a href=\"./rules.html\">发行规则</a>。",
    // 规则页
    "rules.title": "发行规则",
    "rules.desc": "把你的音乐永久刻在链上。所有音频、封面、版税逻辑全部上链，无服务器、无中介、永久可播放。",
    "rule.storage.title": "永久上链存储",
    "rule.storage.desc": "音频文件通过 TapeOut DeWEB 协议直接存入 X Layer，只要链在运行，你的音乐就在。不依赖 IPFS、Arweave 或任何中心化服务器。",
    "rule.royalty.title": "版税即时结算",
    "rule.royalty.desc": "每次买断的收入，由智能合约按你设定的比例即时分流给各收益方（艺人、制作人、作词、作曲…），无拖欠、无对账。",
    "rule.ownership.title": "可验证所有权",
    "rule.ownership.desc": "每首唱片绑定一个 Circuit NFT + ERC-6551 容器账户，所有权链上可查，收益权可组合、可转让。",
    "rule.external.title": "外部播放集成",
    "rule.external.desc": "第三方播放器可调用合约 <code>play(trackId)</code> 上报播放次数，便于统计与嵌入式场景集成。",
    "rule.encrypt.title": "加密上链保护",
    "rule.encrypt.desc": "付费曲目在上传前用随机内容密钥（CEK）加密，密钥由平台密钥管家封装后分发给购买者；链上只存密文，未购买者无法解密播放。",
    "rule.sharding.title": "无损分片支持",
    "rule.sharding.desc": "单文件超过 8.4MB 自动分片上传，播放时前端合并还原，支持高品质音频。",
    "rule.multiparty.title": "多方版税分流",
    "rule.multiparty.desc": "一首歌可配置多个收益方（艺人、制作人、作词、作曲、发行方），按基点比例自动分配。",
    "rules.flow.title": "发行流程",
    "rules.flow.callout": "发行前请确保你已拥有一个开通了容器的 TapeOut 电路（可在 <a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a> 开通，约 0.08 OKB/月）。",
    "rules.circuitNote": "<strong>特别说明：</strong>“唱片容器”是 SonicMint 产品专用的链上容器，仅支持 X Layer 链上 260 号 SonicMint 处理器的容器，其他链或其他处理器的容器无法在本平台发行。",
    "rules.step1.title": "准备素材",
    "rules.step1.desc": "音频文件（MP3/WAV/FLAC/AAC/M4A）、封面图（建议 1:1，≤8.4MB）、曲目名、艺人名。",
    "rules.step2.title": "填写发行信息",
    "rules.step2.desc": "在首页填写曲目名、艺人名、分类、唱片容器 #ID，上传音频和封面图。可选择性添加多个版税收益方。",
    "rules.step3.title": "上链存储",
    "rules.step3.desc": "点击“上传并注册”。为免逐块弹出钱包确认，前端会先授权一个临时上传密钥（有效期 1 小时），由它在后台把音频、封面、歌词逐块写入你的 TapeOut 容器，传完自动撤销授权并退回剩余 gas。付费曲目会先加密再上传。",
    "rules.step4.title": "上架完成",
    "rules.step4.desc": "曲目出现在曲库中，任何人可买断；付费曲目加密上链，仅购买者可解密播放。买断收入即时分流到账。",
    "rules.settle.title": "播放与结算规则",
    "rules.settle.modes": "两种播放模式",
    "settle.free.title": "免费播放",
    "settle.free.desc": "艺人勾选“免费唱片”后，任何人无需付费即可播放。不加密、不分钱，纯推广用途。",
    "settle.buy.title": "买断播放",
    "settle.buy.desc": "买家一次付清买断价，永久可听。收入先扣除 3% 平台抽成，其余即时分流给各收益方；付费曲目加密上链，仅购买者可解密。",
    "rules.royalty.title2": "版税分配",
    "rules.royalty.desc2": "每笔收入平台固定抽成 <strong>3%</strong>，先行扣除，不占用收益方份额。剩余部分按你配置的比例分流给各收益方（基点，10000 = 100%）：例如艺人 70%、制作人 30%，则平台 3%、艺人 67.9%、制作人 29.1%。若未配置收益方，默认全部归艺人。所有分流均通过智能合约 <code>.call{value: share}</code> 即时执行，合约不留余额，无资金沉淀风险。",
    "rules.storage.title": "存储规格与限制",
    "storage.item": "项目",
    "storage.spec": "规格",
    "storage.size": "单文件上限",
    "storage.sizeV": "8.4 MB（超出自动分片）",
    "storage.audioFmt": "支持音频格式",
    "storage.audioFmtV": "MP3 · WAV · FLAC · AAC/M4A",
    "storage.imgFmt": "支持图片格式",
    "storage.imgFmtV": "JPG · PNG · WebP · GIF",
    "storage.lyrics": "歌词",
    "storage.lyricsV": "可选，纯文本或 LRC 时间轴；付费曲目的歌词随音频一同加密",
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
    "rules.note4": "付费曲目由平台密钥管家（keeper）托管分发内容密钥；请妥善保管钱包私钥与签名权，换钱包或更换域名前缀可能导致已购密钥无法再派生。",
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
    // Tabs
    "tab.library": "Music Plaza",
    "tab.publish": "Publish",
    "tab.profile": "Profile",
    // Publish hero
    "hero.title1": "On-chain Music",
    "hero.title2": "Playable Forever",
    "hero.desc": "All audio lives in TapeOut on-chain containers; paid tracks are encrypted on-chain. Buy once, play forever — royalties settled instantly by smart contract.",
    "hero.cta1": "Publish My Record",
    "hero.cta2": "Learn the Rules",
    // Music genres (index = on-chain genre)
    "pub.genre": "Genre",
    "pub.genrePick": "Please choose a genre",
    "genre.0": "Pop",
    "genre.1": "Rock",
    "genre.2": "Electronic",
    "genre.3": "Hip-Hop",
    "genre.4": "Folk",
    "genre.5": "Jazz",
    "genre.6": "Classical",
    "genre.7": "Gufeng",
    "genre.8": "Instrumental",
    "genre.9": "Podcast",
    "lib.title": "Music Square",
    "lib.refresh": "Refresh",
    "lib.searchPh": "Search tracks / artists…",
    "queue.title": "My Library",
    "queue.empty": "Nothing to play yet — buy a track to add songs",
    // Lyrics
    "lyrics.title": "Lyrics",
    "lyrics.loading": "Loading lyrics…",
    "lyrics.none": "No lyrics for this track",
    "lyrics.locked": "Buy this track to view the lyrics",
    "lyrics.noKey": "Key not ready yet, please retry",
    "lyrics.noTrack": "Play a track first",
    "lyrics.fail": "Failed to load lyrics",
    "creator.title": "My Releases",
    "creator.mine": "Released",
    "creator.earned": "Total Royalties",
    // Profile panel
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
    "player.locked": "Locked — buy to play",
    "player.ready": "Ready — tap ▶ to play",
    "pub.title": "Publish a Record",
    "pub.desc": "Carve your music onto the chain forever. Audio is stored in a TapeOut on-chain container, permanent and undeletable; royalties are settled instantly by smart contract.",
    "pub.trackName": "Track name",
    "pub.trackNamePh": "e.g. The Brightest Star",
    "pub.artist": "Artist name",
    "pub.artistPh": "Your name or stage name",
    "pub.circuit": "Record container",
    "pub.circuitHint": "Lists only the record containers you own under processor #260; unopened ones must be opened at id.tapeout.link first.",
    "pub.circuitNote": "<strong>Note:</strong> A \"record container\" is an on-chain container dedicated to the SonicMint product line. Only containers under SonicMint processor #260 on X Layer are supported — containers on other chains or processors cannot be released here.",
    "pub.circuitLoading": "Loading…",
    "pub.circuitEmpty": "No record containers owned by this wallet",
    "pub.circuitConnect": "Connect wallet to choose a record container",
    "pub.circuitPick": "Please choose a record container to publish",
    "pub.circuitOpened": "Container opened",
    "pub.circuitNotOpened": "Container not opened — open it at id.tapeout.link first",
    "pub.audio": "Audio file (MP3 · WAV · FLAC · AAC/M4A)",
    "pub.cover": "Cover image (optional, 1:1 recommended, ≤8.4MB)",
    "pub.lyrics": "Lyrics (optional, LRC timestamps supported)",
    "pub.lyricsPh": "[00:12.00]First line\n[00:15.30]Second line\n(plain text if no timestamps)",
    "pub.lyricsHint": "Lyrics of paid tracks are encrypted with the same content key as the audio and visible to buyers only.",
    "pub.royalty": "Royalty split (optional; defaults to artist 100%)",
    "pub.addRoyalty": "+ Add recipient",
    "pub.free": "Free record (anyone can listen for free — not encrypted, no payouts; purely for promotion)",
    "pub.price": "Buyout price (OKB)",
    "pub.priceTip": "Buy once, play forever; paid tracks are encrypted on-chain and playable only by the buyer.",
    "pub.submit": "Upload & Register",
    "pub.revokeOp": "Revoke temporary upload authorization",
    "pub.tip": "<strong>Note:</strong> Uploading consumes Gas on X Layer (OKB). Make sure the record container is opened on the chain (<a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>) and read the <a href=\"./rules.html\">release rules</a>.",
    "rules.title": "Release Rules",
    "rules.desc": "Carve your music onto the chain forever. Audio, covers and royalty logic all live on-chain — no servers, no middlemen, playable forever.",
    "rule.storage.title": "Permanent On-chain Storage",
    "rule.storage.desc": "Audio is stored directly on X Layer via the TapeOut DeWEB protocol. As long as the chain runs, your music lives. No IPFS, Arweave or any centralized server.",
    "rule.royalty.title": "Instant Royalty Settlement",
    "rule.royalty.desc": "Each buyout is split instantly by smart contract to your configured recipients (artist, producer, lyricist, composer…) — no arrears, no reconciliation.",
    "rule.ownership.title": "Verifiable Ownership",
    "rule.ownership.desc": "Every record binds a Circuit NFT + ERC-6551 container account. Ownership is on-chain and verifiable; revenue rights are composable and transferable.",
    "rule.external.title": "External Playback",
    "rule.external.desc": "Third-party players can call <code>play(trackId)</code> to report a play — handy for analytics and embedded scenarios.",
    "rule.encrypt.title": "Encrypted On-chain",
    "rule.encrypt.desc": "Paid tracks are encrypted with a random content key (CEK) before upload; the key is wrapped by the platform key keeper and delivered to buyers. Only ciphertext is stored on-chain — non-buyers can't decrypt or play.",
    "rule.sharding.title": "Lossless Sharding",
    "rule.sharding.desc": "Files over 8.4MB are uploaded in shards automatically and merged back in the frontend when played — high-quality audio supported.",
    "rule.multiparty.title": "Multi-party Royalty Split",
    "rule.multiparty.desc": "A track can configure multiple recipients (artist, producer, lyricist, composer, label) split automatically by basis points.",
    "rules.flow.title": "Release Flow",
    "rules.flow.callout": "Before releasing, make sure you own a TapeOut circuit with an opened container (open at <a href=\"https://id.tapeout.link\" target=\"_blank\">id.tapeout.link</a>, ~0.08 OKB/month).",
    "rules.circuitNote": "<strong>Note:</strong> A \"record container\" is an on-chain container dedicated to the SonicMint product line. Only containers under SonicMint processor #260 on X Layer are supported — containers on other chains or processors cannot be released here.",
    "rules.step1.title": "Prepare materials",
    "rules.step1.desc": "Audio file (MP3/WAV/FLAC/AAC/M4A), cover image (1:1 recommended, ≤8.4MB), track name and artist name.",
    "rules.step2.title": "Fill in release info",
    "rules.step2.desc": "Enter track name, artist, genre and record container #ID, then upload audio and cover. Optionally add multiple royalty recipients.",
    "rules.step3.title": "Store on-chain",
    "rules.step3.desc": "Click “Upload & Register”. To avoid one wallet prompt per chunk, the app first authorizes a temporary upload key (valid for 1 hour); it writes audio, cover and lyrics into your TapeOut container in the background, then the authorization is revoked and leftover gas refunded. Paid tracks are encrypted before upload.",
    "rules.step4.title": "Listed",
    "rules.step4.desc": "The track appears in the library; anyone can buy it out. Paid tracks are encrypted on-chain and playable only by the buyer. Buyout revenue is split and paid out instantly.",
    "rules.settle.title": "Play & Settlement Rules",
    "rules.settle.modes": "Two play modes",
    "settle.free.title": "Free Play",
    "settle.free.desc": "If the artist marks a record “free”, anyone can play it without paying. Not encrypted, no payouts — purely promotional.",
    "settle.buy.title": "Buyout",
    "settle.buy.desc": "The buyer pays the buyout price once to own the track forever. A 3% platform fee is deducted first and the rest is split instantly among recipients; paid tracks are encrypted on-chain and decryptable only by the buyer.",
    "rules.royalty.title2": "Royalty Split",
    "rules.royalty.desc2": "Every payment carries a flat <strong>3%</strong> platform fee, deducted first and not taken from recipient shares. The remainder is split by your configured ratios (basis points, 10000 = 100%): with artist 70% / producer 30%, the result is platform 3%, artist 67.9%, producer 29.1%. If no recipients are configured, the artist takes it all. All payouts run instantly via smart contract <code>.call{value: share}</code> — no balance is held, no custody risk.",
    "rules.storage.title": "Storage Specs & Limits",
    "storage.item": "Item",
    "storage.spec": "Spec",
    "storage.size": "Max file size",
    "storage.sizeV": "8.4 MB (auto-sharded beyond)",
    "storage.audioFmt": "Audio formats",
    "storage.audioFmtV": "MP3 · WAV · FLAC · AAC/M4A",
    "storage.imgFmt": "Image formats",
    "storage.imgFmtV": "JPG · PNG · WebP · GIF",
    "storage.lyrics": "Lyrics",
    "storage.lyricsV": "Optional, plain text or LRC timestamps; lyrics of paid tracks are encrypted together with the audio",
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
    "rules.note4": "Paid tracks have their content keys delivered by the platform key keeper; keep your wallet private key and signing ability safe — switching wallets or changing the domain prefix may break key derivation for past purchases.",
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
