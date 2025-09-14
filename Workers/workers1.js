/**
 * Cloudflare Workers 代理入口
 * 本文件实现了一个针对 GitHub 相关域名的镜像代理
 * 需要Cloudflare Workers中添加环境变量，名称为固定值 DOMAIN，值为镜像绑定一级域名（yourdomain.com），记录类型为TXT文本
 * 需要在自定义域功能以及路由功能中分别添加以下内容：（请将yourdomain.com替换为实际绑定的域名，自定义域功能和路由功能分开分别都要添加）
 * hub.yourdomain.com
 * raw.yourdomain.com
 * assets.yourdomain.com
 * download.yourdomain.com
 * object.yourdomain.com
 * media.yourdomain.com
 * gist.yourdomain.com
 */

// domainMaps: 记录“镜像域名 -> 官方域名”的映射关系
let domainMaps = {};
// reverseDomainMaps: 记录“官方域名 -> 镜像域名”的反向映射，用于回写 Location/HTML 中的链接
let reverseDomainMaps = {};

// Cloudflare Workers 约定的模块导出对象，其中包含 fetch 处理函数
const index = {
  /**
   * 处理所有进入到 Worker 的 HTTP 请求
   * @param {Request} request - 进入 Worker 的原始请求
   * @param {Object} env - 运行环境变量（例如 GIT_HASH）
   * @param {Object} _ctx - 执行上下文（未使用）
   * @returns {Promise<Response>} - 返回代理后的响应
   */
  async fetch(request, env, _ctx) {
    // 1) 根据路径判断是否需要直接取消（如 favicon、sw.js 等静态探测请求）
    const needCancel = await needCancelRequest(request);
    if (needCancel)
      return new Response("", { status: 204 }); // 204: No Content，快速结束

    // 2) 解析请求 URL，并提取域名与子域名信息
    const url = new URL(request.url);
    const { domain, subdomain } = getDomainAndSubdomain(request);

    // 3) robots.txt：统一禁止全站抓取，避免镜像被爬虫反复抓取
    if (url.pathname === "/robots.txt")
      return new Response("User-agent: *\nDisallow: /", { status: 200 });

    // 4) 构建镜像域名 -> 官方域名的映射表
    domainMaps = {
      [`hub.${domain}`]: "github.com",
      [`assets.${domain}`]: "github.githubassets.com",
      [`raw.${domain}`]: "raw.githubusercontent.com",
      [`download.${domain}`]: "codeload.github.com",
      [`object.${domain}`]: "objects.githubusercontent.com",
      [`media.${domain}`]: "media.githubusercontent.com",
      [`gist.${domain}`]: "gist.github.com",
    };

    // 5) 生成官方域名 -> 镜像域名的反向映射，用于回写
    reverseDomainMaps = Object.fromEntries(
      Object.entries(domainMaps).map((arr) => arr.reverse())
    );

    // 6) 若当前请求 Host 正好命中映射表，则将其替换为对应的官方域名进行转发
    if (url.host in domainMaps) {
      url.host = domainMaps[url.host]; // 将镜像域名替换为官方域名

      // 端口归一化：
      // 如果 URL 上带有非 80/443 端口，则根据协议强制改为标准端口，避免某些后端对端口敏感
      if (url.port !== "80" && url.port !== "443")
        url.port = url.protocol === "https:" ? "443" : "80";

      // 根据原请求构造一个新的请求对象（携带必要头部、保持方法/体等）
      const newRequest = getNewRequest(url, request);

      // 执行真正的代理请求
      return proxy(url, newRequest);
    }

    // 7) 未命中任何受支持的镜像子域，返回提示信息
    return new Response(
      `Unsupported domain ${subdomain ? `${subdomain}.` : ""}${domain}`,
      {
        status: 200,
        headers: {
          "content-type": "text/plain;charset=utf-8",
          // 透出构建版本（如有），便于排查
          "git-hash": env?.GIT_HASH,
        },
      }
    );
  },
};

/**
 * 提取当前请求的主域名和子域名
 * 实现说明：
 * - 基于 URL.host 的分段来判断子域与主域
 * - 对 localhost[:port] 做特殊兼容（本地开发场景）
 * @param {Request} request
 * @returns {{domain: string, subdomain: string}}
 */
function getDomainAndSubdomain(request) {
  const url = new URL(request.url);
  const hostArr = url.host.split(".");
  let subdomain = ""; // 记录子域（如 hub/assets/raw 等）
  let domain = ""; // 记录主域（镜像站的根域名）

  if (hostArr.length > 2) {
    // 形如 sub.example.com => subdomain=sub, domain=example.com
    subdomain = hostArr[0];
    domain = hostArr.slice(1).join(".");
  } else if (hostArr.length === 2) {
    // 形如 example.com 或 localhost:8787 之类
    // 当第二段是 localhost[:port] 时，将第一段视作子域
    subdomain = hostArr[1].match(/^localhost(:\d+)?$/) ? hostArr[0] : "";
    domain = hostArr[1].match(/^localhost(:\d+)?$/) ? hostArr[1] : hostArr.join(".");
  } else {
    // 单段主机名（较少见），直接作为 domain
    domain = hostArr.join(".");
  }
  return { domain, subdomain };
}

/**
 * 判断请求是否应当被快速取消（不进入代理）
 * 典型场景：浏览器自动请求的 favicon.ico、Service Worker 脚本等
 * @param {Request} request
 * @param {string[]} [matches] - 需要匹配的路径片段，若不提供使用默认
 * @returns {Promise<boolean>}
 */
async function needCancelRequest(request, matches = []) {
  const url = new URL(request.url);
  // 默认匹配规则：包含 /favicon. 或 /sw.js 字样的路径
  matches = matches.length ? matches : ["/favicon.", "/sw.js"];
  return matches.some((match) => url.pathname.includes(match));
}

/**
 * 基于原始请求构造一个新的 Request 用于转发
 * 实现说明：
 * - 克隆原请求头，并添加一个 reason 头部，标注“China 镜像”
 * - 设置 redirect: 'manual'，便于我们手动处理 Location 回写
 * @param {URL} url - 目标 URL（已替换为官方域名）
 * @param {Request} request - 原始请求
 * @returns {Request}
 */
function getNewRequest(url, request) {
  const headers = new Headers(request.headers);
  headers.set("reason", "mirror of China"); // 用于后端/日志的溯源标记
  const newRequestInit = { redirect: "manual", headers };
  // 通过 new Request(request, init) 复制原请求的方法、body 等，再覆盖 URL
  return new Request(url.toString(), new Request(request, newRequestInit));
}

/**
 * 代理核心：向目标 URL 发起请求并对响应进行加工
 * 关键处理：
 * 1) 跳转回写：若响应包含 Location 且指向官方域名，则回写为镜像域名
 * 2) 放宽跨域：添加 CORS 相关响应头；移除 CSP 相关头
 * 3) HTML 回写：将 HTML 中出现的官方域名绝对链接替换为镜像域名；并去除 integrity 以规避 SRI 不一致
 * @param {URL} url - 目标 URL（官方域名）
 * @param {Request} request - 转发请求
 * @param {Object} [env] - 运行环境（未使用）
 * @returns {Promise<Response>}
 */
async function proxy(url, request, env) {
  try {
    // 发起上游请求
    const res = await fetch(url.toString(), request);

    // 复制响应头，便于后续修改
    const headers = res.headers;
    const newHeaders = new Headers(headers);
    const status = res.status;

    // 处理 30x 跳转：将 Location 中的官方域名回写为镜像域名
    if (newHeaders.has("location")) {
      const loc = newHeaders.get("location");
      if (loc) {
        try {
          const locUrl = new URL(loc);
          if (locUrl.host in reverseDomainMaps) {
            locUrl.host = reverseDomainMaps[locUrl.host];
            newHeaders.set("location", locUrl.toString());
          }
        } catch (e) {
          // Location 可能是相对路径或非标准 URL，解析失败时忽略回写
          console.error(e);
        }
      }
    }

    // 放宽跨域限制，便于前端直接访问
    newHeaders.set("access-control-expose-headers", "*");
    newHeaders.set("access-control-allow-origin", "*");

    // 为避免 CSP 限制导致镜像环境加载失败，移除相关安全头
    newHeaders.delete("content-security-policy");
    newHeaders.delete("content-security-policy-report-only");
    newHeaders.delete("clear-site-data");

    // 如果是 HTML，进一步进行内容回写
    if (res.headers.get("content-type")?.indexOf("text/html") !== -1) {
      const body = await res.text();

      // 正则构造说明：
      // - 将所有“https?://<镜像域名>”作为候选匹配项统一收集（使用分组 | 连接）
      // - regAll 会匹配到 HTML 文本中所有以 http/https 开头、指向镜像域名的绝对链接
      const regAll = new RegExp(
        Object.keys(reverseDomainMaps)
          .map((r) => `(https?://${r})`)
          .join("|"),
        "g"
      );

      // newBody 回写逻辑：
      // - 对每个匹配到的“协议+镜像域名”进行替换
      // - 若其对应官方域名存在于 reverseDomainMaps（即确实是我们支持的映射）
      //   则替换为“协议+官方域名”，从而把 HTML 中的链接回写回官方域名
      // - 去除 integrity 属性，避免因镜像与官方资源字节差异导致 SRI 校验失败
      const newBody = body
        .replace(regAll, (match) => {
          return match.replace(/^(https?:\/\/)(.*?)$/g, (m, p1, p2) => {
            return reverseDomainMaps[p2] ? `${p1}${reverseDomainMaps[p2]}` : m;
          });
        })
        .replace(/integrity=\".*?\"/g, "");

      return new Response(newBody, { status, headers: newHeaders });
    }

    // 非 HTML 场景，直接透传响应体（但保留上面处理过的响应头）
    return new Response(res.body, { status, headers: newHeaders });
  } catch (e) {
    // 发生网络错误或其他异常时，返回 500，并携带简要错误信息
    return new Response(e.message, { status: 500 });
  }
}

// 以默认导出的形式暴露给 Cloudflare Workers 运行时
export { index as default };