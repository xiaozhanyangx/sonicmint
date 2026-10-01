// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFactory {
    function cpuAt(uint256 number) external view returns (address);
}
interface IERC721 {
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title SonicMint v2
 * @notice 链上音乐发行与版税结算合约
 *         v2 特性：
 *           1. 订阅制：用户按月付费进池子，免费播放，按播放占比结算给艺人
 *           2. 抗女巫：订阅免费播放需持有 TapeOut Circuit NFT
 *           3. 多方版税：每首歌可配置多个收益方（艺人/制作人/作词/作曲…）
 *           4. 无损分片：单文件超 8.4MB 可分片上传，前端合并播放
 *
 * 付费播放（play with value）：即时分流，不走池子
 * 订阅播放（play by subscriber, value=0）：计入 pendingPlays，由 settleTrack 从池子分流
 */
contract SonicMint {
    // ───────────────────────── 数据结构 ─────────────────────────

    struct RoyaltyRecipient {
        address addr;    // 收益方地址
        uint256 bps;     // 分成比例（基点，10000 = 100%）
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
        uint256 playCount;       // 总播放次数（含付费+订阅+免费）
        uint256 totalEarned;     // 累计版税收入（wei）
        uint256 pendingPlays;    // 待结算的订阅播放次数
        uint256 createdAt;
        bool    free;            // 免费唱片：任何人免费听，不分钱、不计入池子
        bool    exists;
    }

    // ───────────────────────── 状态变量 ─────────────────────────

    mapping(uint256 => Track) public tracks;
    mapping(uint256 => RoyaltyRecipient[]) public trackRoyalties;
    uint256 public trackCount;

    address public platform;
    uint256 public platformBps;       // 付费播放时平台分成
    uint256 public minPlayPrice;      // 单次付费播放最低价（wei）

    // 订阅制
    mapping(address => uint256) public subscriptionExpiry;
    uint256 public monthlyFee;        // 订阅月费（wei）
    uint256 public subscriptionPool;  // 待分配的订阅池子
    uint256 public totalPendingPlays; // 所有曲目待结算播放总数

    // 抗女巫
    address public processorFactory;  // TapeOut ProcessorFactory，用于校验 Circuit NFT

    bool private _locked;

    // ───────────────────────── 事件 ─────────────────────────

    event TrackRegistered(uint256 indexed trackId, address indexed artist, address container, string title, uint256 partCount);
    event TrackPlayed(uint256 indexed trackId, address indexed player, uint256 amount, bool subscribed);
    event Subscribed(address indexed user, uint256 expiry, uint256 amount);
    event TrackSettled(uint256 indexed trackId, uint256 plays, uint256 amount);
    event MonthlyFeeUpdated(uint256 newFee);

    // ───────────────────────── 构造 ─────────────────────────

    constructor(
        address _platform,
        uint256 _platformBps,
        uint256 _minPlayPrice,
        uint256 _monthlyFee,
        address _processorFactory
    ) {
        require(_platform != address(0), "platform = zero");
        require(_platformBps <= 10000, "bps > 10000");
        require(_processorFactory != address(0), "factory = zero");
        platform = _platform;
        platformBps = _platformBps;
        minPlayPrice = _minPlayPrice;
        monthlyFee = _monthlyFee;
        processorFactory = _processorFactory;
    }

    // ───────────────────────── 修饰器 ─────────────────────────

    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    // ───────────────────────── 内部：抗女巫校验 ─────────────────────────

    /// @notice 校验用户是否持有至少一个 Circuit NFT（在 0 号处理器上）
    function _holdsCircuit(address user) internal view returns (bool) {
        address processor = IFactory(processorFactory).cpuAt(0);
        return IERC721(processor).balanceOf(user) >= 1;
    }

    // ───────────────────────── 内部：分发版税给多方 ─────────────────────────

    /// @notice 将 amount 按 trackRoyalties 比例分发给各收益方，剩余给平台
    function _distributeRoyalties(uint256 trackId, uint256 amount) internal {
        RoyaltyRecipient[] storage recipients = trackRoyalties[trackId];
        uint256 remaining = amount;

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 share = (amount * recipients[i].bps) / 10000;
            if (share == 0) continue;
            (bool ok, ) = recipients[i].addr.call{value: share, gas: 100_000}("");
            require(ok, "recipient transfer failed");
            remaining -= share;
        }

        // 剩余（未分配部分）归平台
        if (remaining > 0) {
            (bool ok, ) = platform.call{value: remaining, gas: 100_000}("");
            require(ok, "platform transfer failed");
        }
    }

    // ───────────────────────── 艺人：注册曲目 ─────────────────────────

    /**
     * @param royalties 收益方列表，bps 总和须 ≤ 10000；若为空则艺人拿 100%
     * @param partCount 分片数，0 或 1 表示单文件
     */
    function registerTrack(
        address container,
        uint256 tokenId,
        uint256 cpu,
        string calldata audioPath,
        uint256 partCount,
        string calldata coverPath,
        string calldata title,
        string calldata artistName,
        bool free,
        RoyaltyRecipient[] calldata royalties
    ) external returns (uint256 trackId) {
        require(container != address(0), "container = zero");
        require(tokenId != 0, "tokenId = 0");
        require(bytes(audioPath).length > 0, "empty path");
        require(bytes(title).length > 0, "empty title");

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
            title: title,
            artistName: artistName,
            playCount: 0,
            totalEarned: 0,
            pendingPlays: 0,
            createdAt: block.timestamp,
            free: free,
            exists: true
        });

        // 若未指定收益方，默认艺人拿 100%
        if (royalties.length == 0) {
            trackRoyalties[trackId].push(RoyaltyRecipient({addr: msg.sender, bps: 10000}));
        } else {
            for (uint256 i = 0; i < royalties.length; i++) {
                trackRoyalties[trackId].push(royalties[i]);
            }
        }

        emit TrackRegistered(trackId, msg.sender, container, title, partCount);
    }

    // ───────────────────────── 播放 ─────────────────────────

    /**
     * @notice 播放一首曲目
     * @dev    三种模式：
     *         - 免费唱片：任何人免费听，不分钱、不计入池子
     *         - 订阅播放：msg.value = 0 且订阅有效，需持有 Circuit NFT，计入池子待结算
     *         - 付费播放：msg.value ≥ minPlayPrice，即时分流给收益方
     */
    function play(uint256 trackId) external payable nonReentrant {
        Track storage track = tracks[trackId];
        require(track.exists, "track not found");

        if (track.free) {
            // 免费唱片：任何人免费听，不分钱、不计入池子
            require(msg.value == 0, "free track, no payment");
        } else {
            bool subscribed = block.timestamp < subscriptionExpiry[msg.sender];
            if (subscribed && msg.value == 0) {
                require(_holdsCircuit(msg.sender), "need circuit NFT");
                track.pendingPlays++;
                totalPendingPlays++;
            } else {
                require(msg.value >= minPlayPrice, "below min play price");
                track.totalEarned += msg.value;
                _distributeRoyalties(trackId, msg.value);
            }
        }

        unchecked { track.playCount++; }
        emit TrackPlayed(trackId, msg.sender, msg.value, track.free);
    }

    // ───────────────────────── 订阅 ─────────────────────────

    /**
     * @notice 订阅 30 天，费用进入池子，按播放占比结算给艺人
     */
    function subscribe() external payable nonReentrant {
        require(msg.value >= monthlyFee, "below monthly fee");
        subscriptionPool += msg.value;

        if (subscriptionExpiry[msg.sender] < block.timestamp) {
            subscriptionExpiry[msg.sender] = block.timestamp + 30 days;
        } else {
            subscriptionExpiry[msg.sender] += 30 days;
        }

        emit Subscribed(msg.sender, subscriptionExpiry[msg.sender], msg.value);
    }

    // ───────────────────────── 结算 ─────────────────────────

    /**
     * @notice 结算某首曲目的订阅播放收益（任何人可调用）
     *         从池子中按该曲目播放占比分配给其收益方
     */
    function settleTrack(uint256 trackId) external nonReentrant {
        Track storage track = tracks[trackId];
        require(track.exists, "track not found");
        uint256 plays = track.pendingPlays;
        require(plays > 0, "no pending plays");
        require(totalPendingPlays > 0, "nothing to settle");
        require(subscriptionPool > 0, "pool empty");

        uint256 share = (subscriptionPool * plays) / totalPendingPlays;
        require(share > 0, "share = 0");

        track.pendingPlays = 0;
        totalPendingPlays -= plays;
        subscriptionPool -= share;
        track.totalEarned += share;

        _distributeRoyalties(trackId, share);

        emit TrackSettled(trackId, plays, share);
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

    function setMinPlayPrice(uint256 _price) external {
        require(msg.sender == platform, "only platform");
        minPlayPrice = _price;
    }

    function setMonthlyFee(uint256 _fee) external {
        require(msg.sender == platform, "only platform");
        monthlyFee = _fee;
        emit MonthlyFeeUpdated(_fee);
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

    function isSubscriber(address user) external view returns (bool) {
        return block.timestamp < subscriptionExpiry[user];
    }
}
