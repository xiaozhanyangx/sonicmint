// SonicMint 加密层：把 TAP-10 原语包装成本项目要用的三件事
//   1. 音频内容密钥 K 与音频加解密（XChaCha20-Poly1305）
//   2. 钱包签名 → X25519 密钥对（私钥不落地）
//   3. TAP-10 载荷封装/解封：把 K 封给 keeper、把 K 集封成用户 vault
// 统一约定：to = 收件人地址，from = hub = SonicMint 合约地址，chainId = 当前链，ref = 全零
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { ascii, bytesToHex, concat, hexToBytes } from './bytes.js';
import { openPayload, seal } from './payload.js';
import { CHAIN_ID, deriveKeyPair, keyDerivationText } from './keys.js';

export { CHAIN_ID, KEY_DOMAIN } from './keys.js';
export { TapeSendError, bytesToHex, hexToBytes } from './bytes.js';
export { openPayload, seal } from './payload.js';
export { deriveKeyPair, keyDerivationText } from './keys.js';

const NONCE = 24;

/** 生成 32 字节内容密钥 K */
export function randomKey() {
  return randomBytes(32);
}

/** 用 K 加密任意字节：nonce ‖ 密文（含 16 字节认证标签） */
export function encryptBytes(key, plain) {
  const nonce = randomBytes(NONCE);
  return concat(nonce, xchacha20poly1305(key, nonce).encrypt(plain));
}

/** 解密 encryptBytes 的输出；密钥不对或数据被改动都会抛错 */
export function decryptBytes(key, sealed) {
  if (sealed.length <= NONCE) throw new Error('ciphertext too short');
  return xchacha20poly1305(key, sealed.slice(0, NONCE)).decrypt(sealed.slice(NONCE));
}

/**
 * 派生当前钱包的 X25519 密钥对。
 * @param {{signMessage: (text: string) => Promise<string>, holder: string, hub: string, chainId?: number}} p
 * @returns {Promise<{secretKey: Uint8Array, publicKey: Uint8Array}>} 私钥仅存于内存
 */
export async function deriveWalletKeyPair({ signMessage, holder, hub, chainId = CHAIN_ID }) {
  // tokenId 固定 1、cpuIndex 固定 0、container 用钱包地址：本项目把「用户地址」当作自己的密钥域
  const params = { tokenId: 1, cpuIndex: 0, container: holder, holder, hub, chainId };
  const signature = await signMessage(keyDerivationText(params));
  const { secretKey, publicKey } = deriveKeyPair({ ...params, signature });
  return { secretKey, publicKey };
}

/** 把内容封给某人（recipient = {address, publicKey}），载荷的 to = 收件人地址、from = 合约地址 */
function sealTo(recipient, content, { hub, chainId = CHAIN_ID }) {
  return seal({ content, recipients: [recipient.publicKey], to: recipient.address, from: hub, hub, chainId });
}

/** 用自己的私钥解开封给自己的载荷 */
function openFrom(secretKey, selfAddress, payload, { hub, chainId = CHAIN_ID }) {
  return openPayload({ payload, secretKey, to: selfAddress, from: hub, hub, chainId });
}

/** K → 封给 keeper 的载荷（上链存于 sealedCEK） */
export function wrapKeyFor(key, keeper, cfg) {
  const k = new Uint8Array(32);
  k.set(key);
  return sealTo(keeper, k, cfg);
}

/** 解开封给自己的 K */
export function unwrapKey(secretKey, selfAddress, payload, cfg) {
  const { content } = openFrom(secretKey, selfAddress, payload, cfg);
  if (content.length !== 32) throw new Error('unexpected key length');
  return content;
}

/** {trackId: K 的 hex} → 封给用户的 vault 载荷 */
export function sealVault(keys, user, cfg) {
  return sealTo(user, ascii(JSON.stringify(keys)), cfg);
}

/** 解开 vault 载荷，得到 {trackId: K 的 hex} */
export function openVault(payload, secretKey, selfAddress, cfg) {
  const { content } = openFrom(secretKey, selfAddress, payload, cfg);
  return JSON.parse(new TextDecoder().decode(content));
}

/** 32 字节公钥的 hex，写在合约 bytes32 字段里 */
export function pubKeyHex(publicKey) {
  return bytesToHex(publicKey);
}

/** 合约里的 bytes32 公钥 → 32 字节 */
export function pubKeyBytes(hex) {
  return hexToBytes(String(hex), 32);
}