'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { getCurrentUser, loginWithRole, logout as authLogout, switchRole as authSwitchRole } from '@/services/auth';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAdmin: boolean;
    login: (role: 'admin' | 'member') => Promise<void>;
    logout: () => Promise<void>;
    switchRole: (role: 'admin' | 'member') => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Check for existing session
                const currentUser = await getCurrentUser();
                setUser(currentUser);
            } catch (error) {
                console.error('Failed to initialize auth:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = async (role: 'admin' | 'member') => {
        setIsLoading(true);
        try {
            const loggedInUser = await loginWithRole(role);
            setUser(loggedInUser);
        } catch (error) {
            console.error('Login failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            await authLogout();
            setUser(null);
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const switchRole = async (role: 'admin' | 'member') => {
        setIsLoading(true);
        try {
            const updatedUser = await authSwitchRole(role);
            setUser(updatedUser);
        } catch (error) {
            console.error('Switch role failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshUser = async () => {
        try {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
        } catch (error) {
            console.error('Refresh user failed:', error);
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAdmin: user?.role === 'admin',
            login,
            logout,
            switchRole,
            refreshUser,
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
