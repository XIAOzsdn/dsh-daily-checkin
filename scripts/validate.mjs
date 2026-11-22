/**
 * 静态自检：语法、清单、渠道不变量、响应信封、打包必需文件。
 *
 * 任何一项失败都以非零退出码结束，避免把坏包发出去。
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const failures = [];
let passed = 0;

function check(name, fn) {
  try {
    const detail = fn();
    passed += 1;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`FAIL  ${name} — ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(rel) {
  const file = path.join(ROOT, rel);
  assert(existsSync(file), `缺少文件 ${rel}`);
  return readFileSync(file, 'utf8');
}

function sizeOf(rel) {
  const file = path.join(ROOT, rel);
  assert(existsSync(file), `缺少文件 ${rel}`);
  return statSync(file).size;
}

function syntax(rel) {
  const file = path.join(ROOT, rel);
  assert(existsSync(file), `缺少文件 ${rel}`);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert(result.status === 0, `${rel} 语法错误：${(result.stderr || result.stdout || '').trim().split('\n')[0]}`);
}

// ── 1. 语法 ────────────────────────────────────────────────────────────────
for (const rel of ['index.js', 'client.js', 'lib/channels.js', 'scripts/validate.mjs', 'scripts/doctor.mjs']) {
  check(`语法 ${rel}`, () => syntax(rel));
}
check('语法 vendor/channel-pack/pack.js', () => syntax(path.join('vendor', 'channel-pack', 'pack.js')));
for (const name of readdirSync(path.join(ROOT, 'test'))) {
  if (name.endsWith('.test.js')) check(`语法 test/${name}`, () => syntax(path.join('test', name)));
}

// ── 2. 清单 ────────────────────────────────────────────────────────────────
check('package.json 可解析且字段完整', () => {
  const pkg = JSON.parse(read('package.json'));
  assert(pkg.name === 'dsh-daily-checkin', '包名必须是 dsh-daily-checkin');
  assert(/^\d+\.\d+\.\d+$/.test(pkg.version), '版本号必须形如 x.y.z');
  assert(pkg.type === 'module', '必须是 ESM（type: module）');
  assert(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch === './cordis.patch.yml', 'dsh.bundle.patch 必须指向 cordis.patch.yml');
  assert(pkg.dsh.client && pkg.dsh.client.platform === 'web', '客户端平台必须是 web');
  assert(pkg.dsh.engines && typeof pkg.dsh.engines.dsh === 'string', '必须声明 DSH 兼容版本');
  return `${pkg.name}@${pkg.version}`;
});

check('cordis.patch.yml 挂载条目正确', () => {
  const text = read('cordis.patch.yml');
  assert(/id:\s*daily-checkin/.test(text), 'patch 缺少 id: daily-checkin');
  assert(/name:\s*dsh-daily-checkin/.test(text), 'patch 缺少 name: dsh-daily-checkin');
});

check('client.js 是 ModuleLoader 模块且 id 正确', () => {
  const text = read('client.js');
  assert(text.includes('window.__ModuleLoader__.load'), '缺少 ModuleLoader 入口');
  assert(/id:\s*'dsh-daily-checkin'/.test(text), 'ModuleLoader id 必须是 dsh-daily-checkin');
  assert(text.includes("slots.inject('settings.section'"), '必须注册 settings.section');
});

check('宿主不引用已删除的旁路模块', () => {
  const text = read('index.js');
  const imports = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const bad = imports.filter((spec) => /(^|\/)src\//.test(spec) || /(eac|kilo|aggregate|combos|token-saver|updater|feed|magpie|extensions|plugins)/.test(spec));
  assert(bad.length === 0, `仍引用了：${bad.join(', ')}`);
  return `${imports.length} 个导入全部为本地基础模块`;
});

// ── 3. 渠道不变量 ──────────────────────────────────────────────────────────
const channelsMod = await import(pathToFileURL(path.join(ROOT, 'lib/channels.js')).href);
check('渠道名单：保留项全部可签到，且与移除项不重叠', () => {
  const { CHANNELS, BLOCKED_CHANNELS, CHANNEL_IDS, BLOCKED_IDS } = channelsMod;
  assert(CHANNELS.length > 0, '保留渠道不能为空');
  assert(CHANNELS.every((item) => item.claim === true), '保留渠道必须全部 claim=true');
  assert(BLOCKED_CHANNELS.length > 0, '必须显式登记移除渠道');
  const overlap = CHANNEL_IDS.filter((id) => BLOCKED_IDS.includes(id));
  assert(overlap.length === 0, `渠道同时出现在保留与移除名单：${overlap.join(', ')}`);
  assert(new Set(CHANNEL_IDS).size === CHANNEL_IDS.length, '保留渠道存在重复 id');
  return `${CHANNEL_IDS.length} 个保留 / ${BLOCKED_IDS.length} 个移除`;
});

check('配置归一化：非法值回落默认且不抛错', () => {
  const { sanitizeConfig, DEFAULT_CONFIG } = channelsMod;
  const value = sanitizeConfig({ disableBlockedChannels: 'yes', checkinDelayMs: -5 });
  assert(value.disableBlockedChannels === DEFAULT_CONFIG.disableBlockedChannels, '非法布尔未回落默认');
  assert(value.checkinDelayMs === null, '非法延迟未回落 null');
  assert(sanitizeConfig(undefined).disableBlockedChannels === true, '默认应开启渠道白名单');
});

// ── 4. 响应信封（自描述元数据） ────────────────────────────────────────────
check('响应信封包含自描述元数据', () => {
  const { ok, fail } = channelsMod;
  const good = ok({ hello: 'world' });
  const bad = fail('X', 'boom');
  for (const env of [good, bad]) {
    assert(env.meta && env.meta.plugin === 'dsh-daily-checkin', '缺少 meta.plugin');
    assert(typeof env.meta.version === 'string' && env.meta.version.length > 0, '缺少 meta.version');
    assert(typeof env.meta.generatedAt === 'string', '缺少 meta.generatedAt');
    assert(env.meta.confidence === 1, '缺少 meta.confidence');
  }
  assert(bad.ok === false && bad.error && bad.error.code === 'X', '失败信封结构不正确');
});

// ── 5. 打包必需文件 ────────────────────────────────────────────────────────
check('渠道引擎文件完整', () => {
  const pack = sizeOf(path.join('vendor', 'channel-pack', 'pack.js'));
  const wasm = sizeOf(path.join('vendor', 'channel-pack', 'qoder-auth-wasm.wasm'));
  assert(pack > 1_000_000, `pack.js 体积异常（${pack}）`);
  assert(wasm > 100_000, `qoder-auth-wasm.wasm 体积异常（${wasm}）`);
  assert(existsSync(path.join(ROOT, 'vendor', 'channel-pack', 'LICENSE')), '缺少渠道引擎 LICENSE');
  assert(existsSync(path.join(ROOT, 'vendor', 'channel-pack', 'NOTICE.md')), '缺少渠道引擎 NOTICE');
  return `pack.js ${(pack / 1024 / 1024).toFixed(2)} MB`;
});

check('渠道引擎包含本插件依赖的 RPC 方法', () => {
  const text = read(path.join('vendor', 'channel-pack', 'pack.js'));
  const required = [
    'usage.autoCheckin',
    'credits.claimAll',
    'credits.status',
    'account.list',
    'account.create',
    'account.update',
    'account.delete',
    'login.poll',
    'model.list',
    'model.setDisabled',
  ];
  const missing = required.filter((method) => !text.includes(method));
  assert(missing.length === 0, `渠道引擎缺少方法：${missing.join(', ')}`);
  return required.length + ' 个方法全部存在';
});

check('文档与许可存在', () => {
  assert(read('README.md').length > 500, 'README 内容过短');
  assert(read('LICENSE').length > 200, 'LICENSE 内容过短');
});

// ── 结果 ──────────────────────────────────────────────────────────────────
console.log('');
if (failures.length > 0) {
  console.error(`自检失败：${failures.length} 项\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`自检通过：${passed} 项全部 PASS`);
