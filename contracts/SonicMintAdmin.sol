// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SonicMintAdmin —— SonicMint 的升级与封印逻辑（UUPS）
 * @notice 适配自 TapeKit/send/contracts/src/DeWebAdmin.sol（同协议家族的参考实现）。
 *         与 DeWebAdmin 的差异：不单设 owner，升级权直接复用业务存储里的 platform
 *         （setPlatform 转让的即是业务与升级双重权限，避免两处权限失同步）。
 *
 * 封印（seal）之前，platform 可以升级实现——控制 platform 的人可以改写一切业务逻辑
 * （含密钥分发），须向用户明示这一信任假设；seal() 之后升级路径永久关闭，
 * 代理定格在当前实现，hub 地址与其行为从此不变。
 */
abstract contract SonicMintAdmin {
    /// @custom:storage-location erc7201:sonicmint.admin.v1
    struct AdminStorage {
        bool sealed_;     // true = 永久不可升级
        bool initialized; // 代理只初始化一次；实现合约构造时即置位，自身无法被初始化
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("sonicmint.admin.v1")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ADMIN_STORAGE = 0xa0620b3ac808ca8dad29355b79fc03ce3dac9af6272fe3a7aae9c82534d1cc00;
    /// @dev ERC-1967 实现槽
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    error ZeroAddress();
    error NotAContract();
    error NotUUPS();
    error AlreadyInitialized();
    error NotProxy();
    error NotDelegated();
    error NotPlatform();
    error Sealed();

    event Upgraded(address indexed implementation);
    event ProxySealed();

    /// @dev 实现合约自己的地址：用来区分「经代理调用」和「直接调用实现」
    address internal immutable __self = address(this);

    constructor() {
        // 实现合约自身不可被初始化：只能作为代理背后的逻辑使用
        _admin().initialized = true;
    }

    /// @dev 业务合约覆写：升级与封印的管理者（SonicMint 返回 platform）
    function _adminOwner() internal view virtual returns (address);

    /// @dev 只允许经代理调用（直接调用实现会写进实现自己的存储，形成一个「影子合约」）
    modifier onlyProxy() {
        if (address(this) == __self) revert NotProxy();
        _;
    }

    function _admin() internal pure returns (AdminStorage storage $) {
        bytes32 slot = ADMIN_STORAGE;
        // memory-safe：只改存储指针槽位，不碰内存（不标注会阻断 viaIR 的栈重排）
        assembly ("memory-safe") { $.slot := slot }
    }

    /// @notice 代理部署时调用一次，标记初始化完成（业务变量由 SonicMint.initialize 设置）
    function _initializeAdmin() internal {
        AdminStorage storage $ = _admin();
        if ($.initialized) revert AlreadyInitialized();
        $.initialized = true;
    }

    /// @notice 是否已封印（true = 永久不可升级）。
    function isSealed() external view returns (bool) {
        return _admin().sealed_;
    }

    /// @notice UUPS 标识：返回 ERC-1967 实现槽。升级时用它确认新实现也是本套逻辑。
    ///         经代理调用时回滚：否则另一个代理也能通过升级检查，升上去之后两个代理互相转发、合约永久砖掉。
    function proxiableUUID() external view returns (bytes32) {
        if (address(this) != __self) revert NotDelegated();
        return IMPLEMENTATION_SLOT;
    }

    /// @notice 实现合约自己的地址。升级时要求新实现返回的值恰好等于它自己的地址：
    ///         经代理转调拿不到这个结果，于是代理不能被当成实现。
    function selfAddress() external view returns (address) {
        return __self;
    }

    /// @notice 永久关闭升级。不可撤销。
    function seal() external {
        AdminStorage storage $ = _requireAdmin();
        $.sealed_ = true;
        emit ProxySealed();
    }

    /// @notice 升级实现（UUPS）。仅 platform、且未封印时可用。
    /// @param data 非空时在新实现上 delegatecall 一次（数据迁移用）
    function upgradeToAndCall(address newImplementation, bytes calldata data) external onlyProxy {
        _requireAdmin();
        if (newImplementation == address(0)) revert ZeroAddress();
        if (newImplementation.code.length == 0) revert NotAContract();
        // 指向代理自己会形成无限 delegatecall，合约直接砖掉
        if (newImplementation == address(this)) revert NotUUPS();
        // 新实现必须也是本套 UUPS 逻辑：否则升上去之后连升级入口都没有了
        (bool uuidOk, bytes memory uuid) = newImplementation.staticcall(abi.encodeWithSelector(this.proxiableUUID.selector));
        if (!uuidOk || uuid.length != 32 || abi.decode(uuid, (bytes32)) != IMPLEMENTATION_SLOT) revert NotUUPS();
        // 新实现必须报出「我就是我自己」：拦截把代理或别的委托目标当成实现传进来
        (bool selfOk, bytes memory self_) = newImplementation.staticcall(abi.encodeWithSelector(this.selfAddress.selector));
        if (!selfOk || self_.length != 32 || abi.decode(self_, (address)) != newImplementation) revert NotUUPS();
        // memory-safe：写存储 + 只读内存（返回数据），不标注会阻断 viaIR 的栈重排
        assembly ("memory-safe") {
            sstore(IMPLEMENTATION_SLOT, newImplementation)
        }
        emit Upgraded(newImplementation);
        if (data.length != 0) {
            (bool ok, bytes memory ret) = newImplementation.delegatecall(data);
            if (!ok) {
                assembly ("memory-safe") { revert(add(ret, 0x20), mload(ret)) }
            }
        }
    }

    function _requireAdmin() private view returns (AdminStorage storage $) {
        $ = _admin();
        if ($.sealed_) revert Sealed();
        address owner = _adminOwner();
        if (owner == address(0) || msg.sender != owner) revert NotPlatform();
    }
}
