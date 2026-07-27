"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, LogOut, User, Mail, Camera } from 'lucide-react';
import api from '@/lib/api';
import { clearSession, getStoredToken, getStoredUser } from '@/lib/auth';
import FaceRegistration from '@/components/FaceRegistration';

export default function StudentProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchProfile = useCallback(async () => {
        try {
            const { data } = await api.get('/student/profile');
            setProfile(data);
            setError(null);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const user = getStoredUser();
        const token = getStoredToken();

        if (!user || !token) {
            clearSession();
            router.push('/login');
            return;
        }

        const parsed = JSON.parse(user);
        if (parsed.role !== 'student') {
            router.push('/professor/courses');
            return;
        }

        fetchProfile();
    }, [router, fetchProfile]);

    const handleRegistrationComplete = () => {
        fetchProfile();
    };

    const handleLogout = () => {
        clearSession();
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Loading your profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
                <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Layers size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">AcadTrack</h1>
                            <p className="text-xs text-slate-400">My Account</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all duration-200"
                    >
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Log Out</span>
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
                <button
                    onClick={() => router.push('/student/courses')}
                    className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Courses
                </button>

                <div className="mb-8">
                    <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">My Account</h2>
                    <p className="text-slate-400">View your account details, registered face image, and biometric registration.</p>
                </div>

                {error ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-300">
                        {error}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur sm:p-6">
                            <h3 className="text-lg font-bold text-white mb-6">Account Details</h3>
                            <div className="space-y-5">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-700/80 flex items-center justify-center shrink-0">
                                        <User size={18} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Name</p>
                                        <p className="text-white font-medium">{profile?.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-700/80 flex items-center justify-center shrink-0">
                                        <Mail size={18} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Email</p>
                                        <p className="text-white font-medium break-all">{profile?.email}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur sm:p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <Camera size={20} className="text-purple-400" />
                                <h3 className="text-lg font-bold text-white">Registered Face</h3>
                            </div>

                            {profile?.profileImageUrl ? (
                                <div className="flex flex-col items-center sm:items-start">
                                    <img
                                        src={profile.profileImageUrl}
                                        alt="Registered face"
                                        className="w-full max-w-[200px] aspect-square object-cover rounded-2xl border border-slate-600/80 shadow-lg"
                                    />
                                    <p className="text-xs text-slate-500 mt-3 text-center sm:text-left">
                                        This is the reference image used for attendance verification.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 px-4 rounded-2xl border border-dashed border-slate-600/80 bg-slate-900/40">
                                    <div className="w-16 h-16 rounded-full bg-slate-700/80 flex items-center justify-center mb-4">
                                        <Camera size={28} className="text-slate-500" />
                                    </div>
                                    <p className="text-slate-400 text-sm text-center">
                                        No registered face image found.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!error && (
                    <div className="mt-8">
                        <div className="flex items-center gap-2 mb-4">
                            <Camera size={20} className="text-emerald-400" />
                            <h3 className="text-lg font-bold text-white">Register Face</h3>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">
                            Capture up to 3 reference selfies for attendance verification. Your latest image will appear above after registration.
                        </p>
                        <FaceRegistration onComplete={handleRegistrationComplete} />
                    </div>
                )}
            </main>
        </div>
    );
}
