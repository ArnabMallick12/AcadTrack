"use client";

import { useEffect, useMemo, useState } from 'react';
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
    department: '',
    semester: '',
};

export default function AdminUsersPage() {
    const { user, isReady } = useAdminSession();
    const [users, setUsers] = useState([]);
    const [userForm, setUserForm] = useState(initialUserForm);
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
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

    const filteredUsers = useMemo(() => {
        return users.filter((entry) => {
            const matchesRole = roleFilter === 'all' || entry.role === roleFilter;
            const haystack = `${entry.name} ${entry.email} ${entry.department || ''} ${entry.roll_no || ''}`.toLowerCase();
            const matchesQuery = haystack.includes(query.toLowerCase());
            return matchesRole && matchesQuery;
        });
    }, [query, roleFilter, users]);

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

            <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <form onSubmit={submitUser} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
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
                        <input className="w-full rounded-lg border px-4 py-3 text-sm" placeholder="Department" value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} required />

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

                <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">User Directory</h3>
                            <p className="mt-2 text-sm text-gray-500">Search by name, email, roll number, or department.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <input className="rounded-lg border px-4 py-3 text-sm" placeholder="Search users" value={query} onChange={(e) => setQuery(e.target.value)} />
                            <select className="rounded-lg border px-4 py-3 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                                <option value="all">All roles</option>
                                <option value="student">Students</option>
                                <option value="professor">Professors</option>
                                <option value="admin">Admins</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-6 overflow-hidden rounded-xl border border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">User</th>
                                        <th className="px-4 py-3 text-left font-medium">Role</th>
                                        <th className="px-4 py-3 text-left font-medium">Department</th>
                                        <th className="px-4 py-3 text-left font-medium">Academic Info</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredUsers.map((entry) => (
                                        <tr key={entry.id} className="bg-white">
                                            <td className="px-4 py-4 align-top">
                                                <p className="font-medium text-gray-800">{entry.name}</p>
                                                <p className="text-gray-500">{entry.email}</p>
                                            </td>
                                            <td className="px-4 py-4 align-top">
                                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                                    {formatRole(entry.role)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 align-top text-gray-600">{entry.department || '-'}</td>
                                            <td className="px-4 py-4 align-top text-gray-600">
                                                {entry.role === 'student'
                                                    ? `${entry.roll_no || '-'} · Semester ${entry.semester || '-'}`
                                                    : 'Profile ready'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>
        </AdminShell>
    );
}
