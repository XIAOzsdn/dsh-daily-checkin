/* 每日签到 · 免费模型 — 浏览器半边。
 *
 * 只注册一个设置页：自动签到开关 / 今日状态 / 立即签到 / 渠道账号登录 / 模型开关。
 * 业务请求全部走渠道包已注册的 RPC（connection.rpc → /api channel-pack），
 * 本插件不再单独复制一份账号与签到逻辑。
 */
window.__ModuleLoader__.load({
  id: 'dsh-daily-checkin',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { Fragment, useState, useEffect, useRef, useCallback } = React;

    const API = 'api/daily-checkin/';
    const NS = 'dailyCheckin';
    const STYLE_ID = 'dsc-style';

    const CSS = [
      '.dsc-root{color:var(--dsw-alias-text-primary,#1f2329);font-size:13px;line-height:1.55;padding:4px 2px 24px}',
      '.dsc-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
      '.dsc-title{font-size:17px;font-weight:700}',
      '.dsc-sub{color:var(--dsw-alias-text-secondary,#6b7280);font-size:12px}',
      '.dsc-spacer{flex:1}',
      '.dsc-card{background:var(--dsw-alias-bg-primary,#fff);border:1px solid var(--dsw-alias-border-primary,#e5e6eb);border-radius:12px;padding:16px;margin-bottom:12px}',
      '.dsc-card h3{margin:0 0 4px;font-size:14px;font-weight:650;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dsc-card h3 .dsc-sub{font-weight:400}',
      '.dsc-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dsc-btn{border:1px solid var(--dsw-alias-border-primary,#d7dae0);background:var(--dsw-alias-bg-primary,#fff);color:inherit;border-radius:8px;padding:5px 12px;cursor:pointer;font:inherit;white-space:nowrap}',
      '.dsc-btn:hover{border-color:#6b5ae6;color:#6b5ae6}',
      '.dsc-btn[data-v="primary"]{background:#6b5ae6;border-color:#6b5ae6;color:#fff;font-weight:600}',
      '.dsc-btn[data-v="primary"]:hover{background:#5b4bd6;color:#fff}',
      '.dsc-btn[data-v="danger"]{color:#c22;border-color:rgba(204,34,34,.4);background:rgba(204,34,34,.06)}',
      '.dsc-btn[data-v="ghost"]{border-color:transparent;background:transparent;color:#6b5ae6;padding:3px 6px}',
      '.dsc-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.dsc-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:2px 10px;font-size:11.5px;border:1px solid transparent}',
      '.dsc-pill[data-t="ok"]{background:rgba(31,158,79,.12);color:#1f9e4f;border-color:rgba(31,158,79,.3)}',
      '.dsc-pill[data-t="warn"]{background:rgba(217,119,6,.12);color:#b45309;border-color:rgba(217,119,6,.3)}',
      '.dsc-pill[data-t="bad"]{background:rgba(204,34,34,.1);color:#c22;border-color:rgba(204,34,34,.3)}',
      '.dsc-pill[data-t="off"]{background:rgba(107,114,128,.12);color:#6b7280;border-color:rgba(107,114,128,.25)}',
      '.dsc-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none}',
      '.dsc-switch input{width:16px;height:16px;accent-color:#6b5ae6}',
      '.dsc-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}',
      '.dsc-chip{border:1px solid var(--dsw-alias-border-primary,#eceef2);border-radius:999px;padding:2px 9px;font-size:11.5px;color:var(--dsw-alias-text-secondary,#555)}',
      '.dsc-channel{border:1px solid var(--dsw-alias-border-primary,#eceef2);border-radius:10px;padding:12px;margin-bottom:10px}',
      '.dsc-channel-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dsc-badge{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;color:#fff;font-weight:700;font-size:12.5px;flex:none}',
      '.dsc-main{flex:1;min-width:0}',
      '.dsc-name{font-weight:650}',
      '.dsc-mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--dsw-alias-text-secondary,#6b7280);word-break:break-all}',
      '.dsc-accounts{margin-top:10px;border-top:1px dashed var(--dsw-alias-border-primary,#eceef2);padding-top:10px}',
      '.dsc-account{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-primary,#f3f4f8)}',
      '.dsc-account:last-child{border-bottom:0}',
      '.dsc-models{margin-top:10px;border-top:1px dashed var(--dsw-alias-border-primary,#eceef2);padding-top:10px;max-height:320px;overflow:auto}',
      '.dsc-model{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--dsw-alias-border-primary,#f6f7fb)}',
      '.dsc-model:last-child{border-bottom:0}',
      '.dsc-model .dsc-grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsc-empty{padding:14px 0;color:var(--dsw-alias-text-secondary,#8a919c);font-size:12.5px}',
      '.dsc-credit{font-size:11.5px;color:#187a3d;background:rgba(31,158,79,.10);border:1px solid rgba(31,158,79,.25);border-radius:999px;padding:1px 8px;white-space:nowrap}',
      '.dsc-note{font-size:12px;color:var(--dsw-alias-text-secondary,#6b7280);background:rgba(124,108,240,.07);border:1px solid rgba(124,108,240,.2);border-radius:9px;padding:9px 11px;margin-top:10px}',
      '.dsc-warn{font-size:12px;color:#b45309;background:rgba(217,119,6,.08);border:1px solid rgba(217,119,6,.25);border-radius:9px;padding:9px 11px;margin-top:10px}',
      '.dsc-err{font-size:12px;color:#b02020;background:rgba(204,34,34,.07);border:1px solid rgba(204,34,34,.25);border-radius:9px;padding:9px 11px;margin-top:10px}',
      '.dsc-toast{position:sticky;bottom:10px;margin-top:12px;padding:9px 12px;border-radius:9px;background:rgba(31,158,79,.12);border:1px solid rgba(31,158,79,.3);color:#187a3d;font-size:12px;z-index:5}',
      '.dsc-toast[data-err="1"]{background:rgba(204,34,34,.09);border-color:rgba(204,34,34,.3);color:#b02020}',
      '.dsc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:10px}',
      '.dsc-stat{border:1px solid var(--dsw-alias-border-primary,#eceef2);border-radius:9px;padding:10px 12px}',
      '.dsc-stat b{display:block;font-size:18px;line-height:1.3}',
      '.dsc-stat span{font-size:11.5px;color:var(--dsw-alias-text-secondary,#6b7280)}',
    ].join('');

    function ensureCss() {
      try {
        if (document.getElementById(STYLE_ID)) return;
        const el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = CSS;
        document.head.appendChild(el);
      } catch {
        /* 样式注入失败不影响功能 */
      }
    }

    async function api(path) {
      try {
        const res = await fetch(API + path, { cache: 'no-store' });
        const json = await res.json();
        if (!json || typeof json !== 'object') return { ok: false, error: { message: '响应格式异常' } };
        return json;
      } catch (error) {
        return { ok: false, error: { message: '无法连接插件接口：' + (error && error.message ? error.message : String(error)) } };
      }
    }

    function textOf(error) {
      return error && error.message ? error.message : String(error);
    }

    function fmtTime(ms) {
      const n = Number(ms);
      if (!Number.isFinite(n) || n <= 0) return '—';
      try {
        return new Date(n).toLocaleString('zh-CN', { hour12: false });
      } catch {
        return '—';
      }
    }

    /** 额度/积分展示：保留两位小数，超过一百万用 M 简写。 */
    function fmtCredits(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return '—';
      const rounded = Math.round(n * 100) / 100;
      if (Math.abs(rounded) >= 1_000_000) return (rounded / 1_000_000).toFixed(1).replace(/\.0$/u, '') + 'M';
      try {
        return rounded.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
      } catch {
        return String(rounded);
      }
    }

    /** 余额明细（悬停提示）：列出每个有效资源包及其剩余额度。 */
    function balanceDetail(balance) {
      const packages = balance && Array.isArray(balance.packages) ? balance.packages : [];
      const active = packages.filter((item) => item && item.active !== false);
      if (active.length === 0) return '';
      return active
        .map((item) => String(item.name || '额度') + '：' + fmtCredits(item.remaining) + (item.unit === 'token' ? ' token' : ''))
        .join('\n');
    }

    function providerOf(cfg, id) {
      const list = cfg && Array.isArray(cfg.channels) ? cfg.channels : [];
      return list.find((item) => item.id === id) || { id, name: id, org: '', note: '', claim: false };
    }

    /**
     * 渠道包 RPC：与官方前端同一调用路径（connection.rpc → /api channel-pack）。
     * 连接服务可能晚于插件加载就绪，因此每秒探测一次，未就绪时页面给出明确提示。
     */
    function useChannelRpc(ctx) {
      const ctxRef = useRef(ctx);
      ctxRef.current = ctx;
      const readTransport = useCallback(() => {
        const current = ctxRef.current;
        let connection;
        try {
          connection = current && current.connection;
        } catch {
          connection = undefined;
        }
        if (!connection) {
          try {
            connection = current && current.get ? current.get('connection') : undefined;
          } catch {
            connection = undefined;
          }
        }
        try {
          const call = connection && connection.rpc && connection.rpc.call;
          return typeof call === 'function' ? { connection, call } : null;
        } catch {
          return null;
        }
      }, []);
      const [transport, setTransport] = useState(readTransport);
      useEffect(() => {
        let alive = true;
        const check = () => {
          if (!alive) return;
          const next = readTransport();
          setTransport((previous) => {
            if (previous === next) return previous;
            if (previous && next && previous.connection === next.connection && previous.call === next.call) return previous;
            return next;
          });
        };
        const timer = setInterval(check, 1000);
        return () => {
          alive = false;
          clearInterval(timer);
        };
      }, [readTransport]);

      const rpc = useCallback(async (method, payload, timeoutMs) => {
        const latest = readTransport();
        if (latest === null) throw new Error('渠道引擎尚未连接（connection 服务未就绪）');
        const controller = new AbortController();
        const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60_000;
        const timer = setTimeout(() => controller.abort(), ms);
        try {
          const result = await latest.call.call(latest.connection.rpc, '/api', 'channel-pack', { method, payload }, controller.signal);
          if (result && result.ok === true) return result.value;
          if (result && result.ok === false) {
            const reason = result.error && (result.error.message || result.error.code);
            throw new Error(reason || '渠道引擎拒绝了该请求');
          }
          return result;
        } catch (error) {
          if (error && error.name === 'AbortError') throw new Error('请求超时（渠道引擎没有在限定时间内响应）');
          throw error;
        } finally {
          clearTimeout(timer);
        }
      }, [readTransport]);
      return { available: transport !== null, rpc };
    }

    function Badge(props) {
      return h('span', { className: 'dsc-pill', 'data-t': props.tone || 'off' }, props.children);
    }

    function Panel(props) {
      const { ctx } = props;
      const { available, rpc } = useChannelRpc(ctx);

      const [boot, setBoot] = useState({ status: 'loading', cfg: null, error: '' });
      const [auto, setAuto] = useState(undefined);
      const [accounts, setAccounts] = useState({});
      const [balances, setBalances] = useState({});
      const [models, setModels] = useState({});
      const [expanded, setExpanded] = useState('');
      const [busy, setBusy] = useState('');
      const [toast, setToast] = useState(null);
      const loginRef = useRef({ accountId: '', startedAt: 0, timer: null });

      const showToast = useCallback((message, isError) => {
        setToast({ message: String(message || ''), error: isError === true, at: Date.now() });
      }, []);

      useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(null), 4200);
        return () => clearTimeout(timer);
      }, [toast]);

      const cfg = boot.cfg;
      const channels = cfg && Array.isArray(cfg.channels) ? cfg.channels : [];

      const loadAuto = useCallback(async () => {
        if (!available) return;
        try {
          const value = await rpc('usage.autoCheckin', {}, 30_000);
          setAuto(value && value.autoCheckin ? value.autoCheckin : null);
        } catch {
          setAuto(null);
        }
      }, [available, rpc]);

      /** 单渠道余额：逐账号剩余积分/额度（credits.balances）。 */
      const loadBalances = useCallback(async (provider, force) => {
        if (!available) return;
        setBalances((previous) => ({ ...previous, [provider]: { status: 'loading', rows: [] } }));
        try {
          const value = await rpc(
            'credits.balances',
            { provider, ...(force === true ? { force: true } : {}) },
            90_000,
          );
          const rows = value && Array.isArray(value.accounts) ? value.accounts : [];
          setBalances((previous) => ({ ...previous, [provider]: { status: 'ready', rows } }));
        } catch (error) {
          setBalances((previous) => ({ ...previous, [provider]: { status: 'error', rows: [], error: textOf(error) } }));
        }
      }, [available, rpc]);

      const loadAccounts = useCallback(async () => {
        if (!available) return;
        const list = cfg && Array.isArray(cfg.channels) ? cfg.channels : [];
        const next = {};
        await Promise.all(list.map(async (channel) => {
          try {
            const value = await rpc('account.list', { provider: channel.id }, 30_000);
            next[channel.id] = Array.isArray(value && value.accounts) ? value.accounts : [];
          } catch (error) {
            next[channel.id] = { error: textOf(error) };
          }
        }));
        setAccounts(next);
        setBalances((previous) => {
          let changed = false;
          const clean = { ...previous };
          for (const channel of list) {
            const rows = next[channel.id];
            if (!Array.isArray(rows) || rows.length === 0) {
              if (Object.prototype.hasOwnProperty.call(clean, channel.id)) {
                delete clean[channel.id];
                changed = true;
              }
            }
          }
          return changed ? clean : previous;
        });
        for (const channel of list) {
          const rows = next[channel.id];
          if (Array.isArray(rows) && rows.length > 0) void loadBalances(channel.id);
        }
      }, [available, rpc, cfg, loadBalances]);

      useEffect(() => {
        let alive = true;
        api('config')
          .then((res) => {
            if (!alive) return;
            if (!res.ok) {
              setBoot({ status: 'error', cfg: null, error: (res.error && res.error.message) || '配置接口不可用' });
              return;
            }
            setBoot({ status: 'ready', cfg: { ...res.data, meta: res.meta || null }, error: '' });
          })
          .catch((error) => {
            if (alive) setBoot({ status: 'error', cfg: null, error: textOf(error) });
          });
        return () => {
          alive = false;
        };
      }, []);

      useEffect(() => {
        if (!cfg || !available) return;
        void loadAuto();
        void loadAccounts();
      }, [cfg, available, loadAuto, loadAccounts]);

      // 余额会随别处调用模型而变化：页面停留时每 90 秒静默刷新一次。
      useEffect(() => {
        if (!cfg || !available) return undefined;
        const timer = setInterval(() => {
          for (const channel of channels) {
            const rows = accounts[channel.id];
            if (Array.isArray(rows) && rows.length > 0) void loadBalances(channel.id);
          }
        }, 90_000);
        return () => clearInterval(timer);
      }, [cfg, available, channels, accounts, loadBalances]);

      useEffect(() => () => {
        const login = loginRef.current;
        if (login.timer) clearInterval(login.timer);
      }, []);

      async function setAutoEnabled(enabled) {
        if (!available) return showToast('渠道引擎尚未就绪', true);
        setBusy('auto');
        try {
          await rpc('usage.autoCheckin', { enabled: enabled === true }, 30_000);
          await loadAuto();
          showToast(enabled ? '已开启每日自动签到' : '已关闭每日自动签到');
        } catch (error) {
          showToast('保存失败：' + textOf(error), true);
        } finally {
          setBusy('');
        }
      }

      async function runCheckin() {
        if (!available) return showToast('渠道引擎尚未就绪', true);
        const list = channels.filter((channel) => channel.claim === true);
        setBusy('checkin');
        const lines = [];
        for (const channel of list) {
          const bucket = accounts[channel.id];
          const rows = Array.isArray(bucket) ? bucket : [];
          if (rows.length === 0) {
            lines.push(channel.name + '：未登录，跳过');
            continue;
          }
          try {
            const value = await rpc('credits.claimAll', { provider: channel.id }, 120_000);
            const summary = (value && value.summary) || {};
            const parts = [];
            if (summary.claimed > 0) parts.push('领取 ' + summary.claimed);
            if (summary.alreadyClaimed > 0) parts.push('今日已领 ' + summary.alreadyClaimed);
            if (summary.failed > 0) parts.push('失败 ' + summary.failed);
            if (summary.coversToday > 0 && parts.length === 0) parts.push('今日已处理');
            lines.push(channel.name + '：' + (parts.length ? parts.join('，') : '没有可领取的账号'));
          } catch (error) {
            lines.push(channel.name + '：失败（' + textOf(error) + '）');
          }
        }
        await loadAuto();
        await loadAccounts();
        for (const channel of list) {
          const bucket = accounts[channel.id];
          if (Array.isArray(bucket) && bucket.length > 0) void loadBalances(channel.id, true);
        }
        setBusy('');
        showToast(lines.join('；') || '没有可签到的渠道');
      }

      function stopLoginPoll() {
        const login = loginRef.current;
        if (login.timer) clearInterval(login.timer);
        login.timer = null;
        login.accountId = '';
      }

      async function pollLogin(accountId, provider) {
        stopLoginPoll();
        loginRef.current.accountId = accountId;
        loginRef.current.startedAt = Date.now();
        loginRef.current.timer = setInterval(async () => {
          const login = loginRef.current;
          if (login.accountId !== accountId) return;
          if (Date.now() - login.startedAt > (cfg && cfg.limits ? cfg.limits.loginPollMaxMs : 300_000)) {
            stopLoginPoll();
            showToast('登录等待超时，可稍后在账号列表点「刷新」', true);
            return;
          }
          try {
            const value = await rpc('login.poll', { accountId }, 20_000);
            if (value && value.done === true) {
              stopLoginPoll();
              await loadAccounts();
              if (provider) void loadBalances(provider);
              showToast(value.success === true ? '登录成功' : '登录未完成：' + (value.error || '请重试'), value.success !== true);
            }
          } catch {
            /* 单次轮询失败不终止，等下一轮 */
          }
        }, (cfg && cfg.limits ? cfg.limits.loginPollMs : 2_500));
      }

      async function login(provider) {
        if (!available) return showToast('渠道引擎尚未就绪', true);
        setBusy('login:' + provider);
        try {
          const value = await rpc('account.create', { provider }, 120_000);
          const accountId = value && value.accountId ? value.accountId : '';
          const url = value && value.loginUrl ? value.loginUrl : '';
          const mode = value && value.loginMode ? value.loginMode : 'url';
          if (mode === 'sms') {
            showToast('该渠道需要短信验证码，请在原版渠道面板完成登录后回到本页刷新', true);
          } else if (url) {
            try {
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch {
              /* 弹窗被拦截时，页面仍显示轮询状态 */
            }
            showToast('已打开登录页，完成授权后会自动刷新');
          } else {
            showToast('已在渠道端发起登录，请按提示完成');
          }
          if (accountId) void pollLogin(accountId, provider);
          await loadAccounts();
        } catch (error) {
          showToast('发起登录失败：' + textOf(error), true);
        } finally {
          setBusy('');
        }
      }

      async function removeAccount(account) {
        if (!available) return;
        const label = account.nickname || account.id;
        let confirmed = false;
        try {
          confirmed = window.confirm('确定删除账号「' + label + '」吗？删除后需要重新登录。');
        } catch {
          confirmed = true;
        }
        if (!confirmed) return;
        setBusy('remove:' + account.id);
        try {
          await rpc('account.delete', { accountId: account.id }, 30_000);
          await loadAccounts();
          showToast('已删除账号 ' + label);
        } catch (error) {
          showToast('删除失败：' + textOf(error), true);
        } finally {
          setBusy('');
        }
      }

      async function toggleAccount(account) {
        if (!available) return;
        setBusy('toggle:' + account.id);
        try {
          await rpc('account.update', { accountId: account.id, patch: { enabled: account.enabled === false } }, 30_000);
          await loadAccounts();
        } catch (error) {
          showToast('操作失败：' + textOf(error), true);
        } finally {
          setBusy('');
        }
      }

      async function loadModels(provider) {
        if (!available) return;
        setBusy('models:' + provider);
        try {
          const value = await rpc('model.list', { provider }, 60_000);
          setModels((previous) => ({ ...previous, [provider]: Array.isArray(value && value.models) ? value.models : [] }));
        } catch (error) {
          setModels((previous) => ({ ...previous, [provider]: { error: textOf(error) } }));
        } finally {
          setBusy('');
        }
      }

      async function toggleModel(provider, model) {
        if (!available) return;
        setBusy('model:' + model.id);
        try {
          await rpc('model.setDisabled', { provider, modelId: model.id, disabled: model.disabled !== true }, 30_000);
          await loadModels(provider);
        } catch (error) {
          showToast('模型开关失败：' + textOf(error), true);
        } finally {
          setBusy('');
        }
      }

      if (boot.status === 'loading') {
        return h('div', { className: 'dsc-root' }, h('div', { className: 'dsc-empty' }, '正在读取插件配置…'));
      }
      if (boot.status === 'error') {
        return h('div', { className: 'dsc-root' },
          h('div', { className: 'dsc-head' }, h('div', { className: 'dsc-title' }, '每日签到 · 免费模型')),
          h('div', { className: 'dsc-err' }, '配置接口不可用：' + boot.error));
      }

      const packState = cfg && cfg.meta && cfg.meta.pack ? cfg.meta.pack : null;
      const whitelist = cfg && cfg.meta && cfg.meta.whitelist ? cfg.meta.whitelist : null;
      const autoChannels = auto && Array.isArray(auto.channels) ? auto.channels : [];
      const channelText = (provider) => {
        const hit = autoChannels.find((item) => item.provider === provider);
        return hit && hit.text ? hit.text : '';
      };
      const totalAccounts = channels.reduce((sum, channel) => {
        const rows = accounts[channel.id];
        return sum + (Array.isArray(rows) ? rows.length : 0);
      }, 0);

      return h('div', { className: 'dsc-root' },
        h('div', { className: 'dsc-head' },
          h('div', null,
            h('div', { className: 'dsc-title' }, cfg.title || '每日签到 · 免费模型'),
            h('div', { className: 'dsc-sub' }, 'v' + (cfg.version || '') + ' · 适配 DSH ' + (cfg.testedDsh || '') + ' · 只保留签到渠道')),
          h('div', { className: 'dsc-spacer' }),
          packState && packState.state === 'ready'
            ? h(Badge, { tone: 'ok' }, '渠道引擎就绪')
            : packState && packState.state === 'failed'
              ? h(Badge, { tone: 'bad' }, '渠道引擎失败')
              : h(Badge, { tone: 'warn' }, '渠道引擎启动中'),
          available ? h(Badge, { tone: 'ok' }, '已连接') : h(Badge, { tone: 'warn' }, '等待连接')),

        packState && packState.state === 'failed'
          ? h('div', { className: 'dsc-err' }, '渠道引擎加载失败：' + (packState.error || '未知原因') + '。签到与模型功能不可用，请检查 DSH 版本与插件安装是否完整。')
          : null,

        !available
          ? h('div', { className: 'dsc-warn' }, '连接服务尚未就绪。请确认当前是 DSH Web / 桌面端 profile，并等待几秒后刷新。')
          : null,

        h('div', { className: 'dsc-card' },
          h('h3', null, '每日自动签到',
            h('span', { className: 'dsc-sub' }, '默认开启，每天（UTC+8）只跑一次')),
          h('div', { className: 'dsc-row' },
            h('label', { className: 'dsc-switch' },
              h('input', {
                type: 'checkbox',
                checked: !!(auto && auto.enabled !== false),
                disabled: !available || busy === 'auto',
                onChange: (event) => void setAutoEnabled(event.target.checked),
              }),
              h('span', null, auto && auto.enabled !== false ? '已开启' : '已关闭')),
            h('div', { className: 'dsc-spacer' }),
            h('button', {
              className: 'dsc-btn',
              'data-v': 'primary',
              disabled: !available || busy === 'checkin',
              onClick: () => void runCheckin(),
            }, busy === 'checkin' ? '签到中…' : '立即签到')),
          h('div', { className: 'dsc-grid' },
            h('div', { className: 'dsc-stat' }, h('b', null, (auto && auto.lastDate) || '—'), h('span', null, '上次签到日期')),
            h('div', { className: 'dsc-stat' }, h('b', null, String(totalAccounts)), h('span', null, '已登录账号')),
            h('div', { className: 'dsc-stat' }, h('b', null, String(channels.length)), h('span', null, '签到渠道'))),
          auto && auto.lastResult ? h('div', { className: 'dsc-note' }, '上次结果：' + auto.lastResult + (auto.lastAt ? '（' + fmtTime(auto.lastAt) + '）' : '')) : null,
          autoChannels.length
            ? h('div', { className: 'dsc-chips' }, autoChannels.map((item) => h('span', { className: 'dsc-chip', key: item.provider }, providerOf(cfg, item.provider).name + '：' + item.text)))
            : null),

        h('div', { className: 'dsc-card' },
          h('h3', null, '签到渠道与免费模型',
            h('span', { className: 'dsc-sub' }, '模型由渠道原生适配器提供，调用即消耗该渠道账号额度')),
          channels.length === 0 ? h('div', { className: 'dsc-empty' }, '没有可用渠道') : null,
          channels.map((channel) => {
            const bucket = accounts[channel.id];
            const rows = Array.isArray(bucket) ? bucket : [];
            const failed = bucket && !Array.isArray(bucket) ? bucket.error : '';
            const isOpen = expanded === channel.id;
            const modelBucket = models[channel.id];
            const modelRows = Array.isArray(modelBucket) ? modelBucket : [];
            const balanceBucket = balances[channel.id];
            const balanceRows = balanceBucket && Array.isArray(balanceBucket.rows) ? balanceBucket.rows : [];
            const knownBalances = balanceRows.filter((row) => row && row.balance && Number.isFinite(row.balance.total));
            const totalBalance = knownBalances.reduce((sum, row) => sum + row.balance.total, 0);
            const balanceLoading = balanceBucket && balanceBucket.status === 'loading';
            return h('div', { className: 'dsc-channel', key: channel.id },
              h('div', { className: 'dsc-channel-head' },
                h('div', { className: 'dsc-badge', style: { background: 'linear-gradient(135deg,#6b5ae6,#8d7bf0)' } }, String(channel.name || channel.id).slice(0, 2)),
                h('div', { className: 'dsc-main' },
                  h('div', { className: 'dsc-name' }, channel.name + ' ', h('span', { className: 'dsc-sub' }, channel.org || '')),
                  h('div', { className: 'dsc-sub' }, channel.note || '')),
                rows.length > 0 ? h(Badge, { tone: 'ok' }, rows.length + ' 个账号') : h(Badge, { tone: 'off' }, '未登录'),
                channelText(channel.id) ? h(Badge, { tone: 'warn' }, channelText(channel.id)) : null,
                knownBalances.length > 0
                  ? h('span', { className: 'dsc-credit', title: '已查询 ' + knownBalances.length + ' 个账号' }, '剩余积分 ' + fmtCredits(totalBalance))
                  : balanceLoading ? h('span', { className: 'dsc-sub' }, '余额查询中…') : null,
                h('button', {
                  className: 'dsc-btn',
                  'data-v': 'primary',
                  disabled: !available || busy === 'login:' + channel.id,
                  onClick: () => void login(channel.id),
                }, busy === 'login:' + channel.id ? '登录中…' : '登录'),
                h('button', {
                  className: 'dsc-btn',
                  disabled: !available,
                  onClick: () => {
                    if (isOpen) {
                      setExpanded('');
                      return;
                    }
                    setExpanded(channel.id);
                    if (models[channel.id] === undefined) void loadModels(channel.id);
                  },
                }, isOpen ? '收起' : '账号与模型')),

              failed ? h('div', { className: 'dsc-err' }, '读取账号失败：' + failed) : null,

              isOpen
                ? h('div', { className: 'dsc-accounts' },
                  rows.length === 0
                    ? h('div', { className: 'dsc-empty' }, '还没有账号。点上方「登录」完成授权后会自动出现。')
                    : rows.map((account) => h('div', { className: 'dsc-account', key: account.id },
                      h('div', { className: 'dsc-main' },
                        h('div', null, h('b', null, account.nickname || account.id), ' ',
                          account.enabled === false ? h(Badge, { tone: 'off' }, '已停用') : h(Badge, { tone: 'ok' }, '启用中')),
                        h('div', { className: 'dsc-mono' }, account.id + (account.expiresAt ? ' · 到期 ' + fmtTime(account.expiresAt) : '')),
                        (() => {
                          if (!balanceBucket) return null;
                          if (balanceLoading) return h('div', { className: 'dsc-sub' }, '余额查询中…');
                          if (balanceBucket.status === 'error') return h('div', { className: 'dsc-sub' }, '余额不可用');
                          const entry = balanceRows.find((row) => row && row.accountId === account.id);
                          if (!entry) return null;
                          if (entry.balance && Number.isFinite(entry.balance.total)) {
                            return h('div', { style: { marginTop: '4px' } },
                              h('span', { className: 'dsc-credit', title: balanceDetail(entry.balance) || '' }, '剩余积分 ' + fmtCredits(entry.balance.total)));
                          }
                          return h('div', { className: 'dsc-sub' }, '余额查询失败' + (entry.error ? '：' + entry.error : ''));
                        })()),
                      h('button', {
                        className: 'dsc-btn',
                        'data-v': 'ghost',
                        disabled: busy === 'toggle:' + account.id,
                        onClick: () => void toggleAccount(account),
                      }, account.enabled === false ? '启用' : '停用'),
                      h('button', {
                        className: 'dsc-btn',
                        'data-v': 'danger',
                        disabled: busy === 'remove:' + account.id,
                        onClick: () => void removeAccount(account),
                      }, '删除'))),
                  h('div', { className: 'dsc-row', style: { marginTop: '8px' } },
                    h('button', {
                      className: 'dsc-btn',
                      disabled: !available,
                      onClick: () => void loadModels(channel.id),
                    }, busy === 'models:' + channel.id ? '刷新中…' : '刷新模型列表'),
                    h('button', {
                      className: 'dsc-btn',
                      disabled: !available,
                      onClick: () => void loadAccounts(),
                    }, '刷新账号'),
                    h('button', {
                      className: 'dsc-btn',
                      disabled: !available || balanceLoading,
                      onClick: () => void loadBalances(channel.id, true),
                    }, balanceLoading ? '余额查询中…' : '刷新余额')),
                  modelBucket && !Array.isArray(modelBucket) ? h('div', { className: 'dsc-err' }, '读取模型失败：' + modelBucket.error) : null,
                  modelRows.length === 0
                    ? h('div', { className: 'dsc-empty' }, '暂无模型数据（登录后点「刷新模型列表」）')
                    : h('div', { className: 'dsc-models' }, modelRows.map((model) => h('div', { className: 'dsc-model', key: model.id },
                      h('input', {
                        type: 'checkbox',
                        checked: model.disabled !== true,
                        disabled: busy === 'model:' + model.id,
                        onChange: () => void toggleModel(channel.id, model),
                      }),
                      h('div', { className: 'dsc-grow', title: model.id }, model.name || model.id),
                      model.dead === true ? h(Badge, { tone: 'bad' }, '已下线') : null,
                      h('span', { className: 'dsc-mono' }, model.id)))))
                : null);
          })),

        h('div', { className: 'dsc-card' },
          h('h3', null, '说明'),
          h('div', { className: 'dsc-note' },
            '免费模型只来自上方的签到渠道：模型由各渠道原生适配器提供，请求使用该渠道已登录账号的额度；没有账号就无法调用。插件不提供匿名免费车道、EAC 协付、Kilo 免费池、聚合渠道或降级路由。'),
          cfg && Array.isArray(cfg.blocked)
            ? h('div', { className: 'dsc-sub', style: { marginTop: '8px' } },
              '已移除：' + cfg.blocked.map((item) => item.name + '（' + item.reason + '）').join('、'))
            : null,
          whitelist && whitelist.closed && whitelist.closed.length
            ? h('div', { className: 'dsc-sub', style: { marginTop: '6px' } }, '已关闭渠道：' + whitelist.closed.join('、'))
            : null,
          h('div', { className: 'dsc-sub', style: { marginTop: '6px' } },
            '签到记录保存在 DSH 数据目录的 channel-pack/auto-checkin.json；账号凭据由宿主凭据库加密保存。')),

        toast ? h('div', { className: 'dsc-toast', 'data-err': toast.error ? '1' : '0' }, toast.message) : null);
    }

    function apply(ctx) {
      try {
        ensureCss();
        const slots = ctx && ctx.slots;
        if (!slots) return;
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: NS, order: 34, label: '每日签到' },
          (props) => h(Panel, { ...props, ctx }),
        ));
      } catch (error) {
        try {
          console.warn('[daily-checkin] client degraded: ' + ((error && error.message) || error));
        } catch {
          /* ignore */
        }
      }
    }

    return { inject: ['slots'], apply };
  },
});
