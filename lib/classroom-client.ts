type Session = { token: string; expiresAt: number };
type ClientConfig = { backendUrl?: string; classroomEndpoint?: string };
let configuredBackend: string | undefined;
let memorySession: { origin: string; session: Session } | null = null;
const teacherActions = new Set(['teacher', 'class', 'create', 'close', 'feedback', 'regroup', 'resetcode']);

let configuredEndpoint: string | undefined;
export function configureClassroomClient(config: ClientConfig) { configuredBackend = config.backendUrl; configuredEndpoint = config.classroomEndpoint; memorySession = null; }
export function isLocalReviewOnly(): boolean {
  if (typeof window === 'undefined') return false;
  const config = (window as unknown as { __SPACE_CONFIG__?: { STATIC_EXPORT?: boolean; PUBLIC_BACKEND_URL?: string; PUBLIC_CLASSROOM_ENDPOINT?: string } }).__SPACE_CONFIG__;
  return config?.STATIC_EXPORT === true && !(configuredEndpoint ?? config.PUBLIC_CLASSROOM_ENDPOINT ?? configuredBackend ?? config.PUBLIC_BACKEND_URL ?? '').trim();
}
export function getBackendUrl(): string {
  if (typeof window === 'undefined') return configuredBackend || '';
  const runtime = (window as unknown as { __SPACE_CONFIG__?: { PUBLIC_BACKEND_URL?: string } }).__SPACE_CONFIG__;
  const url = new URL(configuredBackend ?? runtime?.PUBLIC_BACKEND_URL ?? '/', window.location.href);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (window.location.protocol === 'https:' && url.protocol !== 'https:')) throw new Error('탐사실 연결 주소를 확인해 주세요.');
  return url.origin;
}

export function getClassroomEndpoint(): string {
  if (typeof window === 'undefined') return configuredEndpoint || '';
  const runtime = (window as unknown as { __SPACE_CONFIG__?: { PUBLIC_CLASSROOM_ENDPOINT?: string } }).__SPACE_CONFIG__;
  const raw = configuredEndpoint ?? runtime?.PUBLIC_CLASSROOM_ENDPOINT;
  const url = new URL(raw || (getBackendUrl() + '/api/classroom'), window.location.href);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (window.location.protocol === 'https:' && url.protocol !== 'https:')) throw new Error('탐사실 연결 주소를 확인해 주세요.');
  return url.href.replace(/\/$/,'');
}
function sessionKey() { return 'space-session:v1:' + getClassroomEndpoint(); }
function saveSession(session: Session) {
  memorySession = { origin: getBackendUrl(), session };
  try { window.sessionStorage.setItem(sessionKey(), JSON.stringify(session)); } catch { /* Memory remains available if storage is blocked. */ }
}
export function clearStudentSession() {
  memorySession = null;
  try { window.sessionStorage.removeItem(sessionKey()); } catch { /* Storage may be blocked. */ }
}
function readSession(): Session | null {
  let session = memorySession?.origin === getBackendUrl() ? memorySession.session : null;
  if (!session) { try { session = JSON.parse(window.sessionStorage.getItem(sessionKey()) || 'null'); } catch { session = null; } }
  if (!session || typeof session.token !== 'string' || !/^[A-Za-z0-9_-]{40,200}$/.test(session.token) || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) { clearStudentSession(); return null; }
  memorySession = { origin: getBackendUrl(), session };
  return session;
}
export function hasStudentSession() { return typeof window !== 'undefined' && !!readSession(); }

export async function api(action: string, body?: Record<string, unknown>): Promise<any> {
  if (isLocalReviewOnly()) throw Object.assign(new Error('지금은 검토용 체험 화면입니다. 실제 학급 연결을 설정한 뒤 입장할 수 있습니다.'), { status: 503, code: 'BACKEND_NOT_CONFIGURED' });
  const params = action.includes('=') ? new URLSearchParams(action) : new URLSearchParams({ action });
  const name = params.get('action') || '';
  const backend = getBackendUrl(), endpoint = getClassroomEndpoint(), crossOrigin = new URL(endpoint).origin !== window.location.origin;
  const isTeacher = teacherActions.has(name);
  if (isTeacher && crossOrigin) throw Object.assign(new Error('교사 관리는 탐사실 관리 사이트에서 열어 주세요.'), { status: 403, code: 'TEACHER_ORIGIN' });
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const session = isTeacher || name === 'join' ? null : readSession();
  if (session) headers.Authorization = 'Bearer ' + session.token;
  const url = endpoint + (body === undefined ? '?' + params.toString() : '');
  try {
    let res: Response;
    try { res = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify({ ...body, action: name }), credentials: crossOrigin ? 'omit' : 'same-origin', cache: 'no-store' }); }
    catch { throw Object.assign(new Error('연결을 확인해 주세요. 입력 내용은 그대로 남아 있습니다.'), { status: 0, code: 'NETWORK_ERROR' }); }
    let data: any;
    try { data = await res.json(); } catch { throw Object.assign(new Error('탐사실 응답을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.'), { status: res.status, code: 'INVALID_RESPONSE' }); }
    if (!res.ok) {
      if (res.status === 401 && !isTeacher && name !== 'join') clearStudentSession();
      throw Object.assign(new Error(data?.error || '연결을 확인해 주세요.'), data, { status: res.status });
    }
    if (name === 'join') {
      const value = data?.session;
      if (!value || typeof value.token !== 'string' || !/^[A-Za-z0-9_-]{40,200}$/.test(value.token) || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) throw Object.assign(new Error('입장 정보를 확인하지 못했습니다. 다시 입장해 주세요.'), { status: 502, code: 'INVALID_SESSION' });
      saveSession({ token: value.token, expiresAt: value.expiresAt });
      const { session: privateSession, ...visibleState } = data;
      void privateSession;
      return visibleState;
    }
    return data;
  } finally { if (name === 'logout') clearStudentSession(); }
}
