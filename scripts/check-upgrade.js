/**
 * 升级前的存储布局比对：旧实现与新实现的 storageLayout 必须满足「只增不改」
 * 用法：node scripts/check-upgrade.js <旧布局.json> <新布局.json>
 *   （升级流程：先备份当前 artifacts/SonicMint.storage.json，改完代码 npm run compile 后比对）
 * 规则：
 *   1. 旧布局里的每个变量（槽位、名称、偏移、完整类型含结构体成员）在新布局中原样存在
 *   2. 新增变量只能落在 ≥ 旧布局最后一个变量的槽位（即只许末尾追加，不许中插）
 * 违反任一规则即退出码 1：按此升级会让代理里的既有数据错位。
 *
 * 说明：solc 的类型键内嵌 AST 编号（如 t_struct(Track)95_storage），任何代码改动都会
 * 改变编号，因此不能直接比字符串——先把两侧布局规范化为「类型标签 + 递归成员」再比较。
 */
import fs from "node:fs";

const [oldPath, newPath] = process.argv.slice(2);
if (!oldPath || !newPath) {
  console.error("用法：node scripts/check-upgrade.js <旧布局.json> <新布局.json>");
  process.exit(1);
}

const oldLayout = JSON.parse(fs.readFileSync(oldPath, "utf8"));
const newLayout = JSON.parse(fs.readFileSync(newPath, "utf8"));

// 把类型键递归解析成规范化描述：基本类型 → 标签；结构体 → 成员表；映射 → (键, 值)；数组 → 元素
function canonType(t, types, depth = 0) {
  if (depth > 8) return "?";
  const ty = types[t];
  if (!ty) return t;
  if (ty.members) {
    return { struct: ty.label, members: ty.members.map((m) => [m.label, m.slot, m.offset, canonType(m.type, types, depth + 1)]) };
  }
  if (ty.key && ty.value) {
    return { map: [canonType(ty.key, types, depth + 1), canonType(ty.value, types, depth + 1)] };
  }
  if (ty.base) {
    return { arr: canonType(ty.base, types, depth + 1) };
  }
  return ty.label;
}

function canonical(layout) {
  const types = layout.types || {};
  return (layout.storage || []).map((v) => ({ label: v.label, slot: v.slot, offset: v.offset, type: canonType(v.type, types) }));
}

const oldL = canonical(oldLayout);
const newL = canonical(newLayout);
const newMap = new Map(newL.map((v) => [`${v.slot}:${v.label}`, v]));
let ok = true;

for (const v of oldL) {
  const n = newMap.get(`${v.slot}:${v.label}`);
  if (!n) {
    console.error(`✗ 变量被删除或移动：slot ${v.slot} ${v.label}`);
    ok = false;
    continue;
  }
  if (JSON.stringify(n.type) !== JSON.stringify(v.type) || n.offset !== v.offset) {
    console.error(`✗ 变量类型被修改：slot ${v.slot} ${v.label}`);
    console.error(`    旧: ${JSON.stringify(v.type)} offset=${v.offset}`);
    console.error(`    新: ${JSON.stringify(n.type)} offset=${n.offset}`);
    ok = false;
  }
}

// 旧布局最大槽位（空布局视为 -1，即全新存储）
const maxOldSlot = oldL.reduce((m, v) => Math.max(m, Number(v.slot)), -1);
const oldKeys = new Set(oldL.map((v) => `${v.slot}:${v.label}`));
for (const v of newL) {
  if (oldKeys.has(`${v.slot}:${v.label}`)) continue;
  if (Number(v.slot) < maxOldSlot) {
    console.error(`✗ 新增变量插进了中部：slot ${v.slot} ${v.label}（旧布局最大槽位 ${maxOldSlot}）`);
    ok = false;
  } else {
    console.log(`+ 合法追加：slot ${v.slot} ${v.label} (${typeof v.type === "string" ? v.type : v.type.struct || v.type.map || v.type.arr})`);
  }
}

if (ok) console.log("✓ 存储布局兼容：旧变量原样保留，新变量仅在末尾追加");
else console.error("布局不兼容：按此升级会让既有数据错位，禁止升级");
process.exit(ok ? 0 : 1);
