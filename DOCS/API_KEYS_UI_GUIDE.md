# API Keys Management UI - Usage Guide

## Overview

The API Keys management page provides a user-friendly interface for creating and managing API keys for programmatic access to your Image Prompt Manager data.

## Accessing the Page

Navigate to `/api-keys` or click **API Keys** in the main navigation menu.

## Features

### 1. **Create Your First API Key**

When you have no API keys:

1. Click **"Create Your First Key"** button
2. Enter a name for your key (e.g., "Production API Key")
3. Optionally add a description
4. Click **"Create Key"**
5. **IMPORTANT**: Copy the displayed API key immediately - it will only be shown once!
6. Click "I've Saved My Key" after copying

The first key uses a special bootstrap endpoint (`/api/keys/bootstrap`) that doesn't require authentication.

### 2. **View Your API Keys**

The page displays all your API keys with:
- Key name and description
- Key prefix (first 12 characters + "...")
- Creation date
- Last used timestamp (if applicable)

### 3. **Delete an API Key**

1. Click the **"Delete"** button on any key card
2. Confirm the deletion
3. The key will be permanently removed

> [!WARNING]
> Deleting an API key will immediately invalidate it. Any applications using that key will stop working.

## Creating Additional Keys

**Current Limitation**: The UI currently only supports creating the first key via the bootstrap endpoint. To create additional keys, you have two options:

### Option A: Use the API Directly

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "X-API-Key: YOUR_FIRST_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Second API Key",
    "description":"For development"
  }'
```

### Option B: Store Your First Key Securely

In a production application, you would:
1. Store your first API key securely (environment variable, secrets manager, etc.)
2. Use that key to authenticate when creating additional keys via the UI
3. The UI would be enhanced to accept an API key for authentication

## Security Best Practices

1. **Copy Immediately**: API keys are only shown once upon creation
2. **Store Securely**: Use environment variables or a secrets manager
3. **Rotate Regularly**: Delete old keys and create new ones periodically
4. **Limit Scope**: Create separate keys for different applications/environments
5. **Monitor Usage**: Check the "Last used" timestamp to detect unused keys

## Technical Details

### Endpoints Used

- `POST /api/keys/bootstrap` - Create first key (no auth required)
- `GET /api/keys` - List user's keys (requires auth)
- `DELETE /api/keys?id=<keyId>` - Delete a key (requires auth)

### Data Stored

- `id` - Unique identifier
- `userId` - Owner's user ID
- `name` - Human-readable name
- `description` - Optional description
- `keyHash` - SHA-256 hash of the key
- `keyPrefix` - First 12 characters (for display)
- `createdAt` - Creation timestamp
- `lastUsed` - Last usage timestamp

### Security

- Keys are hashed with SHA-256 before storage
- Only the hash is stored in Firestore
- Full key is never retrievable after creation
- Firestore rules ensure users can only access their own keys

## Troubleshooting

### "Failed to load API keys"
- Check your internet connection
- Ensure you're logged in
- Verify Firestore rules are deployed

### "Failed to create API key"
- Check browser console for detailed errors
- Ensure Firebase Admin SDK is properly configured
- Verify environment variables are set

### "To create additional keys, you need to use an existing API key"
- This is expected behavior for the current UI
- Use the API directly with your first key (see Option A above)
- Or wait for UI enhancement to support authenticated key creation

## Future Enhancements

Planned improvements:
- [ ] Support for creating additional keys via UI with authentication
- [ ] API key expiration dates
- [ ] Usage statistics and rate limiting
- [ ] Key scopes and permissions
- [ ] Toast notifications for copy/delete actions
- [ ] Search and filter keys

## Related Documentation

- [API Reference](file:///home/heidless/projects/heidless-ai/antigravity/sandbox/Deployed/ImgPromptMgr/v1/DOCS/API_REFERENCE.md)
- [API Walkthrough](file:///home/heidless/.gemini/antigravity/brain/58392417-cc5c-4e10-a237-05a128b8e55b/walkthrough.md)
