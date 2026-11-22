/**
 * dsh-daily-checkin — 宿主半边。
 *
 * 只做三件事：
 *   1. 挂载内置渠道引擎（账号登录 / 账号池 / 每日签到 / 渠道模型 / 本机网关）；
 *   2. 渠道白名单：启动后关闭「没有每日签到」的渠道（Cline / Raccoon / ZCode / Gemini）；
 *   3. 提供一个只读配置接口给设置页。
 *
 * 不注册任何模型车道的旁路、不做公告/升级/看板/省 Token/聚合/路由。
 * 任何一步失败都只降级并记录日志，绝不让插件 apply 抛错拖垮宿主。
 */
import {
  PLUGIN_NAME,
  PLUGIN_VERSION,
  BLOCKED_IDS,
  LIMITS,
  publicConfig,
  sanitizeConfig,
  ok,
  fail,
} from './lib/channels.js';

export const name = PLUGIN_NAME;
export const version = PLUGIN_VERSION;
export const inject = [];

const ROUTE_PREFIX = '/api/daily-checkin';
const PACK_ENTRY = './vendor/channel-pack/pack.js';

function loggerOf(ctx) {
  const logger = ctx && ctx.logger;
  if (logger && typeof logger.info === 'function') return logger;
  return console;
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function isTrusted(req) {
  const host = String((req.headers && req.headers.host) || '');
  const origin = String((req.headers && req.headers.origin) || '');
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function writeJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(JSON.stringify(body));
}

/**
 * 关闭白名单之外的渠道：先关模型、再停账号。
 *
 * 顺序与渠道包 `provider.setEnabled` 的语义一致：只停账号会留下
 * 「账号不可用但模型仍出现在选择器」的中间态。
 * 某个渠道读不到目录时只记录，不影响其它渠道；失败会在稍后重试。
 */
export async function enforceWhitelist(scoped, log) {
  const pool = typeof scoped.get === 'function' ? scoped.get('accountPool') : undefined;
  const llm = typeof scoped.get === 'function' ? scoped.get('llm') : undefined;
  if (!pool || typeof pool.setModelsDisabled !== 'function' || !llm) {
    return { ready: false, closed: [], errors: [{ provider: '*', error: 'accountPool / llm 尚未就绪' }] };
  }
  const closed = [];
  const errors = [];
  for (const provider of BLOCKED_IDS) {
    try {
      let models = [];
      try {
        models = await llm.listModels(provider);
      } catch (error) {
        // 目录暂不可读：不写模型黑名单，但仍要停账号（下轮补模型）。
        errors.push({ provider, error: `读取模型目录失败：${errorText(error)}` });
      }
      const ids = Array.isArray(models)
        ? models.map((model) => (model && typeof model.id === 'string' ? model.id : '')).filter((id) => id.length > 0)
        : [];
      if (ids.length > 0) await pool.setModelsDisabled(provider, ids);
      if (typeof pool.setAccountsEnabled === 'function') await pool.setAccountsEnabled(provider, false);
      closed.push(provider);
    } catch (error) {
      errors.push({ provider, error: errorText(error) });
    }
  }
  try {
    if (typeof scoped.emit === 'function') scoped.emit('llm/adapters-updated');
  } catch {
    /* 广播失败不影响白名单本身 */
  }
  if (errors.length > 0) log.warn?.(`[daily-checkin] 白名单未完全生效：${JSON.stringify(errors).slice(0, 300)}`);
  return { ready: errors.length === 0, closed, errors };
}

function mountRoutes(ctx, runtime) {
  if (runtime.mounted) return true;
  const server = typeof ctx.get === 'function' ? ctx.get('webServer') : ctx.webServer;
  if (!server || typeof server.register !== 'function') return false;

  const disposers = [];
  const routes = [
    {
      path: `${ROUTE_PREFIX}/config`,
      handler: (req, res) => {
        if (!isTrusted(req)) return writeJson(res, 403, fail('FORBIDDEN', '仅允许同源访问'));
        if (String(req.method || 'GET').toUpperCase() !== 'GET') {
          return writeJson(res, 405, fail('METHOD_NOT_ALLOWED', '只支持 GET'));
        }
        return writeJson(res, 200, ok(publicConfig(runtime.settings), { pack: runtime.pack(), whitelist: runtime.whitelist() }));
      },
    },
    {
      path: `${ROUTE_PREFIX}/health`,
      handler: (req, res) => {
        if (!isTrusted(req)) return writeJson(res, 403, fail('FORBIDDEN', '仅允许同源访问'));
        if (String(req.method || 'GET').toUpperCase() !== 'GET') {
          return writeJson(res, 405, fail('METHOD_NOT_ALLOWED', '只支持 GET'));
        }
        return writeJson(res, 200, ok({
          pack: runtime.pack(),
          whitelist: runtime.whitelist(),
          settings: runtime.settings,
        }));
      },
    },
  ];

  for (const route of routes) {
    try {
      const dispose = server.register({
        kind: 'exact',
        path: route.path,
        handler: (req, res) => {
          try {
            route.handler(req, res);
          } catch (error) {
            writeJson(res, 500, fail('INTERNAL', errorText(error)));
          }
        },
      });
      if (typeof dispose === 'function') disposers.push(dispose);
    } catch (error) {
      runtime.log.warn?.(`[daily-checkin] 路由注册失败 ${route.path}：${errorText(error)}`);
    }
  }

  runtime.mounted = disposers.length > 0;
  if (runtime.mounted && typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          /* ignore */
        }
      }
    }, 'daily-checkin: routes');
  }
  return disposers.length > 0;
}

export function apply(ctx, rawConfig) {
  const log = loggerOf(ctx);
  const settings = sanitizeConfig(rawConfig);

  let stopped = false;
  let packState = { state: 'pending', error: '' };
  let whitelistState = { ready: false, closed: [], errors: [] };

  const runtime = {
    settings,
    log,
    mounted: false,
    pack: () => ({ ...packState }),
    whitelist: () => ({ ...whitelistState }),
  };

  // 配置里的签到延迟只覆盖渠道包默认值；不配置时保持上游默认（30 秒）。
  try {
    if (settings.checkinDelayMs !== null) {
      process.env.DSH_CHANNEL_PACK_AUTO_CHECKIN_DELAY_MS = String(settings.checkinDelayMs);
    }
  } catch (error) {
    log.warn?.(`[daily-checkin] 写入签到延迟配置失败：${errorText(error)}`);
  }

  // 先挂配置接口：渠道包失败时页面也能显示原因。
  try {
    mountRoutes(ctx, runtime);
  } catch (error) {
    log.warn?.(`[daily-checkin] 配置接口挂载失败：${errorText(error)}`);
  }
  if (typeof ctx.inject === 'function') {
    const timer = setTimeout(() => {
      try {
        ctx.inject(['webServer'], (scoped) => {
          if (stopped) return;
          try {
            mountRoutes(scoped, runtime);
          } catch (error) {
            log.warn?.(`[daily-checkin] 配置接口延迟挂载失败：${errorText(error)}`);
          }
        });
      } catch (error) {
        log.warn?.(`[daily-checkin] webServer 注入失败：${errorText(error)}`);
      }
    }, 0);
    if (typeof timer.unref === 'function') timer.unref();
  }

  // 生命周期：插件卸载时停止重试，不再触碰任何服务。
  try {
    if (typeof ctx.effect === 'function') {
      ctx.effect(() => () => {
        stopped = true;
      }, 'daily-checkin: lifecycle');
    }
  } catch {
    /* 老宿主没有 effect 时不影响功能 */
  }

  // 渠道包要求 credentials / commands / llm 三个服务；任一缺席就只保留配置页。
  try {
    ctx.inject(['credentials', 'commands', 'llm'], (scoped) => {
      try {
        if (typeof scoped.effect === 'function') {
          scoped.effect(() => () => {
            stopped = true;
          }, 'daily-checkin: pack lifecycle');
        }
      } catch {
        /* ignore */
      }
      void import(PACK_ENTRY)
        .then(async (pack) => {
          if (stopped) return;
          try {
            pack.apply(scoped, { disableOpencode: true });
            packState = { state: 'ready', error: '' };
            log.info?.('[daily-checkin] 渠道引擎已挂载（仅保留签到渠道）');
          } catch (error) {
            packState = { state: 'failed', error: `挂载失败：${errorText(error)}`.slice(0, 300) };
            log.warn?.(`[daily-checkin] ${packState.error}`);
            return;
          }
          if (!settings.disableBlockedChannels) return;
          for (const delay of LIMITS.enforceRetryDelays) {
            if (stopped) return;
            if (delay > 0) await new Promise((resolve) => {
              const timer = setTimeout(resolve, delay);
              if (typeof timer.unref === 'function') timer.unref();
            });
            if (stopped) return;
            try {
              whitelistState = await enforceWhitelist(scoped, log);
              if (whitelistState.ready) break;
            } catch (error) {
              whitelistState = { ready: false, closed: [], errors: [{ provider: '*', error: errorText(error) }] };
            }
          }
          whitelistState.at = new Date().toISOString();
        })
        .catch((error) => {
          if (stopped) return;
          packState = { state: 'failed', error: `加载失败：${errorText(error)}`.slice(0, 300) };
          log.warn?.(`[daily-checkin] ${packState.error}`);
        });
    });
  } catch (error) {
    packState = { state: 'failed', error: `注入失败：${errorText(error)}`.slice(0, 300) };
    log.warn?.(`[daily-checkin] ${packState.error}`);
  }
}
