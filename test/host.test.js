import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, enforceWhitelist, name, version } from '../index.js';
import { BLOCKED_IDS } from '../lib/channels.js';

function fakeScoped(options = {}) {
  const calls = { models: [], accounts: [], emitted: 0 };
  const scoped = {
    logger: { info() {}, warn() {}, error() {} },
    get(service) {
      if (service === 'llm') {
        return {
          listModels: async (provider) => {
            if (options.fail?.[provider]) throw new Error(options.fail[provider]);
            return options.models?.[provider] ?? [{ id: `${provider}-m1` }, { id: `${provider}-m2` }];
          },
        };
      }
      if (service === 'accountPool') {
        return {
          setModelsDisabled: async (provider, ids) => {
            if (options.fence) throw new Error(options.fence);
            calls.models.push([provider, ids.slice()]);
          },
          setAccountsEnabled: async (provider, enabled) => {
            calls.accounts.push([provider, enabled]);
          },
        };
      }
      return undefined;
    },
    emit() {
      calls.emitted += 1;
    },
  };
  return { scoped, calls };
}

test('白名单会关闭全部移除渠道的模型与账号', async () => {
  const { scoped, calls } = fakeScoped();
  const state = await enforceWhitelist(scoped, { warn() {} });
  assert.equal(state.ready, true);
  assert.deepEqual(state.closed.slice().sort(), BLOCKED_IDS.slice().sort());
  assert.equal(calls.models.length, BLOCKED_IDS.length);
  assert.equal(calls.accounts.length, BLOCKED_IDS.length);
  for (const [provider, ids] of calls.models) {
    assert.deepEqual(ids, [`${provider}-m1`, `${provider}-m2`]);
  }
  assert.equal(calls.emitted, 1);
});

test('单个渠道读取失败不影响其它渠道，并记录错误', async () => {
  const { scoped, calls } = fakeScoped({ fail: { cline: '目录超时' } });
  const state = await enforceWhitelist(scoped, { warn() {} });
  assert.equal(state.ready, false);
  assert.ok(state.errors.some((item) => item.provider === 'cline' && /目录超时/.test(item.error)));
  assert.ok(state.closed.includes('cline'), '读目录失败时仍应停账号');
  assert.equal(calls.accounts.length, BLOCKED_IDS.length);
});

test('账号池缺失时返回可解释的失败而不是抛错', async () => {
  const scoped = { get: () => undefined, emit() {} };
  const state = await enforceWhitelist(scoped, { warn() {} });
  assert.equal(state.ready, false);
  assert.match(state.errors[0].error, /accountPool/);
});

test('插件导出名与清单版本一致', () => {
  assert.equal(name, 'dsh-daily-checkin');
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('apply 在服务齐全时注册配置接口且不抛错', async () => {
  const routes = new Map();
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    get(service) {
      if (service === 'webServer') {
        return {
          register({ path, handler }) {
            routes.set(path, handler);
            return () => routes.delete(path);
          },
        };
      }
      return undefined;
    },
    inject(deps, callback) {
      callback(ctx);
    },
    effect() {},
    emit() {},
  };

  assert.doesNotThrow(() => apply(ctx, { checkinDelayMs: 0 }));
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.ok(routes.has('/api/daily-checkin/config'));
  assert.ok(routes.has('/api/daily-checkin/health'));

  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  routes.get('/api/daily-checkin/config')({ method: 'GET', headers: { host: '127.0.0.1:3000' } }, res);
  const payload = JSON.parse(res.body);
  assert.equal(res.statusCode, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.plugin, 'dsh-daily-checkin');
  assert.equal(payload.meta.plugin, 'dsh-daily-checkin');
  // 测试环境没有宿主依赖，渠道引擎应当以「失败但可解释」的形态收场。
  assert.ok(['pending', 'failed'].includes(payload.meta.pack.state));
});

test('跨源请求被拒绝', async () => {
  const routes = new Map();
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    get(service) {
      if (service === 'webServer') {
        return {
          register({ path, handler }) {
            routes.set(path, handler);
            return () => routes.delete(path);
          },
        };
      }
      return undefined;
    },
    inject(deps, callback) {
      callback(ctx);
    },
    effect() {},
    emit() {},
  };
  apply(ctx, {});
  await new Promise((resolve) => setTimeout(resolve, 10));
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(body) {
      this.body = body;
    },
  };
  routes.get('/api/daily-checkin/health')(
    { method: 'GET', headers: { host: '127.0.0.1:3000', origin: 'https://evil.example' } },
    res,
  );
  assert.equal(res.statusCode, 403);
  assert.equal(JSON.parse(res.body).error.code, 'FORBIDDEN');
});
