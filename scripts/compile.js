/**
 * 编译 contracts/ 下的合约，输出 ABI + Bytecode + 存储布局到 artifacts/
 * 产物：
 *   SonicMint.abi.json / SonicMint.bin               —— 实现（前端与部署用）
 *   SonicMintProxy.abi.json / SonicMintProxy.bin      —— 代理（部署用）
 *   SonicMint.storage.json                            —— 实现的存储布局（升级比对的基线）
 * 用法：npm run compile
 */
import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const srcDir = "contracts";
const outDir = "artifacts";
const files = ["SonicMint.sol", "SonicMintAdmin.sol", "SonicMintProxy.sol"];

const sources = {};
for (const f of files) {
  sources[`${srcDir}/${f}`] = { content: fs.readFileSync(path.join(srcDir, f), "utf8") };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "storageLayout"] },
    },
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
  },
};

console.log("编译中…");
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  const errs = output.errors.filter((e) => e.severity === "error");
  if (errs.length) {
    console.error("编译错误：");
    errs.forEach((e) => console.error(e.formattedMessage));
    process.exit(1);
  }
  output.errors.filter((e) => e.severity === "warning").forEach((e) =>
    console.warn("⚠ " + e.formattedMessage)
  );
}

fs.mkdirSync(outDir, { recursive: true });

// 所有可部署合约各出一份 ABI + Bytecode（抽象合约无 bytecode，跳过）
for (const contracts of Object.values(output.contracts)) {
  for (const [name, c] of Object.entries(contracts)) {
    if (!c.evm?.bytecode?.object) continue;
    fs.writeFileSync(path.join(outDir, `${name}.abi.json`), JSON.stringify(c.abi, null, 2));
    fs.writeFileSync(path.join(outDir, `${name}.bin`), c.evm.bytecode.object);
    console.log(`✓ ${name}: ABI + Bytecode`);
  }
}

// 实现合约的存储布局：升级前与旧版比对（npm run check:upgrade）
const layout = output.contracts[`${srcDir}/SonicMint.sol`].SonicMint.storageLayout;
fs.writeFileSync(path.join(outDir, "SonicMint.storage.json"), JSON.stringify(layout, null, 2));
console.log("✓ SonicMint 存储布局: artifacts/SonicMint.storage.json");
