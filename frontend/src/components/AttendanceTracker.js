"use client";

import { useEffect, useState, useRef } from 'react';
import Webcam from 'react-webcam';
import api from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { MapPin, Play, Square, Clock, AlertCircle, CheckCircle2, Camera } from 'lucide-react';

const ATTENDANCE_SESSION_PREFIX = 'acadtrack:attendance-session';

function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getAttendanceStorageKey(subjectId) {
    return `${ATTENDANCE_SESSION_PREFIX}:${subjectId}`;
}

function getElapsedSeconds(startedAt) {
    const started = new Date(startedAt).getTime();
    if (!Number.isFinite(started)) return 0;
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

function readStoredAttendanceSession(subjectId) {
    if (typeof window === 'undefined' || !subjectId) return null;

    try {
        const raw = window.localStorage.getItem(getAttendanceStorageKey(subjectId));
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (
            parsed?.status !== 'active' ||
            String(parsed.subjectId) !== String(subjectId) ||
            !parsed.sessionId ||
            !parsed.startedAt ||
            parsed.attendanceDate !== localDateKey()
        ) {
            window.localStorage.removeItem(getAttendanceStorageKey(subjectId));
            return null;
        }

        return parsed;
    } catch {
        window.localStorage.removeItem(getAttendanceStorageKey(subjectId));
        return null;
    }
}

function saveStoredAttendanceSession(subjectId, session) {
    if (typeof window === 'undefined' || !subjectId) return;

    try {
        window.localStorage.setItem(
            getAttendanceStorageKey(subjectId),
            JSON.stringify({
                subjectId,
                status: 'active',
                attendanceDate: localDateKey(),
                ...session,
            })
        );
    } catch {
        // Attendance can still continue if browser storage is unavailable.
    }
}

function normalizeCoordinate(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n.toFixed(6);
}

function createNonce() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildAttendancePacket({ action, studentId, sessionId, latitude, longitude, timestamp, nonce }) {
    return JSON.stringify({
        action: String(action),
        studentId: String(studentId),
        sessionId: String(sessionId),
        gps: {
            latitude: normalizeCoordinate(latitude),
            longitude: normalizeCoordinate(longitude),
        },
        timestamp: new Date(timestamp).toISOString(),
        nonce: String(nonce),
    });
}

async function hmacSha256Hex(secret, message) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return Array.from(new Uint8Array(signature))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}
function clearStoredAttendanceSession(subjectId) {
    if (typeof window === 'undefined' || !subjectId) return;

    try {
        window.localStorage.removeItem(getAttendanceStorageKey(subjectId));
    } catch {
        // Nothing to clear if browser storage is unavailable.
    }
}

export default function AttendanceTracker({ subjectId }) {
    const [status, setStatus] = useState('idle'); // idle, capturing, active, completed
    const [sessionId, setSessionId] = useState(null);
    const [sessionStartedAt, setSessionStartedAt] = useState(null);
    const [timer, setTimer] = useState(0);
    const [todayClasses, setTodayClasses] = useState(null);
    const [loading, setLoading] = useState(true);
    const [distanceStr, setDistanceStr] = useState(null);
    const webcamRef = useRef(null);
    const signingKeyRef = useRef(null);
    const [verifyLoading, setVerifyLoading] = useState(false);

    // Fetch today's class schedule
    useEffect(() => {
        const fetchTodayClasses = async () => {
            try {
                const { data } = await api.get(`/schedule/${subjectId}/today`);
                setTodayClasses(data);
            } catch (err) {
                console.error('Failed to fetch today classes', err);
                setTodayClasses({ date: new Date().toISOString().split('T')[0], classes: [] });
            } finally {
                setLoading(false);
            }
        };
        fetchTodayClasses();
    }, [subjectId]);

    useEffect(() => {
        const storedSession = readStoredAttendanceSession(subjectId);
        if (!storedSession) return;

        setSessionId(storedSession.sessionId);
        setSessionStartedAt(storedSession.startedAt);
        setTimer(getElapsedSeconds(storedSession.startedAt));
        setDistanceStr(storedSession.distanceStr || null);
        setStatus('active');
    }, [subjectId]);
    // Check if there's a currently active class (within the time window)
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const activeClass = todayClasses?.classes?.find(c => {
        return currentTime >= c.start_time?.slice(0, 5) && currentTime <= c.end_time?.slice(0, 5);
    });

    const upcomingClasses = todayClasses?.classes?.filter(c => {
        return currentTime < c.start_time?.slice(0, 5);
    }) || [];

    const pastClasses = todayClasses?.classes?.filter(c => {
        return currentTime > c.end_time?.slice(0, 5);
    }) || [];

    const getAttendanceSigningKey = async () => {
        const cached = signingKeyRef.current;
        if (cached && new Date(cached.expires_at).getTime() > Date.now() + 30000) {
            return cached;
        }

        const { data } = await api.get('/attendance/signing-key');
        signingKeyRef.current = data;
        return data;
    };

    const signAttendanceRequest = async ({ action, sessionIdentifier, latitude, longitude }) => {
        const storedUser = getStoredUser();
        if (!storedUser) throw new Error('Student session not found');

        const user = JSON.parse(storedUser);
        const signingKey = await getAttendanceSigningKey();
        const timestamp = new Date().toISOString();
        const nonce = createNonce();
        const packet = buildAttendancePacket({
            action,
            studentId: user.role_id,
            sessionId: sessionIdentifier,
            latitude,
            longitude,
            timestamp,
            nonce,
        });
        const signature = await hmacSha256Hex(signingKey.signing_key, packet);

        return {
            key_id: signingKey.key_id,
            timestamp,
            nonce,
            signature,
        };
    };
    const initiateCapture = () => {
        setStatus('capturing');
    };

    const confirmStartSession = async () => {
        if (!navigator.geolocation) return alert('Geolocation is not supported by your browser');

        const live_selfie = webcamRef.current?.getScreenshot();
        if (!live_selfie) return alert('Failed to capture image. Please try again.');

        setVerifyLoading(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const attendance_signature = await signAttendanceRequest({
                    action: 'start',
                    sessionIdentifier: `subject:${subjectId}`,
                    latitude,
                    longitude,
                });
                const { data } = await api.post('/attendance/start', { subject_id: subjectId, latitude, longitude, live_selfie, attendance_signature });
                const startedAt = new Date().toISOString();
                const nextDistanceStr = data.current_distance !== null && data.current_distance !== undefined
                    ? `${Math.round(data.current_distance)}m`
                    : 'Awaiting Prof';

                setSessionId(data.session_id);
                setSessionStartedAt(startedAt);
                setTimer(0);
                setDistanceStr(nextDistanceStr);
                saveStoredAttendanceSession(subjectId, {
                    sessionId: data.session_id,
                    startedAt,
                    distanceStr: nextDistanceStr,
                });
                setStatus('active');
            } catch (err) {
                alert(err.response?.data?.error || 'Failed to start session. Ensure you are close to the professor and your face matches.');
                setStatus('idle');
            } finally {
                setVerifyLoading(false);
            }
        }, () => {
            alert('Please allow location access to mark attendance.');
            setVerifyLoading(false);
            setStatus('idle');
        });
    };

    const stopSession = async () => {
        if (!navigator.geolocation) return alert('Geolocation is not supported by your browser');

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const attendance_signature = await signAttendanceRequest({
                    action: 'complete',
                    sessionIdentifier: sessionId,
                    latitude,
                    longitude,
                });
                const { data } = await api.post('/attendance/complete', { session_id: sessionId, latitude, longitude, attendance_signature });
                clearStoredAttendanceSession(subjectId);
                alert(`Session Completed! Marked as: ${data.message}`);
                setSessionId(null);
                setSessionStartedAt(null);
                setTimer(0);
                setDistanceStr(null);
                setStatus('completed');
            } catch (err) {
                alert(err.response?.data?.error || 'Failed to complete session');
            }
        }, () => {
            alert('Please allow location access to complete attendance.');
        });
    };

    useEffect(() => {
        let interval;
        let pinger;

        if (status === 'active') {
            interval = setInterval(() => {
                setTimer(sessionStartedAt ? getElapsedSeconds(sessionStartedAt) : 0);
            }, 1000);

            // Heartbeat every 30s
            pinger = setInterval(() => {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const attendance_signature = await signAttendanceRequest({
                            action: 'ping',
                            sessionIdentifier: sessionId,
                            latitude,
                            longitude,
                        });
                        const { data } = await api.post('/attendance/ping', { session_id: sessionId, latitude, longitude, attendance_signature });
                        if (data.current_distance !== null && data.current_distance !== undefined) {
                            const nextDistanceStr = `${Math.round(data.current_distance)}m`;
                            setDistanceStr(nextDistanceStr);

                            const storedSession = readStoredAttendanceSession(subjectId);
                            if (storedSession) {
                                saveStoredAttendanceSession(subjectId, {
                                    ...storedSession,
                                    distanceStr: nextDistanceStr,
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Ping failed');
                    }
                });
            }, 30000);
        }

        return () => {
            clearInterval(interval);
            clearInterval(pinger);
        };
    }, [status, sessionId, sessionStartedAt, subjectId]);

    const formatTime = (s) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTimeSlot = (time) => {
        if (!time) return '';
        const [h, m] = time.slice(0, 5).split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

    if (loading) {
        return (
            <div className="p-6 bg-white rounded-xl shadow border">
                <div className="flex items-center gap-3 text-gray-400">
                    <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Checking today&apos;s schedule...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Today's Schedule Overview */}
            <div className="p-5 bg-white rounded-xl shadow border">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <Clock className="text-blue-500" size={20} />
                    Today&apos;s Classes
                </h3>

                {todayClasses?.classes?.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-dashed">
                        <AlertCircle size={20} className="text-gray-400" />
                        <div>
                            <p className="text-sm font-medium text-gray-600">No classes scheduled for today</p>
                            <p className="text-xs text-gray-400">Attendance marking is not available when there are no classes.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {todayClasses?.classes?.map((c, i) => {
                            const isActive = currentTime >= c.start_time?.slice(0, 5) && currentTime <= c.end_time?.slice(0, 5);
                            const isPast = currentTime > c.end_time?.slice(0, 5);
                            return (
                                <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${
                                    isActive ? 'bg-emerald-50 border-emerald-200' :
                                    isPast ? 'bg-gray-50 border-gray-200 opacity-60' :
                                    'bg-blue-50 border-blue-200'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : isPast ? 'bg-gray-300' : 'bg-blue-400'}`}></div>
                                        <span className="text-sm font-medium">
                                            {formatTimeSlot(c.start_time)} — {formatTimeSlot(c.end_time)}
                                        </span>
                                        {c.status === 'extra' && <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-600 font-bold rounded">EXTRA</span>}
                                        {c.note && <span className="text-xs text-gray-400">({c.note})</span>}
                                    </div>
                                    <span className={`text-xs font-bold ${isActive ? 'text-emerald-600' : isPast ? 'text-gray-400' : 'text-blue-600'}`}>
                                        {isActive ? '● LIVE NOW' : isPast ? 'ENDED' : 'UPCOMING'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Mark Attendance Section */}
            <div className="p-5 bg-white rounded-xl shadow border">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <MapPin className="text-emerald-500" size={20} />
                    Mark Attendance
                </h3>

                {!activeClass && status === 'idle' ? (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertCircle size={20} className="text-amber-500" />
                        <div>
                            <p className="text-sm font-medium text-amber-700">Attendance marking not available right now</p>
                            <p className="text-xs text-amber-500">
                                {upcomingClasses.length > 0
                                    ? `Next class starts at ${formatTimeSlot(upcomingClasses[0].start_time)}`
                                    : todayClasses?.classes?.length === 0
                                      ? 'No classes today'
                                      : 'All classes have ended for today'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <div>
                            {activeClass && status === 'idle' && (
                                <p className="text-sm text-gray-600 mb-1">
                                    Class active: {formatTimeSlot(activeClass.start_time)} — {formatTimeSlot(activeClass.end_time)}
                                </p>
                            )}
                            {status === 'active' && <p className="text-2xl font-mono text-emerald-600">{formatTime(timer)}</p>}
                            {status === 'completed' && (
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 size={20} />
                                    <span className="font-bold">Attendance marked!</span>
                                </div>
                            )}
                        </div>
                        <div>
                            {status === 'idle' && activeClass && (
                                <button onClick={initiateCapture} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors">
                                    <Play size={18}/> Start Session
                                </button>
                            )}
                            {status === 'capturing' && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                                    <div className="bg-slate-800 p-6 rounded-2xl max-w-sm w-full border border-slate-700 shadow-2xl">
                                        <h4 className="text-white font-bold text-xl mb-2 flex items-center gap-2">
                                            <Camera size={24} className="text-emerald-400"/> Biometric Verification
                                        </h4>
                                        <p className="text-slate-400 text-sm mb-4">Please look into the camera to verify your identity.</p>
                                        <div className="relative rounded-xl overflow-hidden mb-4 bg-black border border-slate-700">
                                            <Webcam
                                                audio={false}
                                                ref={webcamRef}
                                                screenshotFormat="image/jpeg"
                                                videoConstraints={{ facingMode: "user" }}
                                                className="w-full h-auto"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setStatus('idle')}
                                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl transition-colors"
                                                disabled={verifyLoading}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={confirmStartSession}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                                                disabled={verifyLoading}
                                            >
                                                {verifyLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Verify & Start'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {status === 'active' && (
                                <div className="flex items-center gap-4">
                                    {distanceStr && (
                                        <div className="flex flex-col items-end pr-4 border-r border-gray-200">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Distance</span>
                                            <span className={`font-mono font-bold text-lg leading-tight ${distanceStr.includes('Awaiting') || distanceStr === 'nullm' ? 'text-amber-500' : parseInt(distanceStr) <= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {distanceStr}
                                            </span>
                                        </div>
                                    )}
                                    <button onClick={stopSession} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors border border-red-700 shadow-sm">
                                        <Square fill="currentColor" size={18}/> End
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
