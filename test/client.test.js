import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(path.join(ROOT, 'client.js'), 'utf8');

/** 最小 React 桩：只保证组件在首屏（loading 分支）能被同步渲染一次。 */
const react = {
  Fragment: 'Fragment',
  createElement(type, props, ...children) {
    return { type, props: props || {}, children };
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  },
  useEffect() {},
  useRef(value) {
    return { current: value };
  },
  useCallback(fn) {
    return fn;
  },
  useMemo(fn) {
    return fn();
  },
};

function loadClient() {
  let definition;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(def) {
          definition = def;
        },
      },
    },
    document: {
      getElementById() {
        return null;
      },
      createElement() {
        return {};
      },
      head: { appendChild() {} },
    },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ json: async () => ({ ok: true, data: {}, meta: {} }) }),
  };
  vm.runInNewContext(source, sandbox, { filename: 'client.js' });
  assert.ok(definition, 'client.js 没有调用 ModuleLoader.load');
  return definition;
}

test('client.js 能注册到设置页并渲染首屏', () => {
  const definition = loadClient();
  assert.equal(definition.id, 'dsh-daily-checkin');
  assert.equal(typeof definition.factory, 'function');

  let renderFn;
  let injected = '';
  const ctx = {
    slots: {
      inject(name, callback) {
        injected = name;
        callback();
      },
      register(def, render) {
        assert.equal(def.name, 'settings.section');
        assert.equal(def.id, 'dailyCheckin');
        renderFn = render;
        return () => {};
      },
    },
    connection: {},
  };

  const mod = definition.factory((spec) => {
    if (spec === 'react') return react;
    throw new Error('未预期的 require：' + spec);
  });
  assert.equal(mod.inject.join(','), 'slots');
  mod.apply(ctx);
  assert.equal(injected, 'settings.section');
  assert.equal(typeof renderFn, 'function');

  const element = renderFn({});
  assert.equal(typeof element.type, 'function', '渲染入口应返回 Panel 元素');
  const tree = element.type(element.props);
  assert.equal(tree.type, 'div');
  assert.equal(tree.props.className, 'dsc-root');
  assert.ok(JSON.stringify(tree).includes('正在读取插件配置'), '首屏应显示加载提示');
});
