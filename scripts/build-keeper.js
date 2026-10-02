/**
 * 把 keeper Worker 打包成单文件（Cloudflare 直接部署，no_bundle）
 * 用法：npm run build:keeper
 * 注意：@noble/* 需 v2（TAP-10），而 ethers v6 依赖根目录的 v1；
 *      只把来自 vendor/tap10 与 keeper 源码的引用指向 v2，其余走默认解析。
 */
import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nobleDir = path.join(root, "TapeKit", "send", "module", "node_modules");

const nobleV2 = {
  name: "noble-v2",
  setup(build) {
    build.onResolve({ filter: /^@noble\// }, (args) => {
      const importer = (args.importer || "").replace(/\\/g, "/");
      if (importer.includes("/vendor/tap10/") || importer.includes("/keeper/")) {
        return { path: path.join(nobleDir, args.path) };
      }
      return null; // 交回默认解析（根 node_modules 的 v1，供 ethers 使用）
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(root, "keeper/src/worker.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: path.join(root, "keeper/dist/worker.js"),
  minify: true,
  charset: "utf8",
  plugins: [nobleV2],
});
console.log("✓ 已生成 keeper/dist/worker.js");