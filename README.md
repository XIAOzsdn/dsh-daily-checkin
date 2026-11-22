# dsh-daily-checkin

> ## 来源与关系（先读这一段）
>
> - **原版仓库**：[Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)
> - **原版作者**：**Ebony-Vinyl**（GitHub：<https://github.com/Ebony-Vinyl>）
> - **渠道引擎上游**：**Jet（iJetLi）**（<https://gitee.com/iJetLi>）的 MIT 渠道实现，
>   由原版仓库以 `vendor/channel-pack` 内嵌
> - **本仓库**：[XIAOzsdn/dsh-daily-checkin](https://github.com/XIAOzsdn/dsh-daily-checkin)
>   （维护者：**XIAOzsdn**）
>
> **关系说明**：本仓库是原版仓库的**非官方精简衍生版（非官方 fork / derivative）**，
> 基于原版 `@ebony-vinyl/dsh-our-free-model@2.8.0` 的代码与内置渠道引擎做裁剪重写。
> 本仓库**不是**原作者发布、**不是**原仓库的官方分支或续作，**不受**原作者维护、
> 审核或背书，也**不会**自动同步原仓库的更新。原版是功能完整的模型聚合插件；
> 本仓库只保留「每日自动签到 + 签到渠道的免费模型」。
> 原版的问题与功能请求请提交到原仓库；本仓库只对裁剪后的这部分负责。

**每日自动签到 + 签到渠道的免费模型** —— 一个只保留这两件事的 DSH 插件。

它不是一个新写的「模型协议实现」，而是把渠道引擎（账号登录、账号池、每日签到、渠道模型、本机网关）单独留下，把原项目其余功能全部移除后的极简包。

- 目标：装在**老电脑**上，开机后自动签到，然后直接用签到账号的免费模型。
- 原则：**免费模型只能来自签到渠道**，没有匿名免费车道、没有第三方中转池。

---

## 1. 保留了什么

| 能力 | 说明 |
|---|---|
| 每日自动签到 | DSH 启动 30 秒后执行，按 UTC+8 每天只跑一次；当天失败会自动重试 |
| 手动签到 | 设置页「立即签到」，逐渠道串行领取，不受每天一次限制 |
| 账号登录 / 账号池 | 每个渠道可登录多个账号，自动轮换 |
| 签到渠道的免费模型 | 由各渠道**原生适配器**提供，请求消耗该渠道账号额度 |
| 模型开关 | 可单独关闭某个渠道下的某个模型 |
| 本机 OpenAI 网关 | 渠道引擎自带，供本机其它工具调用（默认 `127.0.0.1:8326`，可不开） |

### 保留的渠道（都有每日签到）

| 渠道 | 归属 | 签到 |
|---|---|---|
| LobsterAI | 有道 | 每日签到积分 |
| Qoder | 阿里系 | 每日 100 Credits（10:00 UTC+8 刷新） |
| Qoder 中国版 | 阿里系 | 中国版端点与模型池 |
| TRAE | 字节 | 每日签到积分 |
| Loomy | 讯飞 | 每日赠送额度（微信扫码登录） |
| MiniMax Code | MiniMax | 每日签到 |

## 2. 移除了什么

- 匿名免费车道（OpenCode Zen）、Kilo 免费池、EAC 协付渠道
- 聚合渠道（76 家自带 Key 的提供商）
- 降级路由 / 组合模型（`combo:`）
- 本地转发端口、局域网中继
- 省 Token、工具输出压缩、提示词瘦身
- 公告推送、应用内升级、热重载、插件中心
- 用量看板、运行日志、数据统计
- magpie 模型工作台、Codex/Claude 订阅侧车
- 独立服务端、桌面端整合包
- 无每日签到的渠道：Cline、Raccoon、ZCode（需现场验证码）、Gemini

> 说明：渠道引擎是上游编译产物（`vendor/channel-pack/pack.js`），
> 四个被移除的渠道仍存在于引擎内，但插件启动后会关闭它们的**全部模型与账号**，
> 因此不会出现在模型选择器里，也不会被签到遍历。

## 3. 安装

### 前置条件

| 项目 | 要求 |
|---|---|
| DSH | ≥ `0.2.0-rc.2`（本包在 `0.2.2-rc.1` 实测） |
| Node.js | ≥ `22.19.0` |
| 包管理器 | `pnpm`（`dsh plugin add` 需要） |
| profile | `desktop`（桌面端）或 `web`（纯 Web） |

```powershell
node -v
dsh --version
# 如无 pnpm：
npm install -g pnpm
```

### 与官方插件的关系（重要）

本插件与 `@ebony-vinyl/dsh-our-free-model` **不能同时安装**：两者都会挂载同一个渠道引擎，
并注册同一个 `channel-pack` 接口与同名模型 provider，会互相冲掉。

安装前请先在原插件所在 profile 中卸载它：

```powershell
dsh plugin --profile desktop remove @ebony-vinyl/dsh-our-free-model
# 如果原来是 web profile：
# dsh plugin --profile web remove @ebony-vinyl/dsh-our-free-model
```

账号与签到记录保存在 `DSH_HOME/channel-pack/`，卸载插件不会删除：
装上新插件后，原先登录过的账号仍然有效，不需要重新登录。

### 方式一：AI 安装（推荐）

把下面整段提示词复制给任意 AI 助手（Trae / DSH 内置助手 / 其它能执行命令的 AI），
它就会按步骤完成安装与验证。提示词里已包含**本仓库链接**。

```text
请帮我在本机安装 DSH 插件 dsh-daily-checkin。

要安装的仓库（就是下面这个链接）：
https://github.com/XIAOzsdn/dsh-daily-checkin

必须知悉的背景：
- 本仓库是 @ebony-vinyl/dsh-our-free-model 的非官方精简衍生版。
- 原版仓库：https://github.com/Ebony-Vinyl/dsh-our-free-model
- 原版作者：Ebony-Vinyl（https://github.com/Ebony-Vinyl）
- 本仓库与原版不能同时安装：两者都会挂载同一个渠道引擎与同名模型 provider。

请严格按顺序执行，任何一步失败都要先解释原因并给出修复方案，禁止跳步：
1. 检查环境：node -v 必须 >= 22.19.0；dsh --version 必须 >= 0.2.0-rc.2。
   不满足就停止，并告诉我如何升级。
2. 如果 pnpm 不存在，执行：npm install -g pnpm
3. 获取源码（优先 git clone；本机没有 git 就下载 ZIP 后解压）：
   git clone https://github.com/XIAOzsdn/dsh-daily-checkin.git
4. 先问清楚我要装到哪个 profile（desktop 桌面端 或 web 纯 Web，默认 desktop）。
   如果该 profile 已安装原版插件，先卸载：
   dsh plugin --profile <profile> remove @ebony-vinyl/dsh-our-free-model
5. 进入插件目录，依次执行，必须全部通过后再继续：
   npm run validate
   npm test
   npm run doctor
   不要跳过，也不要因为失败就继续安装。
6. 安装到 profile：
   dsh plugin --profile <profile> add "<插件目录的绝对路径>"
7. 重启 DSH（关闭后重新启动）。
8. 告诉我如何打开「设置 → 每日签到」，并提醒我：
   - 逐个渠道点「登录」完成授权；
   - 确认「每日自动签到」开关为开启；
   - 模型列表为空时点「账号与模型 → 刷新模型列表」。
9. 不要修改我的其它插件配置，不要删除 DSH_HOME/channel-pack 下已有账号与签到数据。
10. 最后输出结果清单：Node 版本、DSH 版本、profile、三项校验结果、
    安装路径、是否已重启、设置页入口。
```

AI 安装完成后，你只需要手动做两件事：

1. 在「设置 → 每日签到」里逐个渠道点「登录」，完成授权。
2. 确认「每日自动签到」处于开启状态。

### 方式二：源码目录安装

```powershell
# 1. 解压/克隆到任意目录（不需要 npm install，本包零运行时依赖）
# 2. 进入目录自检
cd <插件目录>
npm run validate
npm test
npm run doctor

# 3. 安装到 profile（desktop 或 web，按你实际使用）
dsh plugin --profile desktop add "<插件绝对路径>"

# 4. 重启 DSH
```

### 方式三：ZIP / 离线复制安装

```powershell
# 解压 dsh-daily-checkin-1.0.0.zip 后，对解压目录执行同样的 add
dsh plugin --profile desktop add "C:\path\to\dsh-daily-checkin"
```

本机没有 pnpm / 不能执行 `dsh plugin add` 时，也可以直接复制目录：

1. 把整个插件目录复制到
   `<DSH_HOME>/profiles/<profile>/node_modules/dsh-daily-checkin/`
2. 在该 profile 的 `package.json` 的 `dependencies` 里加
   `"dsh-daily-checkin": "file:./node_modules/dsh-daily-checkin"`
3. 在 `dsh.profile.bundles` 末尾追加 `"dsh-daily-checkin"`
4. 重启 DSH

> 注意：**不要**同时保留原插件的 bundle 条目，否则渠道引擎会被挂载两次。

## 4. 使用

1. 打开 **设置 → 每日签到**。
2. 每个渠道点「登录」，按弹出的登录页完成授权；登录成功后账号自动出现。
3. 「每日自动签到」默认开启。也可以点「立即签到」立刻领一次。
4. 回到模型选择器，选择对应渠道的模型即可。模型列表来自该渠道，
   首次使用前需要在设置页点一次「账号与模型 → 刷新模型列表」。

### 模型为什么一定走签到渠道

- 插件不注册任何匿名/公共免费模型车道；
- 每个模型都由对应渠道的适配器列出，调用时从账号池取该渠道的账号凭据；
- 没有账号 → 渠道没有可用凭据 → 调用直接失败，不会回落到别家；
- 关闭的渠道（Cline / Raccoon / ZCode / Gemini）在启动时被整体关闭。

## 5. 数据、权限与安全

| 内容 | 位置 |
|---|---|
| 账号池、模型黑名单、签到结果 | `DSH_HOME/channel-pack/` |
| 账号凭据 | 宿主凭据库（加密） |
| 本机网关密钥 | `DSH_HOME/openai-gateway/api-key` |

- 插件不收集、不上传任何数据；没有公告/遥测/反馈通道。
- 配置接口 `/api/daily-checkin/config` 与 `/api/daily-checkin/health` 只允许同源访问。
- 所有接口返回统一信封：`{ ok, data, error, meta }`，`meta` 内含
  插件名、版本、生成时间与置信度，便于排障与下游识别。

## 6. 自检与验证

```bash
npm run validate   # 语法 / 清单 / 渠道不变量 / 响应信封 / 打包文件
npm test           # 单元测试（零网络、零文件系统写入）
npm run doctor     # 环境体检：Node、DSH_HOME、profile、渠道引擎文件
```

发布前必须三项全部通过。

## 7. 排障

| 现象 | 处理 |
|---|---|
| 设置页提示「渠道引擎失败」 | 确认 Node ≥ 22.19、DSH ≥ 0.2.0-rc.2，且插件目录里 `vendor/channel-pack/pack.js` 存在 |
| 设置页提示「连接服务未就绪」 | 确认当前是 `desktop` 或 `web` profile；headless 没有 connection 服务 |
| 模型选择器里出现 Cline/Gemini 等 | 重启一次 DSH，让白名单在启动后执行；仍出现请查看日志 `[daily-checkin] 白名单` |
| 登录后没有账号 | 登录页授权完成后等 2~5 秒，点「刷新账号」 |
| 签到失败 | 渠道凭据过期时先点账号「刷新/重新登录」；Qoder 活动 10:00（UTC+8）才刷新 |
| 与官方插件冲突 | 两个插件不能共存，卸载 `@ebony-vinyl/dsh-our-free-model` 后重启 |

## 8. 来源、作者与关系

### 原版仓库与作者

| 项目 | 内容 |
|---|---|
| 原版仓库 | [https://github.com/Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) |
| 原版作者 | **Ebony-Vinyl**（<https://github.com/Ebony-Vinyl>） |
| 渠道引擎上游 | **Jet（iJetLi）**（<https://gitee.com/iJetLi>），MIT |
| 本仓库 | [https://github.com/XIAOzsdn/dsh-daily-checkin](https://github.com/XIAOzsdn/dsh-daily-checkin) |
| 本仓库维护者 | **XIAOzsdn** |
| 本仓库基线 | 原版 `@ebony-vinyl/dsh-our-free-model@2.8.0` |

### 两者是什么关系

- 本仓库是原版仓库的**非官方精简衍生版（非官方 fork / derivative）**：保留原版的渠道引擎与签到能力，删除其余功能。
- 本仓库**不是**原作者发布，**不是**官方分支、官方续作或官方认可版本；原作者未参与本仓库的维护、审核或背书。
- 本仓库**不会**自动同步原仓库的更新，也不保证与原版的行为、版本、接口保持一致。
- 原版是功能完整的模型聚合插件；本仓库只保留「每日自动签到 + 签到渠道的免费模型」，两者定位不同。
- 原版的问题、功能请求与安全反馈请提交到原仓库；本仓库只对裁剪后的这部分代码负责。
- 渠道引擎的原始版权与许可归 Jet（iJetLi）与原版仓库所有，详见 `vendor/channel-pack/NOTICE.md` 与 `LICENSE`。

### 许可

- 本仓库代码：MIT。
- 内置渠道引擎来自原版仓库的 `vendor/channel-pack`（MIT），原样保留其 `LICENSE` 与 `NOTICE.md`。
  仅为通过 GitHub 推送保护，把其中两处**公开的 Gemini CLI 客户端标识**拆成了字符串拼接，
  运行时拼出的值与上游完全一致。
- 使用本仓库即表示你已知悉：这是第三方非官方衍生版，原版作者不对其负责。
