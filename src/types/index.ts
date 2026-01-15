// User types
export interface User {
    id: string;
    email: string;
    username?: string;
    loginName?: string;
    displayName: string;
    avatarUrl?: string; // Base64 or external URL
    avatarPrompt?: string; // Remembered prompt for AI generation
    password?: string; // For mock auth
    role: 'admin' | 'member';
    isPublic: boolean; // For user directory visibility
    settings?: {
        geminiApiKey?: string;
        [key: string]: any;
    };
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
    videoUrl?: string; // Base64 data URL or external URL
    videoGeneratedAt?: string;
    notes?: string;
    attachments?: Attachment[]; // File attachments for this version
    preferredBackgroundStyle?: string; // NEW: Persisted background style preference
    tags?: string[]; // Tags for the version (e.g., 'veo 3', 'video')
    createdAt: string;
    updatedAt: string;
}

// Attachment types
export type AttachmentSource = 'upload' | 'media' | 'promptset_version';

export interface Attachment {
    id: string;
    name: string;             // Display name / reference key
    type: 'image' | 'file';   // File category
    mimeType: string;         // e.g., 'image/png', 'application/pdf'
    url: string;              // Storage URL or data URL
    source: AttachmentSource;
    sourceId?: string;        // Media ID or PromptVersion ID for references
    sourcePromptSetId?: string; // PromptSet ID if from version
    sourcePromptSetTitle?: string; // Title of source PromptSet for display
    createdAt: string;
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

// Media types
export interface MediaImage {
    id: string;
    userId: string;
    url: string; // Base64 or external URL
    promptSetId?: string; // Reference to original prompt set if applicable
    versionId?: string; // Reference to original version if applicable
    createdAt: string;
}

// Backup types
export interface Backup {
    id: string;
    userId: string;
    type: 'promptSet' | 'media' | 'all';
    file: string; // Base64 or JSON string
    fileName: string;
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

// API Key types
export interface ApiKey {
    id: string;
    userId: string;
    name: string;
    description?: string;
    keyHash: string; // SHA-256 hash of the key
    keyPrefix: string; // First 12 chars for display (e.g., "pk_live_...")
    lastUsed?: string;
    createdAt: string;
    expiresAt?: string;
}

// Version with metadata for API responses
export interface VersionWithMetadata extends PromptVersion {
    promptSetTitle: string;
    promptSetDescription?: string;
    promptSetCategoryId?: string;
    userName: string;
    userEmail: string;
}

// API response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
