"use client";

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/admin-shell';
import { useAdminSession } from '@/components/admin/use-admin-session';
import api from '@/lib/api';
import { getRegistrationStatusLabel, getReleaseProgress, normalizeSemester } from '@/lib/admin';

function MetricTile({ label, value, tone = 'slate' }) {
    const tones = {
        slate: 'bg-gray-100 text-gray-800',
        sky: 'bg-blue-100 text-blue-900',
        emerald: 'bg-emerald-100 text-emerald-900',
        amber: 'bg-amber-100 text-amber-900',
    };

    return (
        <div className={`rounded-[24px] p-5 ${tones[tone]}`}>
            <p className="text-sm font-medium opacity-80">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
        </div>
    );
}

export default function AdminSemesterDetailPage({ params }) {
    const { user, isReady } = useAdminSession();
    const [detail, setDetail] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const semesterId = params.semesterId;

    const loadDetail = async () => {
        try {
            setError('');
            const { data } = await api.get(`/admin/semesters/${semesterId}`);
            setDetail({
                ...data,
                semester: normalizeSemester(data.semester),
                registrations: data.registrations || [],
                grade_sheets: data.grade_sheets || [],
                courses: data.courses || [],
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load semester details');
        }
    };

    useEffect(() => {
        if (!isReady) return;
        loadDetail();
    }, [isReady, semesterId]);

    const semester = detail?.semester;
    const releaseProgress = useMemo(() => getReleaseProgress(semester), [semester]);

    const groupedCourses = useMemo(() => {
        const compulsory = [];
        const electives = [];
        for (const course of detail?.courses || []) {
            if (course.course_type === 'elective') electives.push(course);
            else compulsory.push(course);
        }
        return { compulsory, electives };
    }, [detail]);

    const toggleRegistration = async (nextState) => {
        try {
            setError('');
            setMessage('');
            await api.patch(`/admin/semesters/${semesterId}/registration`, { registration_open: nextState });
            setMessage(nextState ? 'Registration opened successfully.' : 'Registration closed successfully.');
            await loadDetail();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update registration state');
        }
    };

    const releaseGradeSheets = async () => {
        try {
            setError('');
            setMessage('');
            await api.post(`/admin/semesters/${semesterId}/release-grade-sheets`);
            setMessage('Semester gradesheets released successfully.');
            await loadDetail();
        } catch (err) {
            const pendingCourses = err.response?.data?.pending_courses;
            if (pendingCourses?.length) {
                const codes = pendingCourses.map((course) => course.code).join(', ');
                setError(`Some course grades are still pending release: ${codes}`);
                return;
            }
            setError(err.response?.data?.error || 'Failed to release gradesheets');
        }
    };

    if (!isReady) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-100">Loading semester...</div>;
    }

    return (
        <AdminShell
            user={user}
            title={semester ? semester.display_name : 'Semester Detail'}
            description="See the full registration and release picture before opening registration or publishing SPI-based gradesheets."
            actions={semester ? (
                <>
                    <button
                        type="button"
                        onClick={() => toggleRegistration(!semester.normalized_registration_open)}
                        className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
                            semester.normalized_registration_open ? 'bg-amber-600' : 'bg-emerald-600'
                        }`}
                    >
                        {semester.normalized_registration_open ? 'Close Registration' : 'Open Registration'}
                    </button>
                    <button
                        type="button"
                        onClick={releaseGradeSheets}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                        Release Grade Sheets
                    </button>
                </>
            ) : null}
        >
            {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            {!semester ? (
                <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-gray-500 shadow-sm">
                    Semester details are loading.
                </div>
            ) : (
                <>
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricTile label="Registration" value={getRegistrationStatusLabel(semester)} tone="amber" />
                        <MetricTile label="Students Registered" value={detail.registrations.length} tone="sky" />
                        <MetricTile label="Courses Offered" value={detail.courses.length} tone="slate" />
                        <MetricTile label="Gradesheet Status" value={semester.gradesheet_released ? 'Released' : 'Pending'} tone="emerald" />
                    </section>

                    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Readiness Snapshot</h3>
                                <p className="mt-2 text-sm text-gray-500">
                                    {semester.department} Semester {semester.normalized_semester_no} · {semester.total_credits} total credits
                                </p>
                            </div>
                            <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
                                {semester.released_course_count}/{semester.course_count} course grades released
                            </div>
                        </div>

                        <div className="mt-5">
                            <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
                                <span>Release progress</span>
                                <span>{releaseProgress}%</span>
                            </div>
                            <div className="h-3 rounded-full bg-gray-100">
                                <div className="h-3 rounded-full bg-blue-500" style={{ width: `${releaseProgress}%` }} />
                            </div>
                        </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr_1fr]">
                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-xl font-bold text-gray-800">Compulsory Courses</h3>
                            <div className="mt-5 space-y-3">
                                {groupedCourses.compulsory.map((course) => (
                                    <div key={course.id} className="rounded-xl border border-gray-200 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-gray-800">{course.code}</p>
                                                <p className="text-sm text-gray-500">{course.name}</p>
                                            </div>
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{course.credits} cr</span>
                                        </div>
                                        <p className="mt-3 text-sm text-gray-600">{course.professor_name || 'Professor not assigned yet'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-xl font-bold text-gray-800">Elective Options</h3>
                            <div className="mt-5 space-y-3">
                                {groupedCourses.electives.length ? groupedCourses.electives.map((course) => (
                                    <div key={course.id} className="rounded-xl border border-gray-200 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-gray-800">{course.code}</p>
                                                <p className="text-sm text-gray-500">{course.name}</p>
                                            </div>
                                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                                {course.elective_group || 'Elective'}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-sm text-gray-600">{course.professor_name || 'Professor not assigned yet'}</p>
                                    </div>
                                )) : (
                                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                                        No elective courses configured for this semester yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-xl font-bold text-gray-800">Grade Sheet Output</h3>
                            <div className="mt-5 space-y-3">
                                {detail.grade_sheets.length ? detail.grade_sheets.map((sheet) => (
                                    <div key={sheet.id} className="rounded-xl border border-gray-200 p-4">
                                        <p className="font-semibold text-gray-800">{sheet.student_name}</p>
                                        <p className="text-sm text-gray-500">{sheet.roll_no}</p>
                                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-gray-500">SPI</p>
                                                <p className="font-semibold text-blue-700">{sheet.spi}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500">Grade points</p>
                                                <p className="font-semibold text-gray-800">{sheet.total_grade_points}</p>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                                        No semester gradesheets released yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-2">
                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-xl font-bold text-gray-800">Student Registrations</h3>
                            <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium">Roll No</th>
                                                <th className="px-4 py-3 text-left font-medium">Student</th>
                                                <th className="px-4 py-3 text-left font-medium">Credits</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {detail.registrations.map((registration) => (
                                                <tr key={registration.id}>
                                                    <td className="px-4 py-4 font-mono text-gray-700">{registration.roll_no}</td>
                                                    <td className="px-4 py-4 text-gray-800">{registration.student_name}</td>
                                                    <td className="px-4 py-4 text-gray-600">{registration.total_credits}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                            <h3 className="text-xl font-bold text-gray-800">Course Assignment Grid</h3>
                            <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium">Code</th>
                                                <th className="px-4 py-3 text-left font-medium">Course</th>
                                                <th className="px-4 py-3 text-left font-medium">Type</th>
                                                <th className="px-4 py-3 text-left font-medium">Professor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {detail.courses.map((course) => (
                                                <tr key={course.id}>
                                                    <td className="px-4 py-4 font-mono text-gray-700">{course.code}</td>
                                                    <td className="px-4 py-4 text-gray-800">{course.name}</td>
                                                    <td className="px-4 py-4 text-gray-600">
                                                        {course.course_type}
                                                        {course.elective_group ? ` · ${course.elective_group}` : ''}
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600">{course.professor_name || 'Unassigned'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </section>
                </>
            )}
        </AdminShell>
    );
}
