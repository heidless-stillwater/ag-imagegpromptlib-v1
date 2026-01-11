# Image Prompt Manager - Functional Overview

## Application Summary

**Image Prompt Manager** (PromptVault) is a comprehensive web application for managing AI image generation prompts, their versions, and generated images. It provides both a rich user interface and a RESTful API for programmatic access.

---

## Core Concept

The application enables users to:
1. **Create and organize prompt sets** - Collections of related image generation prompts
2. **Version prompts** - Track multiple iterations of prompts with their generated images
3. **Generate images** - Use Gemini AI to create images from prompts
4. **Share prompts** - Collaborate by sharing prompt sets with other users
5. **Access via API** - Programmatic access to all data through secure API keys

---

## User Roles

### Member (Regular User)
- Create, edit, and delete their own prompt sets
- Generate images using AI
- Share prompt sets with other users
- Access their own data via API
- Manage their media library
- Create backups of their data

### Admin
- All member capabilities
- View and manage all users' prompt sets
- Access all data across the system
- Administrative dashboard with system-wide statistics

---

## Main Features

### 1. **Prompt Set Management**

**Location**: Dashboard (`/dashboard`)

**Functionality**:
- Create new prompt sets with title, description, category, and notes
- Each prompt set contains multiple versions
- Organize by categories
- Search and filter prompt sets
- Duplicate existing prompt sets
- Delete prompt sets

**Data Structure**:
```typescript
PromptSet {
  id: string
  userId: string
  title: string
  description: string
  categoryId: string
  notes: string
  versions: PromptVersion[]
  createdAt: string
  updatedAt: string
}
```

### 2. **Prompt Versioning**

**Location**: Prompt Detail Page (`/prompts/[id]`)

**Functionality**:
- Add new versions to a prompt set
- Each version has:
  - Version number (auto-incremented)
  - Prompt text
  - Optional generated image
  - Notes
  - Timestamps
- Edit existing versions
- Delete versions
- Generate images for specific versions

**Data Structure**:
```typescript
PromptVersion {
  id: string
  promptSetId: string
  versionNumber: number
  promptText: string
  imageUrl?: string (base64 or URL)
  imageGeneratedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}
```

### 3. **AI Image Generation**

**Location**: Throughout the app (prompt detail pages)

**Functionality**:
- Generate images using Gemini 2.5 Flash Image model
- User confirmation required before API calls
- Images stored as base64 data URLs
- Automatic sync to media library
- Caching to minimize API calls

**Integration**:
- Uses Google Generative AI SDK
- API endpoint: `/api/generate`
- Requires explicit user permission for each generation
- Safety settings: BLOCK_NONE

### 4. **Media Library**

**Location**: Media Page (`/media`)

**Functionality**:
- View all generated images
- Select multiple images
- Download selected images as ZIP
- Delete selected images
- Filter and search media
- Bulk operations

**Features**:
- Grid view with thumbnails
- Image metadata (creation date, associated prompt)
- Selection mode for batch operations
- ZIP export with JSZip library

### 5. **Sharing System**

**Location**: Shares Page (`/shares`)

**Functionality**:
- Share prompt sets with other users
- Three share states:
  - **In Transit**: Pending recipient action
  - **Accepted**: Recipient accepted and duplicated
  - **Rejected**: Recipient declined
- View incoming and outgoing shares
- Accept/reject incoming shares
- Notifications for share events

**Workflow**:
1. Sender shares a prompt set with recipient
2. System creates a snapshot of the prompt set
3. Recipient receives notification
4. Recipient can accept (duplicates to their account) or reject
5. Sender gets notified of the decision

### 6. **Backup & Restore**

**Location**: Backups Page (`/backups`)

**Functionality**:
- Export data as JSON or ZIP
- Backup types:
  - Prompt sets only
  - Media library only
  - Complete backup (all data)
- Restore from backup files
- Download backups locally

**Data Included**:
- Prompt sets with all versions
- Media images
- Categories
- User preferences

### 7. **User Profile**

**Location**: Profile Page (`/profile`)

**Functionality**:
- View and edit profile information
- Generate AI avatar using Gemini
- Update display name
- Manage account settings
- View user statistics

### 8. **Admin Panel**

**Location**: Admin Page (`/admin`) - Admin only

**Functionality**:
- System-wide statistics
- View all users
- Manage all prompt sets
- User management
- System health monitoring

### 9. **API Access**

**Location**: API Keys Page (`/api-keys`)

**Functionality**:
- Create API keys for programmatic access
- View all your API keys
- Delete unused keys
- Monitor key usage (last used timestamp)

**API Endpoints**:

#### Version Retrieval
- `GET /api/versions` - All versions across all prompt sets
- `GET /api/versions/user/:userId` - All versions for a specific user

#### Prompt Sets CRUD
- `GET /api/promptSets` - List all accessible prompt sets
- `POST /api/promptSets` - Create new prompt set
- `GET /api/promptSets/:id` - Get single prompt set
- `PATCH /api/promptSets/:id` - Update prompt set
- `DELETE /api/promptSets/:id` - Delete prompt set

#### Version Management
- `POST /api/promptSets/:id/versions` - Add version
- `PATCH /api/promptSets/:id/versions?versionId=:vid` - Update version
- `DELETE /api/promptSets/:id/versions?versionId=:vid` - Delete version

#### API Key Management
- `GET /api/keys` - List your keys
- `POST /api/keys` - Create new key (requires existing key)
- `POST /api/keys/bootstrap` - Create first key (no auth)
- `PATCH /api/keys?id=:id` - Update key metadata
- `DELETE /api/keys?id=:id` - Delete key

---

## Technology Stack

### Frontend
- **Framework**: Next.js 16.1.1 with App Router
- **Language**: TypeScript
- **Styling**: CSS Modules with custom dark theme
- **State Management**: React Context API
- **UI Components**: Custom components with glassmorphism design

### Backend
- **Runtime**: Next.js API Routes (serverless)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage (for future use)
- **Admin SDK**: Firebase Admin for server-side operations

### AI Integration
- **Provider**: Google Generative AI
- **Model**: Gemini 2.5 Flash Image
- **SDK**: @google/generative-ai

### Key Libraries
- `firebase` - Client SDK
- `firebase-admin` - Server SDK
- `react-firebase-hooks` - React hooks for Firebase
- `jszip` - ZIP file creation
- `uuid` - Unique ID generation

---

## Data Architecture

### Firestore Collections

#### `users`
```typescript
{
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  role: 'admin' | 'member'
  isPublic: boolean
  createdAt: string
}
```

#### `promptSets`
```typescript
{
  id: string
  userId: string
  title: string
  description: string
  categoryId: string
  notes: string
  versions: PromptVersion[]  // Embedded array
  createdAt: string
  updatedAt: string
}
```

#### `media`
```typescript
{
  id: string
  userId: string
  url: string  // Base64 data URL
  promptSetId?: string
  versionId?: string
  createdAt: string
}
```

#### `shares`
```typescript
{
  id: string
  promptSetId: string
  promptSetSnapshot: PromptSet  // Deep copy
  senderId: string
  recipientId: string
  state: 'inTransit' | 'accepted' | 'rejected'
  createdAt: string
  respondedAt?: string
}
```

#### `notifications`
```typescript
{
  id: string
  userId: string
  type: 'share_received' | 'share_accepted' | 'share_rejected'
  message: string
  relatedShareId?: string
  read: boolean
  createdAt: string
}
```

#### `categories`
```typescript
{
  id: string
  name: string
  description: string
  userId: string | null  // null = system category
  isSystem: boolean
  createdAt: string
}
```

#### `apiKeys`
```typescript
{
  id: string
  userId: string
  name: string
  description: string
  keyHash: string  // SHA-256 hash
  keyPrefix: string  // First 12 chars for display
  lastUsed?: string
  createdAt: string
  expiresAt?: string
}
```

#### `backups`
```typescript
{
  id: string
  userId: string
  type: 'promptSet' | 'media' | 'all'
  file: string  // JSON or base64
  fileName: string
  createdAt: string
}
```

---

## Security Features

### Authentication
- Firebase Authentication
- Email/password login
- Session management
- Protected routes

### Authorization
- Role-based access control (admin/member)
- Firestore security rules
- API key authentication for API endpoints
- User ownership validation

### API Security
- API keys hashed with SHA-256
- Keys shown only once upon creation
- Per-user key management
- Last used tracking
- Optional expiration dates

### Firestore Security Rules
```javascript
// Users can only access their own data
match /promptSets/{doc} {
  allow read, write: if request.auth.uid == resource.data.userId
}

// API keys are private to each user
match /apiKeys/{keyId} {
  allow read, write: if request.auth.uid == resource.data.userId
}
```

---

## User Interface Design

### Design System
- **Theme**: Dark mode with purple/blue gradient accents
- **Style**: Modern glassmorphism with subtle blur effects
- **Colors**:
  - Primary: Purple (#8b5cf6)
  - Secondary: Blue (#3b82f6)
  - Background: Dark gray (#0a0a0f)
  - Cards: Semi-transparent with backdrop blur
- **Typography**: System fonts with clear hierarchy
- **Icons**: Custom SVG icons throughout

### Responsive Design
- Mobile-first approach
- Breakpoint: 1024px for tablet/desktop
- Hamburger menu on mobile
- Adaptive layouts for all screen sizes

### Key UI Patterns
- **Modals**: Confirmation dialogs, creation forms
- **Cards**: Glassmorphic cards for content display
- **Buttons**: Gradient buttons with hover effects
- **Forms**: Clean input fields with focus states
- **Notifications**: Badge counters for pending items

---

## Workflow Examples

### Creating and Generating an Image

1. User logs in
2. Navigates to Dashboard
3. Clicks "Create New Prompt Set"
4. Enters title, description, initial prompt
5. Saves prompt set
6. Opens prompt detail page
7. Clicks "Generate Image" on a version
8. Confirms the API call
9. Image is generated and displayed
10. Image auto-syncs to media library

### Sharing a Prompt Set

1. User A creates a prompt set
2. Clicks "Share" button
3. Selects User B from user list
4. Confirms share
5. System creates snapshot and notification
6. User B receives notification
7. User B views share in Shares page
8. User B accepts share
9. Prompt set is duplicated to User B's account
10. User A receives acceptance notification

### Using the API

1. User navigates to API Keys page
2. Creates first API key (bootstrap)
3. Copies the key securely
4. Makes API request:
   ```bash
   curl -H "X-API-Key: pk_live_..." \
     http://localhost:3000/api/versions
   ```
5. Receives JSON response with all versions

---

## File Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected routes
│   │   ├── admin/           # Admin panel
│   │   ├── backups/         # Backup management
│   │   ├── dashboard/       # Main dashboard
│   │   ├── media/           # Media library
│   │   ├── profile/         # User profile
│   │   ├── prompts/[id]/    # Prompt detail
│   │   └── shares/          # Share management
│   ├── api/                 # API routes
│   │   ├── generate/        # Image generation
│   │   ├── keys/            # API key management
│   │   ├── promptSets/      # Prompt sets CRUD
│   │   └── versions/        # Version retrieval
│   ├── api-keys/            # API keys UI
│   └── page.tsx             # Login page
├── components/
│   ├── layout/              # Header, layout components
│   └── ui/                  # Reusable UI components
├── contexts/
│   └── AuthContext.tsx      # Authentication context
├── hooks/
│   ├── useNotifications.ts  # Notifications hook
│   └── useShares.ts         # Shares hook
├── lib/
│   ├── firebase.ts          # Firebase client config
│   ├── firebase-admin.ts    # Firebase Admin SDK
│   ├── api-middleware.ts    # API authentication
│   └── firestore.ts         # Firestore utilities
├── services/
│   ├── apiKeys.ts           # API key service
│   ├── auth.ts              # Auth service
│   ├── backup.ts            # Backup service
│   ├── categories.ts        # Categories service
│   ├── gemini.ts            # AI generation service
│   ├── media.ts             # Media service
│   ├── notifications.ts     # Notifications service
│   ├── promptSets.ts        # Prompt sets service
│   ├── shares.ts            # Sharing service
│   └── users.ts             # User service
└── types/
    └── index.ts             # TypeScript definitions
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Firebase Admin SDK
FIREBASE_ADMIN_TYPE=service_account
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_PRIVATE_KEY_ID=your_key_id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_CLIENT_ID=your_client_id
```

---

## Deployment

### Firebase Hosting

```bash
# Build the application
npm run build

# Deploy to Firebase
firebase deploy --only hosting

# Deploy Firestore rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### Live URL
- Development: `http://localhost:3000`
- Production: `https://imageprompt-v1-dev.web.app`

---

## Key Features Summary

✅ **Prompt Management**: Create, version, and organize AI prompts  
✅ **AI Image Generation**: Generate images with Gemini AI  
✅ **Media Library**: Manage all generated images  
✅ **Sharing**: Collaborate with other users  
✅ **Backup/Restore**: Export and import your data  
✅ **API Access**: Programmatic access with API keys  
✅ **Role-Based Access**: Admin and member roles  
✅ **Dark Theme**: Modern glassmorphism design  
✅ **Responsive**: Works on all devices  
✅ **Secure**: Firebase Auth + API key authentication  

---

## Documentation

- [API Reference](file:///home/heidless/projects/heidless-ai/antigravity/sandbox/Deployed/ImgPromptMgr/v1/DOCS/API_REFERENCE.md)
- [API Walkthrough](file:///home/heidless/.gemini/antigravity/brain/58392417-cc5c-4e10-a237-05a128b8e55b/walkthrough.md)
- [API Keys UI Guide](file:///home/heidless/projects/heidless-ai/antigravity/sandbox/Deployed/ImgPromptMgr/v1/DOCS/API_KEYS_UI_GUIDE.md)

---

## Future Enhancements

- [ ] Real-time collaboration
- [ ] Advanced search and filtering
- [ ] Image editing capabilities
- [ ] Prompt templates library
- [ ] Analytics and usage statistics
- [ ] API rate limiting
- [ ] Webhook support
- [ ] Mobile app (React Native)
- [ ] Integration with other AI models
- [ ] Team workspaces
