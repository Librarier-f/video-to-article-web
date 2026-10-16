# 视频转文章 Ubuntu 同机部署

## 范围与资源

首次空库，不迁移本机数据库、截图、Cookie 或密钥。Compose 项目名 `v2a`，只发布 `127.0.0.1:8890`；不占用 ClipRAG/FinAnalyst 的 80/443/3000/8800/8888，不修改宿主机 Nginx。

访问路径：电脑 `http://127.0.0.1:18890` → SSH 隧道 → 服务器 `127.0.0.1:8890` → 前端 Nginx :8080 → 同源 `/api` → 后端 :8000。后续域名 `v2a.fengjiajun.site` 尚未启用。

| 配置 | 含义 |
| --- | --- |
| 后端 | Python 3.12，单 worker，640MiB、1 CPU、128 PID 上限 |
| 前端 | 本机预构建 React，Nginx 96MiB、0.25 CPU、32 PID 上限 |
| MAX_ACTIVE_TASKS=1 | 整个应用最多一个未完成转换，额外提交 429，不创建卡住的排队记录 |
| GENERATION_CONCURRENCY=1 | 每任务最多一个并发模型请求，不等于全局任务数量 |
| v2a_data | 持久化 `/data/app.db` 与 `/data/snapshots`，重建不丢失 |
| 临时空间 | 后端 /tmp 96MiB，用于 Cookie 和 yt-dlp 缓存，不持久化 |
| 日志 | 每容器两个 5MiB 文件，轮转 |

这些是资源上限，不是三套应用同时高负载的容量证明。安装前可用 RAM 至少 900MiB、磁盘至少 3GiB，不足则退出，不自动停其他服务或创建 swap。

后台任务不能跨重启续跑。启动时将未结束任务标为中断失败，保留已发布文章，需要重新提交；不伪装继续运行、不自动重复收费调用。部署必须单 worker。

## 1. 本机构建和上传

交付包已构建时只执行最后一条上传命令；重打包换新文件名。

```powershell
cd D:\SelfMedia\video-to-article-web\frontend
$env:VITE_API_BASE_URL = ""
npm run build
cd ..
.\backend\.venv\Scripts\python.exe deploy\ubuntu\package_release.py --output .deploy\v2a-release.tar.gz
scp ".deploy\v2a-release.tar.gz" ".deploy\v2a-release.tar.gz.sha256" root@117.72.149.6:/tmp/
```

前端必须同源构建，不能请求访客自己的 localhost:8000；不要把密钥放进 VITE 环境变量。归档读取当前工作区，包括未提交新功能，有白名单和逐文件 SHA-256，不包含 `.env`、数据库、截图、Cookie、任务日志、虚拟环境、node_modules 或 Git 元数据。

## 2. Ubuntu 安装

已有 Docker，不重新安装/替换引擎。在服务器执行：

```bash
docker compose version
free -h
df -h /
cd /tmp
sha256sum -c v2a-release.tar.gz.sha256
```

校验 OK 后继续。缺少 Compose 插件时先保留 Docker 版本及报错，按当前安装来源补齐，不能盲目重装 Docker。

```bash
(
set -e
test ! -e /opt/v2a
install -d -m 0755 /opt/v2a
tar -xzf /tmp/v2a-release.tar.gz -C /opt/v2a
cd /opt/v2a
bash deploy/ubuntu/install.sh
)
```

已有 `/opt/v2a` 时停止，避免覆盖。脚本先检查完整性、资源、端口，再顺序构建两个镜像，只启动本项目。前端已构建，服务器不执行 npm 构建。首次拉取官方镜像、安装 FFmpeg 可能较慢；pip 使用清华 PyPI HTTPS 镜像，网络失败按实际 registry/apt/pip 错误处理，不关闭 TLS 校验。

成功标准：两个容器 healthy，`/api/health` 返回 `{"status":"ok"}`，前端 HTTP 200。失败先查：

```bash
cd /opt/v2a
docker compose -f compose.ubuntu.yml ps
docker compose -f compose.ubuntu.yml logs --tail 60 backend frontend
```

依赖与初始空库检查：

```bash
docker compose -f compose.ubuntu.yml exec -T backend node --version
docker compose -f compose.ubuntu.yml exec -T backend ffmpeg -version
docker compose -f compose.ubuntu.yml exec -T backend python -c "import importlib.metadata as m; print('yt-dlp',m.version('yt-dlp')); print('EJS',m.version('yt-dlp-ejs'))"
docker compose -f compose.ubuntu.yml exec -T backend python -c "import sqlite3; db=sqlite3.connect('/data/app.db'); print('articles',db.execute('select count(*) from articles').fetchone()[0])"
```

首次 articles 应为 0；更新保留原卷，不强制清空。

## 3. SSH 访问与 BYOK

电脑新开 PowerShell：

```powershell
ssh -N -L 18890:127.0.0.1:8890 root@117.72.149.6
```

登录后保持窗口，浏览器访问 `http://127.0.0.1:18890`。不需要公开 8890，流量由 SSH 加密；这个本地链接不能分享给面试官。使用相同本地端口，浏览器设置才属于同一个 origin。

本项目在网页设置中配置 Key，不读取 FinAnalyst 的 providers.env。Key 在当前浏览器 localStorage，任务请求临时发送到后端，不写入 Task/Article 表；Cookie 可用于临时文件，随后清理。不复制原电脑凭证，不把真实 Key/Cookie 发给智能体。

先用一个有权访问且确认带字幕的短 B 站视频，快速模式先关闭截图。模型填写账号支持的 ID，例如 `deepseek-flash`，参考 [DeepSeek 官方模型列表](https://api-docs.deepseek.com/quick_start/pricing/)。真实转换会收费，本批离线验证不自动执行。

验收：任务进度和正文正常；进行中第二次提交 429；历史/MD预览/HTML和MD下载正常；再开启截图生成，重启后历史与图片保留；重启中的任务明确标为中断。

不承诺任意视频可解析。项目依赖平台字幕，没有字幕不会自动本地语音识别；Cookie、权限、平台风控和出口影响结果。大陆服务器不能仅凭启动成功承诺 YouTube 可达。后端 Node 22 与 yt-dlp default/EJS 满足当前 JS 挑战运行依赖，不替代网络条件：[yt-dlp 官方说明](https://github.com/yt-dlp/yt-dlp/wiki/EJS)。

## 4. 后续域名和访问范围

DNSPod 添加 `v2a` A 记录指向 `117.72.149.6`。备案及京东云接入/公网条件确认后，为 v2a 单独申请证书；finrag 证书不覆盖 v2a。DNS TXT 挑战记录为 `_acme-challenge.v2a`。手动签发不能自动续期，仍需 DNSPod 自动认证及续期演练。

`deploy/ubuntu/nginx-v2a.conf.example` 仅供后续新增 v2a 的 443 server，不覆盖 FinAnalyst，不修改 ClipRAG。证书不存在时不能启用。本次安装不复制或启用此文件。

当前没有账号登录、资源归属校验或多用户隔离。历史、删除、下载和截图共享；BYOK 不是身份认证。自定义模型地址及通用视频链接存在服务端请求目标风险。本次按本人 SSH 使用交付；公开前需确定内容可公开，并选择统一访问保护或补齐用户隔离，不能宣称已适合不受信任访客的开放服务。

## 5. 备份与更新

卷为 v2a_data。不要运行 `docker compose down -v` 或全局 Docker 清理。等待任务结束，单独停止本项目后端后备份；以下退出时尝试恢复后端，不停止其他项目：

```bash
(
set -e
cd /opt/v2a
install -d -m 0700 /var/backups/v2a
trap 'docker compose -f compose.ubuntu.yml start backend' EXIT
docker compose -f compose.ubuntu.yml stop backend
docker compose -f compose.ubuntu.yml run --rm --no-deps --user 0:0 \
  -v /var/backups/v2a:/backup backend python -c \
  "import os,tarfile,datetime; os.umask(0o077); name='/backup/v2a-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.tar.gz'; f=tarfile.open(name,'w:gz'); f.add('/data',arcname='data'); f.close(); print(name)"
)
```

更新：本机重构建打包、上传校验，先备份数据。完成备份后，进入旧代码目录，等待所有转换结束，再执行下面的维护停止命令，为构建和安装检查释放本项目内存：

```bash
cd /opt/v2a
docker compose -f compose.ubuntu.yml stop
```

它仅停止 v2a 两个容器，不停止 ClipRAG/FinAnalyst，不删除数据卷。然后保存旧 `/opt/v2a` 代码目录，解压新代码并运行安装脚本。项目名仍 v2a，挂载原卷，不导入本机历史；如果其他应用仍使可用内存低于900MiB，先保留检查结果，不强行跳过资源检查。回滚需兼容代码/镜像及对应数据库备份，不盲目覆盖未知结构。

## 6. 排障与验证边界

| 现象 | 检查 |
| --- | --- |
| 拉取镜像失败 | registry/网络，不重装现有 Docker 引擎 |
| unhealthy/502 | compose ps、两个容器日志、/api/health |
| 前端正常但 API 失败 | 同源构建，不能指向访客 localhost:8000 |
| 缺密钥 | 当前浏览器/端口、供应商设置，不是服务器 .env |
| 429 | 当前任务是否结束；重启中断会标失败释放名额 |
| 截图/YouTube 失败 | FFmpeg、Node/EJS、出口、权限/Cookie/风控 |
| OOM/restarting | docker inspect OOMKilled、docker stats、free -h |

离线 API、前端构建、Compose 配置和归档完整性可以本机验证；Windows Linux Docker 引擎未运行，不能声称完成 Linux 容器启动。服务器构建、健康、SSH 页面、真实转换、截图持久化、域名和自动续期需要逐项验收，结果回填实施计划。
