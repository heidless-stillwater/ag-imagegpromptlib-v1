# AI-to-AI Integration Prompt: Image Prompt Manager (PromptVault)

*Copy and paste the following prompt into your other Antigravity instance to integrate with this app.*


---

"Create a service layer to consume the PromptVault API"

## Integration Objective
I want to integrate the **Image Prompt Manager (PromptVault)** API into this current application. PromptVault will serve as our primary service provider for AI-generated images and prompt versioning data.

## Service Provider Details
- **Name**: Image Prompt Manager (PromptVault)
- **Role**: API Service Provider (RESTful)
- **Base URL**: `https://imageprompt-v1-dev.web.app/api` (Production) or `http://localhost:3000/api` (Development)

## Authentication
- **Method**: API Key in Header
- **Header Key**: `X-API-Key`
- **Value**: `pk_live_SivqQp5ssy_0Mz_uBbAuJulTzuRyQSg_Fk424Y2KF-I`

## Core Endpoints to Integrate
1. **Retrieve Content**:
   - `GET /versions`: Fetch all prompt iterations and their associated image URLs.
   - `GET /versions/user/[userId]`: Sync data for a specific user.
2. **Manage Content**:
   - `GET /promptSets`: List available collections.
   - `POST /promptSets`: Create a new prompt set from this app.
   - `POST /promptSets/[id]/versions`: Add a new version/iteration to an existing set.

## Data Structures
The API returns a standard JSON wrapper:
```json
{
  "success": true,
  "data": { ... }
}
```
Each **Version** object contains: `id`, `promptText`, `imageUrl` (base64 or URL), `versionNumber`, and `createdAt`.

## Task for you (AI Agent):
1. Create a service module (e.g., `src/services/promptVault.ts`) to wrap these API calls.
2. Store the API Key and Base URL in `.env.local`.
3. Implement error handling for `401` (Unauthorized) and `403` (Forbidden) responses.
4. (Optional) Create a UI component to display the synced image iterations from PromptVault.

---

## Configuration Info to Provide to the Other Agent:
1. **API Key**: Genererate one in the PromptVault UI (`/api-keys`) and provide the `pk_live_...` string.
2. **Environment Variable Name**: Suggest using `pk_live_SivqQp5ssy_0Mz_uBbAuJulTzuRyQSg_Fk424Y2KF-I`.
3. **Base URL**: Use `https://imageprompt-v1-dev.web.app/api`.
