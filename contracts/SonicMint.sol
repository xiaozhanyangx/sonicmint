// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SonicMint v4
 * @notice 链上音乐发行、版税结算与加密密钥分发合约
 *         v4 特性：
 *           1. 免费唱片：任何人免费听
 *           2. 买断制：单曲一次付费，永久可听，收入即时分流（v3 的订阅制已移除）
 *           3. 多方版税：每首歌可配置多个收益方（艺人/制作人/作词/作曲…）
 *           4. 分类标签：每首歌带一个 genre 分类
 *           5. 加密上链：音频用内容密钥 K 加密后存入容器，K 经 keeper 逐用户封装成 vault
 *           6. 无损分片：单文件超 8.4MB 可分片上传，前端合并播放
 *           7. 平台抽成：每笔收入先按 platformBps 扣除，余下按版税比例分给收益方
 *           8. 处理器白名单：仅指定处理器的电路可发行唱片，并校验容器归属与开启状态
 *
 * 加密流程（TAP-10 载荷，X25519 + XChaCha20-Poly1305）：
 *   - 艺人上传前生成随机 K，用 K 加密音频；K 封给 keeper 公钥后上链，存于 sealedCEK[trackId]
 *   - 买家 buy() 时提交自己的 X25519 公钥，keeper 解出 K 后为该买家封一份 vault
 *   - 买家播放时用自己钱包派生的私钥解开 vault，得到已购曲目的 K
 *   - 所有载荷统一约定：chainId = 部署链、hub = 本合约、from = 本合约地址、to = 收件人地址
 */

/// TapeOut 处理器工厂：按编号查处理器地址
interface IProcessorFactory {
    function cpuAt(uint256 number) external view returns (address);
}

/// TapeOut 容器开启器：按 (处理器, 电路#ID) 查容器地址与开启状态
interface IContainerOpener {
    function accountOf(address processor, uint256 tokenId) external view returns (address);
    function isOpened(address processor, uint256 tokenId) external view returns (bool);
}

contract SonicMint {
    // ───────────────────────── 数据结构 ─────────────────────────

    struct RoyaltyRecipient {
        address addr;    // 收益方地址
        uint256 bps;     // 分成比例（基点，10000 = 100%）
    }

    /// @notice 发行时的元信息，避免 registerTrack 参数过多
    struct TrackMeta {
        string  title;
        string  artistName;
        uint8   genre;        // 分类编号，0..MAX_GENRE
        uint256 price;        // 买断价（wei）；free = true 时忽略
        bool    free;         // 免费唱片
        bool    encrypted;    // 是否加密上链（加密曲目必须付费）
        bytes32 artistPubKey; // 艺人的 X25519 公钥，供 keeper 封装时参考
    }

    struct Track {
        address artist;          // 主艺人（注册者）
        address container;       // TapeOut 容器地址
        uint256 tokenId;         // 电路 #ID
        uint256 cpu;             // 处理器编号
        string  audioPath;       // 音频路径；partCount>1 时为 base path，文件为 path.part0, .part1...
        uint256 partCount;       // 分片数：0/1 = 单文件；>1 = 分片
        string  coverPath;       // 封面图路径
        string  title;
        string  artistName;
        uint8   genre;
        uint256 playCount;       // 总播放次数
        uint256 totalEarned;     // 累计收入（wei）
        uint256 createdAt;
        uint256 price;           // 买断价（wei）；free = true 时为 0
        bool    free;
        bool    encrypted;
        bytes32 artistPubKey;
        bool    exists;
    }

    // ───────────────────────── 状态变量 ─────────────────────────

    mapping(uint256 => Track) public tracks;
    mapping(uint256 => RoyaltyRecipient[]) public trackRoyalties;
    mapping(uint256 => bytes) public sealedCEK; // 曲目内容密钥 K，封给 keeper 公钥的 TAP-10 载荷
    uint256 public trackCount;

    address public platform;
    uint256 public platformBps;       // 平台抽成比例（基点，1000 = 10%），每笔收入先行扣除
    address public keeper;            // 密钥管家：封装 vault 的唯一写入方

    // TapeOut 协议地址（用于发行时校验处理器与容器）
    address public immutable factory; // 处理器工厂
    address public immutable opener;  // 容器开启器
    address public allowedProcessor;  // 唯一允许发行唱片的处理器；address(0) = 不限

    // 买断：用户 => 曲目 => 已买断
    mapping(address => mapping(uint256 => bool)) public purchased;

    // 加密：用户 => 派生的 X25519 公钥；用户 => 已购曲目密钥的封装载荷
    mapping(address => bytes32) public userPubKey;
    mapping(address => bytes) private _vault;

    uint8 public constant MAX_GENRE = 9; // 分类编号上限（0..9 共 10 类）

    bool private _locked;

    // ───────────────────────── 事件 ─────────────────────────

    event TrackRegistered(uint256 indexed trackId, address indexed artist, address container, string title, uint8 genre, bool encrypted);
    event TrackPlayed(uint256 indexed trackId, address indexed player, bool unlocked);
    event TrackPurchased(uint256 indexed trackId, address indexed buyer, uint256 amount, bytes32 buyerPubKey);
    event VaultUpdated(address indexed user, uint256 size);
    event KeeperUpdated(address newKeeper);

    // ───────────────────────── 构造 ─────────────────────────

    constructor(
        address _platform,
        uint256 _platformBps,
        address _factory,
        address _opener,
        address _processor
    ) {
        require(_platform != address(0), "platform = zero");
        require(_platformBps <= 10000, "bps > 10000");
        require(_factory != address(0), "factory = zero");
        require(_opener != address(0), "opener = zero");
        platform = _platform;
        platformBps = _platformBps;
        factory = _factory;
        opener = _opener;
        allowedProcessor = _processor;
    }

    // ───────────────────────── 修饰器 ─────────────────────────

    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    // ───────────────────────── 内部：分发版税给多方 ─────────────────────────

    /// @notice 将 amount 按「平台抽成 → 版税分配 → 余数归平台」的顺序分完
    /// @dev    platformBps 先行扣除；剩余部分按 trackRoyalties 比例分配；
    ///         分配后的取整余数一并归平台，确保 amount 全部分出
    function _distributeRoyalties(uint256 trackId, uint256 amount) internal {
        RoyaltyRecipient[] storage recipients = trackRoyalties[trackId];

        // 平台抽成部分（不参与版税分配）
        uint256 platformCut = (amount * platformBps) / 10000;
        uint256 rest = amount - platformCut;

        uint256 distributed = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 share = (rest * recipients[i].bps) / 10000;
            if (share == 0) continue;
            (bool ok, ) = recipients[i].addr.call{value: share, gas: 100_000}("");
            require(ok, "recipient transfer failed");
            distributed += share;
        }

        // 平台实得 = 抽成 + 未分配完的余数
        uint256 toPlatform = amount - distributed;
        if (toPlatform > 0) {
            (bool ok, ) = platform.call{value: toPlatform, gas: 100_000}("");
            require(ok, "platform transfer failed");
        }
    }

    // ───────────────────────── 艺人：注册曲目 ─────────────────────────

    /**
     * @param container 容器地址，须等于 opener.accountOf(cpuAt(cpu), tokenId)，且该容器已开启
     * @param cpu       处理器编号，须指向 allowedProcessor（未设白名单时不限）
     * @param meta      元信息；meta.encrypted 为真时须同时给出 artistPubKey 与 wrappedCEK
     * @param wrappedCEK 内容密钥封给 keeper 的载荷；未加密时留空
     * @param royalties 收益方列表，bps 相对「扣除平台抽成后」的金额计算，总和须 ≤ 10000；若为空则艺人拿 100%
     * @param partCount 分片数，0 或 1 表示单文件
     */
    function registerTrack(
        address container,
        uint256 tokenId,
        uint256 cpu,
        string calldata audioPath,
        uint256 partCount,
        string calldata coverPath,
        TrackMeta calldata meta,
        bytes calldata wrappedCEK,
        RoyaltyRecipient[] calldata royalties
    ) external returns (uint256 trackId) {
        require(container != address(0), "container = zero");
        require(tokenId != 0, "tokenId = 0");
        require(bytes(audioPath).length > 0, "empty path");
        require(bytes(meta.title).length > 0, "empty title");
        require(meta.genre <= MAX_GENRE, "bad genre");
        require(meta.free || meta.price > 0, "price = 0");
        // 免费曲目无法触发买断，也就无法生成 vault，因此不允许加密
        require(!(meta.free && meta.encrypted), "free cannot be encrypted");
        if (meta.encrypted) {
            require(meta.artistPubKey != bytes32(0), "artist pubkey = 0");
            require(wrappedCEK.length > 0, "empty wrapped CEK");
        }

        // 处理器与容器校验：处理器须为指定地址，容器须与 (cpu, tokenId) 匹配且已开启
        // processor 由合约自行从工厂查得，不接受调用方传入，避免绕过白名单
        address proc = IProcessorFactory(factory).cpuAt(cpu);
        require(proc != address(0), "processor not found");
        require(allowedProcessor == address(0) || proc == allowedProcessor, "processor not allowed");
        require(IContainerOpener(opener).accountOf(proc, tokenId) == container, "container mismatch");
        require(IContainerOpener(opener).isOpened(proc, tokenId), "container not opened");

        // 校验版税总和
        uint256 totalBps = 0;
        for (uint256 i = 0; i < royalties.length; i++) {
            require(royalties[i].addr != address(0), "recipient = zero");
            totalBps += royalties[i].bps;
        }
        require(totalBps <= 10000, "royalties > 10000");

        trackId = trackCount++;
        tracks[trackId] = Track({
            artist: msg.sender,
            container: container,
            tokenId: tokenId,
            cpu: cpu,
            audioPath: audioPath,
            partCount: partCount,
            coverPath: coverPath,
            title: meta.title,
            artistName: meta.artistName,
            genre: meta.genre,
            playCount: 0,
            totalEarned: 0,
            createdAt: block.timestamp,
            price: meta.free ? 0 : meta.price,
            free: meta.free,
            encrypted: meta.encrypted,
            artistPubKey: meta.artistPubKey,
            exists: true
        });

        if (meta.encrypted) sealedCEK[trackId] = wrappedCEK;

        // 若未指定收益方，默认艺人拿 100%
        if (royalties.length == 0) {
            trackRoyalties[trackId].push(RoyaltyRecipient({addr: msg.sender, bps: 10000}));
        } else {
            for (uint256 i = 0; i < royalties.length; i++) {
                trackRoyalties[trackId].push(royalties[i]);
            }
        }

        emit TrackRegistered(trackId, msg.sender, container, meta.title, meta.genre, meta.encrypted);
    }

    // ───────────────────────── 播放 ─────────────────────────

    /**
     * @notice 记录一次播放（不收费）
     * @dev    需满足其一：免费唱片 / 已买断。加密与否由前端凭 vault 判定，链上只做记账
     */
    function play(uint256 trackId) external nonReentrant {
        Track storage track = tracks[trackId];
        require(track.exists, "track not found");
        require(track.free || purchased[msg.sender][trackId], "buy first");

        unchecked { track.playCount++; }
        emit TrackPlayed(trackId, msg.sender, true);
    }

    // ───────────────────────── 买断 ─────────────────────────

    /**
     * @notice 买断一首曲目，永久可听；收入即时按版税比例分流
     * @param buyerPubKey 买家的 X25519 公钥，供 keeper 封装 vault；加密曲目必填
     */
    function buy(uint256 trackId, bytes32 buyerPubKey) external payable nonReentrant {
        Track storage track = tracks[trackId];
        require(track.exists, "track not found");
        require(!track.free, "free track");
        require(!purchased[msg.sender][trackId], "already purchased");
        require(msg.value >= track.price, "below price");
        if (track.encrypted) require(buyerPubKey != bytes32(0), "buyer pubkey = 0");

        purchased[msg.sender][trackId] = true;
        if (buyerPubKey != bytes32(0)) userPubKey[msg.sender] = buyerPubKey;
        track.totalEarned += msg.value;
        _distributeRoyalties(trackId, msg.value);

        emit TrackPurchased(trackId, msg.sender, msg.value, buyerPubKey);
    }

    // ───────────────────────── 密钥管家 ─────────────────────────

    /**
     * @notice 写入某用户的全量 vault（keeper 在链下合并所有已购曲目的 K 后整体覆盖）
     * @param user    用户地址
     * @param payload 封给 userPubKey 的 TAP-10 载荷
     */
    function setVault(address user, bytes calldata payload) external {
        require(msg.sender == keeper || msg.sender == platform, "only keeper");
        require(user != address(0), "user = zero");
        _vault[user] = payload;
        emit VaultUpdated(user, payload.length);
    }

    function vaultOf(address user) external view returns (bytes memory) {
        return _vault[user];
    }

    // ───────────────────────── 平台管理 ─────────────────────────

    function setPlatform(address _platform) external {
        require(msg.sender == platform, "only platform");
        require(_platform != address(0), "platform = zero");
        platform = _platform;
    }

    function setPlatformBps(uint256 _bps) external {
        require(msg.sender == platform, "only platform");
        require(_bps <= 10000, "bps > 10000");
        platformBps = _bps;
    }

    function setKeeper(address _keeper) external {
        require(msg.sender == platform, "only platform");
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }

    /// @notice 更换允许发行唱片的处理器；传 address(0) 表示不限制
    function setAllowedProcessor(address _processor) external {
        require(msg.sender == platform, "only platform");
        allowedProcessor = _processor;
    }

    // ───────────────────────── 读取 ─────────────────────────

    function getTrack(uint256 trackId) external view returns (Track memory) {
        return tracks[trackId];
    }

    function getTrackRoyalties(uint256 trackId)
        external view returns (RoyaltyRecipient[] memory)
    {
        return trackRoyalties[trackId];
    }

    function getTracks(uint256 offset, uint256 limit)
        external view returns (Track[] memory result)
    {
        uint256 end = offset + limit;
        if (end > trackCount) end = trackCount;
        if (offset >= end) return result;
        result = new Track[](end - offset);
        for (uint256 i = offset; i < end; i++) result[i - offset] = tracks[i];
    }

    /// @notice 批量查询买断状态，配合 getTracks 判断当前用户能否播放
    function getPurchased(address user, uint256 offset, uint256 limit)
        external view returns (bool[] memory result)
    {
        uint256 end = offset + limit;
        if (end > trackCount) end = trackCount;
        if (offset >= end) return result;
        result = new bool[](end - offset);
        for (uint256 i = offset; i < end; i++) result[i - offset] = purchased[user][i];
    }
}