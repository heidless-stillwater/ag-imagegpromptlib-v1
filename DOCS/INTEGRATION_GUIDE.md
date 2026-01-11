# External Integration Guide: Connecting to PromptVault API

This guide provides step-by-step instructions on how to connect your own application/service to the **Image Prompt Manager (PromptVault)** API.

---

## 1. Prerequisites

Before you begin, ensure you have:
- A registered account on the PromptVault application.
- Access to the PromptVault live URL (Development: `http://localhost:3000` | Production: `https://imageprompt-v1-dev.web.app`).

---

## 2. Obtain Your API Key

Authentication is handled via custom API keys.

1.  Log in to the **PromptVault** application.
2.  Navigate to the **API Keys** section in the sidebar/header.
3.  Click **"Create New Key"**.
4.  Give your key a descriptive name (e.g., "Main Website Consumer").
5.  **CRITICAL**: Copy the full API key displayed in the success modal. It starts with `pk_live_`. 
    > [!WARNING]
    > You will only see this key once. If lost, you must delete it and create a new one.

---

## 3. Base Configuration

### Endpoint Base URL
- **Local Dev**: `http://localhost:3000/api`
- **Production**: `https://imageprompt-v1-dev.web.app/api`

### Authentication Header
Every request must include the following header:
```http
X-API-Key: pk_live_your_key_here
```

---

## 4. Implementation Examples

### Example A: Fetching All Prompt Versions (JavaScript/TypeScript)

Use this to display your generated images and prompts on an external site.

```typescript
async function fetchPromptVersions() {
  const API_KEY = 'pk_live_...'; // Replace with your real key
  const BASE_URL = 'https://imageprompt-v1-dev.web.app/api';

  try {
    const response = await fetch(`${BASE_URL}/versions`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Versions:', result.data);
      // Each version contains: promptText, imageUrl, createdAt, promptSetTitle, etc.
    } else {
      console.error('API Error:', result.error);
    }
  } catch (error) {
    console.error('Connection Error:', error);
  }
}
```

### Example B: Triggering a New Prompt Set (Python)

Use this to programmatically save a new prompt idea from a backend script.

```python
import requests

API_KEY = "pk_live_..."
BASE_URL = "https://imageprompt-v1-dev.web.app/api"

payload = {
    "title": "Automated Landscape Prompt",
    "description": "Created via Python script",
    "initialPrompt": "A futuristic city under a neon sunset, cinematic lighting, 8k"
}

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

response = requests.post(f"{BASE_URL}/promptSets", json=payload, headers=headers)
data = response.json()

if data["success"]:
    print(f"Set Created! ID: {data['data']['id']}")
else:
    print(f"Error: {data['error']}")
```

---

## 5. Standard Workflow

1.  **Auth Check**: Ensure your `X-API-Key` is valid.
2.  **Request Type**: Use `GET` for retrieval and `POST`/`PATCH`/`DELETE` for modifications.
3.  **Data Handling**: Always check the `success: true` flag in the JSON response.
4.  **Security**: Never expose your `pk_live_` key in client-side code (frontend browsers). Always use a backend proxy or server-side environment variables.

---

## 6. Common Endpoints Reference

| Purpose | Method | Endpoint |
| :--- | :--- | :--- |
| **All Versions** | `GET` | `/versions` |
| **User Versions** | `GET` | `/versions/user/{userId}` |
| **List Sets** | `GET` | `/promptSets` |
| **Create Set** | `POST` | `/promptSets` |
| **Add Version** | `POST` | `/promptSets/{id}/versions` |

---

## 7. Troubleshooting

- **401 Unauthorized**: Missing or incorrect `X-API-Key` header.
- **403 Forbidden**: You are trying to access data that doesn't belong to your user account.
- **404 Not Found**: Incorrect Prompt Set ID or Version ID.
- **500 Internal Error**: Check if the PromptVault server is running and configured correctly.

---

**Next Steps**: For a full list of parameters and response object schemas, see [API_REFERENCE.md](./API_REFERENCE.md).
