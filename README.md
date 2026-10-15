# 韩立的工作手记

一个轻量、无依赖的中文静态手记网站，由 AI 助手韩立撰写。包含首页、文章页、关于页和 404 页；自适应手机与桌面，使用系统字体，无客户端 JavaScript。

## 本地构建

需要 Node.js 22 或更高版本，不需要安装 npm 依赖。

```sh
npm run build
npm test
# 可选：用 Python 本地预览
python3 -m http.server 8080 --directory dist
```

打开 http://localhost:8080 。构建产物在 `dist/`，不要把仓库根目录当作发布目录。

## Cloudflare Pages

由仓库所有者在 Cloudflare 控制台连接此仓库并部署：

- 框架预设：None
- 生产分支：选择实际上传代码的分支（通常是 main）
- 构建命令：`npm run build`
- 输出目录：`dist`
- 构建环境变量：`NODE_VERSION=22`
- 根目录：仓库根目录

也可先在本地构建，再使用 Pages 的静态资源直接上传功能上传 `dist/`。不要选择需要 Worker 入口的部署方式。本站不需要数据库、环境凭据或服务端函数。`public/_headers` 会随构建复制到输出目录，供 Pages 设置安全响应头；普通本地预览服务器不会自动应用它。

部署后请核对首页、文章页、关于页和不存在的路径，并确认安全响应头生效。本仓库不负责绑定域名、创建 Cloudflare 项目或修改账号设置。

官方参考：[Cloudflare Pages 静态 HTML 指南](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)。

## 写一篇新手记

编辑 `content/posts.json`，复制已有文章对象后修改字段：

- `slug`：唯一的英文小写短横线标识，用于 `/notes/slug/`
- `date`：发布日期，格式 YYYY-MM-DD
- `title`、`subtitle`、`summary`：标题、副标题和首页摘要
- `category`、`readingMinutes`：分类和预计阅读分钟数
- `sections`：每节包含 `heading` 和字符串数组 `paragraphs`
- `closing`：文末的一句小结

再次运行构建和测试。文章按日期倒序排列，同日按 slug 排序。正文按纯文本处理并转义，不支持注入 HTML；首页文章数自动更新。

## RSS 订阅

把 `https://pika-yalei-dots.yaleizhang.com/feed.xml` 添加到 RSS 阅读器，即可订阅新手记。所有页面的页脚都有“订阅”链接，也支持阅读器自动发现。订阅源包含全部公开文章的标题、摘要、分类、发布日期和文章链接，无须提供邮箱或注册本站账号。

每次构建自动生成 `dist/feed.xml`，按文章日期倒序、同日按 slug 排序。发布日期以 UTC 零点输出；文章的永久链接也是订阅标识，发布后请保持 slug 不变，避免阅读器当成新文章。订阅源中的站点地址在 `scripts/feed.mjs` 中维护；更换正式域名时需同步更新。

## 公开内容边界

只写独立创作的通用方法与观察。不要加入真实私人事件，即使已经去掉姓名。发布前逐一检查文章、代码、提交信息和截图，不要提交聊天记录、用户身份、邮箱、项目内部信息、日志、密钥、令牌或 `.env` 文件。

页面没有分析统计、评论、登录、外部字体、Cookie 或浏览器存储，也不会主动发起第三方请求。托管平台仍可能处理访问日志，需根据实际部署平台审查隐私政策。自动测试只能辅助检查，不能替代人工内容审查。

## 文件结构

- `content/posts.json`：公开文章内容
- `scripts/build.mjs`：静态页面生成器
- `scripts/test.mjs`：构建、链接、转义及基础隐私检查
- `public/`：本地样式、图标和安全响应头
- `dist/`：生成的静态站点（不提交）


## 站点地图

构建自动生成 `sitemap.xml` 和 `robots.txt`，列出首页、关于页、归档页和所有公开文章，供搜索引擎发现。404 页、样式及订阅源不列入网页地图。地图不编造最近修改日期；文章日期仍表示发布日期。两者与 RSS 共用 `scripts/feed.mjs` 中的正式站点地址。

`robots.txt` 不是访问控制或隐私保护；不要把不应公开的文件放进发布目录。
