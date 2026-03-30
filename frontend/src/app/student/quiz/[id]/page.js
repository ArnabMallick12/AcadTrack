"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function QuizTaker({ params }) {
    const { id } = params;
    const router = useRouter();
    const [quiz, setQuiz] = useState(null);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(0);
    const [violations, setViolations] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const { data } = await api.get(`/quiz/${id}`);
                setQuiz(data);
                // Calculate time left from duration
                const end = new Date(data.end_time).getTime();
                const now = new Date().getTime();
                const maxSeconds = data.duration * 60;
                const remaining = Math.max(0, Math.floor((end - now) / 1000));
                setTimeLeft(Math.min(maxSeconds, remaining));
            } catch (err) {
                alert('Failed to load quiz');
                router.push('/student/dashboard');
            }
        };
        fetchQuiz();
    }, [id, router]);

    const submitQuiz = useCallback(async () => {
        try {
            const { data } = await api.post('/quiz/submit', { quiz_id: id, answers });
            alert(`Quiz Submitted! Score: ${data.score}`);
            if (document.fullscreenElement) await document.exitFullscreen().catch(()=>{});
            router.push('/student/dashboard');
        } catch (err) {
            alert('Submission failed');
        }
    }, [id, answers, router]);

    const recordViolation = useCallback(async (type) => {
        try {
            const { data } = await api.post('/quiz/violation', { quiz_id: id, type });
            setViolations(data.violations_count);
            alert(`Warning! ${type} detected. Violations: ${data.violations_count}/3`);
            
            if (data.auto_submit) {
                alert('Maximum violations reached. Auto-submitting quiz.');
                submitQuiz();
            }
        } catch (err) {
            console.error(err);
        }
    }, [id, submitQuiz]);

    useEffect(() => {
        if (!quiz) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    submitQuiz();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [quiz, submitQuiz]);

    // Anti-cheat mechanisms
    useEffect(() => {
        if (!quiz) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                recordViolation('Tab Switch');
            }
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                recordViolation('Exited Fullscreen');
            } else {
                setIsFullscreen(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [quiz, recordViolation]);

    const enterFullscreen = async () => {
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } catch (err) {
            alert('Please enable fullscreen to start the quiz');
        }
    };

    if (!quiz) return <div className="p-10 text-center">Loading Quiz...</div>;

    if (!isFullscreen) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-100 p-6">
                <div className="bg-white p-8 rounded-xl shadow max-w-lg text-center">
                    <h2 className="text-2xl font-bold mb-4 text-red-600">Strict Quiz Environment</h2>
                    <p className="mb-6 text-gray-700">
                        This quiz strictly monitors tab switching and requires fullscreen. You will be penalized for leaving the quiz screen. 3 violations = Auto Submit.
                    </p>
                    <button onClick={enterFullscreen} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition">
                        Enter Fullscreen & Start
                    </button>
                </div>
            </div>
        );
    }

    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;

    return (
        <div className="min-h-screen bg-white p-8 bg-gray-50 flex flex-col">
            <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow border">
                <div>
                    <h1 className="text-2xl font-bold">{quiz.title}</h1>
                    <p className="text-red-600 font-semibold mt-1">Violations: {violations}/3</p>
                </div>
                <div className="text-right">
                    <p className="text-lg text-gray-500">Time Left</p>
                    <p className="text-3xl font-mono font-bold text-blue-600">
                        {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
                    </p>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
                {quiz.questions.map((q, i) => (
                    <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-semibold text-lg mb-4">{i + 1}. {q.question}</h3>
                        <div className="space-y-3">
                            {['A', 'B', 'C', 'D'].map(opt => {
                                const optionText = q[`option_${opt.toLowerCase()}`];
                                return (
                                    <label key={opt} className={`block p-4 border rounded-lg cursor-pointer transition ${answers[q.id] === opt ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-gray-50'}`}>
                                        <input 
                                            type="radio" 
                                            name={`question-${q.id}`} 
                                            value={opt} 
                                            className="hidden"
                                            onChange={() => setAnswers({...answers, [q.id]: opt})}
                                        />
                                        <span className="font-bold mr-3">{opt}.</span> {optionText}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </main>

            <footer className="mt-8 text-center bg-white p-4 rounded-xl shadow border">
                <button onClick={submitQuiz} className="bg-green-600 text-white font-bold py-3 px-12 rounded-lg hover:bg-green-700 transition">
                    Submit Final Answers
                </button>
            </footer>
        </div>
    );
}
