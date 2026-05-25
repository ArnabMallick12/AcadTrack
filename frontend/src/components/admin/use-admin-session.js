"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getStoredToken, getStoredUser } from '@/lib/auth';

export function useAdminSession() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const storedUser = getStoredUser();
        const storedToken = getStoredToken();

        if (!storedUser || !storedToken) {
            clearSession();
            router.replace('/login');
            return;
        }

        try {
            const parsedUser = JSON.parse(storedUser);
            if (parsedUser.role !== 'admin') {
                router.replace('/login');
                return;
            }

            setUser(parsedUser);
            setIsReady(true);
        } catch {
            clearSession();
            router.replace('/login');
        }
    }, [router]);

    return { user, isReady };
}
