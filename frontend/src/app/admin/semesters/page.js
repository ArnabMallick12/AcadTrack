"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '@/components/admin/admin-shell';
import { useAdminSession } from '@/components/admin/use-admin-session';
import api from '@/lib/api';
import { getRegistrationStatusLabel, getReleaseProgress, normalizeSemester } from '@/lib/admin';

const initialSemesterForm = {
    name: '',
    department: '',
    semester_no: '',
    total_credits: '',
};

const initialCourseForm = {
    semester_id: '',
    name: '',
    code: '',
    professor_id: '',
    credits: '',
    course_type: 'compulsory',
    elective_group: '',
};

export default function AdminSemestersPage() {
    const router = useRouter();
    const { user, isReady } = useAdminSession();
    const [professors, setProfessors] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [semesterForm, setSemesterForm] = useState(initialSemesterForm);
    const [courseForm, setCourseForm] = useState(initialCourseForm);
    const [search, setSearch] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const loadData = async () => {
        try {
            setError('');
            const [profRes, semRes] = await Promise.all([
                api.get('/admin/professors'),
                api.get('/admin/semesters'),
            ]);
            setProfessors(profRes.data);
            setSemesters((semRes.data || []).map(normalizeSemester));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load semesters');
        }
    };

    useEffect(() => {
        if (!isReady) return;
        loadData();
    }, [isReady]);

    const filteredSemesters = useMemo(() => {
        return semesters.filter((semester) => {
            const haystack = `${semester.display_name} ${semester.department} ${semester.normalized_semester_no}`.toLowerCase();
            return haystack.includes(search.toLowerCase());
        });
    }, [search, semesters]);

    const submitSemester = async (event) => {
        event.preventDefault();
        try {
            setError('');
            setMessage('');
            const { data } = await api.post('/admin/semesters', {
                ...semesterForm,
                semester_no: Number(semesterForm.semester_no),
                total_credits: Number(semesterForm.total_credits),
            });
            setMessage('Semester created successfully.');
            setSemesterForm(initialSemesterForm);
            await loadData();
            router.push(`/admin/semesters/${data.id}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create semester');
        }
    };

    const submitCourse = async (event) => {
        event.preventDefault();
        try {
            setError('');
            setMessage('');
            await api.post('/admin/courses', {
                ...courseForm,
                semester_id: Number(courseForm.semester_id),
                professor_id: Number(courseForm.professor_id),
                credits: Number(courseForm.credits),
                elective_group: courseForm.course_type === 'elective' ? courseForm.elective_group : '',
            });
            const semesterId = Number(courseForm.semester_id);
            setMessage('Course added successfully.');
            setCourseForm(initialCourseForm);
            await loadData();
            router.push(`/admin/semesters/${semesterId}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add course');
        }
    };

    if (!isReady) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-100">Loading semesters...</div>;
    }

    return (
        <AdminShell
            user={user}
            title="Semesters"
            description="Create semester offerings, define the credit target, attach courses, and keep a clear view of which semester is ready for registration or gradesheet release."
        >
            {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <section className="grid gap-6 xl:grid-cols-[360px_360px_minmax(0,1fr)]">
                <form onSubmit={submitSemester} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-800">Create Semester</h3>
                    <div className="mt-5 space-y-4">
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" placeholder="Semester name" value={semesterForm.name} onChange={(e) => setSemesterForm({ ...semesterForm, name: e.target.value })} required />
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" placeholder="Department" value={semesterForm.department} onChange={(e) => setSemesterForm({ ...semesterForm, department: e.target.value })} required />
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" type="number" placeholder="Semester number" value={semesterForm.semester_no} onChange={(e) => setSemesterForm({ ...semesterForm, semester_no: e.target.value })} required />
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" type="number" placeholder="Total credits" value={semesterForm.total_credits} onChange={(e) => setSemesterForm({ ...semesterForm, total_credits: e.target.value })} required />
                        <button className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">Create Semester</button>
                    </div>
                </form>

                <form onSubmit={submitCourse} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-800">Add Course Offering</h3>
                    <div className="mt-5 space-y-4">
                        <select className="w-full rounded-lg border px-4 py-3 text-sm" value={courseForm.semester_id} onChange={(e) => setCourseForm({ ...courseForm, semester_id: e.target.value })} required>
                            <option value="">Select semester</option>
                            {semesters.map((semester) => (
                                <option key={semester.id} value={semester.id}>
                                    {semester.display_name} · {semester.department} Sem {semester.normalized_semester_no}
                                </option>
                            ))}
                        </select>
                            <input className="w-full rounded-lg border px-4 py-3 text-sm" placeholder="Course name" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} required />
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" placeholder="Course code" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })} required />
                        <select className="w-full rounded-lg border px-4 py-3 text-sm" value={courseForm.professor_id} onChange={(e) => setCourseForm({ ...courseForm, professor_id: e.target.value })} required>
                            <option value="">Assign professor</option>
                            {professors.map((professor) => (
                                <option key={professor.id} value={professor.id}>{professor.name} · {professor.department}</option>
                            ))}
                        </select>
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" type="number" placeholder="Credits" value={courseForm.credits} onChange={(e) => setCourseForm({ ...courseForm, credits: e.target.value })} required />
                        <select className="w-full rounded-lg border px-4 py-3 text-sm" value={courseForm.course_type} onChange={(e) => setCourseForm({ ...courseForm, course_type: e.target.value })}>
                            <option value="compulsory">Compulsory</option>
                            <option value="elective">Elective</option>
                        </select>
                        {courseForm.course_type === 'elective' ? (
                            <div className="space-y-2">
                                <input
                                    className="w-full rounded-lg border px-4 py-3 text-sm"
                                    placeholder="Elective group (e.g. OE1, EO1, HS1)"
                                    value={courseForm.elective_group}
                                    onChange={(e) => setCourseForm({ ...courseForm, elective_group: e.target.value.toUpperCase() })}
                                    required
                                />
                                <p className="text-xs text-gray-500">
                                    Students will choose exactly one course from each elective group. Courses inside the same group must have the same credits.
                                </p>
                            </div>
                        ) : null}
                        <button className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Add Course</button>
                    </div>
                </form>

                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Semester Board</h3>
                            <p className="mt-1 text-sm text-gray-500">Track planning, registration, and release progress.</p>
                        </div>
                        <input
                            className="w-full rounded-lg border px-4 py-3 text-sm lg:w-64"
                            placeholder="Search semester"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="mt-5 space-y-4">
                        {filteredSemesters.map((semester) => {
                            const releaseProgress = getReleaseProgress(semester);
                            return (
                                <Link
                                    key={semester.id}
                                    href={`/admin/semesters/${semester.id}`}
                                    className="block rounded-xl border border-gray-100 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/40"
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <p className="text-lg font-semibold text-gray-800">{semester.display_name}</p>
                                            <p className="text-sm text-gray-500">{semester.department} Semester {semester.normalized_semester_no}</p>
                                        </div>
                                        <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                            {getRegistrationStatusLabel(semester)}
                                        </span>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 min-[420px]:grid-cols-3">
                                        <div>{semester.course_count} courses</div>
                                        <div>{semester.registered_student_count} registrations</div>
                                        <div>{semester.total_credits} credits</div>
                                    </div>

                                    <div className="mt-4">
                                        <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
                                            <span>Grades released</span>
                                            <span>{semester.released_course_count}/{semester.course_count}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-100">
                                            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${releaseProgress}%` }} />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>
        </AdminShell>
    );
}
