# Image Prompt Manager API - Quick Reference

## Base URL
- Development: `http://localhost:3000`
- Production: `https://imageprompt-v1-dev.web.app`

## Authentication
All requests require an API key in the header:
```
X-API-Key: pk_live_your_key_here
```

---

## Endpoints Summary

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/keys` | List your API keys |
| POST | `/api/keys` | Create new API key |
| PATCH | `/api/keys?id=<id>` | Update key metadata |
| DELETE | `/api/keys?id=<id>` | Delete an API key |

### Versions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/versions` | All versions across all prompt sets |
| GET | `/api/versions/user/:userId` | All versions for a specific user |
| GET | `/api/promptSets/user/:userId` | All prompt sets for a specific user |
| GET | `/api/promptSets/:id/versions/:versionId` | Specific version of a prompt set |

### Prompt Sets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/promptSets` | List all prompt sets |
| POST | `/api/promptSets` | Create new prompt set |
| GET | `/api/promptSets/<id>` | Get single prompt set |
| PATCH | `/api/promptSets/<id>` | Update prompt set |
| DELETE | `/api/promptSets/<id>` | Delete prompt set |

### Versions (within Prompt Sets)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/promptSets/<id>/versions` | Add version to set |
| PATCH | `/api/promptSets/<id>/versions?versionId=<vid>` | Update version |
| DELETE | `/api/promptSets/<id>/versions?versionId=<vid>` | Delete version |

---

## Quick Examples

### Create API Key
```bash
curl -X POST http://localhost:3000/api/keys \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Key"}'
```

### Get All Versions
```bash
curl http://localhost:3000/api/versions \
  -H "X-API-Key: YOUR_KEY"
```

### Create Prompt Set
```bash
curl -X POST http://localhost:3000/api/promptSets \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"My Set",
    "description":"Test",
    "initialPrompt":"A beautiful landscape"
  }'
```

### Add Version
```bash
curl -X POST http://localhost:3000/api/promptSets/SET_ID/versions \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "promptText":"Updated prompt text",
    "notes":"Version 2"
  }'
```

### 3. Retrieve User Prompt Sets

**Endpoint**: `GET /api/promptSets/user/:userId`
**Description**: Returns a list of all promptSets for a particular User.

### 4. Retrieve Specific Version

**Endpoint**: `GET /api/promptSets/:id/versions/:versionId`
**Description**: Returns a specific Version of a Specific PromptSet for a specific User.

---

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## Security Notes

1. **API keys are shown only once** upon creation
2. Keys are hashed with SHA-256 before storage
3. Users can only access their own data (unless admin)
4. All write operations verify ownership
5. Keys can have optional expiration dates

---

## Getting Started

1. **Get your first API key** (bootstrap via Firebase Console or UI)
2. **Test the connection**:
   ```bash
   curl http://localhost:3000/api/versions -H "X-API-Key: YOUR_KEY"
   ```
3. **Start building!**

For detailed documentation, see [walkthrough.md](file:///home/heidless/.gemini/antigravity/brain/58392417-cc5c-4e10-a237-05a128b8e55b/walkthrough.md)
