// User types
export interface User {
    id: string;
    email: string;
    displayName: string;
    role: 'admin' | 'member';
    isPublic: boolean; // For user directory visibility
    createdAt: string;
}

// Category types
export interface Category {
    id: string;
    name: string;
    description?: string;
    userId: string | null; // null = system category
    isSystem: boolean;
    createdAt: string;
}

// Rating types
export interface Rating {
    id: string;
    promptSetId: string;
    userId: string;
    score: number; // 1-5 stars
    createdAt: string;
}

// Invite link types
export interface InviteLink {
    id: string;
    creatorId: string;
    code: string;
    expiresAt?: string;
    createdAt: string;
}

// Prompt version types
export interface PromptVersion {
    id: string;
    promptSetId: string;
    versionNumber: number;
    promptText: string;
    imageUrl?: string; // Base64 data URL or external URL
    imageGeneratedAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

// Prompt set types
export interface PromptSet {
    id: string;
    userId: string;
    title: string;
    description?: string;
    categoryId?: string;
    notes?: string;
    versions: PromptVersion[];
    createdAt: string;
    updatedAt: string;
}

// Share types
export type ShareState = 'inTransit' | 'accepted' | 'rejected';

export interface Share {
    id: string;
    promptSetId: string;
    promptSetSnapshot: PromptSet; // Deep copy at share time
    senderId: string;
    recipientId: string;
    state: ShareState;
    createdAt: string;
    respondedAt?: string;
}

// Notification types
export interface Notification {
    id: string;
    userId: string;
    type: 'share_received' | 'share_accepted' | 'share_rejected';
    message: string;
    relatedShareId?: string;
    read: boolean;
    createdAt: string;
}

// Generation cache types
export interface GenerationCache {
    promptHash: string;
    imageUrl: string;
    generatedAt: string;
}

// Auth context types
export interface AuthState {
    user: User | null;
    isLoading: boolean;
}

// API response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
