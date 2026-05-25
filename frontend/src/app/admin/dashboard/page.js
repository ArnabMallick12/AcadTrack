"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/admin-shell';
import { useAdminSession } from '@/components/admin/use-admin-session';
import api from '@/lib/api';
import { getReleaseProgress, normalizeSemester } from '@/lib/admin';

function StatCard({ label, value, hint }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-gray-800">{value}</p>
            <p className="mt-2 text-sm text-gray-500">{hint}</p>
        </div>
    );
}

export default function AdminDashboardPage() {
    const { user, isReady } = useAdminSession();
    const [users, setUsers] = useState([]);
    const [professors, setProfessors] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isReady) return;

        const load = async () => {
            try {
                setError('');
                const [usersRes, profRes, semRes] = await Promise.all([
                    api.get('/admin/users'),
                    api.get('/admin/professors'),
                    api.get('/admin/semesters'),
                ]);
                setUsers(usersRes.data);
                setProfessors(profRes.data);
                setSemesters((semRes.data || []).map(normalizeSemester));
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load admin overview');
            }
        };

        load();
    }, [isReady]);

    const metrics = useMemo(() => {
        const activeRegistrations = semesters.filter((semester) => semester.normalized_registration_open).length;
        const releasedSheets = semesters.filter((semester) => semester.gradesheet_released).length;
        const totalRegistrations = semesters.reduce((sum, semester) => sum + semester.registered_student_count, 0);
        const totalCourses = semesters.reduce((sum, semester) => sum + semester.course_count, 0);
        const students = users.filter((entry) => entry.role === 'student').length;

        return {
            students,
            professors: professors.length,
            semesters: semesters.length,
            activeRegistrations,
            releasedSheets,
            totalRegistrations,
            totalCourses,
        };
    }, [professors, semesters, users]);

    const spotlightSemesters = useMemo(() => {
        return [...semesters]
            .sort((a, b) => {
                const progressDiff = getReleaseProgress(b) - getReleaseProgress(a);
                if (progressDiff !== 0) return progressDiff;
                return b.registered_student_count - a.registered_student_count;
            })
            .slice(0, 4);
    }, [semesters]);

    if (!isReady) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-100">Loading admin workspace...</div>;
    }

    return (
        <AdminShell
            user={user}
            title="Overview"
            description="Keep an eye on onboarding, semester setup, registration progress, and gradesheet readiness without jumping between scattered forms."
            actions={
                <>
                    <Link href="/admin/users" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                        Create User
                    </Link>
                    <Link href="/admin/semesters" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                        Manage Semesters
                    </Link>
                </>
            }
        >
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Students" value={metrics.students} hint="Total student accounts available for registration." />
                <StatCard label="Professors" value={metrics.professors} hint="Faculty members available for course assignment." />
                <StatCard label="Semesters" value={metrics.semesters} hint={`${metrics.activeRegistrations} currently accepting registration.`} />
                <StatCard label="Course Load" value={metrics.totalCourses} hint={`${metrics.totalRegistrations} student registrations recorded.`} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Semester Spotlight</h3>
                            <p className="mt-1 text-sm text-gray-500">Prioritize the semesters closest to release or needing action.</p>
                        </div>
                        <Link href="/admin/semesters" className="text-sm font-medium text-emerald-600">
                            View all semesters
                        </Link>
                    </div>

                    <div className="mt-5 space-y-4">
                        {spotlightSemesters.length ? spotlightSemesters.map((semester) => {
                            const releaseProgress = getReleaseProgress(semester);
                            return (
                                <Link
                                    key={semester.id}
                                    href={`/admin/semesters/${semester.id}`}
                                    className="block rounded-xl border border-gray-100 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/40"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-lg font-semibold text-gray-800">{semester.display_name}</p>
                                            <p className="text-sm text-gray-500">{semester.department} Semester {semester.normalized_semester_no}</p>
                                        </div>
                                        <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                            {semester.total_credits} credits
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-3">
                                        <div>{semester.course_count} courses</div>
                                        <div>{semester.registered_student_count} registrations</div>
                                        <div>{semester.released_course_count}/{semester.course_count} grades released</div>
                                    </div>
                                    <div className="mt-4">
                                        <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
                                            <span>Release readiness</span>
                                            <span>{releaseProgress}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-100">
                                            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${releaseProgress}%` }} />
                                        </div>
                                    </div>
                                </Link>
                            );
                        }) : (
                            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                                No semesters created yet. Start by creating one from the semesters page.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-gray-800">Quick Action Flow</h3>
                        <div className="mt-5 space-y-4">
                            {[
                                'Create a semester with the right credit target.',
                                'Add compulsory courses and elective options, then assign professors.',
                                'Open registration so students can choose electives.',
                                'Wait for professors to release course grades.',
                                'Release semester gradesheets once every course is ready.',
                            ].map((step, index) => (
                                <div key={step} className="flex gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                                        {index + 1}
                                    </div>
                                    <p className="pt-1 text-sm leading-6 text-gray-600">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                        <h3 className="text-xl font-bold text-gray-800">Release Snapshot</h3>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl bg-emerald-50 p-4">
                                <p className="text-sm font-medium text-emerald-700">Grade sheets released</p>
                                <p className="mt-2 text-3xl font-semibold text-emerald-900">{metrics.releasedSheets}</p>
                            </div>
                            <div className="rounded-2xl bg-amber-50 p-4">
                                <p className="text-sm font-medium text-amber-700">Open registrations</p>
                                <p className="mt-2 text-3xl font-semibold text-amber-900">{metrics.activeRegistrations}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </AdminShell>
    );
}
