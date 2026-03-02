# AutoBioInterview

一个面向科研访谈场景的双端系统：

- 发起者端（Researcher）：上传邀请函，AI 生成访谈模板，查看会话与总结，导出内容。
- 受访者端（Participant）：通过邀请链接进入访谈，同意一次后可持续续聊，刷新不丢进度。

> 当前仓库仅保留一个运行版本：`uvicorn app:app ...`。  
> 研究者端与受访者端共用同一套当前产品代码与数据链路。

## 核心能力

1. 发起者账号体系
- 邮箱 + 密码注册登录
- Cookie 会话维持登录状态

2. 项目化访谈管理
- 创建项目时粘贴邀请函（如原始 `readme` 内容）
- AI 自动生成 6 阶段访谈模板（daily/evolution/experience/difficulty/impact/wrapup）
- 自动生成受访链接：`/participant/{invite_code}`

3. 受访者友好体验
- 邀请链接进入，无需账号密码
- 通过服务端 cookie 自动恢复会话
- 已同意后刷新页面不会重复同意
- 中途离开后可继续访谈

4. 公共示例项目（便于学习与测试）
- 系统会自动创建一个公开示例项目（中国传媒大学访谈样例）
- 所有研究者账号都可查看该示例项目、会话内容与导出结果
- 示例受访者链接：`/participant/sample`

4. 数据留存与导出
- 对话、阶段进度、总结全部入库
- 发起者可导出单会话 JSON/TXT

## 技术栈

- FastAPI
- SQLite（默认，后续可迁移 PostgreSQL）
- OpenAI Python SDK（配置为豆包 Ark 兼容接口）

## 目录结构

```text
app.py
autobio_app/
  app_factory.py
  config.py
  db.py
  llm.py
  prompts.py
  security.py
  routers/
    auth.py
    researcher.py
    participant.py
    participant_compat.py
  services/
    researcher.py
    participant.py
static/
  researcher.html
  researcher.js
  participant.html
  app.js
  participant.css
  styles.css
```

## 环境变量

在 `.env` 中设置：

```env
ARK_API_KEY=你的豆包兼容 key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 可选：/model-config 可选模型列表（建议包含 mini/lite/pro）
ARK_MODEL_CHOICES=doubao-seed-2-0-mini-260215,doubao-seed-2-0-lite-260215,doubao-seed-2-0-pro-260215

# 启动时的初始生效模型（系统不会在失败时自动切模型重试）
MODEL_ORCH=doubao-seed-2-0-mini-260215
MODEL_WRITE=doubao-seed-2-0-lite-260215

# 兼容旧命名（可选）：等价于上面的初始模型别名
# ARK_MODEL_DEFAULT=doubao-seed-2-0-mini-260215
# ARK_MODEL_FALLBACK=doubao-seed-2-0-lite-260215

DB_PATH=./interviews.db
```

可直接复制：`cp .env.example .env`

## 本地运行

```bash
uvicorn app:app --host 0.0.0.0 --port 8002 --reload
```

访问：

- 发起者控制台: `http://127.0.0.1:8002/researcher`
- 受访者页面: `http://127.0.0.1:8002/participant/{invite_code}`
- 示例受访者页面: `http://127.0.0.1:8002/participant/sample`

健康检查（含模型与 key 读取状态）：
- `http://127.0.0.1:8002/healthz`

## 主要 API

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Researcher
- `GET /api/researcher/projects`
- `POST /api/researcher/projects`
- `GET /api/researcher/projects/{project_id}`
- `GET /api/researcher/sessions/{session_id}`
- `GET /api/researcher/sessions/{session_id}/export?fmt=json|txt`

### Participant
- `POST /api/participant/join`
- `GET /api/participant/state`
- `POST /api/participant/consent`
- `POST /api/participant/message`
- `POST /api/participant/advance`
- `POST /api/participant/summary`

### Participant Web（受访者页面内部调用）
- `GET /model-config`
- `POST /model-config`
- `POST /interviews`
- `POST /consent`
- `POST /messages`
- `POST /next`
- `POST /skip`
- `POST /advance-stage`
- `POST /finalize`
- `POST /revise-final`
- `POST /approve-final`
- `GET /export`

## 生产部署建议

1. 数据库迁移到 PostgreSQL
2. `secure=True` Cookie + HTTPS 域名
3. 接入 Nginx + Uvicorn/Gunicorn
4. 增加审计日志备份与导出权限控制
5. 发起者账号可接学校统一认证（SSO/OAuth）
