import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANNELS,
  BLOCKED_CHANNELS,
  CHANNEL_IDS,
  BLOCKED_IDS,
  LIMITS,
  DEFAULT_CONFIG,
  sanitizeConfig,
  publicConfig,
  ok,
  fail,
  meta,
} from '../lib/channels.js';

test('保留渠道全部具备签到能力', () => {
  assert.ok(CHANNELS.length > 0);
  for (const channel of CHANNELS) {
    assert.equal(channel.claim, true, `${channel.id} 必须 claim=true`);
    assert.equal(typeof channel.name, 'string');
  }
});

test('保留与移除名单不重叠', () => {
  const overlap = CHANNEL_IDS.filter((id) => BLOCKED_IDS.includes(id));
  assert.deepEqual(overlap, []);
  assert.equal(new Set(CHANNEL_IDS).size, CHANNEL_IDS.length);
  assert.equal(new Set(BLOCKED_IDS).size, BLOCKED_IDS.length);
  assert.equal(BLOCKED_CHANNELS.length, 4);
});

test('配置归一化：非法输入回落默认值', () => {
  assert.deepEqual(sanitizeConfig(undefined), DEFAULT_CONFIG);
  assert.deepEqual(sanitizeConfig(null), DEFAULT_CONFIG);
  assert.deepEqual(sanitizeConfig('x'), DEFAULT_CONFIG);
  assert.equal(sanitizeConfig({ disableBlockedChannels: 'no' }).disableBlockedChannels, true);
  assert.equal(sanitizeConfig({ disableBlockedChannels: false }).disableBlockedChannels, false);
  assert.equal(sanitizeConfig({ checkinDelayMs: -1 }).checkinDelayMs, null);
  assert.equal(sanitizeConfig({ checkinDelayMs: 'abc' }).checkinDelayMs, null);
  assert.equal(sanitizeConfig({ checkinDelayMs: 5000 }).checkinDelayMs, 5000);
  assert.equal(sanitizeConfig({ checkinDelayMs: LIMITS.maxCheckinDelayMs + 1 }).checkinDelayMs, null);
});

test('公开配置只包含白名单与阈值，不含秘密', () => {
  const cfg = publicConfig(sanitizeConfig({}));
  assert.equal(cfg.plugin, 'dsh-daily-checkin');
  assert.equal(cfg.channels.length, CHANNELS.length);
  assert.equal(cfg.blocked.length, BLOCKED_CHANNELS.length);
  assert.equal(cfg.settings.defaultCheckinDelayMs, LIMITS.checkinDelayMs);
  const text = JSON.stringify(cfg);
  assert.ok(!/token|secret|credentialRef|apiKey/i.test(text));
});

test('响应信封始终带自描述元数据', () => {
  const good = ok({ a: 1 });
  assert.equal(good.ok, true);
  assert.equal(good.meta.plugin, 'dsh-daily-checkin');
  assert.equal(good.meta.confidence, 1);
  assert.match(good.meta.generatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const bad = fail('BAD', '坏掉了');
  assert.equal(bad.ok, false);
  assert.equal(bad.error.code, 'BAD');
  assert.equal(bad.meta.plugin, 'dsh-daily-checkin');

  const withExtra = meta({ pack: { state: 'ready' } });
  assert.equal(withExtra.pack.state, 'ready');
});
