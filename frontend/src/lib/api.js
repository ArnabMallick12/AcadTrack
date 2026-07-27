import axios from 'axios';
import { clearLocalSession, clearSession, getDeviceId, getStoredRefreshToken, getStoredToken, setSession } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
});

const refreshClient = axios.create({
    baseURL: API_URL,
});

let refreshPromise = null;

async function refreshAccessToken() {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    if (!refreshPromise) {
        const deviceId = getDeviceId();
        refreshPromise = refreshClient.post('/auth/refresh', {
            refresh_token: refreshToken,
            device_id: deviceId,
        }, {
            headers: { 'X-Device-Id': deviceId },
        }).then(({ data }) => {
            setSession(data, data.user);
            return data.access_token || data.token;
        }).finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
}

api.interceptors.request.use((config) => {
    const isAuthRoute = config.url?.startsWith('/auth/login') || config.url?.startsWith('/auth/register');
    const token = isAuthRoute ? null : getStoredToken();
    const deviceId = getDeviceId();
    console.log('[api] request', {
        method: config.method,
        url: config.url,
        hasToken: Boolean(token),
        hasDeviceId: Boolean(deviceId),
        path: typeof window !== 'undefined' ? window.location.pathname : 'server',
    });
    config.headers['X-Device-Id'] = deviceId;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error?.response?.status;
        console.log('[api] response_error', {
            url: originalRequest?.url,
            method: originalRequest?.method,
            status,
            data: error?.response?.data,
            path: typeof window !== 'undefined' ? window.location.pathname : 'server',
        });

        const isAuthRoute = originalRequest?.url?.startsWith('/auth/login')
            || originalRequest?.url?.startsWith('/auth/refresh')
            || originalRequest?.url?.startsWith('/auth/register');
        if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
            originalRequest._retry = true;
            try {
                const newAccessToken = await refreshAccessToken();
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                originalRequest.headers['X-Device-Id'] = getDeviceId();
                return api(originalRequest);
            } catch (refreshError) {
                clearLocalSession();
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                    window.location.assign('/login');
                }
                return Promise.reject(refreshError);
            }
        }

        if (status === 401 && !isAuthRoute) {
            clearLocalSession();
        }

        return Promise.reject(error);
    }
);

export default api;
