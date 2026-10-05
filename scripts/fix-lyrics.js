/**
 * 一次性脚本：原地替换已发行曲目的歌词
 *   付费曲目会用 vault 里的 K 重新加密（与音频同一把 K），再 putFile 覆盖原路径
 * 用法：node scripts/fix-lyrics.js [trackId] [歌词文件]
 *   默认：TRACK_ID=1，歌词文件=doc/歌词
 * 私钥来源：环境变量 PRIVATE_KEY，或项目根目录的 .env（已在 .gitignore 中，不会被提交）
 */
import { ethers } from "ethers";
import fs from "node:fs";
import crypto from "node:crypto";

const CONTRACT = "0x243000a1BA9058E6A856d5AFAbAE575f9E549130";
const SITE_REGISTRY = "0xd6efb7adcc9c83dc4924ad56f6a8e4e969b9adb6";
const CHAIN_ID = 196;
const CHUNK_MAX = 24000;
const RPC = process.env.RPC_URL || "https://rpc.xlayer.tech";

const TRACK_ID = Number(process.argv[2] ?? 1);
const LYRICS_FILE = process.argv[3] || "doc/歌词";

const MINT_ABI = [
  "function getTrack(uint256) view returns (tuple(address artist, address container, uint256 tokenId, uint256 cpu, string audioPath, uint256 partCount, string coverPath, string lyricsPath, string title, string artistName, uint8 genre, uint256 playCount, uint256 totalEarned, uint256 createdAt, uint256 price, bool free, bool encrypted, bytes32 artistPubKey, bool exists))",
  "function vaultOf(address) view returns (bytes)",
];
const REG_ABI = [
  "function setOperator(address container, address op, uint256 ttl)",
  "function putFile(address container, string path, string contentType, bytes32 sha256Hash, bytes firstChunk)",
  "function appendChunk(address container, string path, uint256 expectIndex, bytes chunk)",
  "function fileInfo(address container, string path) view returns (uint256, string, bytes32, uint256, uint256)",
];

/** 私钥只从环境变量或本地 .env 读取，任何情况下都不打印 */
function readPrivateKey() {
  if (process.env.KEEPER_PRIVATE_KEY) return process.env.KEEPER_PRIVATE_KEY.trim();
  try {
    const m = fs.readFileSync(".env", "utf8").match(/^\s*PRIVATE_KEY\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  } catch { /* .env 不存在时走下面的报错 */ }
  throw new Error("未找到 PRIVATE_KEY（环境变量，或项目根目录的 .env）");
}

async function main() {
  const wallet = new ethers.Wallet(readPrivateKey(), new ethers.JsonRpcProvider(RPC));
  const mint = new ethers.Contract(CONTRACT, MINT_ABI, wallet.provider);
  const reg = new ethers.Contract(SITE_REGISTRY, REG_ABI, wallet);

  const t = await mint.getTrack(TRACK_ID);
  if (!t.exists) throw new Error(`曲目 #${TRACK_ID} 不存在`);
  if (!t.lyricsPath) throw new Error("该曲目没有歌词路径");
  if (t.artist.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`钱包 ${wallet.address} 不是该曲目的作者 ${t.artist}`);
  }
  console.log(`曲目 #${TRACK_ID} ${t.title} | encrypted=${t.encrypted}`);
  console.log(`目标路径 ${t.lyricsPath} · 容器 ${t.container}`);

  let data = new Uint8Array(fs.readFileSync(LYRICS_FILE));
  console.log(`新歌词 ${LYRICS_FILE}：${data.length} 字节`);

  // 付费曲目：歌词必须与音频共用同一把 K，K 只能从自己的 vault 解出
  if (t.encrypted) {
    (0, eval)(fs.readFileSync("frontend/crypto.js", "utf8")); // IIFE，执行后 TapeCrypto 挂到全局
    const lib = globalThis.TapeCrypto;

    const kp = await lib.deriveWalletKeyPair({
      signMessage: (text) => wallet.signMessage(text),
      holder: wallet.address,
      hub: CONTRACT,
      chainId: CHAIN_ID,
    });

    const payload = await mint.vaultOf(wallet.address);
    if (!payload || payload === "0x") throw new Error("链上 vault 为空，先调用 keeper 的 /sync");
    const keys = lib.openVault(lib.hexToBytes(payload), kp.secretKey, wallet.address, {
      hub: CONTRACT, chainId: CHAIN_ID,
    });
    const keyHex = keys[TRACK_ID];
    if (!keyHex) throw new Error(`vault 里没有曲目 #${TRACK_ID} 的密钥（keeper 未写入，或本钱包不是买家）`);

    data = lib.encryptBytes(lib.hexToBytes(keyHex, 32), data);
    console.log(`已用该曲目的 K 加密：${data.length} 字节`);
  }

  const hash = "0x" + crypto.createHash("sha256").update(data).digest("hex");
  const chunks = Math.ceil(data.length / CHUNK_MAX);
  console.log(`写入 ${chunks} 块…`);

  await (await reg.setOperator(t.container, wallet.address, 3600)).wait();
  await (await reg.putFile(t.container, t.lyricsPath, "text/plain", hash, data.subarray(0, CHUNK_MAX))).wait();
  for (let i = 1; i < chunks; i++) {
    const s = i * CHUNK_MAX;
    await (await reg.appendChunk(t.container, t.lyricsPath, i, data.subarray(s, s + CHUNK_MAX))).wait();
  }
  await (await reg.setOperator(t.container, wallet.address, 0)).wait();

  const info = await reg.fileInfo(t.container, t.lyricsPath);
  const onchain = Number(info[0]);
  console.log(`✓ 已替换 ${t.lyricsPath}，链上 ${onchain} 字节 / 本地 ${data.length} 字节`);
  if (onchain !== data.length) throw new Error("字节数不一致，写入可能不完整");
}

main().catch((e) => { console.error("✗", e.reason || e.message); process.exit(1); });
