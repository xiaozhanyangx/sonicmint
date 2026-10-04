/**
 * 部署 SonicMint v4 合约到 X Layer
 * 用法：
 *   PRIVATE_KEY=0x... PROCESSOR=0x... node scripts/deploy.js
 *   可选参数：PLATFORM=0x... PLATFORM_BPS=300 (3%)
 *             FACTORY=0x... OPENER=0x... (默认 TapeOut 官方地址)
 *             KEEPER=0x... (顺带登记 keeper，须为平台账户发起)
 *   网络：默认 X Layer，可设 RPC_URL 覆盖
 */
import { ethers } from "ethers";
import fs from "node:fs";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error("请设置 PRIVATE_KEY 环境变量"); process.exit(1); }

const PROCESSOR = process.env.PROCESSOR;
if (!PROCESSOR) { console.error("请设置 PROCESSOR 环境变量（唯一允许发行唱片的处理器地址）"); process.exit(1); }

const RPC_URL = process.env.RPC_URL || "https://rpc.xlayer.tech";
const PLATFORM = process.env.PLATFORM || new ethers.Wallet(PRIVATE_KEY).address;
const PLATFORM_BPS = parseInt(process.env.PLATFORM_BPS || "300"); // 平台抽成 3%
const FACTORY = process.env.FACTORY || "0x1f09daefa827f02cbb40967cc91b259763760761"; // TapeOut 处理器工厂
const OPENER = process.env.OPENER || "0x536add8f30f03b69f6fbf29d425a816a0dc50106";  // TapeOut 容器开启器

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const ABI = JSON.parse(fs.readFileSync("artifacts/SonicMint.abi.json", "utf8"));
const BYTECODE = fs.readFileSync("artifacts/SonicMint.bin", "utf8");

async function main() {
  const balance = await provider.getBalance(signer.address);
  console.log("部署者:", signer.address, "余额:", ethers.formatEther(balance), "OKB");

  const factory = new ethers.ContractFactory(ABI, BYTECODE, signer);
  console.log(`参数: platform=${PLATFORM}, bps=${PLATFORM_BPS}`);
  console.log(`      factory=${FACTORY}, opener=${OPENER}, processor=${PROCESSOR}`);
  const contract = await factory.deploy(PLATFORM, PLATFORM_BPS, FACTORY, OPENER, PROCESSOR);
  console.log("等待部署确认…");
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("✓ SonicMint v4 已部署:", addr);

  // 可选：直接登记 keeper（平台才能调用 setKeeper）
  if (process.env.KEEPER) {
    const keeper = ethers.getAddress(process.env.KEEPER);
    console.log("登记 keeper:", keeper);
    await (await contract.setKeeper(keeper)).wait();
    console.log("✓ keeper 已登记");
  }
  console.log("\n下一步：");
  console.log("  1. 将合约地址填入 frontend/app.js 的 NETWORKS.music 与 keeper/wrangler.toml 的 CONTRACT");
  console.log("  2. 派生 keeper 公钥并回填：KEEPER_PRIVATE_KEY=0x... npm run keeper:key");
  console.log("  3. 部署 keeper Worker：npm run build:keeper && npm run deploy:keeper");
  console.log("  4. 重建加密模块并部署前端：npm run build:crypto && npm run deploy:web");
}

main().catch((e) => { console.error(e); process.exit(1); });
