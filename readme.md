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

5. 数据留存与导出
- 对话、阶段进度、总结全部入库
- 发起者可导出单会话 JSON/TXT

## 技术栈

- FastAPI
- SQLite（默认，可后续迁移 PostgreSQL）
- OpenAI Python SDK（配置为豆包 Ark 兼容接口）
- Docker / Docker Compose
- Caddy（反向代理 + HTTPS）

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
deploy/
  caddy/
    Caddyfile.dev
    Caddyfile.prod
Dockerfile
docker-compose.dev.yml
docker-compose.prod.yml
```

## 环境变量

复制模板：

```bash
cp .env.example .env
```

`.env` 至少配置以下项：

```env
ARK_API_KEY=你的豆包兼容key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3

# 生产环境域名（给 Caddy 自动签发 HTTPS 证书）
APP_DOMAIN=your.domain.com

# 可选：开发环境对外端口（默认 5000）
DEV_HTTP_PORT=5000

# 可选：prod uvicorn worker 数（默认 2）
UVICORN_WORKERS=2

# 可选：/model-config 可选模型列表（建议 mini/lite/pro）
ARK_MODEL_CHOICES=doubao-seed-2-0-mini-260215,doubao-seed-2-0-lite-260215,doubao-seed-2-0-pro-260215

# 启动时初始生效模型（失败时不会自动切模型重试）
MODEL_ORCH=doubao-seed-2-0-mini-260215
MODEL_WRITE=doubao-seed-2-0-lite-260215

DB_PATH=./interviews.db
```

## 本地直接运行（非 Docker）

```bash
uvicorn app:app --host 0.0.0.0 --port 5000 --reload
```

访问：

- 发起者控制台: `http://127.0.0.1:5000/researcher`
- 受访者页面: `http://127.0.0.1:5000/participant/{invite_code}`
- 示例受访者页面: `http://127.0.0.1:5000/participant/sample`
- 健康检查: `http://127.0.0.1:5000/healthz`

## Docker 开发模式（热更新）

此模式用于你在服务器或本机上持续改代码，前端/后端改动自动生效。

1. 启动

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

2. 查看日志

```bash
docker compose -f docker-compose.dev.yml logs -f app
docker compose -f docker-compose.dev.yml logs -f caddy
```

3. 访问

- `http://<服务器IP>:${DEV_HTTP_PORT:-5000}/researcher`
- `http://<服务器IP>:${DEV_HTTP_PORT:-5000}/participant/sample`
- `http://<服务器IP>:${DEV_HTTP_PORT:-5000}/healthz`

4. 停止

```bash
docker compose -f docker-compose.dev.yml down
```

说明：
- dev 使用 `uvicorn --reload`。
- 代码目录以 volume 方式挂载到容器，实现热更新。
- 数据库存储在 volume `autobio_dev_data`，不会随容器重建丢失。

## Docker 生产模式（稳定版）

此模式用于长期稳定运行，带 Caddy HTTPS 反向代理。

### 前置条件

1. 服务器已安装 Docker Engine + Docker Compose Plugin。
2. 域名 `APP_DOMAIN` 的 A 记录已指向服务器公网 IP，且 `www`/`m` 子域名也已指向同一 IP（A 或 CNAME）。
3. 服务器放行 `80/443` 端口（防火墙/安全组）。
4. `.env` 中已设置正确的 `APP_DOMAIN` 和 `ARK_API_KEY`。

### 启动 prod

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

检查状态：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy
```

访问：

- `https://<APP_DOMAIN>/researcher`
- `https://<APP_DOMAIN>/participant/sample`
- `https://<APP_DOMAIN>/healthz`

说明：
- app 容器使用 `uvicorn --workers ${UVICORN_WORKERS:-2}`。
- caddy 容器负责反代到 app:8000，并自动申请/续期 HTTPS 证书。
- SQLite 数据在 volume `autobio_prod_data`。
- Caddy 证书与配置在 volume `caddy_data`、`caddy_config`。

## 服务器重启后自动恢复

本项目 compose 已使用 `restart: unless-stopped`，只要 Docker 服务随系统启动，容器会自动拉起。

在 Ubuntu/Debian 上建议执行一次：

```bash
sudo systemctl enable docker
sudo systemctl restart docker
```

验证：

```bash
sudo reboot
# 机器重启后再登录
cd /path/to/AutoBioInterview
docker compose -f docker-compose.prod.yml ps
```

## 升级与回滚

### 升级（拉代码并重建）

```bash
cd /path/to/AutoBioInterview
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### 回滚到某个提交

```bash
cd /path/to/AutoBioInterview
git checkout <commit_sha>
docker compose -f docker-compose.prod.yml up -d --build
```

## 数据备份（SQLite）

1. 找到数据卷名：

```bash
docker volume ls | grep autobio_prod_data
```

2. 导出数据库（示例）：

```bash
mkdir -p backup
docker run --rm \
  -v autobiointerview_autobio_prod_data:/data \
  -v "$PWD/backup":/backup \
  alpine sh -c 'cp /data/interviews.db /backup/interviews-$(date +%F-%H%M%S).db'
```

> `autobiointerview_autobio_prod_data` 这个名字会受目录名影响，以你机器实际 volume 名为准。

## 常用运维命令

```bash
# 查看容器状态
docker compose -f docker-compose.prod.yml ps

# 重启服务
docker compose -f docker-compose.prod.yml restart

# 仅重启 app
docker compose -f docker-compose.prod.yml restart app

# 跟踪日志
docker compose -f docker-compose.prod.yml logs -f --tail=200

# 停止并移除容器（不删 volume）
docker compose -f docker-compose.prod.yml down
```

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
