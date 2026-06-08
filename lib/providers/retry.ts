// Transient errors worth retrying on AI provider calls.
// 429 = rate limit, 500/502/503/504 = upstream temporarily unavailable.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// Node fetch / undici error code names that mean "didn't reach the upstream".
const RETRYABLE_CAUSE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "EPIPE",
  "ENOTFOUND",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

const RETRYABLE_MSG_RE =
  /UNAVAILABLE|temporarily|overloaded|fetch failed|socket hang up|network|ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|ENOTFOUND/i;

export type RetryableError = Error & {
  status?: number;
  retryable?: boolean;
  causeCode?: string;
};

// Walk the .cause chain and collect every object we encounter.
function chain(err: unknown): unknown[] {
  const seen = new Set<unknown>();
  const out: unknown[] = [];
  let cur = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = (cur as { cause?: unknown }).cause;
  }
  return out;
}

function statusOf(err: unknown): number | undefined {
  for (const e of chain(err)) {
    const o = e as Record<string, unknown>;
    if (typeof o.status === "number") return o.status as number;
    if (typeof o.statusCode === "number") return o.statusCode as number;
    if (typeof o.code === "number") return o.code as number;
    const error = o.error as Record<string, unknown> | undefined;
    if (error && typeof error.code === "number") return error.code as number;
    if (typeof o.message === "string") {
      const m = /"code"\s*:\s*(\d{3})/.exec(o.message);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

function causeCodeOf(err: unknown): string | undefined {
  for (const e of chain(err)) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}

function fullMessage(err: unknown): string {
  return chain(err)
    .map((e) => (e as Error)?.message)
    .filter(Boolean)
    .join(" | ");
}

function isRetryable(err: unknown): boolean {
  const status = statusOf(err);
  if (status && RETRYABLE_STATUS.has(status)) return true;
  const code = causeCodeOf(err);
  if (code && RETRYABLE_CAUSE_CODES.has(code)) return true;
  return RETRYABLE_MSG_RE.test(fullMessage(err));
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 1200;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retry = isRetryable(err);
      if (i === attempts - 1 || !retry) break;
      const delay = base * Math.pow(2, i) + Math.floor(Math.random() * 250);
      console.warn(
        `[${label}] attempt ${i + 1}/${attempts} failed `
          + `(status=${statusOf(err) ?? "?"}, cause=${causeCodeOf(err) ?? "?"}); `
          + `retrying in ${delay}ms — ${fullMessage(err)}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  const status = statusOf(lastErr);
  const code = causeCodeOf(lastErr);
  const wrapped: RetryableError = new Error(
    cleanMessage(label, status, code, lastErr),
  );
  wrapped.status = status;
  wrapped.causeCode = code;
  wrapped.retryable = isRetryable(lastErr);
  if ((lastErr as Error)?.stack) wrapped.stack = (lastErr as Error).stack;
  throw wrapped;
}

function cleanMessage(
  label: string,
  status: number | undefined,
  code: string | undefined,
  err: unknown,
): string {
  if (status === 503)
    return `${label}: 모델이 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요. (503)`;
  if (status === 429)
    return `${label}: 요청 한도 초과. 잠시 후 다시 시도해주세요. (429)`;
  if (status && status >= 500)
    return `${label}: 업스트림 서버 오류 (${status}). 잠시 후 다시 시도해주세요.`;
  if (status === 400) {
    const raw = fullMessage(err);
    const jsonMsg = /"message"\s*:\s*"([^"]+)"/.exec(raw)?.[1];
    return `${label}: 요청 거부됨 (400). ${jsonMsg ?? raw}`;
  }
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET")
    return `${label}: 업스트림과의 연결이 끊어졌습니다. 잠시 후 다시 시도해주세요.`;
  if (code === "ETIMEDOUT" || code?.includes("TIMEOUT"))
    return `${label}: 업스트림 응답이 지연되어 시간 초과되었습니다. 잠시 후 다시 시도해주세요.`;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    return `${label}: 호스트 이름을 해석할 수 없습니다. 네트워크 상태를 확인해주세요.`;
  const raw = fullMessage(err);
  const jsonMsg = /"message"\s*:\s*"([^"]+)"/.exec(raw)?.[1];
  return `${label}: ${jsonMsg ?? raw ?? "알 수 없는 오류"}`;
}
