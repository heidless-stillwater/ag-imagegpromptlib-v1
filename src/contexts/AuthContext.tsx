'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { getCurrentUser, loginWithRole, logout as authLogout, switchRole as authSwitchRole } from '@/services/auth';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAdmin: boolean;
    login: (role: 'admin' | 'member') => void;
    logout: () => void;
    switchRole: (role: 'admin' | 'member') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        const currentUser = getCurrentUser();
        setUser(currentUser);
        setIsLoading(false);
    }, []);

    const login = (role: 'admin' | 'member') => {
        const loggedInUser = loginWithRole(role);
        setUser(loggedInUser);
    };

    const logout = () => {
        authLogout();
        setUser(null);
    };

    const switchRole = (role: 'admin' | 'member') => {
        const updatedUser = authSwitchRole(role);
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAdmin: user?.role === 'admin',
            login,
            logout,
            switchRole,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
