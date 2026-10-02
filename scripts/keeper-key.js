/**
 * 由 keeper 私钥派生 X25519 公钥，并回填到 frontend/app.js 的 KEEPER 常量
 * 用法：KEEPER_PRIVATE_KEY=0x... node scripts/keeper-key.js
 *   可选 CONTRACT=0x... 覆盖合约地址（默认读 frontend/app.js 里的 music 地址）
 * 说明：派生结果与 keeper Worker 完全一致；合约地址变化会导致公钥变化，须重新运行
 */
import esbuild from "esbuild";
import { ethers } from "ethers";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nobleDir = path.join(root, "TapeKit", "send", "module", "node_modules");
const appPath = path.join(root, "frontend", "app.js");

const privateKey = process.env.KEEPER_PRIVATE_KEY;
if (!privateKey) { console.error("请设置 KEEPER_PRIVATE_KEY 环境变量"); process.exit(1); }

const appJs = fs.readFileSync(appPath, "utf8");
const hub = ethers.getAddress(process.env.CONTRACT || appJs.match(/music:\s*"(0x[0-9a-fA-F]{40})"/)[1]);
const chainId = 196;

// vendor/tap10 需要 @noble/* v2，先打包成临时 ESM 再导入
const tmp = path.join(os.tmpdir(), `sonicmint-keys-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: [path.join(root, "frontend/vendor/tap10/sonic.js")],
  bundle: true, format: "esm", platform: "node", target: ["node20"], outfile: tmp,
  plugins: [{
    name: "noble-v2",
    setup(build) {
      build.onResolve({ filter: /^@noble\// }, (args) => ({ path: path.join(nobleDir, args.path) }));
    },
  }],
});
const lib = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

const wallet = new ethers.Wallet(privateKey);
const params = { tokenId: 1, cpuIndex: 0, container: wallet.address, holder: wallet.address, hub, chainId };
const signature = await wallet.signMessage(lib.keyDerivationText(params));
const { publicKey } = lib.deriveKeyPair({ ...params, signature });
const pubHex = lib.pubKeyHex(publicKey);

const patched = appJs.replace(
  /(const KEEPER = \{\s*\n\s*address: ")[^"]*(",\s*\n\s*publicKey: ")[^"]*(")/,
  `$1${wallet.address}$2${pubHex}$3`,
);
if (patched === appJs) { console.error("未能定位 app.js 中的 KEEPER 常量，请手动填写"); }
else fs.writeFileSync(appPath, patched);

console.log("keeper 地址  :", wallet.address);
console.log("keeper 公钥  :", pubHex);
console.log("hub（合约）  :", hub);
console.log("\n下一步：");
console.log(`  npx wrangler secret put KEEPER_PRIVATE_KEY --config keeper/wrangler.toml`);