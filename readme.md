# Yunnan Journey Guide

这个仓库当前已经收敛成一个很简单的站点：

- 只保留 `FastAPI + 静态挂载`
- 主页面是云南路线攻略长页
- 主入口是 `/guides/yunnan`

## 当前路由

- `/`：302 跳转到 `/guides/yunnan`
- `/guides/yunnan`：云南路线主页面
- `/static/...`：页面样式与脚本
- `/healthz`：基础健康检查

为避免旧链接直接失效，以下历史入口也会跳到新页面：

- `/researcher`
- `/participant-direct`
- `/participant/sample`
- `/participant/{invite_code}`
- `/m/participant/{invite_code}`

## 页面内容

主页面基于 `云南十天（昆明大理泸沽湖丽江香格里拉）` 的 docx 内容重构，重点包括：

- 11 天路线长卷
- 分阶段筛选与搜索
- 每日卡片展开 / 收起
- 订票时间线
- 行前统一注意事项
- 本地持久化打包清单

## 关键文件

```text
app.py
autobio_app/
  app_factory.py
  config.py
static/
  index.html
  guide/
    yunnan.html
    yunnan.css
    yunnan.js
```

## 运行

```bash
uvicorn app:app --host 0.0.0.0 --port 5000 --reload
```

打开：

- `http://127.0.0.1:5000/guides/yunnan`
- `http://127.0.0.1:5000/healthz`

## 说明

仓库里还保留了一些旧时代码文件，但当前启动链路不再引用它们。现在真正生效的，是新的路由层和 `static/guide/` 这套页面资源。
