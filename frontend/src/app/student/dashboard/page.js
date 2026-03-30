"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { CheckSquare, FileText, ClipboardList, BookOpen, LogOut } from 'lucide-react';
import AttendanceTracker from '@/components/AttendanceTracker';
import api from '@/lib/api';

export default function StudentDashboard() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('attendance');
    const [subjectId, setSubjectId] = useState('');
    const [quizzes, setQuizzes] = useState([]);
    const [marks, setMarks] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [assignmentFile, setAssignmentFile] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const u = Cookies.get('user');
        if (!u) return router.push('/login');
        const parsed = JSON.parse(u);
        if (parsed.role !== 'student') return router.push('/professor/dashboard');
        setUser(parsed);
        fetchData(parsed.role_id, 'attendance'); // default tab
    }, []);

    const fetchData = async (id, tab) => {
        if (tab === 'marks') {
            const { data } = await api.get(`/marks/student/${id}`);
            setMarks(data);
        }
        // Assuming we have endpoints to fetch student's subjects and their quizzes/assignments.
        // For simplicity, we assume they enter a subject ID to browse for now, or fetch all global ones.
    };

    const handleSubjectSearch = async () => {
        if (!subjectId) return;
        if (activeTab === 'quizzes') {
            const { data } = await api.get(`/quiz/subject/${subjectId}`);
            setQuizzes(data);
        }
        // In reality, assignments would also be fetched. Since backend doesn't have `GET /assignment/subject/:id`, we assume professor provides assignment IDs or we add an endpoint. Let's mock fetching assignments locally or assume assignment creation notifies students.
    };

    const submitAssignment = async (e, assignmentId) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('assignment_id', assignmentId);
        formData.append('file', assignmentFile);
        
        try {
            await api.post('/assignment/submit', formData);
            alert('Assignment submitted!');
        } catch (err) {
            alert('Submission failed');
        }
    };

    if (!user) return <div>Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-lg flex flex-col">
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-blue-600">AcadTrack</h2>
                    <p className="text-sm text-gray-500 mt-1">Student Portal</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {[
                        { id: 'attendance', name: 'Attendance', icon: CheckSquare },
                        { id: 'quizzes', name: 'Quizzes', icon: ClipboardList },
                        { id: 'marks', name: 'Marks & Grading', icon: BookOpen },
                        { id: 'assignments', name: 'Assignments', icon: FileText },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { setActiveTab(t.id); fetchData(user.role_id, t.id); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <t.icon size={20} /> {t.name}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t">
                    <button onClick={() => { Cookies.remove('token'); Cookies.remove('user'); router.push('/login'); }} className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <LogOut size={20} /> Log Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Welcome back, {user.name}!</h1>
                        <p className="text-gray-500">Stay on top of your academic progress.</p>
                    </div>
                    {['attendance', 'quizzes'].includes(activeTab) && (
                        <div className="flex gap-2">
                            <input type="text" placeholder="Subject ID" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
                            <button onClick={handleSubjectSearch} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700">Go</button>
                        </div>
                    )}
                </header>

                <div className="space-y-6">
                    {activeTab === 'attendance' && (
                        <div>
                            {subjectId ? (
                                <AttendanceTracker subjectId={subjectId} />
                            ) : (
                                <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-dashed">
                                    Enter a Subject ID in the top right to mark attendance.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'quizzes' && (
                        <div className="bg-white p-6 rounded-xl shadow border">
                            <h3 className="text-xl font-bold mb-4">Available Quizzes</h3>
                            {quizzes.length === 0 ? <p className="text-gray-500">No quizzes available for this subject.</p> : (
                                <div className="grid gap-4">
                                    {quizzes.map(q => (
                                        <div key={q.id} className="p-4 border rounded-lg flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold">{q.title}</h4>
                                                <p className="text-sm text-gray-500">Duration: {q.duration} mins | Start: {new Date(q.start_time).toLocaleString()}</p>
                                            </div>
                                            <button onClick={() => router.push(`/student/quiz/${q.id}`)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                                                Attempt Quiz
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'marks' && (
                        <div className="bg-white p-6 rounded-xl shadow border">
                            <h3 className="text-xl font-bold mb-4">Your Performance</h3>
                            {marks.length === 0 ? <p className="text-gray-500">No marks uploaded yet.</p> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {marks.map((m, i) => (
                                        <div key={i} className="p-5 border border-l-4 border-l-blue-500 rounded-lg shadow-sm">
                                            <h4 className="font-bold text-lg">{m.subject_name}</h4>
                                            <p className="text-sm text-gray-600 capitalize mb-3 border-b pb-2">{m.exam_type} Exam</p>
                                            <div className="flex justify-between items-end">
                                                <span className="text-3xl font-bold text-gray-800">{m.marks_obtained}</span>
                                                <span className="text-gray-500">/ {m.max_marks}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div className="bg-white p-6 rounded-xl shadow border">
                            <h3 className="text-xl font-bold mb-4">Submit Assignment</h3>
                            <form onSubmit={(e) => submitAssignment(e, prompt('Enter Assignment ID'))} className="border p-6 rounded-lg bg-gray-50">
                                <label className="block text-sm font-medium mb-2">Upload File</label>
                                <input type="file" required onChange={(e) => setAssignmentFile(e.target.files[0])} className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition">Submit File</button>
                            </form>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
