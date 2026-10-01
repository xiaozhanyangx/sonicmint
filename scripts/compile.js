/**
 * 编译 SonicMint.sol，输出 ABI + Bytecode 到 artifacts/
 * 用法：npm run compile
 */
import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const srcPath = "contracts/SonicMint.sol";
const outDir = "artifacts";

const source = fs.readFileSync(srcPath, "utf8");
const input = {
  language: "Solidity",
  sources: { "SonicMint.sol": { content: source } },
  settings: {
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
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

const contract = output.contracts["SonicMint.sol"]["SonicMint"];

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "SonicMint.abi.json"),
  JSON.stringify(contract.abi, null, 2)
);
fs.writeFileSync(
  path.join(outDir, "SonicMint.bin"),
  contract.evm.bytecode.object
);

console.log("✓ 编译成功");
console.log("  ABI: artifacts/SonicMint.abi.json");
console.log("  Bytecode:", contract.evm.bytecode.object.length, "hex chars");
