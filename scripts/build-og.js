/**
 * 把 scripts/og.svg 渲染成 OG 分享图 frontend/og.png（1200×630）
 * 用法：npm run build:og
 *
 * 依赖 @resvg/resvg-js；中文字形从系统字体加载，缺失时回退英文渲染（文字会变方框）。
 */
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

const SRC = "scripts/og.svg";
const OUT = "frontend/og.png";

// 系统 CJK 字体：常规 + 粗体（Windows / macOS 常见路径）
const FONT_CANDIDATES = [
  "C:/Windows/Fonts/msyh.ttc",
  "C:/Windows/Fonts/msyhbd.ttc",
  "/System/Library/Fonts/PingFang.ttc",
];

const fontFiles = FONT_CANDIDATES.filter((f) => fs.existsSync(f));
if (fontFiles.length === 0) {
  console.warn("⚠ 未找到中文字体，生成的图片中文可能显示为方块");
}

const svg = fs.readFileSync(SRC, "utf8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: {
    fontFiles,
    loadSystemFonts: fontFiles.length === 0,
    defaultFontFamily: "Microsoft YaHei",
  },
});

const png = resvg.render().asPng();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log(`✓ ${OUT} (${(png.length / 1024).toFixed(1)} KB)`);
