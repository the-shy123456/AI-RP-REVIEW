const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_OAUTH_STATE_COOKIE = "ai_pr_review_github_oauth_state";
export const GITHUB_TOKEN_COOKIE = "ai_pr_review_github_token";
const MESSAGE_TYPE = "ai-pr-review:github-auth";
const OAUTH_NOT_CONFIGURED_MESSAGE =
  "GitHub 登录暂未启用：部署者需要先配置 GitHub OAuth App。";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

export function createGitHubAuthStartResponse({ origin, state }) {
  const clientId = clean(process.env.GITHUB_CLIENT_ID);
  const clientSecret = clean(process.env.GITHUB_CLIENT_SECRET);
  const safeState = clean(state);

  if (!clientId || !clientSecret) {
    return {
      body: OAUTH_NOT_CONFIGURED_MESSAGE,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      status: 500,
    };
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/github-auth/callback`,
    state: safeState,
  });

  return {
    headers: {
      Location: `${GITHUB_AUTH_URL}?${params.toString()}`,
      "Set-Cookie": serializeCookie(GITHUB_OAUTH_STATE_COOKIE, safeState, {
        httpOnly: true,
        maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
        origin,
      }),
    },
    status: 302,
  };
}

export async function createGitHubAuthCallbackResponse(
  { code, cookieHeader, origin, state },
  fetcher = fetch,
) {
  const clientId = clean(process.env.GITHUB_CLIENT_ID);
  const clientSecret = clean(process.env.GITHUB_CLIENT_SECRET);
  const safeState = clean(state);
  const expectedState = readCookie(cookieHeader, GITHUB_OAUTH_STATE_COOKIE);
  const extensionMode = safeState.startsWith("extension-");

  if (!clientId || !clientSecret) {
    return htmlResponse(
      renderCallbackPage({
        error: OAUTH_NOT_CONFIGURED_MESSAGE,
        extensionMode,
        origin,
        state,
      }),
    );
  }

  if (!safeState || safeState !== expectedState) {
    return htmlResponse(
      renderCallbackPage({
        error: "GitHub OAuth 状态校验失败，请回到应用重试。",
        extensionMode,
        origin,
        state: safeState,
      }),
      [clearCookie(GITHUB_OAUTH_STATE_COOKIE, origin)],
    );
  }

  if (!clean(code)) {
    return htmlResponse(
      renderCallbackPage({
        error: "GitHub OAuth 回调缺少 code。",
        extensionMode,
        origin,
        state: safeState,
      }),
      [clearCookie(GITHUB_OAUTH_STATE_COOKIE, origin)],
    );
  }

  const tokenResult = await exchangeOAuthCode(
    { clientId, clientSecret, code: clean(code), origin },
    fetcher,
  );

  if (!tokenResult.ok) {
    return htmlResponse(
      renderCallbackPage({
        error: tokenResult.error,
        extensionMode,
        origin,
        state: safeState,
      }),
      [clearCookie(GITHUB_OAUTH_STATE_COOKIE, origin)],
    );
  }

  return htmlResponse(
    renderCallbackPage({
      authenticated: true,
      extensionMode,
      origin,
      state: safeState,
    }),
    [
      serializeCookie(GITHUB_TOKEN_COOKIE, tokenResult.token, {
        httpOnly: true,
        maxAge: TOKEN_MAX_AGE_SECONDS,
        origin,
      }),
      clearCookie(GITHUB_OAUTH_STATE_COOKIE, origin),
    ],
  );
}

export function createGitHubAuthLogoutResponse({ origin }) {
  return {
    body: { ok: true },
    headers: {
      "Set-Cookie": clearCookie(GITHUB_TOKEN_COOKIE, origin),
    },
    status: 200,
  };
}

export function createGitHubAuthStatusResponse({ cookieHeader }) {
  return {
    body: {
      authorized: Boolean(readCookie(cookieHeader, GITHUB_TOKEN_COOKIE)),
    },
    status: 200,
  };
}

export function readCookie(cookieHeader, name) {
  if (!cookieHeader || !name) {
    return "";
  }

  return String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .reduce((matched, part) => {
      if (matched) {
        return matched;
      }

      const [cookieName, ...rawValue] = part.split("=");
      return cookieName === name ? decodeURIComponent(rawValue.join("=")) : "";
    }, "");
}

async function exchangeOAuthCode({ clientId, clientSecret, code, origin }, fetcher) {
  try {
    const tokenResponse = await fetcher(GITHUB_TOKEN_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${origin}/api/github-auth/callback`,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });
    const payload = await tokenResponse.json();

    if (!tokenResponse.ok || !payload.access_token) {
      return {
        ok: false,
        error:
          payload.error_description ||
          payload.error ||
          `GitHub OAuth 换取 token 失败：${tokenResponse.status}`,
      };
    }

    return { ok: true, token: payload.access_token };
  } catch {
    return { ok: false, error: "GitHub OAuth 换取 token 时网络失败，请重试。" };
  }
}

function htmlResponse(body, cookies = []) {
  const headers = { "Content-Type": "text/html;charset=utf-8" };

  if (cookies.length > 0) {
    headers["Set-Cookie"] = cookies;
  }

  return {
    body,
    headers,
    status: 200,
  };
}

function renderCallbackPage({
  authenticated = false,
  error = "",
  extensionMode = false,
  origin,
  state = "",
}) {
  const message = JSON.stringify({
    authenticated,
    error,
    extensionMode,
    state,
    type: MESSAGE_TYPE,
  });

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>GitHub 授权完成</title>
  </head>
  <body>
    <p>GitHub 授权处理中，可以关闭此窗口。</p>
    <script>
      const message = ${message};
      const authenticatedKey = "ai-pr-review.github-authorized";
      const stateKey = "ai-pr-review.github-auth-state";
      if (message.extensionMode) {
        if (message.error) {
          document.body.textContent = message.error;
        } else if (message.authenticated) {
          document.body.innerHTML = "<h1>GitHub 授权完成</h1><p>请回到 GitHub PR 页面继续使用 AI PR Review 插件。</p><button type='button' onclick='window.close()'>关闭窗口</button>";
        } else {
          document.body.textContent = "GitHub 授权状态校验失败，请回到 GitHub PR 页面重试。";
        }
      } else if (window.opener) {
        window.opener.postMessage(message, ${JSON.stringify(origin)});
        window.close();
      } else if (message.error) {
        document.body.textContent = message.error;
      } else if (
        message.authenticated &&
        message.state &&
        sessionStorage.getItem(stateKey) === message.state
      ) {
        sessionStorage.setItem(authenticatedKey, "true");
        sessionStorage.removeItem(stateKey);
        window.location.replace("/");
      } else {
        document.body.textContent = "GitHub 授权状态校验失败，请回到应用重试。";
      }
    </script>
  </body>
</html>`;
}

function serializeCookie(
  name,
  value,
  {
    httpOnly = false,
    maxAge,
    origin,
    path = "/",
    sameSite = String(origin).startsWith("https://") ? "None" : "Lax",
  } = {},
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ];

  if (Number.isFinite(maxAge)) {
    parts.push(`Max-Age=${Math.floor(maxAge)}`);
  }

  if (httpOnly) {
    parts.push("HttpOnly");
  }

  if (String(origin).startsWith("https://")) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearCookie(name, origin) {
  return serializeCookie(name, "", {
    httpOnly: true,
    maxAge: 0,
    origin,
  });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}
