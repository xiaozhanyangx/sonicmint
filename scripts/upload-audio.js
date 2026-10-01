/**
 * CLI：上传单个音频文件到 TapeOut 容器
 * 用法：
 *   PRIVATE_KEY=0x... TOKEN_ID=4246 CPU=0 AUDIO=./song.mp3 \
 *   TITLE="夜曲" ARTIST="周杰伦" node scripts/upload-audio.js
 *
 * 注意：此脚本只上传音频到 SiteRegistry，不注册到 SonicMint。
 *      要在平台显示，还需调用 registerTrack（前端会自动做）。
 */
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TOKEN_ID = parseInt(process.env.TOKEN_ID);
const CPU = parseInt(process.env.CPU || "0");
const AUDIO = process.env.AUDIO;
if (!PRIVATE_KEY || !TOKEN_ID || !AUDIO) {
  console.error("请设置 PRIVATE_KEY, TOKEN_ID, AUDIO 环境变量");
  process.exit(1);
}

const RPC_URL = process.env.RPC_URL || "https://rpc.xlayer.tech";
// TapeOut 核心合约地址（X Layer 部署后替换）
const SITE_REGISTRY = "0x0000000000000000000000000000000000000000";
const CONTAINER_OPENER = "0x0000000000000000000000000000000000000000";
const PROCESSOR_FACTORY = "0x0000000000000000000000000000000000000000";
const CHUNK_MAX = 24000;
const FILE_MAX = 8_400_000;

const REGISTRY_ABI = [
  "function putFile(address container, string path, string contentType, bytes32 sha256Hash, bytes firstChunk)",
  "function appendChunk(address container, string path, uint256 expectIndex, bytes chunk)",
];
const OPENER_ABI = [
  "function accountOf(address processor, uint256 tokenId) view returns (address)",
  "function isOpened(address processor, uint256 tokenId) view returns (bool)",
];
const FACTORY_ABI = ["function cpuAt(uint256) view returns (address)"];

function sha256Hex(bytes) {
  return "0x" + crypto.createHash("sha256").update(bytes).digest("hex");
}

async function main() {
  const buf = fs.readFileSync(AUDIO);
  if (buf.length > FILE_MAX) {
    console.error(`文件过大：${(buf.length/1024/1024).toFixed(2)}MB，上限 8.4MB`);
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const factory = new ethers.Contract(PROCESSOR_FACTORY, FACTORY_ABI, provider);
  const opener = new ethers.Contract(CONTAINER_OPENER, OPENER_ABI, provider);
  const registry = new ethers.Contract(SITE_REGISTRY, REGISTRY_ABI, signer);

  const processor = await factory.cpuAt(CPU);
  const container = await opener.accountOf(processor, TOKEN_ID);
  if (!(await opener.isOpened(processor, TOKEN_ID))) {
    console.error("该电路尚未开通容器"); process.exit(1);
  }

  const audioPath = `music/${TOKEN_ID}.${CPU}${path.extname(AUDIO)}`;
  const hash = sha256Hex(buf);
  const totalChunks = Math.ceil(buf.length / CHUNK_MAX);

  console.log(`容器: ${container}`);
  console.log(`路径: ${audioPath}  大小: ${(buf.length/1024).toFixed(1)}KB  块数: ${totalChunks}`);

  process.stdout.write("第 1 块… ");
  const tx1 = await registry.putFile(container, audioPath, "audio/mpeg", hash, buf.subarray(0, CHUNK_MAX));
  await tx1.wait();
  console.log("✓");

  for (let i = 1; i < totalChunks; i++) {
    process.stdout.write(`第 ${i+1} 块… `);
    const tx = await registry.appendChunk(container, audioPath, i, buf.subarray(i*CHUNK_MAX, (i+1)*CHUNK_MAX));
    await tx.wait();
    console.log("✓");
  }

  console.log(`\n✓ 音频已上链：${audioPath}`);
}

main().catch((e) => { console.error("✗", e.reason || e.message); process.exit(1); });
