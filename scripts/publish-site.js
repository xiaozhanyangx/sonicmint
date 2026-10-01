/**
 * 将前端发布到 TapeOut 链上容器（SiteRegistry）
 * 用法：
 *   PRIVATE_KEY=0x... TOKEN_ID=4246 CPU=0 node scripts/publish-site.js
 *   可选：FRONTEND_DIR=./frontend  RPC_URL=...  FALLBACK=index.html
 *
 * 前提：该电路已开通容器（id.tapeout.link），钱包持有该电路 NFT
 */
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TOKEN_ID = parseInt(process.env.TOKEN_ID);
const CPU = parseInt(process.env.CPU || "0");
if (!PRIVATE_KEY || !TOKEN_ID) {
  console.error("请设置 PRIVATE_KEY 和 TOKEN_ID 环境变量");
  process.exit(1);
}

const RPC_URL = process.env.RPC_URL || "https://rpc.xlayer.tech";
const FRONTEND_DIR = process.env.FRONTEND_DIR || "./frontend";
const FALLBACK = process.env.FALLBACK || "index.html";

// TapeOut 核心合约地址（X Layer 部署后替换）
const SITE_REGISTRY = "0x0000000000000000000000000000000000000000";
const CONTAINER_OPENER = "0x0000000000000000000000000000000000000000";
const PROCESSOR_FACTORY = "0x0000000000000000000000000000000000000000";

const CHUNK_MAX = 24000;

const REGISTRY_ABI = [
  "function putFile(address container, string path, string contentType, bytes32 sha256Hash, bytes firstChunk)",
  "function appendChunk(address container, string path, uint256 expectIndex, bytes chunk)",
  "function setFallback(address container, string fallbackPath)",
  "function fileInfo(address container, string path) view returns (uint256, string, bytes32, uint256, uint256)",
];
const OPENER_ABI = [
  "function accountOf(address processor, uint256 tokenId) view returns (address)",
  "function isOpened(address processor, uint256 tokenId) view returns (bool)",
];
const FACTORY_ABI = ["function cpuAt(uint256) view returns (address)"];

// MIME 类型映射
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

function walk(dir, base = "") {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...walk(full, rel));
    else files.push(rel);
  }
  return files;
}

function sha256Hex(bytes) {
  return "0x" + crypto.createHash("sha256").update(bytes).digest("hex");
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const factory = new ethers.Contract(PROCESSOR_FACTORY, FACTORY_ABI, provider);
  const opener = new ethers.Contract(CONTAINER_OPENER, OPENER_ABI, provider);
  const registry = new ethers.Contract(SITE_REGISTRY, REGISTRY_ABI, signer);

  // 推导容器
  const processor = await factory.cpuAt(CPU);
  const container = await opener.accountOf(processor, TOKEN_ID);
  const opened = await opener.isOpened(processor, TOKEN_ID);
  if (!opened) { console.error("该电路尚未开通容器"); process.exit(1); }
  console.log("容器:", container);

  // 收集文件
  const relFiles = walk(FRONTEND_DIR);
  console.log(`共 ${relFiles.length} 个文件待上传`);

  for (const rel of relFiles) {
    const abs = path.join(FRONTEND_DIR, rel);
    const buf = fs.readFileSync(abs);
    const ext = path.extname(rel).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    const hash = sha256Hex(buf);

    const totalChunks = Math.ceil(buf.length / CHUNK_MAX);
    process.stdout.write(`上传 ${rel} (${(buf.length/1024).toFixed(1)}KB, ${totalChunks}块)… `);

    // 第一块
    const firstChunk = buf.subarray(0, CHUNK_MAX);
    const tx1 = await registry.putFile(container, rel, contentType, hash, firstChunk);
    await tx1.wait();

    // 后续块
    for (let i = 1; i < totalChunks; i++) {
      const start = i * CHUNK_MAX;
      const chunk = buf.subarray(start, start + CHUNK_MAX);
      const tx = await registry.appendChunk(container, rel, i, chunk);
      await tx.wait();
    }
    console.log("✓");
  }

  // 设置回退路径（SPA）
  if (FALLBACK) {
    process.stdout.write(`设置 fallback=${FALLBACK}… `);
    const tx = await registry.setFallback(container, FALLBACK);
    await tx.wait();
    console.log("✓");
  }

  console.log("\n✓ 发布完成！");
  console.log(`网关预览: https://${TOKEN_ID}-${CPU}.tapekit.org/`);
  console.log("（需开通容器名字：0.08 OKB/月，DomainBinding.bind）");
}

main().catch((e) => { console.error("\n✗", e.reason || e.message); process.exit(1); });
