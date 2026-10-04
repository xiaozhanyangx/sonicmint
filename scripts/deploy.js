/**
 * 部署 SonicMint v5 到 X Layer：实现 + ERC-1967 代理两步部署
 *   hub（密钥派生输入）= 代理地址，部署后永久固定，此后只升级实现、不再换地址
 * 用法：
 *   PRIVATE_KEY=0x... PROCESSOR=0x... node scripts/deploy.js
 *   可选参数：PLATFORM=0x... (平台收款地址，默认部署者)
 *             FACTORY=0x... OPENER=0x... (默认 TapeOut 官方地址)
 *             KEEPER=0x... (顺带登记 keeper，须为平台账户发起)
 *   网络：默认 X Layer，可设 RPC_URL 覆盖
 * 注意：FACTORY/OPENER 是实现的 immutable 协议常量，升级部署新实现时必须填相同值。
 */
import { ethers } from "ethers";
import fs from "node:fs";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error("请设置 PRIVATE_KEY 环境变量"); process.exit(1); }

const PROCESSOR = process.env.PROCESSOR;
if (!PROCESSOR) { console.error("请设置 PROCESSOR 环境变量（唯一允许发行唱片的处理器地址）"); process.exit(1); }

const RPC_URL = process.env.RPC_URL || "https://rpc.xlayer.tech";
const PLATFORM = process.env.PLATFORM || new ethers.Wallet(PRIVATE_KEY).address;
const FACTORY = process.env.FACTORY || "0x1f09daefa827f02cbb40967cc91b259763760761"; // TapeOut 处理器工厂
const OPENER = process.env.OPENER || "0x536add8f30f03b69f6fbf29d425a816a0dc50106";  // TapeOut 容器开启器

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const IMPL_ABI = JSON.parse(fs.readFileSync("artifacts/SonicMint.abi.json", "utf8"));
const IMPL_BIN = fs.readFileSync("artifacts/SonicMint.bin", "utf8");
const PROXY_ABI = JSON.parse(fs.readFileSync("artifacts/SonicMintProxy.abi.json", "utf8"));
const PROXY_BIN = fs.readFileSync("artifacts/SonicMintProxy.bin", "utf8");

async function main() {
  const balance = await provider.getBalance(signer.address);
  console.log("部署者:", signer.address, "余额:", ethers.formatEther(balance), "OKB");
  console.log(`参数: platform=${PLATFORM}`);
  console.log(`      factory=${FACTORY}, opener=${OPENER}, processor=${PROCESSOR}`);

  // 1. 实现合约：只设 immutable 协议常量；构造时已自锁，实现自身不可被初始化
  console.log("部署实现合约…");
  const impl = await new ethers.ContractFactory(IMPL_ABI, IMPL_BIN, signer).deploy(FACTORY, OPENER);
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("✓ 实现合约:", implAddr);

  // 2. 代理：initData 原子完成 initialize(platform, processor)，杜绝抢跑
  const initData = new ethers.Interface(IMPL_ABI).encodeFunctionData("initialize", [PLATFORM, PROCESSOR]);
  console.log("部署代理…");
  const proxy = await new ethers.ContractFactory(PROXY_ABI, PROXY_BIN, signer).deploy(implAddr, initData);
  await proxy.waitForDeployment();
  const hub = await proxy.getAddress();
  console.log("✓ 代理（hub，地址永久固定）:", hub);

  // 3. 业务操作一律走代理
  const music = new ethers.Contract(hub, IMPL_ABI, signer);
  if (process.env.KEEPER) {
    const keeper = ethers.getAddress(process.env.KEEPER);
    console.log("登记 keeper:", keeper);
    await (await music.setKeeper(keeper)).wait();
    console.log("✓ keeper 已登记");
  }

  console.log("\n下一步：");
  console.log("  1. 将代理地址填入 frontend/app.js 的 NETWORKS.music 与 keeper/wrangler.toml 的 CONTRACT（最后一次改地址）");
  console.log("  2. 派生 keeper 公钥并回填：KEEPER_PRIVATE_KEY=0x... npm run keeper:key");
  console.log("  3. 部署 keeper Worker：npm run build:keeper ; npm run deploy:keeper");
  console.log("  4. 重建加密模块并部署前端：npm run build:crypto ; npm run deploy:web");
  console.log("  5. 在 README「已部署地址」登记代理与实现地址");
  console.log("\n之后的升级流程（地址不变）：");
  console.log("  a. 备份当前 artifacts/SonicMint.storage.json");
  console.log("  b. 改实现代码后 npm run compile");
  console.log("  c. npm run check:upgrade <备份的旧布局> artifacts/SonicMint.storage.json");
  console.log("  d. 部署新实现（FACTORY/OPENER 不变），经代理调用 upgradeToAndCall(新实现地址, 0x)");
  console.log("  e. 确认永不再升级时，经代理调用 seal() 永久封印");
}

main().catch((e) => { console.error(e); process.exit(1); });
