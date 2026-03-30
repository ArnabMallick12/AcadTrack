"use client";

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { MapPin, Play, Square } from 'lucide-react';

export default function AttendanceTracker({ subjectId }) {
    const [status, setStatus] = useState('idle'); // idle, active, completed
    const [sessionId, setSessionId] = useState(null);
    const [timer, setTimer] = useState(0);

    const startSession = async () => {
        if (!navigator.geolocation) return alert('Geolocation is not supported by your browser');

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const { data } = await api.post('/attendance/start', { subject_id: subjectId, latitude, longitude });
                setSessionId(data.session_id);
                setStatus('active');
            } catch (err) {
                alert('Failed to start session');
            }
        });
    };

    const stopSession = async () => {
        try {
            const { data } = await api.post('/attendance/complete', { session_id: sessionId });
            alert(`Session Completed! Marked as: ${data.message}`);
            setStatus('completed');
        } catch (err) {
            alert('Failed to complete session');
        }
    };

    useEffect(() => {
        let interval;
        let pinger;

        if (status === 'active') {
            interval = setInterval(() => setTimer((t) => t + 1), 1000);
            
            // Heartbeat every 30s
            pinger = setInterval(() => {
                navigator.geolocation.getCurrentPosition((position) => {
                    const { latitude, longitude } = position.coords;
                    api.post('/attendance/ping', { session_id: sessionId, latitude, longitude });
                });
            }, 30000);
        }

        return () => {
            clearInterval(interval);
            clearInterval(pinger);
        };
    }, [status, sessionId]);

    const formatTime = (s) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin className="text-blue-500" /> Mark Attendance</h3>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-600 mb-2">Ensure you are in the classroom. Subject ID: {subjectId}</p>
                    {status === 'active' && <p className="text-2xl font-mono text-green-600">{formatTime(timer)}</p>}
                </div>
                <div>
                    {status === 'idle' && (
                        <button onClick={startSession} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <Play size={18}/> Start Session
                        </button>
                    )}
                    {status === 'active' && (
                        <button onClick={stopSession} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            <Square size={18}/> End Session
                        </button>
                    )}
                    {status === 'completed' && (
                        <div className="px-4 py-2 bg-green-100 text-green-700 font-bold rounded-lg border border-green-300">
                            Completed
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
