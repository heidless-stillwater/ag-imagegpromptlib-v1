import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Define the mocks FIRST
export const mockFirestore = {
    doc: vi.fn((...args) => ({ path: args.slice(1).join('/'), _path: { segments: args.slice(1) } })),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(),
    deleteDoc: vi.fn(),
    collection: vi.fn((...args) => ({ path: args.slice(1).join('/'), _path: { segments: args.slice(1) } })),
    getDocs: vi.fn(),
    query: vi.fn((col) => col),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    onSnapshot: vi.fn(),
    createDocSnapshot: (data: any, exists = true) => ({
        exists: () => exists,
        data: () => data,
        id: data?.id || 'doc-id',
        ref: { id: data?.id || 'doc-id' }
    }),
    createCollectionSnapshot: (docsData: any[]) => ({
        docs: docsData.map(data => ({
            id: data.id || 'doc-id',
            data: () => data,
            ref: { id: data.id || 'doc-id' }
        })),
        empty: docsData.length === 0,
        size: docsData.length,
    }),
};

export const mockAuth = {
    currentUser: null as any,
    onAuthStateChanged: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    signInWithPopup: vi.fn(),
};

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
    }),
    usePathname: () => '/',
    useParams: () => ({}),
    useSearchParams: () => new URLSearchParams(),
}));

// Mock Firebase SDKs
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => mockAuth),
    onAuthStateChanged: (auth: any, cb: any) => mockAuth.onAuthStateChanged(auth, cb),
    signInWithEmailAndPassword: (auth: any, e: any, p: any) => mockAuth.signInWithEmailAndPassword(auth, e, p),
    createUserWithEmailAndPassword: (auth: any, e: any, p: any) => mockAuth.createUserWithEmailAndPassword(auth, e, p),
    signOut: (auth: any) => mockAuth.signOut(auth),
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    doc: (...args: any[]) => mockFirestore.doc(...args),
    getDoc: (...args: any[]) => mockFirestore.getDoc(...args),
    setDoc: (...args: any[]) => mockFirestore.setDoc(...args),
    updateDoc: (...args: any[]) => mockFirestore.updateDoc(...args),
    addDoc: (...args: any[]) => mockFirestore.addDoc(...args),
    deleteDoc: (...args: any[]) => mockFirestore.deleteDoc(...args),
    collection: (...args: any[]) => mockFirestore.collection(...args),
    getDocs: (...args: any[]) => mockFirestore.getDocs(...args),
    query: (...args: any[]) => mockFirestore.query(...args),
    where: (...args: any[]) => mockFirestore.where(...args),
    orderBy: (...args: any[]) => mockFirestore.orderBy(...args),
    limit: (...args: any[]) => mockFirestore.limit(...args),
    onSnapshot: (...args: any[]) => mockFirestore.onSnapshot(...args),
}));

// Mock our internal firebase lib
vi.mock('@/lib/firebase', () => ({
    auth: mockAuth,
    db: mockFirestore,
    storage: {},
}));
