/**
 * 安装前/安装后的环境自检（只读，不联网，不改任何文件）。
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lines = [];
const problems = [];

function info(label, value) {
  lines.push(`${label}: ${value}`);
}

function requireFile(rel, minSize) {
  const file = path.join(ROOT, rel);
  if (!existsSync(file)) {
    problems.push(`缺少 ${rel}`);
    return;
  }
  const size = statSync(file).size;
  if (minSize && size < minSize) problems.push(`${rel} 体积异常（${size}）`);
}

const major = Number(process.versions.node.split('.')[0]);
info('Node', `${process.version}（要求 >=22.19.0）`);
if (major < 22) problems.push('Node 版本过低，渠道引擎与插件都要求 Node 22 以上');

let pkg = {};
try {
  pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  info('插件', `${pkg.name}@${pkg.version}`);
} catch (error) {
  problems.push(`package.json 无法解析：${error instanceof Error ? error.message : String(error)}`);
}

const dshHome = String(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'));
info('DSH_HOME', dshHome);
info('DSH_HOME 存在', existsSync(dshHome) ? '是' : '否（未安装 DSH 时属正常）');
if (existsSync(path.join(dshHome, 'profiles'))) {
  const profiles = [];
  for (const entry of ['desktop', 'web']) {
    if (existsSync(path.join(dshHome, 'profiles', entry))) profiles.push(entry);
  }
  info('可用 profile', profiles.length ? profiles.join(', ') : '未发现 desktop / web');
}

requireFile('index.js');
requireFile('client.js');
requireFile('cordis.patch.yml');
requireFile(path.join('vendor', 'channel-pack', 'pack.js'), 1_000_000);
requireFile(path.join('vendor', 'channel-pack', 'qoder-auth-wasm.wasm'), 100_000);
requireFile(path.join('vendor', 'channel-pack', 'NOTICE.md'));

info('渠道引擎', existsSync(path.join(ROOT, 'vendor', 'channel-pack', 'pack.js')) ? '在位' : '缺失');

console.log(lines.filter((line) => !line.endsWith(': ')).join('\n'));
if (problems.length > 0) {
  console.error('\n发现问题：');
  for (const problem of problems) console.error('- ' + problem);
  process.exit(1);
}
console.log('\n自检通过：环境与安装文件均正常');
