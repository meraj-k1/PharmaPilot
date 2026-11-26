# PharmaPilot

**AI-Powered Pharmacy Operations Platform**

PharmaPilot is a full-stack pharmacy management application that combines operational workflows with an AI assistant. The backend provides pharmacy-scoped APIs for medicines, suppliers, purchasing, inventory, conversations and document-based knowledge retrieval; the frontend provides a React interface for daily operations.

> **Project status:** Active development / academic project. The APIs and workflows described here reflect the shared code and project setup, but this README is not a claim that every feature has passed end-to-end testing. Verify configuration, authentication, inventory calculations, and medical content before any real-world deployment.

## Important Link:

- **Live Link:** https://pharmapilot-backend-s3s1.onrender.com/docs
- **git Link:** https://github.com/meraj-k1/PharmaPilot
- **Explain video Link:** https://drive.google.com/file/d/1x6tLIJRjmHX8NF5Bd4XMSLQ9vBpERnwo/view?usp=sharing

## Features

- **Authentication and pharmacy access:** authenticated workflows with pharmacy-specific authorization (admin/staff roles).
- **Medicines:** manage medicine records including SKU, brand/generic names, strength, dosage form, selling price and reorder threshold.
- **Suppliers:** create, list, update and manage supplier contact details.
- **Purchase orders:** create purchase orders with suppliers, medicines, quantities and unit costs; receive orders with batch and expiry information.
- **Inventory:** list batches, view stock summary, monitor low stock, identify expiring batches and review stock movements. Admin-authorized batch adjustments are exposed by the backend.
- **AI chat and conversations:** Gemini-backed conversational assistant, with conversation IDs used to continue chats and access to pharmacy-oriented tools.
- **Knowledge documents:** upload documents, extract and chunk text, generate embeddings, and support retrieval-augmented responses.
- **Frontend dashboard modules:** React interfaces for medicines, suppliers, purchases, inventory and AI chat.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Axios, Lucide React |
| API | Python 3.12, FastAPI, Pydantic |
| Database | PostgreSQL with pgvector |
| ORM and migrations | SQLAlchemy (async), asyncpg, Alembic |
| AI generation | Google Gemini API (`google-genai`) |
| Embeddings | Hugging Face Text Embeddings Inference (TEI), `intfloat/multilingual-e5-small` (384 dimensions) |
| Containers | Docker Compose |
| Developer environment | Windows / PowerShell, `uv`, Node.js and npm |

## Project layout

```text
PharmaPilot/                    # Local working directory may be H:\Blank_Mind
├── backend/
│   ├── app/
│   │   ├── api/v1/router.py
│   │   ├── core/
│   │   ├── db/
│   │   ├── integrations/
│   │   │   ├── embeddings/
│   │   │   └── mcp/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── medicines/
│   │   │   ├── suppliers/
│   │   │   ├── purchases/
│   │   │   ├── inventory/
│   │   │   ├── conversations/
│   │   │   └── knowledge/
│   │   └── main.py
│   └── alembic/
├── frontend/
│   └── src/
│       ├── lib/api.ts
│       └── features/
│           ├── medicines/
│           ├── suppliers/
│           ├── purchases/
│           ├── inventory/
│           └── ai-chat/
└── README.md
```

The exact Docker Compose filename and all module paths should be checked against the current checkout.

## Requirements

- Python 3.12 and [`uv`](https://docs.astral.sh/uv/)
- Node.js and npm
- Docker Desktop with Docker Compose (for database and TEI services)
- A Google Gemini API key for AI generation

> Do not commit API keys, database passwords, tokens or environment files containing secrets.

## Quick start: Windows development

### 1. Start infrastructure

From the directory containing the project's Compose file:

```powershell
docker compose up -d

docker compose ps
```

In the shared development setup, container service names and published ports were:

| Service | Docker/container network | Windows host |
| --- | --- | --- |
| Backend | `backend:8000` | `http://localhost:8002` |
| PostgreSQL | `db:5432` (service name may vary) | `localhost:5434` |
| TEI embedder | `http://embedder:80` | `http://127.0.0.1:8010` |

These are project-specific example mappings; confirm them with `docker compose ps`. **If running the backend locally with Uvicorn, the local API is typically `http://127.0.0.1:8000`, not `:8002`.**

### 2. Configure the backend

```powershell
cd H:\Blank_Mind\backend
uv sync
```

Review `app/core/config.py` for the authoritative settings names, required secrets and environment-loading behavior. Supply the correct PostgreSQL connection string, authentication settings, Gemini API key and other required values through the project's supported configuration mechanism.

For a **locally running Windows backend**, TEI is reached through the host-published port:

```powershell
$env:EMBEDDING_SERVICE_URL="http://127.0.0.1:8010"
```

For a **Docker backend**, the container-to-container URL is usually:

```text
EMBEDDING_SERVICE_URL=http://embedder:80
```

`http://embedder:80` is not a resolvable hostname for a normal Windows host process. Prefer a process environment variable when the application's `.env` loading path has not been verified.

Do **not** replace the Docker service URL globally just to fix local Windows execution.

### 3. Run database migrations

```powershell
cd H:\Blank_Mind\backend
uv run alembic upgrade head
uv run alembic current
```

Make sure Alembic targets the same database as the running backend. The development database uses pgvector; migrations must have been applied before accessing conversations, inventory, purchases or knowledge records.

### 4. Start the backend

```powershell
cd H:\Blank_Mind\backend
$env:EMBEDDING_SERVICE_URL="http://127.0.0.1:8010"
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Local development links:

- API docs: http://127.0.0.1:8000/docs
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

If running the API from Docker instead, use the configured host port (previously `8002`). Avoid running both environments against different databases without realizing it.

### 5. Start the frontend

Open a second PowerShell terminal:

```powershell
cd H:\Blank_Mind\frontend
npm install
npm run dev
```

Open the URL printed by Vite (commonly http://localhost:5173).

The frontend API client uses `/api/v1/...` routes. Verify the Vite proxy in `vite.config.ts` (or the active frontend configuration) points at the API instance you intend to use. Requests to `localhost:5173/api/v1/...` can be normal when the Vite proxy forwards them to FastAPI.

### 6. Build the frontend

```powershell
cd H:\Blank_Mind\frontend
npx tsc --noEmit
npm run build
```

If PowerShell blocks `npm.ps1`, run `npm.cmd` / `npx.cmd` instead, or adjust PowerShell execution policy only if allowed by your machine's security rules.

## API endpoints

The backend mounts the versioned router under `settings.API_V1_PREFIX` (typically `/api/v1`). Exact availability also depends on the running application instance.

### Inventory

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/inventory/summary` | Inventory summary |
| GET | `/api/v1/inventory/low-stock` | Low-stock medicines |
| GET | `/api/v1/inventory/expiring?days=30&limit=50&offset=0` | Expiring batches |
| GET | `/api/v1/inventory/batches?limit=50&offset=0` | List batches |
| GET | `/api/v1/inventory/batches/{batch_id}` | Batch details |
| POST | `/api/v1/inventory/batches/{batch_id}/adjustments` | Adjust a batch (admin) |
| GET | `/api/v1/inventory/movements` | Stock movement history |

**Note:** There is no `GET /api/v1/inventory` handler in the shared controller. Use `/inventory/batches` to list inventory batches.

### Purchases

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/purchases?limit=20&offset=0` | List purchase orders |
| POST | `/api/v1/purchases` | Create purchase order (admin) |
| GET | `/api/v1/purchases/{purchase_id}` | Purchase details |
| POST | `/api/v1/purchases/{purchase_id}/receive` | Receive purchased items (admin) |

#### Create purchase request

```json
{
  "supplier_id": "00000000-0000-0000-0000-000000000001",
  "items": [
    {
      "medicine_id": "00000000-0000-0000-0000-000000000002",
      "quantity": 10,
      "unit_cost": "25.50"
    }
  ]
}
```

The UUIDs above are **placeholders**, not real database IDs. `PurchaseCreate` accepts only `supplier_id` and `items`; individual items accept only `medicine_id`, `quantity`, and `unit_cost`. Extra keys are rejected (`extra="forbid"`). The API returns **201 Created** on success.

#### Receive purchase request

```json
{
  "items": [
    {
      "purchase_order_item_id": "00000000-0000-0000-0000-000000000003",
      "batch_number": "BATCH-2026-001",
      "manufactured_at": "2026-01-01",
      "expires_at": "2027-12-31"
    }
  ]
}
```

`purchase_order_item_id` identifies the **created purchase line**, not the medicine ID. `manufactured_at` can be `null`; `expires_at` is required and must be later than manufacturing date when one is provided. Sending batch fields during **purchase creation** causes validation failures because those fields belong to the **receive** step.

### Suppliers

The shared supplier Pydantic schema supports:

```json
{
  "name": "Example Supplier",
  "phone": "+8801000000000",
  "email": "supplier@example.com",
  "address": "Example address"
}
```

`name` is required (1–200 characters). `phone`, `email` and `address` are optional. **`contact_person` is not supported** and will trigger a 422 error if sent. Confirm PATCH/DELETE methods in the current supplier controller before wiring edit/remove buttons.

### AI chat

The conversation chat endpoint used by the shared frontend integration is:

```text
POST /api/v1/conversations/chat
```

Example body:

```json
{
  "message": "Which medicines are low in stock?",
  "conversation_id": null
}
```

`conversation_id` can carry the ID returned by the previous chat response for continuity. **Do not send `history`** to this endpoint: the shared request schema disallows extra fields.

Other modules (auth, medicines, knowledge and conversation management) also register routes in the API router. Consult `/docs` or `/openapi.json` for their current request and response contracts instead of assuming URL paths.

## AI and knowledge architecture

The application uses a conversational layer backed by Gemini and pharmacy-related agent tools. A separate knowledge flow extracts uploaded document text, splits it into chunks, calls a TEI embedding service, and stores vectors for retrieval via PostgreSQL/pgvector.

- Model: `intfloat/multilingual-e5-small`
- Embedding dimension: `384`
- TEI host health check: `http://127.0.0.1:8010/health`
- TEI embed API: `POST http://127.0.0.1:8010/embed`

Test embedding service from PowerShell:

```powershell
Invoke-WebRequest http://127.0.0.1:8010/health -UseBasicParsing

$body = @{
  inputs = @("passage: Paracetamol is used to reduce fever.")
} | ConvertTo-Json

$result = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8010/embed" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$result[0].Count
```

The model should return vectors with **384 dimensions** under the documented setup.

> **Medical safety:** AI responses and uploaded knowledge content are informational aids, not a substitute for licensed clinical judgment. Validate any medicine-related advice before acting on it.

## Verify registered routes

Because `app.main` defines an application factory, importing the module in a script should expose `app = create_app()` and registered routes:

```powershell
cd H:\Blank_Mind\backend

@'
from app.main import app

for route in app.routes:
    path = getattr(route, "path", "")
    methods = getattr(route, "methods", set())
    if path.startswith("/api/"):
        print(",".join(sorted(methods)), path)
'@ | uv run python -
```

If the imported application lists different paths from the running API, compare the active process, port, environment variables, API prefix, Vite proxy target and OpenAPI output:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/openapi.json
```

## Troubleshooting

| Symptom | Likely cause | First check |
| --- | --- | --- |
| `404 GET /api/v1/inventory` | Route does not exist | Use `/api/v1/inventory/batches` |
| `404 POST /api/v1/chat` | Wrong frontend endpoint | Use `/api/v1/conversations/chat` |
| `404` on a known route | Wrong backend port/proxy or different application | Compare `openapi.json`, frontend proxy and running processes |
| `422` when creating a supplier | Unsupported `contact_person` or invalid fields | Match `SupplierCreate` schema |
| `422` when creating a purchase | Extra batch/date fields or missing/invalid items | Match `PurchaseCreate` schema; receive separately |
| `403` on purchase create/receive | Insufficient pharmacy role | Check admin access and authentication headers |
| `500` involving `.pharmacy_id` on UUID | Dependency supplies raw UUID, not a pharmacy object | Pass the UUID directly to the service |
| Missing conversation tables | Migration/model registration mismatch | Check `uv run alembic current` and database tables |
| TEI hostname resolution error on Windows | Docker-only `embedder` hostname | Set `EMBEDDING_SERVICE_URL=http://127.0.0.1:8010` in the same shell as local Uvicorn |
| Knowledge upload returns `502` | Embedding service unavailable or request failed | Check TEI health, effective URL and backend logs |
| Gemini returns `503 UNAVAILABLE` | Model temporarily under high demand | Implement controlled retries and surface friendly 503 responses |
| PowerShell blocks `npm.ps1` | Script execution policy | Use `npm.cmd` or `npx.cmd` |

### Logs and diagnostics

```powershell
docker compose ps
docker logs --tail 100 pharmapilot-embedder
docker logs --tail 100 pharmapilot-api
docker logs --tail 100 pharmapilot-db
```

Use the current container names shown by `docker compose ps` if these differ.

## Development conventions

- Keep frontend payloads synchronized with backend Pydantic schemas.
- Use `brand_name` for medicine display where the backend provides that field.
- Use `medicine_id` and `supplier_id` UUIDs rather than names in API requests.
- Keep pharmacy ID authorization on the server; never trust a frontend-supplied pharmacy ID alone.
- Separate **purchase order creation** from **receiving stock batches**.
- Apply and verify Alembic migrations after changes to database models.
- Display API validation errors so users understand why a form cannot submit.
- Do not silently treat absent stock quantities as real zero-stock records.
- Avoid committing `.env`, keys, tokens, database dumps or sensitive pharmacy data.

## Suggested testing checklist

- [ ] Login and role-based access
- [ ] Medicine creation, listing and editing
- [ ] Supplier creation and listing with schema-valid payloads
- [ ] Purchase order creation returns `201`
- [ ] Receive purchase with batch and expiry fields
- [ ] Inventory batch appears after successful receipt
- [ ] Low-stock and expiry views display expected records
- [ ] Stock adjustment and movement history are consistent
- [ ] AI conversation continues using returned `conversation_id`
- [ ] Knowledge upload, embeddings and retrieval work
- [ ] Frontend `npx tsc --noEmit` and `npm run build` pass
- [ ] API error states and unauthorized actions are handled safely

## Roadmap

Potential enhancements include server-side inventory search/sorting, full purchase pagination, persistent chat history navigation, stronger loading and retry states, improved stock audit trails, and production-grade observability and automated tests.

## License

No license has been specified for this project. Add a `LICENSE` file before distributing or publishing under a particular license.
