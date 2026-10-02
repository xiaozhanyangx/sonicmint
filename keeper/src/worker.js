/**
 * SonicMint keeper · Cloudflare Worker
 * 唯一职责：POST /sync { user, chainId } → 用 keeper 私钥解开该用户已购曲目的内容密钥 K，
 * 重新封成该用户的 vault 并写链。幂等、无状态：vault 完全由链上 sealedCEK 重建，无需缓存。
 * 密钥域：tokenId=1 / cpuIndex=0 / container=holder=keeper 地址 / hub=合约地址 / chainId
 */
import { ethers } from "ethers";
import {
  bytesToHex, deriveKeyPair, hexToBytes, keyDerivationText, pubKeyBytes, sealVault, unwrapKey,
} from "../../frontend/vendor/tap10/sonic.js";

const ABI = [
  "function trackCount() view returns (uint256)",
  "function getPurchased(address user, uint256 offset, uint256 limit) view returns (bool[])",
  "function sealedCEK(uint256) view returns (bytes)",
  "function vaultOf(address user) view returns (bytes)",
  "function userPubKey(address user) view returns (bytes32)",
  "function setVault(address user, bytes payload)",
];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

let cache = null; // isolate 内复用，避免每次请求重新派生

/** 由 keeper 私钥派生 X25519 密钥对（与前端同一套文案，结果确定性） */
async function keeper(env) {
  if (cache) return cache;
  const wallet = new ethers.Wallet(env.KEEPER_PRIVATE_KEY);
  const chainId = Number(env.CHAIN_ID || 196);
  const hub = ethers.getAddress(env.CONTRACT);
  const params = { tokenId: 1, cpuIndex: 0, container: wallet.address, holder: wallet.address, hub, chainId };
  const signature = await wallet.signMessage(keyDerivationText(params));
  const { secretKey, publicKey } = deriveKeyPair({ ...params, signature });
  cache = { wallet, address: wallet.address, secretKey, publicKey, chainId, hub };
  return cache;
}

/** 为某用户重建并写入 vault；返回统计 */
async function sync(env, body) {
  const k = await keeper(env);
  const user = ethers.getAddress(String(body.user)); // 校验地址格式
  if (Number(body.chainId) !== k.chainId) throw new Error("chainId mismatch");

  const provider = new ethers.JsonRpcProvider(env.RPC_URL);
  const contract = new ethers.Contract(k.hub, ABI, provider);
  const cfg = { hub: k.hub, chainId: k.chainId };

  const count = Number(await contract.trackCount());
  if (!count) return { written: false, keys: 0 };

  const purchased = await contract.getPurchased(user, 0, count);
  // 逐条解开已购加密曲目的 K；sealedCEK 为空即免费/未加密曲目，跳过
  const keys = {};
  for (let i = 0; i < count; i++) {
    if (!purchased[i]) continue;
    const sealed = await contract.sealedCEK(i);
    if (!sealed || sealed === "0x") continue;
    keys[i] = bytesToHex(unwrapKey(k.secretKey, k.address, hexToBytes(sealed), cfg));
  }
  const n = Object.keys(keys).length;
  if (!n) return { written: false, keys: 0 };

  // 买家公钥在 buy 时提交，缺失则无法封装
  const buyerKey = await contract.userPubKey(user);
  if (!buyerKey || buyerKey === ethers.ZeroHash) throw new Error("buyer pubkey missing");

  const payload = bytesToHex(sealVault(keys, { address: user, publicKey: pubKeyBytes(buyerKey) }, cfg));
  const current = await contract.vaultOf(user);
  if (current && current.toLowerCase() === payload.toLowerCase()) return { written: false, keys: n }; // 幂等

  const signer = k.wallet.connect(provider);
  const tx = await new ethers.Contract(k.hub, ABI, signer).setVault(user, payload);
  await tx.wait();
  return { written: true, keys: n, tx: tx.hash };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      if (request.method === "GET" && url.pathname === "/info") {
        const k = await keeper(env);
        return json({ address: k.address, publicKey: bytesToHex(k.publicKey), chainId: k.chainId, hub: k.hub });
      }
      if (request.method === "POST" && url.pathname === "/sync") {
        const body = await request.json();
        if (!body || !body.user) return json({ ok: false, error: "user required" }, 400);
        return json({ ok: true, ...(await sync(env, body)) });
      }
      return json({ ok: false, error: "not found" }, 404);
    } catch (e) {
      return json({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
    }
  },
};