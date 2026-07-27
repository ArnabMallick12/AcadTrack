"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/admin-shell';
import { useAdminSession } from '@/components/admin/use-admin-session';
import api from '@/lib/api';
import { formatRole } from '@/lib/admin';

const initialUserForm = {
    name: '',
    email: '',
    password: '',
    role: 'student',
    roll_no: '',
    department: 'CSE',
    semester: '',
};

export default function AdminUsersPage() {
    const { user, isReady } = useAdminSession();
    const [users, setUsers] = useState([]);
    const [userForm, setUserForm] = useState(initialUserForm);
    const [query, setQuery] = useState('');
    const [semesterFilterDraft, setSemesterFilterDraft] = useState('all');
    const [semesterFilter, setSemesterFilter] = useState('all');
    const [semesterEdits, setSemesterEdits] = useState({});
    const [updatingStudentId, setUpdatingStudentId] = useState(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [bulkSemester, setBulkSemester] = useState('');
    const [bulkUpdating, setBulkUpdating] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const loadUsers = async () => {
        try {
            setError('');
            const { data } = await api.get('/admin/users');
            setUsers(data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load users');
        }
    };

    useEffect(() => {
        if (!isReady) return;
        loadUsers();
    }, [isReady]);

    const matchesDirectorySearch = useCallback((entry) => {
        const haystack = `${entry.name} ${entry.email} ${entry.department || ''} ${entry.roll_no || ''}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
    }, [query]);

    const semesterOptions = useMemo(() => {
        const semesters = users
            .filter((entry) => entry.role === 'student' && entry.semester !== null && entry.semester !== undefined)
            .map((entry) => Number(entry.semester))
            .filter((semester) => Number.isInteger(semester));

        return [...new Set(semesters)].sort((a, b) => a - b);
    }, [users]);

    const studentDirectory = useMemo(() => {
        return users.filter((entry) => {
            const matchesSemester = semesterFilter === 'all' || Number(entry.semester) === Number(semesterFilter);
            return entry.role === 'student' && matchesDirectorySearch(entry) && matchesSemester;
        });
    }, [matchesDirectorySearch, semesterFilter, users]);

    const professorDirectory = useMemo(() => {
        return users.filter((entry) => entry.role === 'professor' && matchesDirectorySearch(entry));
    }, [matchesDirectorySearch, users]);

    const adminDirectory = useMemo(() => {
        return users.filter((entry) => entry.role === 'admin' && matchesDirectorySearch(entry));
    }, [matchesDirectorySearch, users]);

    const selectedStudentSet = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);

    const filteredStudentIds = useMemo(() => {
        return studentDirectory.map((entry) => entry.student_id).filter(Boolean);
    }, [studentDirectory]);

    const allFilteredStudentsSelected = filteredStudentIds.length > 0 && filteredStudentIds.every((id) => selectedStudentSet.has(id));

    useEffect(() => {
        const currentStudentIds = new Set(users.filter((entry) => entry.role === 'student').map((entry) => entry.student_id));
        setSelectedStudentIds((current) => current.filter((id) => currentStudentIds.has(id)));
    }, [users]);

    const submitUser = async (event) => {
        event.preventDefault();
        try {
            setError('');
            setMessage('');
            await api.post('/admin/users', {
                ...userForm,
                semester: userForm.role === 'student' ? Number(userForm.semester) : undefined,
            });
            setMessage('User created successfully.');
            setUserForm(initialUserForm);
            await loadUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create user');
        }
    };

    const updateStudentSemester = async (student) => {
        const semester = Number(semesterEdits[student.student_id] ?? student.semester);

        try {
            setError('');
            setMessage('');
            setUpdatingStudentId(student.student_id);
            await api.patch(`/admin/students/${student.student_id}/semester`, { semester });
            setMessage(`${student.name}'s semester was updated successfully.`);
            setSemesterEdits((current) => {
                const next = { ...current };
                delete next[student.student_id];
                return next;
            });
            await loadUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update student semester');
        } finally {
            setUpdatingStudentId(null);
        }
    };

    const toggleStudentSelection = (studentId) => {
        setSelectedStudentIds((current) => {
            if (current.includes(studentId)) {
                return current.filter((id) => id !== studentId);
            }

            return [...current, studentId];
        });
    };

    const selectFilteredStudents = () => {
        setSelectedStudentIds((current) => [...new Set([...current, ...filteredStudentIds])]);
    };

    const updateSelectedStudentSemesters = async () => {
        const semester = Number(bulkSemester);

        if (!selectedStudentIds.length) {
            setError('Select at least one student first.');
            setMessage('');
            return;
        }

        if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
            setError('Semester must be a whole number between 1 and 12.');
            setMessage('');
            return;
        }

        try {
            setError('');
            setMessage('');
            setBulkUpdating(true);
            const { data } = await api.patch('/admin/students/semester', {
                student_ids: selectedStudentIds,
                semester,
            });

            setMessage(`${data.updated_count || selectedStudentIds.length} selected student semester${(data.updated_count || selectedStudentIds.length) === 1 ? '' : 's'} updated successfully.`);
            setSemesterEdits((current) => {
                const next = { ...current };
                selectedStudentIds.forEach((studentId) => {
                    delete next[studentId];
                });
                return next;
            });
            setSelectedStudentIds([]);
            setBulkSemester('');
            await loadUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update selected student semesters');
        } finally {
            setBulkUpdating(false);
        }
    };

    if (!isReady) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-100">Loading users...</div>;
    }

    return (
        <AdminShell
            user={user}
            title="Users"
            description="Create student, professor, and admin accounts, then quickly search the roster to verify profiles before the semester starts."
        >
            {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <section className="grid gap-6 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
                <form onSubmit={submitUser} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
                    <h3 className="text-xl font-bold text-gray-800">Create New User</h3>
                    <p className="mt-2 text-sm text-gray-500">Set up accounts for the next registration cycle without leaving the admin area.</p>

                    <div className="mt-5 space-y-4">
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" placeholder="Full name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
                        <select className="w-full rounded-lg border px-4 py-3 text-sm" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                            <option value="student">Student</option>
                            <option value="professor">Professor</option>
                            <option value="admin">Admin</option>
                        </select>
                        <select className="w-full rounded-lg border px-4 py-3 text-sm" value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} required>
                            <option value="CSE">CSE</option>
                            <option value="IT">IT</option>
                        </select>

                        {userForm.role === 'student' ? (
                            <>
                                <input className="w-full rounded-lg border px-4 py-3 text-sm" placeholder="Roll number" value={userForm.roll_no} onChange={(e) => setUserForm({ ...userForm, roll_no: e.target.value })} required />
                                <input className="w-full rounded-lg border px-4 py-3 text-sm" type="number" placeholder="Current semester number" value={userForm.semester} onChange={(e) => setUserForm({ ...userForm, semester: e.target.value })} required />
                            </>
                        ) : null}

                        <button className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700">
                            Create User
                        </button>
                    </div>
                </form>

                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">User Directory</h3>
                            <p className="mt-2 text-sm text-gray-500">Students and professors are separated for faster semester changes.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)]">
                            <input className="rounded-lg border px-4 py-3 text-sm" placeholder="Search users" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-gray-200">
                        <div className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50 px-4 py-4 xl:flex-row xl:items-end xl:justify-between">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h4 className="text-lg font-bold text-gray-800">Student Directory</h4>
                                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{studentDirectory.length} shown</span>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">{selectedStudentIds.length} selected for semester update.</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[160px_auto_auto_140px_auto]">
                                <select
                                    className="rounded-lg border bg-white px-3 py-2 text-sm"
                                    value={semesterFilterDraft}
                                    onChange={(event) => setSemesterFilterDraft(event.target.value)}
                                >
                                    <option value="all">All semesters</option>
                                    {semesterOptions.map((semester) => (
                                        <option key={semester} value={semester}>Semester {semester}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                    onClick={() => setSemesterFilter(semesterFilterDraft)}
                                >
                                    Filter
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={!filteredStudentIds.length || allFilteredStudentsSelected}
                                    onClick={selectFilteredStudents}
                                >
                                    Select Filtered
                                </button>
                                <input
                                    className="rounded-lg border bg-white px-3 py-2 text-sm"
                                    type="number"
                                    min="1"
                                    max="12"
                                    placeholder="New semester"
                                    value={bulkSemester}
                                    onChange={(event) => setBulkSemester(event.target.value)}
                                />
                                <button
                                    type="button"
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 xl:col-span-1"
                                    disabled={!selectedStudentIds.length || bulkUpdating}
                                    onClick={updateSelectedStudentSemesters}
                                >
                                    {bulkUpdating ? 'Updating...' : 'Update Selected'}
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="w-12 px-4 py-3 text-left font-medium">Select</th>
                                        <th className="px-4 py-3 text-left font-medium">Student</th>
                                        <th className="px-4 py-3 text-left font-medium">Department</th>
                                        <th className="px-4 py-3 text-left font-medium">Roll No.</th>
                                        <th className="px-4 py-3 text-left font-medium">Semester</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {studentDirectory.map((entry) => (
                                        <tr key={entry.id} className="bg-white">
                                            <td className="px-4 py-4 align-top">
                                                <input
                                                    aria-label={`Select ${entry.name}`}
                                                    className="h-4 w-4 rounded border-gray-300"
                                                    type="checkbox"
                                                    checked={selectedStudentSet.has(entry.student_id)}
                                                    onChange={() => toggleStudentSelection(entry.student_id)}
                                                />
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <p className="font-medium text-gray-800">{entry.name}</p>
                                                <p className="text-gray-500">{entry.email}</p>
                                            </td>
                                            <td className="px-4 py-4 align-top text-gray-600">{entry.department || '-'}</td>
                                            <td className="px-4 py-4 align-top text-gray-600">{entry.roll_no || '-'}</td>
                                            <td className="px-4 py-4 align-top text-gray-600">
                                                <div className="flex min-w-[220px] items-center gap-2">
                                                    <input
                                                        aria-label={`Semester for ${entry.name}`}
                                                        className="w-20 rounded-lg border px-3 py-2 text-sm"
                                                        type="number"
                                                        min="1"
                                                        max="12"
                                                        value={semesterEdits[entry.student_id] ?? entry.semester ?? ''}
                                                        onChange={(event) => setSemesterEdits({
                                                            ...semesterEdits,
                                                            [entry.student_id]: event.target.value,
                                                        })}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                        disabled={
                                                            updatingStudentId === entry.student_id ||
                                                            semesterEdits[entry.student_id] === undefined ||
                                                            Number(semesterEdits[entry.student_id]) === Number(entry.semester)
                                                        }
                                                        onClick={() => updateStudentSemester(entry)}
                                                    >
                                                        {updatingStudentId === entry.student_id ? 'Updating...' : 'Update'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!studentDirectory.length ? (
                                        <tr className="bg-white">
                                            <td className="px-4 py-6 text-center text-gray-500" colSpan="5">
                                                No students match this search and semester filter.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-4">
                            <h4 className="text-lg font-bold text-gray-800">Professor Directory</h4>
                            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">{professorDirectory.length} shown</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Professor</th>
                                        <th className="px-4 py-3 text-left font-medium">Department</th>
                                        <th className="px-4 py-3 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {professorDirectory.map((entry) => (
                                        <tr key={entry.id} className="bg-white">
                                            <td className="px-4 py-4 align-top">
                                                <p className="font-medium text-gray-800">{entry.name}</p>
                                                <p className="text-gray-500">{entry.email}</p>
                                            </td>
                                            <td className="px-4 py-4 align-top text-gray-600">{entry.department || '-'}</td>
                                            <td className="px-4 py-4 align-top">
                                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                                    {formatRole(entry.role)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!professorDirectory.length ? (
                                        <tr className="bg-white">
                                            <td className="px-4 py-6 text-center text-gray-500" colSpan="3">
                                                No professors match this search.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-4">
                            <h4 className="text-lg font-bold text-gray-800">Admin Directory</h4>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{adminDirectory.length} shown</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Admin</th>
                                        <th className="px-4 py-3 text-left font-medium">Department</th>
                                        <th className="px-4 py-3 text-left font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {adminDirectory.map((entry) => (
                                        <tr key={entry.id} className="bg-white">
                                            <td className="px-4 py-4 align-top">
                                                <p className="font-medium text-gray-800">{entry.name}</p>
                                                <p className="text-gray-500">{entry.email}</p>
                                            </td>
                                            <td className="px-4 py-4 align-top text-gray-600">{entry.department || '-'}</td>
                                            <td className="px-4 py-4 align-top">
                                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                                    {formatRole(entry.role)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!adminDirectory.length ? (
                                        <tr className="bg-white">
                                            <td className="px-4 py-6 text-center text-gray-500" colSpan="3">
                                                No admins match this search.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>
        </AdminShell>
    );
}
