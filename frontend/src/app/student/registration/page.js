"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { clearSession, getStoredToken, getStoredUser } from '@/lib/auth';

export default function StudentRegistrationPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [data, setData] = useState(null);
    const [selectedSemesterId, setSelectedSemesterId] = useState('');
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedToken = getStoredToken();
        if (!storedUser || !storedToken) {
            clearSession();
            router.push('/login');
            return;
        }

        const parsed = JSON.parse(storedUser);
        if (parsed.role !== 'student') {
            router.push('/login');
            return;
        }

        setUser(parsed);
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            setError('');
            const { data } = await api.get('/registration/current');
            setData(data);

            if (data.semesters.length) {
                const firstSemester = data.semesters[0];
                setSelectedSemesterId(String(firstSemester.id));
                setSelectedSubjects(
                    firstSemester.registration?.selected_subject_ids ||
                    firstSemester.courses
                        .filter((course) => course.course_type === 'compulsory')
                        .map((course) => course.id)
                );
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load registration data');
        } finally {
            setLoading(false);
        }
    };

    const selectedSemester = useMemo(
        () => data?.semesters?.find((semester) => String(semester.id) === String(selectedSemesterId)) || null,
        [data, selectedSemesterId]
    );

    const courseMap = useMemo(
        () => new Map((selectedSemester?.courses || []).map((course) => [course.id, course])),
        [selectedSemester]
    );

    const electiveGroups = useMemo(() => {
        const groups = new Map();
        (selectedSemester?.courses || [])
            .filter((course) => course.course_type === 'elective')
            .forEach((course) => {
                const key = course.elective_group || 'ELECTIVE';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(course);
            });
        return groups;
    }, [selectedSemester]);

    const totalSelectedCredits = selectedSubjects.reduce(
        (sum, subjectId) => sum + Number(courseMap.get(subjectId)?.credits || 0),
        0
    );

    const selectedElectiveSummary = useMemo(() => {
        const summary = [];
        for (const [group, courses] of electiveGroups.entries()) {
            const selectedCourse = courses.find((course) => selectedSubjects.includes(course.id));
            summary.push({
                group,
                selectedCourse,
                credits: Number(courses[0]?.credits || 0),
            });
        }
        return summary;
    }, [electiveGroups, selectedSubjects]);

    const handleSemesterChange = (semesterId) => {
        const semester = data.semesters.find((entry) => String(entry.id) === String(semesterId));
        setSelectedSemesterId(String(semesterId));
        setSelectedSubjects(
            semester?.registration?.selected_subject_ids ||
            semester?.courses.filter((course) => course.course_type === 'compulsory').map((course) => course.id) ||
            []
        );
    };

    const toggleElective = (group, subjectId) => {
        const groupCourseIds = (electiveGroups.get(group) || []).map((course) => course.id);
        setSelectedSubjects((prev) => [
            ...prev.filter((id) => !groupCourseIds.includes(id)),
            subjectId,
        ]);
    };

    const submitRegistration = async () => {
        if (!selectedSemester) return;
        setError('');
        setMessage('');
        try {
            await api.post('/registration/submit', {
                semester_id: selectedSemester.id,
                selected_subject_ids: selectedSubjects,
            });
            setMessage('Registration submitted successfully.');
            await loadData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit registration');
        }
    };

    if (loading || !user) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100">Loading registration...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-100 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="bg-white rounded-2xl border shadow-sm p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Semester Registration</h1>
                        <p className="text-slate-500 mt-1">
                            Register compulsory courses and choose one option from each elective group such as OE1 or EO1.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push('/student/courses')}
                            className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium"
                        >
                            My Courses
                        </button>
                        <button
                            onClick={() => router.push('/student/gradesheets')}
                            className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 font-medium"
                        >
                            Grade Sheets
                        </button>
                        <button
                            onClick={() => { clearSession(); router.push('/login'); }}
                            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium"
                        >
                            Log Out
                        </button>
                    </div>
                </div>

                {message ? <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">{message}</div> : null}
                {error ? <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl">{error}</div> : null}

                <div className="bg-white rounded-2xl border shadow-sm p-5">
                    <label className="block text-sm font-medium text-slate-600 mb-2">Available semester registration</label>
                    <select
                        className="w-full max-w-xl border rounded-lg px-3 py-2"
                        value={selectedSemesterId}
                        onChange={(e) => handleSemesterChange(e.target.value)}
                    >
                        {data?.semesters?.map((semester) => (
                            <option key={semester.id} value={semester.id}>
                                {semester.display_name || semester.name} - {semester.department} Semester {semester.normalized_semester_no || semester.semester_no}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedSemester ? (
                    <div className="grid grid-cols-1 xl:grid-cols-[1.9fr_1.1fr] gap-6">
                        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">{selectedSemester.display_name || selectedSemester.name}</h2>
                                    <p className="text-slate-500">
                                        {selectedSemester.department} Semester {selectedSemester.normalized_semester_no || selectedSemester.semester_no}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${(selectedSemester.normalized_registration_open ?? selectedSemester.registration_open) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {(selectedSemester.normalized_registration_open ?? selectedSemester.registration_open) ? 'Registration Open' : 'Registration Closed'}
                                </span>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-900 mb-3">Compulsory Courses</h3>
                                <div className="space-y-3">
                                    {selectedSemester.courses
                                        .filter((course) => course.course_type === 'compulsory')
                                        .map((course) => (
                                            <label key={course.id} className="flex items-center justify-between border rounded-xl p-4 bg-slate-50">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{course.code} · {course.name}</p>
                                                    <p className="text-sm text-slate-500">{course.professor_name || 'Professor pending'} · {course.credits} credits</p>
                                                </div>
                                                <input type="checkbox" checked readOnly className="w-5 h-5 accent-blue-600" />
                                            </label>
                                        ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-900 mb-3">Elective Choices</h3>
                                <div className="space-y-5">
                                    {[...electiveGroups.entries()].map(([group, courses]) => (
                                        <div key={group} className="border rounded-2xl p-4">
                                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{group}</p>
                                                    <p className="text-sm text-slate-500">Choose exactly one course from this elective group.</p>
                                                </div>
                                                <span className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                                    {courses[0]?.credits || 0} credits
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                {courses.map((course) => (
                                                    <label key={course.id} className="flex items-center justify-between border rounded-xl p-4">
                                                        <div>
                                                            <p className="font-semibold text-slate-900">{course.code} · {course.name}</p>
                                                            <p className="text-sm text-slate-500">{course.professor_name || 'Professor pending'} · {course.credits} credits</p>
                                                        </div>
                                                        <input
                                                            type="radio"
                                                            name={`elective-${group}`}
                                                            checked={selectedSubjects.includes(course.id)}
                                                            onChange={() => toggleElective(group, course.id)}
                                                            disabled={!(selectedSemester.normalized_registration_open ?? selectedSemester.registration_open)}
                                                            className="w-5 h-5 accent-blue-600"
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white rounded-2xl border shadow-sm p-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">Registration Summary</h3>
                                <div className="space-y-3 text-sm text-slate-600">
                                    <div className="flex justify-between">
                                        <span>Required credits</span>
                                        <span className="font-semibold text-slate-900">{selectedSemester.total_credits}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Selected credits</span>
                                        <span className={`font-semibold ${totalSelectedCredits === Number(selectedSemester.total_credits) ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {totalSelectedCredits}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Status</span>
                                        <span className="font-semibold text-slate-900">{selectedSemester.registration ? 'Already registered' : 'Not submitted yet'}</span>
                                    </div>
                                </div>

                                {selectedElectiveSummary.length ? (
                                    <div className="mt-5 space-y-3 border-t pt-4">
                                        <p className="text-sm font-semibold text-slate-900">Elective Group Selection</p>
                                        {selectedElectiveSummary.map((entry) => (
                                            <div key={entry.group} className="flex items-center justify-between text-sm">
                                                <span className="text-slate-600">{entry.group}</span>
                                                <span className={`font-medium ${entry.selectedCourse ? 'text-slate-900' : 'text-rose-700'}`}>
                                                    {entry.selectedCourse ? entry.selectedCourse.code : 'Not selected'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                <button
                                    onClick={submitRegistration}
                                    disabled={!(selectedSemester.normalized_registration_open ?? selectedSemester.registration_open)}
                                    className="w-full mt-5 bg-blue-600 text-white rounded-lg px-4 py-2.5 font-medium disabled:opacity-50"
                                >
                                    Submit Registration
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl border shadow-sm p-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">Grade Sheet</h3>
                                <div className="space-y-4">
                                    {(() => {
                                        // Filter grade sheets for the currently selected semester
                                        const semesterGradeSheet = data.grade_sheets.find(
                                            (sheet) => String(sheet.semester_id) === String(selectedSemesterId)
                                        );

                                        if (!semesterGradeSheet) {
                                            return (
                                                <div className="text-center py-8">
                                                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm text-slate-500">No grade sheet data available for this semester.</p>
                                                </div>
                                            );
                                        }

                                        if (!semesterGradeSheet.released) {
                                            return (
                                                <div className="text-center py-8">
                                                    <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                                                        <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </div>
                                                    <p className="font-semibold text-amber-700 mb-1">Grade Sheet Not Released</p>
                                                    <p className="text-sm text-slate-500">
                                                        The grade sheet for {semesterGradeSheet.semester_name} (Semester {semesterGradeSheet.semester_no}) has not been released yet. Please check back later.
                                                    </p>
                                                </div>
                                            );
                                        }

                                        // Released grade sheet — show full details
                                        return (
                                            <div className="border rounded-2xl p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-slate-900">{semesterGradeSheet.semester_name}</p>
                                                        <p className="text-sm text-slate-500">{semesterGradeSheet.department} Semester {semesterGradeSheet.semester_no}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm text-slate-500">SPI</p>
                                                        <p className="text-2xl font-bold text-blue-700">{semesterGradeSheet.spi}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-slate-50">
                                                            <tr>
                                                                <th className="p-2 text-left">Course</th>
                                                                <th className="p-2 text-left">Credits</th>
                                                                <th className="p-2 text-left">Grade</th>
                                                                <th className="p-2 text-left">Points</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {semesterGradeSheet.courses.map((course) => (
                                                                <tr key={course.id} className="border-t">
                                                                    <td className="p-2">{course.code} · {course.subject_name}</td>
                                                                    <td className="p-2">{course.credits}</td>
                                                                    <td className="p-2">{course.grade_code}</td>
                                                                    <td className="p-2">{course.course_grade_points}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                                                    <span className="text-slate-500">Total Credits: <span className="font-semibold text-slate-900">{semesterGradeSheet.total_credits}</span></span>
                                                    <span className="text-slate-500">Total Grade Points: <span className="font-semibold text-slate-900">{semesterGradeSheet.total_grade_points}</span></span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
