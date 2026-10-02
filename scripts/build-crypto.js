/**
 * 打包加密层：frontend/vendor/tap10/sonic.js → frontend/crypto.js（IIFE，全局 TapeCrypto）
 * @noble 依赖从 TapeKit/send/module/node_modules 解析（v2），避免与 ethers 自带的 v1 冲突
 */
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nobleDir = path.join(root, 'TapeKit', 'send', 'module', 'node_modules');

/** 把 @noble/* 的裸导入指向 TapeKit 自带的 v2 版本 */
const nobleResolver = {
  name: 'noble-v2',
  setup(build) {
    build.onResolve({ filter: /^@noble\// }, (args) => ({ path: path.join(nobleDir, args.path) }));
  },
};

await esbuild.build({
  entryPoints: [path.join(root, 'frontend/vendor/tap10/sonic.js')],
  bundle: true,
  format: 'iife',
  globalName: 'TapeCrypto',
  outfile: path.join(root, 'frontend/crypto.js'),
  target: ['es2020'],
  minify: true,
  charset: 'utf8',
  plugins: [nobleResolver],
});

console.log('✓ 已生成 frontend/crypto.js');