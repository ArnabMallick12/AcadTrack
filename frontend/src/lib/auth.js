import Cookies from 'js-cookie';

const ACCESS_TOKEN_KEY = 'access_token';
const LEGACY_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';
const COURSE_KEY = 'selectedCourse';
const DEVICE_KEY = 'device_id';
const ACCESS_COOKIE_DAYS = 1 / 96; // 15 minutes
const REFRESH_COOKIE_DAYS = 7;
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

function safeLocalStorage() {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function createDeviceId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId() {
    const storage = safeLocalStorage();
    const existing = storage?.getItem(DEVICE_KEY) || Cookies.get(DEVICE_KEY);
    if (existing) return existing;

    const deviceId = createDeviceId();
    storage?.setItem(DEVICE_KEY, deviceId);
    Cookies.set(DEVICE_KEY, deviceId, { expires: 365, path: '/' });
    return deviceId;
}

export function getStoredToken() {
    const tokenFromCookie = Cookies.get(ACCESS_TOKEN_KEY) || Cookies.get(LEGACY_TOKEN_KEY);
    if (tokenFromCookie) return tokenFromCookie;

    const storage = safeLocalStorage();
    return storage?.getItem(ACCESS_TOKEN_KEY) || storage?.getItem(LEGACY_TOKEN_KEY) || null;
}

export function getStoredRefreshToken() {
    const tokenFromCookie = Cookies.get(REFRESH_TOKEN_KEY);
    if (tokenFromCookie) return tokenFromCookie;

    const storage = safeLocalStorage();
    return storage?.getItem(REFRESH_TOKEN_KEY) || null;
}

export function getStoredUser() {
    const userFromCookie = Cookies.get(USER_KEY);
    if (userFromCookie) return userFromCookie;

    const storage = safeLocalStorage();
    return storage?.getItem(USER_KEY) || null;
}

export function getStoredCourse() {
    const courseFromCookie = Cookies.get(COURSE_KEY);
    if (courseFromCookie) return courseFromCookie;

    const storage = safeLocalStorage();
    return storage?.getItem(COURSE_KEY) || null;
}

export function setSession(tokenOrTokens, user, maybeRefreshToken) {
    const accessToken = typeof tokenOrTokens === 'object'
        ? tokenOrTokens.access_token || tokenOrTokens.token
        : tokenOrTokens;
    const refreshToken = typeof tokenOrTokens === 'object'
        ? tokenOrTokens.refresh_token
        : maybeRefreshToken;

    console.log('[auth] setSession:start', {
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
        role: user?.role,
        path: typeof window !== 'undefined' ? window.location.pathname : 'server',
    });

    if (accessToken) {
        Cookies.set(ACCESS_TOKEN_KEY, accessToken, { expires: ACCESS_COOKIE_DAYS, path: '/' });
        Cookies.set(LEGACY_TOKEN_KEY, accessToken, { expires: ACCESS_COOKIE_DAYS, path: '/' });
    }
    if (refreshToken) {
        Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: REFRESH_COOKIE_DAYS, path: '/' });
    }
    Cookies.set(USER_KEY, JSON.stringify(user), { expires: REFRESH_COOKIE_DAYS, path: '/' });

    const storage = safeLocalStorage();
    if (accessToken) {
        storage?.setItem(ACCESS_TOKEN_KEY, accessToken);
        storage?.setItem(LEGACY_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
        storage?.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    storage?.setItem(USER_KEY, JSON.stringify(user));

    console.log('[auth] setSession:done', {
        cookieAccessToken: Boolean(Cookies.get(ACCESS_TOKEN_KEY)),
        cookieRefreshToken: Boolean(Cookies.get(REFRESH_TOKEN_KEY)),
        localAccessToken: Boolean(storage?.getItem(ACCESS_TOKEN_KEY)),
        localRefreshToken: Boolean(storage?.getItem(REFRESH_TOKEN_KEY)),
    });
}

export function setSelectedCourse(course) {
    const serialized = JSON.stringify(course);
    Cookies.set(COURSE_KEY, serialized, { expires: 1, path: '/' });

    const storage = safeLocalStorage();
    storage?.setItem(COURSE_KEY, serialized);
}

function notifyServerLogout(refreshToken, deviceId) {
    if (typeof window === 'undefined' || !refreshToken || !deviceId) return;

    try {
        fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Device-Id': deviceId,
            },
            body: JSON.stringify({ refresh_token: refreshToken, device_id: deviceId }),
            keepalive: true,
        }).catch(() => {});
    } catch {
        // Local logout should still complete if the network request cannot be sent.
    }
}

export function clearLocalSession() {
    Cookies.remove(ACCESS_TOKEN_KEY, { path: '/' });
    Cookies.remove(LEGACY_TOKEN_KEY, { path: '/' });
    Cookies.remove(REFRESH_TOKEN_KEY, { path: '/' });
    Cookies.remove(USER_KEY, { path: '/' });
    Cookies.remove(COURSE_KEY, { path: '/' });

    const storage = safeLocalStorage();
    storage?.removeItem(ACCESS_TOKEN_KEY);
    storage?.removeItem(LEGACY_TOKEN_KEY);
    storage?.removeItem(REFRESH_TOKEN_KEY);
    storage?.removeItem(USER_KEY);
    storage?.removeItem(COURSE_KEY);
}

export function hasValidSession() {
    return Boolean(getStoredToken() && getStoredRefreshToken() && getStoredUser());
}

export function clearSession() {
    const refreshToken = getStoredRefreshToken();
    const deviceId = getDeviceId();
    notifyServerLogout(refreshToken, deviceId);

    console.log('[auth] clearSession', {
        path: typeof window !== 'undefined' ? window.location.pathname : 'server',
    });
    clearLocalSession();
}
