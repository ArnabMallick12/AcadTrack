"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layers, LogOut } from 'lucide-react';
import { clearSession } from '@/lib/auth';

const navItems = [
    { href: '/admin/dashboard', label: 'Overview' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/semesters', label: 'Semesters' },
];

function isActive(pathname, href) {
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({ user, title, description, actions, children }) {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            <div className="flex min-h-screen flex-col lg:flex-row">
                <aside className="w-full border-b bg-white shadow-sm lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:shadow-lg">
                    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
                        <div className="lg:mb-2">
                            <div className="mb-3 flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                                    <Layers size={18} className="text-white" />
                                </div>
                                <h1 className="text-xl font-bold text-emerald-600">AcadTrack</h1>
                            </div>
                            <p className="text-sm text-gray-500">Admin Portal</p>
                        </div>

                        <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
                            {navItems.map((item) => {
                                const active = isActive(pathname, item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`flex shrink-0 items-center justify-between gap-4 rounded-lg px-4 py-3 text-sm transition-colors lg:w-full ${
                                            active
                                                ? 'bg-emerald-50 font-medium text-emerald-700'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span>{item.label}</span>
                                        <span className={`text-xs ${active ? 'text-emerald-500' : 'text-gray-400'}`}>Open</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="rounded-xl border bg-gray-50 p-4 lg:mt-auto">
                            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Signed in</p>
                            <p className="mt-2 text-lg font-semibold text-gray-800">{user?.name || 'Admin'}</p>
                            <p className="break-all text-sm text-gray-500">{user?.email}</p>
                            <button
                                type="button"
                                onClick={() => {
                                    clearSession();
                                    router.push('/login');
                                }}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                            >
                                <LogOut size={16} />
                                Log Out
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
                        <section className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 sm:p-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-2xl">
                                    <p className="text-sm font-medium text-emerald-600">Administration</p>
                                    <h2 className="mt-1 text-2xl font-bold text-gray-800 sm:text-3xl">{title}</h2>
                                    <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
                                </div>
                                {actions ? <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
                            </div>
                        </section>

                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
