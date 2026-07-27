"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { clearLocalSession, getDeviceId, getStoredToken, getStoredUser, setSession } from '@/lib/auth';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [sessionConflict, setSessionConflict] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        clearLocalSession();
    }, []);

    const completeLogin = async (payload) => {
        const deviceId = getDeviceId();
        const { data } = await api.post('/auth/login', {
            ...payload,
            device_id: deviceId,
        }, {
            headers: { 'X-Device-Id': deviceId },
        });

        if (!(data?.access_token || data?.token) || !data?.refresh_token || !data?.user?.role) {
            throw new Error('Invalid login response from server');
        }

        setSession(data, data.user);

        const savedToken = getStoredToken();
        const savedUser = getStoredUser();

        if (!savedToken || !savedUser) {
            throw new Error('Session could not be stored in browser cookies');
        }

        const destination = data.user.role === 'student'
            ? '/student/courses'
            : data.user.role === 'admin'
                ? '/admin/dashboard'
                : '/professor/courses';

        window.location.assign(destination);
    };

    const handleLogin = async (e, forceLogin = false) => {
        e.preventDefault();
        setError('');
        setSessionConflict(false);
        setSubmitting(true);
        try {
            await completeLogin({
                email: email.trim(),
                password,
                force_login: forceLogin,
            });
        } catch (err) {
            if (err.response?.status === 409) {
                setSessionConflict(true);
            }
            setError(
                err.response?.data?.error ||
                err.response?.data?.message ||
                err.message ||
                'Login failed'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleForceLogin = async () => {
        setError('');
        setSubmitting(true);
        try {
            await completeLogin({
                email: email.trim(),
                password,
                force_login: true,
            });
        } catch (err) {
            setError(
                err.response?.data?.error ||
                err.response?.data?.message ||
                err.message ||
                'Login failed'
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg sm:p-8">
                <h2 className="mb-8 text-center text-2xl font-bold text-gray-800 sm:text-3xl">AcadTrack</h2>
                {error && <div className="bg-red-50 text-red-500 p-3 rounded mb-4 text-center">{error}</div>}
                {sessionConflict && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded mb-4">
                        <p className="text-sm mb-3">This account is active on another device or browser tab.</p>
                        <button
                            type="button"
                            onClick={handleForceLogin}
                            disabled={submitting}
                            className="w-full bg-amber-600 text-white font-semibold py-2 rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
                        >
                            Sign in on this device
                        </button>
                    </div>
                )}
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full mt-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Logging In...' : 'Log In'}
                    </button>
                </form>
                <div className="mt-6 text-center text-sm text-gray-600">
                    Don't have an account? <a href="/register" className="text-blue-600 hover:underline">Register</a>
                </div>
            </div>
        </div>
    );
}
