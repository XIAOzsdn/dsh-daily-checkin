/**
 * 单一事实来源：插件元信息、渠道白名单、默认配置与统一响应信封。
 *
 * 宿主（index.js）与前端配置接口都从这里取值，避免两处各写一份渠道名单。
 * 所有可调阈值集中在 LIMITS，不在业务代码里出现裸数字。
 */

export const PLUGIN_NAME = 'dsh-daily-checkin';
export const PLUGIN_VERSION = '1.0.1';
export const PLUGIN_TITLE = '每日签到 · 免费模型';
/** 本包实测通过的 DSH 版本（仅作展示，不参与运行时判断）。 */
export const TESTED_DSH = '0.2.2-rc.1';

/**
 * 保留的渠道：都具备「每日签到 / 每日额度领取」能力。
 * `claim` 为 true 表示插件会把它纳入「立即签到」。
 */
export const CHANNELS = Object.freeze([
  { id: 'lobsterai', name: 'LobsterAI', org: '有道', note: '每日签到积分', claim: true, order: 1 },
  { id: 'qoder', name: 'Qoder', org: '阿里系', note: '每日 100 Credits（10:00 刷新）', claim: true, order: 2 },
  { id: 'qodercn', name: 'Qoder 中国版', org: '阿里系', note: '中国版端点与模型池', claim: true, order: 3 },
  { id: 'trae', name: 'TRAE', org: '字节', note: '每日签到积分', claim: true, order: 4 },
  { id: 'loomy', name: 'Loomy', org: '讯飞', note: '每日赠送额度（微信扫码登录）', claim: true, order: 5 },
  { id: 'minimax', name: 'MiniMax Code', org: 'MiniMax', note: '每日签到', claim: true, order: 6 },
]);

/** 明确移除的渠道及原因（宿主会在启动后关闭它们的模型与账号）。 */
export const BLOCKED_CHANNELS = Object.freeze([
  { id: 'cline', name: 'Cline', reason: '无每日签到' },
  { id: 'raccoon', name: 'Raccoon', reason: '无每日签到' },
  { id: 'zcode', name: 'ZCode', reason: '签到需现场过验证码，无法自动完成' },
  { id: 'gemini', name: 'Gemini', reason: '无每日签到（仅配额）' },
]);

export const CHANNEL_IDS = Object.freeze(CHANNELS.map((item) => item.id));
export const BLOCKED_IDS = Object.freeze(BLOCKED_CHANNELS.map((item) => item.id));

/** 失败重试与限流的硬上限，全部集中在这里。 */
export const LIMITS = Object.freeze({
  /** 自动签到默认延迟：对齐渠道包默认值（30 秒），只在用户显式配置时覆盖。 */
  checkinDelayMs: 30_000,
  maxCheckinDelayMs: 10 * 60_000,
  /** 白名单执行失败后的重试时刻（毫秒，相对启动；首轮立即执行）。 */
  enforceRetryDelays: Object.freeze([0, 3_000, 15_000, 60_000]),
  /** 前端单次 RPC 超时。 */
  rpcTimeoutMs: 60_000,
  /** 登录轮询：间隔与总时长。 */
  loginPollMs: 2_500,
  loginPollMaxMs: 5 * 60_000,
});

/** 默认配置（可通过插件配置覆盖）。 */
export const DEFAULT_CONFIG = Object.freeze({
  /** 是否在启动后关闭 BLOCKED_CHANNELS 的模型与账号。 */
  disableBlockedChannels: true,
  /** 自动签到延迟（毫秒）；null 表示沿用渠道包默认值。 */
  checkinDelayMs: null,
});

function asBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function asDelay(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > LIMITS.maxCheckinDelayMs) return null;
  return n;
}

/** 归一化插件配置：非法值一律回落到默认，不抛错。 */
export function sanitizeConfig(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    disableBlockedChannels: asBool(input.disableBlockedChannels, DEFAULT_CONFIG.disableBlockedChannels),
    checkinDelayMs: asDelay(input.checkinDelayMs),
  };
}

/** 给前端/排障用的公开配置（不含任何秘密）。 */
export function publicConfig(settings) {
  return {
    plugin: PLUGIN_NAME,
    title: PLUGIN_TITLE,
    version: PLUGIN_VERSION,
    testedDsh: TESTED_DSH,
    channels: CHANNELS,
    blocked: BLOCKED_CHANNELS,
    settings: {
      disableBlockedChannels: settings.disableBlockedChannels,
      checkinDelayMs: settings.checkinDelayMs,
      defaultCheckinDelayMs: LIMITS.checkinDelayMs,
    },
    limits: {
      rpcTimeoutMs: LIMITS.rpcTimeoutMs,
      loginPollMs: LIMITS.loginPollMs,
      loginPollMaxMs: LIMITS.loginPollMaxMs,
    },
  };
}

/** 统一元数据：自描述标签，下游不必猜版本与来源。 */
export function meta(extra) {
  return {
    plugin: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    generatedAt: new Date().toISOString(),
    confidence: 1,
    ...(extra && typeof extra === 'object' ? extra : {}),
  };
}

/** 成功信封。 */
export function ok(data, extraMeta) {
  return { ok: true, data, meta: meta(extraMeta) };
}

/** 失败信封：永远返回结构化对象，绝不返回 null / 裸抛。 */
export function fail(code, message, status) {
  return {
    ok: false,
    error: { code: String(code || 'ERROR'), message: String(message || '未知错误') },
    meta: meta(status === undefined ? undefined : { status }),
  };
}
