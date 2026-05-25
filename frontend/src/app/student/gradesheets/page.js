"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, LogOut, ArrowLeft, ChevronDown, ChevronUp, Award, BookOpen, TrendingUp, FileText, Clock } from 'lucide-react';
import api from '@/lib/api';
import { clearSession, getStoredToken, getStoredUser } from '@/lib/auth';

export default function StudentGradeSheets() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedSemesters, setExpandedSemesters] = useState(new Set());
    const [selectedSemester, setSelectedSemester] = useState('all');

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
        fetchGradeSheets();
    }, []);

    const fetchGradeSheets = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/registration/gradesheets');
            setData(data);
            // Auto-expand all released semesters
            const released = new Set();
            data.grade_sheets.forEach((sheet) => {
                if (sheet.released) released.add(sheet.semester_id);
            });
            setExpandedSemesters(released);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load grade sheets');
        } finally {
            setLoading(false);
        }
    };

    const toggleExpanded = (semesterId) => {
        setExpandedSemesters((prev) => {
            const next = new Set(prev);
            if (next.has(semesterId)) next.delete(semesterId);
            else next.add(semesterId);
            return next;
        });
    };

    const filteredSheets = useMemo(() => {
        if (!data) return [];
        if (selectedSemester === 'all') return data.grade_sheets;
        return data.grade_sheets.filter((s) => String(s.semester_id) === String(selectedSemester));
    }, [data, selectedSemester]);

    const getGradeColor = (grade) => {
        const colors = {
            'AA': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
            'AB': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
            'BB': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
            'BC': { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-300' },
            'CC': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
            'CD': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
            'DD': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
            'DE': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
            'F':  { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
        };
        return colors[grade] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
    };

    const getSpiColor = (spi) => {
        const val = Number(spi);
        if (val >= 9) return 'text-emerald-600';
        if (val >= 8) return 'text-green-600';
        if (val >= 7) return 'text-blue-600';
        if (val >= 6) return 'text-amber-600';
        if (val >= 5) return 'text-orange-600';
        return 'text-red-600';
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm">Loading grade sheets...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/50 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Layers size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">AcadTrack</h1>
                            <p className="text-xs text-slate-400">Grade Sheets</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/student/courses')}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200"
                        >
                            <ArrowLeft size={16} />
                            <span className="hidden sm:inline">My Courses</span>
                        </button>
                        <button
                            onClick={() => router.push('/student/registration')}
                            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-300 hover:text-white hover:bg-slate-800 rounded-lg transition-all duration-200"
                        >
                            Registration
                        </button>
                        <span className="text-sm text-slate-300 hidden md:block">
                            <span className="font-semibold text-white">{user.name}</span>
                        </span>
                        <button
                            onClick={() => { clearSession(); router.push('/login'); }}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all duration-200"
                        >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Log Out</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-10">
                {/* Title + Filter */}
                <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Award size={28} className="text-blue-400" />
                            Semester Grade Sheets
                        </h2>
                        <p className="text-slate-400">
                            View your grade sheets across all registered semesters.
                            {data?.student && (
                                <span className="ml-1 text-slate-500">
                                    · {data.student.department} · {data.student.roll_no}
                                </span>
                            )}
                        </p>
                    </div>
                    {data?.grade_sheets?.length > 1 && (
                        <div className="relative shrink-0">
                            <select
                                id="semester-grade-filter"
                                value={selectedSemester}
                                onChange={(e) => setSelectedSemester(e.target.value)}
                                className="appearance-none bg-slate-800/80 border border-slate-600/50 text-white rounded-xl pl-4 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 cursor-pointer transition-all duration-200 hover:bg-slate-700/80 min-w-[200px]"
                            >
                                <option value="all">All Semesters</option>
                                {data.grade_sheets.map((sheet) => (
                                    <option key={sheet.semester_id} value={sheet.semester_id}>
                                        Semester {sheet.semester_no} — {sheet.semester_name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    )}
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl mb-6">{error}</div>
                )}

                {/* Cumulative Stats */}
                {data?.cumulative && data.cumulative.cpi && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <TrendingUp size={22} className="text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Cumulative CPI</p>
                                <p className={`text-2xl font-bold ${getSpiColor(data.cumulative.cpi)}`}>{data.cumulative.cpi}</p>
                            </div>
                        </div>
                        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                <BookOpen size={22} className="text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Credits</p>
                                <p className="text-2xl font-bold text-white">{data.cumulative.total_credits}</p>
                            </div>
                        </div>
                        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg">
                                <Award size={22} className="text-white" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Grade Points</p>
                                <p className="text-2xl font-bold text-white">{data.cumulative.total_grade_points}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Grade Sheet Cards */}
                <div className="space-y-5">
                    {filteredSheets.length === 0 && (
                        <div className="text-center py-20">
                            <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-6">
                                <FileText size={40} className="text-slate-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-300 mb-2">No grade sheets found</h3>
                            <p className="text-slate-500 max-w-md mx-auto">
                                You don&apos;t have any semester registrations yet, or no grade sheets have been generated.
                            </p>
                        </div>
                    )}

                    {filteredSheets.map((sheet) => {
                        const isExpanded = expandedSemesters.has(sheet.semester_id);

                        if (!sheet.released) {
                            // Not released card
                            return (
                                <div
                                    key={`unreleased-${sheet.semester_id}`}
                                    className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-2xl overflow-hidden"
                                >
                                    <div className="p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                <Clock size={22} className="text-amber-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-bold text-white">
                                                        Semester {sheet.semester_no}
                                                    </h3>
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                                        Not Released
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-400 mt-0.5">
                                                    {sheet.semester_name} · {sheet.department}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-6 pb-6">
                                        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 flex items-start gap-3">
                                            <svg className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div>
                                                <p className="text-sm font-medium text-amber-300">Grade Sheet Not Released</p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    The grade sheet for this semester has not been released yet. Please check back later after grades are finalized by the administration.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Released card
                        return (
                            <div
                                key={`released-${sheet.semester_id}`}
                                className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-600/50"
                            >
                                {/* Card Header */}
                                <button
                                    onClick={() => toggleExpanded(sheet.semester_id)}
                                    className="w-full p-6 flex items-center justify-between text-left hover:bg-slate-700/20 transition-colors duration-200"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/10">
                                            <FileText size={22} className="text-white" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-bold text-white">
                                                    Semester {sheet.semester_no}
                                                </h3>
                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                                    Released
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-0.5">
                                                {sheet.semester_name} · {sheet.department}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        {/* SPI Badge */}
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">SPI</p>
                                            <p className={`text-2xl font-bold ${getSpiColor(sheet.spi)}`}>{sheet.spi}</p>
                                        </div>
                                        {/* CPI Badge */}
                                        {sheet.cpi && (
                                            <div className="text-right hidden md:block">
                                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">CPI</p>
                                                <p className={`text-2xl font-bold ${getSpiColor(sheet.cpi)}`}>{sheet.cpi}</p>
                                            </div>
                                        )}
                                        {/* Credits */}
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Credits</p>
                                            <p className="text-2xl font-bold text-white">{sheet.total_credits}</p>
                                        </div>
                                        {/* Expand/Collapse */}
                                        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center">
                                            {isExpanded ? (
                                                <ChevronUp size={18} className="text-slate-400" />
                                            ) : (
                                                <ChevronDown size={18} className="text-slate-400" />
                                            )}
                                        </div>
                                    </div>
                                </button>

                                {/* Mobile SPI/Credits row */}
                                <div className="sm:hidden px-6 pb-3 flex gap-4">
                                    <div className="bg-slate-700/30 rounded-lg px-3 py-2 flex-1 text-center">
                                        <p className="text-xs text-slate-500">SPI</p>
                                        <p className={`text-lg font-bold ${getSpiColor(sheet.spi)}`}>{sheet.spi}</p>
                                    </div>
                                    {sheet.cpi && (
                                        <div className="bg-slate-700/30 rounded-lg px-3 py-2 flex-1 text-center">
                                            <p className="text-xs text-slate-500">CPI</p>
                                            <p className={`text-lg font-bold ${getSpiColor(sheet.cpi)}`}>{sheet.cpi}</p>
                                        </div>
                                    )}
                                    <div className="bg-slate-700/30 rounded-lg px-3 py-2 flex-1 text-center">
                                        <p className="text-xs text-slate-500">Credits</p>
                                        <p className="text-lg font-bold text-white">{sheet.total_credits}</p>
                                    </div>
                                </div>

                                {/* Expanded Course Table */}
                                {isExpanded && (
                                    <div className="border-t border-slate-700/40 px-6 pb-6 pt-4">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-700/50">
                                                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Course</th>
                                                        <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Code</th>
                                                        <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Credits</th>
                                                        <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Grade</th>
                                                        <th className="text-center py-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Grade Points</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sheet.courses.map((course, idx) => {
                                                        const gc = getGradeColor(course.grade_code);
                                                        return (
                                                            <tr
                                                                key={course.id || idx}
                                                                className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors"
                                                            >
                                                                <td className="py-3 px-3 text-white font-medium">{course.subject_name}</td>
                                                                <td className="py-3 px-3 text-slate-400 font-mono text-xs">{course.code}</td>
                                                                <td className="py-3 px-3 text-center text-slate-300">{course.credits}</td>
                                                                <td className="py-3 px-3 text-center">
                                                                    <span className={`inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-lg text-xs font-bold ${gc.bg} ${gc.text} ${gc.border} border`}>
                                                                        {course.grade_code}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-3 text-center text-slate-300 font-semibold">{course.course_grade_points}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="border-t border-slate-600/50">
                                                        <td colSpan={2} className="py-3 px-3 text-sm font-bold text-slate-300">Total</td>
                                                        <td className="py-3 px-3 text-center text-sm font-bold text-white">{sheet.total_credits}</td>
                                                        <td className="py-3 px-3"></td>
                                                        <td className="py-3 px-3 text-center text-sm font-bold text-white">{sheet.total_grade_points}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>

                                        {/* Footer info */}
                                        {sheet.released_at && (
                                            <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
                                                <Clock size={12} />
                                                Released on {new Date(sheet.released_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
