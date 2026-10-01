/**
 * 部署 SonicMint v2 合约到 BNB Chain
 * 用法：
 *   PRIVATE_KEY=0x... node scripts/deploy.js
 *   可选参数：PLATFORM=0x... PLATFORM_BPS=1000 MIN_PLAY_PRICE=0
 *             MONTHLY_FEE=10000000000000000 (0.01 BNB)
 *             PROCESSOR_FACTORY=0x68224F668083c29e9800Be2a646d42d18cedF7e2
 *   网络：默认 BNB Mainnet，可设 RPC_URL 覆盖
 */
import { ethers } from "ethers";
import fs from "node:fs";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) { console.error("请设置 PRIVATE_KEY 环境变量"); process.exit(1); }

const RPC_URL = process.env.RPC_URL || "https://bsc-dataseed.bnbchain.org";
const PLATFORM = process.env.PLATFORM || new ethers.Wallet(PRIVATE_KEY).address;
const PLATFORM_BPS = parseInt(process.env.PLATFORM_BPS || "1000");
const MIN_PLAY_PRICE = process.env.MIN_PLAY_PRICE || "0";
const MONTHLY_FEE = process.env.MONTHLY_FEE || "10000000000000000"; // 0.01 BNB
const PROCESSOR_FACTORY = process.env.PROCESSOR_FACTORY || "0x68224F668083c29e9800Be2a646d42d18cedF7e2";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

const ABI = JSON.parse(fs.readFileSync("artifacts/SonicMint.abi.json", "utf8"));
const BYTECODE = fs.readFileSync("artifacts/SonicMint.bin", "utf8");

async function main() {
  const balance = await provider.getBalance(signer.address);
  console.log("部署者:", signer.address, "余额:", ethers.formatEther(balance), "BNB");

  const factory = new ethers.ContractFactory(ABI, BYTECODE, signer);
  console.log(`参数: platform=${PLATFORM}, bps=${PLATFORM_BPS}, minPrice=${MIN_PLAY_PRICE}, monthlyFee=${ethers.formatEther(MONTHLY_FEE)} BNB`);
  const contract = await factory.deploy(PLATFORM, PLATFORM_BPS, MIN_PLAY_PRICE, MONTHLY_FEE, PROCESSOR_FACTORY);
  console.log("等待部署确认…");
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("✓ SonicMint v2 已部署:", addr);
  console.log("\n下一步：");
  console.log("  1. 将合约地址填入 frontend/app.js 的 NETWORKS 配置");
  console.log("  2. 部署前端到 TapeOut 容器：npm run publish-site");
  console.log("  3. 或本地测试：npx serve frontend");
}

main().catch((e) => { console.error(e); process.exit(1); });
