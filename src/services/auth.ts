import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from '@/types';
import { sanitizeData } from '@/lib/firestore';

/**
 * Convert Firebase User and Firestore Data to our User type
 */
const mapToAppUser = (firebaseUser: FirebaseUser, userData: any): User => ({
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: userData?.displayName || firebaseUser.displayName || 'Anonymous User',
    role: userData?.role || 'member',
    isPublic: userData?.isPublic ?? true,
    avatarUrl: userData?.avatarUrl || firebaseUser.photoURL || '',
    avatarPrompt: userData?.avatarPrompt || '',
    avatarBgColor: userData?.avatarBgColor || '',
    username: userData?.username || '',
    loginName: userData?.loginName || '',
    settings: userData?.settings || {},
    createdAt: userData?.createdAt || new Date().toISOString(),
});

/**
 * Register a new user with email and password
 */
export async function registerUser(email: string, password: string, displayName: string): Promise<User | null> {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        const userData = {
            id: firebaseUser.uid,
            email,
            displayName,
            role: 'member',
            isPublic: true,
            createdAt: new Date().toISOString(),
        };

        // Save to master 'users' collection
        await setDoc(doc(db, 'users', firebaseUser.uid), sanitizeData(userData));

        return mapToAppUser(firebaseUser, userData);
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<User | null> {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;

        return mapToAppUser(firebaseUser, userData);
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

/**
 * Login with Google
 */
export async function loginWithGoogle(): Promise<User | null> {
    try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const firebaseUser = userCredential.user;

        // Check if user exists in Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        let userData;
        if (!userDoc.exists()) {
            // Initialize new user profile
            userData = {
                id: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || 'Google User',
                role: 'member',
                isPublic: true,
                createdAt: new Date().toISOString(),
                avatarUrl: firebaseUser.photoURL,
            };
            await setDoc(userRef, sanitizeData(userData));
        } else {
            userData = userDoc.data();
        }

        return mapToAppUser(firebaseUser, userData);
    } catch (error) {
        console.error('Google login error:', error);
        throw error;
    }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
    await signOut(auth);
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<User | null> {
    try {
        const userRef = doc(db, 'users', userId);

        // Remove 'password' if it's there (we use Firebase Auth for password changes)
        const { password, ...firestoreUpdates } = updates as any;

        await updateDoc(userRef, sanitizeData(firestoreUpdates));

        // If password is provided, it's handled via different Firebase Auth methods 
        // usually in a sensitive flow, but for now we skip it or handle it in Profile page.

        const updatedDoc = await getDoc(userRef);
        if (updatedDoc.exists()) {
            const firebaseUser = auth.currentUser;
            if (firebaseUser) {
                return mapToAppUser(firebaseUser, updatedDoc.data());
            }
        }
        return null;
    } catch (error) {
        console.error('Update profile error:', error);
        return null;
    }
}

/**
 * Get current user data
 */
export async function getCurrentUser(): Promise<User | null> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;

    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
        return mapToAppUser(firebaseUser, userDoc.data());
    }

    return null;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
        return { id: userId, ...userDoc.data() } as User;
    }
    return null;
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<User[]> {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
}

/**
 * Check if admin
 */
export async function isAdmin(): Promise<boolean> {
    const user = await getCurrentUser();
    return user?.role === 'admin';
}

/**
 * Switch role (Dev only / Demo functionality)
 */
export async function switchRole(newRole: 'admin' | 'member'): Promise<User | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    return await updateUserProfile(user.id, { role: newRole });
}
