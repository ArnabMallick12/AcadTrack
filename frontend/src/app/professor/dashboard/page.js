"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { CheckSquare, FileText, ClipboardList, BookOpen, LogOut, PlusCircle, Upload, Search } from 'lucide-react';
import api from '@/lib/api';

export default function ProfessorDashboard() {
    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('attendance');
    const [subjectId, setSubjectId] = useState('');
    
    // Data states
    const [attendanceData, setAttendanceData] = useState([]);
    const [marksData, setMarksData] = useState(null);
    const [submissions, setSubmissions] = useState([]);

    // Form states
    const [quizForm, setQuizForm] = useState({ title: '', duration: 30, start_time: '', end_time: '', questions: [] });
    const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', deadline: '' });
    const [marksForm, setMarksForm] = useState({ exam_type: 'midsem', max_marks: 100, marksJson: '' });

    const router = useRouter();

    useEffect(() => {
        const u = Cookies.get('user');
        if (!u) return router.push('/login');
        const parsed = JSON.parse(u);
        if (parsed.role !== 'professor') return router.push('/student/dashboard');
        setUser(parsed);
    }, []);

    const fetchSubjectData = async () => {
        if (!subjectId) return alert('Enter a subject ID');
        try {
            if (activeTab === 'attendance') {
                const { data } = await api.get(`/attendance/subject/${subjectId}`);
                setAttendanceData(data);
            } else if (activeTab === 'marks_view') {
                const { data } = await api.get(`/marks/subject/${subjectId}`);
                setMarksData(data);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to fetch data');
        }
    };

    const fetchSubmissions = async (assignmentId) => {
        try {
            const { data } = await api.get(`/assignment/${assignmentId}/submissions`);
            setSubmissions(data);
        } catch (err) {
            alert('Failed to fetch submissions');
        }
    };

    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        try {
            await api.post('/quiz/create', { subject_id: subjectId, ...quizForm });
            alert('Quiz created!');
            setQuizForm({ title: '', duration: 30, start_time: '', end_time: '', questions: [] });
        } catch (err) {
            alert('Failed to create quiz');
        }
    };

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/assignment/create', { subject_id: subjectId, ...assignmentForm });
            alert(`Assignment created! ID: ${data.assignment_id}`);
            setAssignmentForm({ title: '', description: '', deadline: '' });
        } catch (err) {
            alert('Failed to create assignment');
        }
    };

    const handleUploadMarks = async (e) => {
        e.preventDefault();
        try {
            const parsedMarks = JSON.parse(marksForm.marksJson);
            await api.post('/marks/upload', {
                subject_id: subjectId,
                exam_type: marksForm.exam_type,
                max_marks: marksForm.max_marks,
                marks: parsedMarks
            });
            alert('Marks uploaded successfully!');
        } catch (err) {
            alert('Invalid JSON or Upload failed');
        }
    };

    const addQuestion = () => {
        setQuizForm({
            ...quizForm,
            questions: [...quizForm.questions, { question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A' }]
        });
    };

    const updateQuestion = (index, field, value) => {
        const newQs = [...quizForm.questions];
        newQs[index][field] = value;
        setQuizForm({ ...quizForm, questions: newQs });
    };

    if (!user) return <div>Loading...</div>;

    const tabs = [
        { id: 'attendance', name: 'Attendance Report', icon: CheckSquare },
        { id: 'create_quiz', name: 'Create Quiz', icon: PlusCircle },
        { id: 'marks_upload', name: 'Upload Marks', icon: Upload },
        { id: 'marks_view', name: 'Marks Analytics', icon: BookOpen },
        { id: 'create_assignment', name: 'Assignments', icon: FileText },
        { id: 'submissions', name: 'Plagiarism Tracker', icon: Search }
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-lg flex flex-col">
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-blue-600">AcadTrack</h2>
                    <p className="text-sm text-gray-500 mt-1">Professor Portal</p>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { setActiveTab(t.id); setAttendanceData([]); setMarksData(null); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${activeTab === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <t.icon size={20} /> <span className="text-sm">{t.name}</span>
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
            <main className="flex-1 p-8 overflow-y-auto h-screen">
                <header className="mb-8 flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Welcome, Prof. {user.name}!</h1>
                        <p className="text-gray-500">Manage your subjects, classes and students.</p>
                    </div>
                    {['attendance', 'create_quiz', 'marks_upload', 'marks_view', 'create_assignment'].includes(activeTab) && (
                        <div className="flex gap-2">
                            <input type="text" placeholder="Subject ID" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="border p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-400" />
                            {['attendance', 'marks_view'].includes(activeTab) && (
                                <button onClick={fetchSubjectData} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700">Fetch</button>
                            )}
                        </div>
                    )}
                </header>

                <div className="bg-white p-6 rounded-xl shadow border">
                    {activeTab === 'attendance' && (
                        <div>
                            <h3 className="text-xl font-bold mb-4">Subject Attendance Log</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="p-3 border">Date</th>
                                            <th className="p-3 border">Roll No</th>
                                            <th className="p-3 border">Name</th>
                                            <th className="p-3 border">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendanceData.map((a, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-3 border">{new Date(a.date).toLocaleDateString()}</td>
                                                <td className="p-3 border">{a.roll_no}</td>
                                                <td className="p-3 border">{a.student_name}</td>
                                                <td className="p-3 border">
                                                    <span className={`px-2 py-1 text-xs font-bold rounded ${a.status==='present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {a.status.toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'create_quiz' && (
                        <form onSubmit={handleCreateQuiz} className="space-y-4">
                            <h3 className="text-xl font-bold mb-4">Create New Quiz</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Title" required className="border p-3 rounded" value={quizForm.title} onChange={e => setQuizForm({...quizForm, title: e.target.value})} />
                                <input type="number" placeholder="Duration (mins)" required className="border p-3 rounded" value={quizForm.duration} onChange={e => setQuizForm({...quizForm, duration: e.target.value})} />
                                <input type="datetime-local" required className="border p-3 rounded" value={quizForm.start_time} onChange={e => setQuizForm({...quizForm, start_time: e.target.value})} />
                                <input type="datetime-local" required className="border p-3 rounded" value={quizForm.end_time} onChange={e => setQuizForm({...quizForm, end_time: e.target.value})} />
                            </div>

                            <div className="border border-dashed p-4 rounded-lg bg-gray-50">
                                <h4 className="font-bold mb-2">Questions ({quizForm.questions.length})</h4>
                                {quizForm.questions.map((q, i) => (
                                    <div key={i} className="mb-4 p-4 border rounded bg-white relative">
                                        <input type="text" placeholder={`Question ${i+1}`} className="w-full border p-2 rounded mb-2" value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)} required />
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input type="text" placeholder="Option A" className="border p-2 rounded" value={q.option_a} onChange={e => updateQuestion(i, 'option_a', e.target.value)} required />
                                            <input type="text" placeholder="Option B" className="border p-2 rounded" value={q.option_b} onChange={e => updateQuestion(i, 'option_b', e.target.value)} required />
                                            <input type="text" placeholder="Option C" className="border p-2 rounded" value={q.option_c} onChange={e => updateQuestion(i, 'option_c', e.target.value)} required />
                                            <input type="text" placeholder="Option D" className="border p-2 rounded" value={q.option_d} onChange={e => updateQuestion(i, 'option_d', e.target.value)} required />
                                        </div>
                                        <label className="text-sm font-bold">Correct Answer: </label>
                                        <select className="border p-2 rounded ml-2" value={q.correct_answer} onChange={e => updateQuestion(i, 'correct_answer', e.target.value)}>
                                            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                                        </select>
                                    </div>
                                ))}
                                <button type="button" onClick={addQuestion} className="text-blue-600 font-bold hover:underline">+ Add Question</button>
                            </div>
                            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700">Save Quiz</button>
                        </form>
                    )}

                    {activeTab === 'marks_upload' && (
                        <form onSubmit={handleUploadMarks} className="space-y-4">
                            <h3 className="text-xl font-bold mb-4">Bulk Upload Marks</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <select className="border p-3 rounded" value={marksForm.exam_type} onChange={e => setMarksForm({...marksForm, exam_type: e.target.value})}>
                                    <option value="midsem">Midsem</option>
                                    <option value="endsem">Endsem</option>
                                </select>
                                <input type="number" placeholder="Max Marks" required className="border p-3 rounded" value={marksForm.max_marks} onChange={e => setMarksForm({...marksForm, max_marks: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Marks JSON array <br/><span className="text-gray-400 font-mono text-xs">Ex: [{`{"student_id": 1, "marks_obtained": 85}`}]</span></label>
                                <textarea rows="6" className="w-full border p-3 rounded font-mono text-sm" value={marksForm.marksJson} onChange={e => setMarksForm({...marksForm, marksJson: e.target.value})} required></textarea>
                            </div>
                            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700">Upload Data</button>
                        </form>
                    )}

                    {activeTab === 'marks_view' && marksData && (
                        <div>
                            <h3 className="text-xl font-bold mb-4">Analytics Overview</h3>
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                {Object.entries(marksData.analytics).map(([type, stats]) => (
                                    <div key={type} className="p-4 bg-gray-50 border rounded flex flex-col items-center">
                                        <span className="capitalize font-bold text-gray-700 mb-2">{type}</span>
                                        <div className="text-sm text-gray-600 space-y-1 text-center">
                                            <p>Avg: <b>{stats.avg.toFixed(2)}</b> / {stats.max_marks}</p>
                                            <p>Max: <b>{stats.max}</b> | Min: <b>{stats.min}</b></p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <h3 className="text-lg font-bold mb-2">Detailed Marks</h3>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-3 border">Roll No</th>
                                        <th className="p-3 border">Name</th>
                                        <th className="p-3 border">Exam Type</th>
                                        <th className="p-3 border">Marks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marksData.marks.map((m, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="p-3 border">{m.roll_no}</td>
                                            <td className="p-3 border">{m.student_name}</td>
                                            <td className="p-3 border capitalize">{m.exam_type}</td>
                                            <td className="p-3 border font-bold">{m.marks_obtained}/{m.max_marks}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'create_assignment' && (
                        <form onSubmit={handleCreateAssignment} className="space-y-4">
                            <h3 className="text-xl font-bold mb-4">Create Assignment</h3>
                            <input type="text" placeholder="Title" required className="w-full border p-3 rounded" value={assignmentForm.title} onChange={e => setAssignmentForm({...assignmentForm, title: e.target.value})} />
                            <textarea placeholder="Description" rows="4" required className="w-full border p-3 rounded" value={assignmentForm.description} onChange={e => setAssignmentForm({...assignmentForm, description: e.target.value})}></textarea>
                            <input type="datetime-local" required className="w-full border p-3 rounded" value={assignmentForm.deadline} onChange={e => setAssignmentForm({...assignmentForm, deadline: e.target.value})} />
                            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded hover:bg-blue-700">Publish Assignment</button>
                        </form>
                    )}

                    {activeTab === 'submissions' && (
                        <div>
                            <h3 className="text-xl font-bold mb-4">Plagiarism Report</h3>
                            <div className="flex gap-2 mb-6">
                                <input type="number" id="assign_search" placeholder="Assignment ID" className="border p-2 rounded-lg outline-none" />
                                <button onClick={() => fetchSubmissions(document.getElementById('assign_search').value)} className="bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700">Search Submissions</button>
                            </div>

                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-3 border">Student Name</th>
                                        <th className="p-3 border">Submission Date</th>
                                        <th className="p-3 border">Sim. Score</th>
                                        <th className="p-3 border">Matched With ID</th>
                                        <th className="p-3 border">Status</th>
                                        <th className="p-3 border">File</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map((s, i) => (
                                        <tr key={i} className={`hover:bg-gray-50 ${s.similarity_score > 0.8 ? 'bg-red-50' : ''}`}>
                                            <td className="p-3 border">{s.student_name}</td>
                                            <td className="p-3 border">{new Date(s.submitted_at).toLocaleString()}</td>
                                            <td className="p-3 border font-bold text-lg text-center">
                                                <span className={s.similarity_score > 0.8 ? 'text-red-600' : 'text-green-600'}>
                                                    {(s.similarity_score * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="p-3 border">{s.matched_with || '-'}</td>
                                            <td className="p-3 border">{s.is_late ? <span className="text-red-500 font-bold">LATE</span> : 'ON TIME'}</td>
                                            <td className="p-3 border"><a href={s.file_url} target="_blank" className="text-blue-600 underline text-sm">Download</a></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
