'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { User } from '@/types';
import { auth, db } from '@/lib/firebase';
import {
    logout as firebaseLogout,
    switchRole as firebaseSwitchRole,
    getCurrentUser,
    login as firebaseLogin,
    loginWithGoogle as firebaseLoginWithGoogle,
    registerUser as firebaseRegister
} from '@/services/auth';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    register: (email: string, password: string, displayName: string) => Promise<void>;
    logout: () => Promise<void>;
    switchRole: (role: 'admin' | 'member') => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userRef = doc(db, 'users', firebaseUser.uid);

                const unsubscribeUser = onSnapshot(userRef, (doc) => {
                    if (doc.exists()) {
                        const userData = doc.data();
                        setUser({
                            id: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            displayName: userData.displayName || firebaseUser.displayName || 'User',
                            role: userData.role || 'member',
                            isPublic: userData.isPublic ?? true,
                            avatarUrl: userData.avatarUrl || firebaseUser.photoURL || '',
                            avatarPrompt: userData.avatarPrompt || '',
                            username: userData.username || '',
                            loginName: userData.loginName || '',
                            createdAt: userData.createdAt,
                        });
                    } else {
                        // User exists in Auth but not yet in Firestore (rare, should be handled in login/register)
                        setUser({
                            id: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            displayName: firebaseUser.displayName || 'User',
                            role: 'member',
                            isPublic: true,
                            createdAt: new Date().toISOString(),
                        });
                    }
                    setIsLoading(false);
                }, (error) => {
                    console.error('User profile snapshot error:', error);
                    setIsLoading(false);
                });

                return () => unsubscribeUser();
            } else {
                setUser(null);
                setIsLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const login = async (email: string, password: string) => {
        await firebaseLogin(email, password);
    };

    const loginWithGoogle = async () => {
        await firebaseLoginWithGoogle();
    };

    const register = async (email: string, password: string, displayName: string) => {
        await firebaseRegister(email, password, displayName);
    };

    const logout = async () => {
        await firebaseLogout();
    };

    const switchRole = async (role: 'admin' | 'member') => {
        await firebaseSwitchRole(role);
    };

    const refreshUser = async () => {
        const updatedUser = await getCurrentUser();
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAdmin: user?.role === 'admin',
            login,
            loginWithGoogle,
            register,
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
