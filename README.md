# TalentFlow Backend Assessment

A comprehensive backend engineering assessment implementing a two-service architecture for candidate evaluation and document processing.

## Project Overview

**TalentFlow** consists of two microservices working in concert:

### FastAPI Service (`python-service/`)
- Handles briefing generation and report formatting
- SQLAlchemy ORM with PostgreSQL
- Jinja2 templating for HTML reports
- RESTful API with pytest test suite

### NestJS Service (`ts-service/`)
- Document intake and candidate management
- Asynchronous summary generation with background workers
- TypeORM with type-safe entities
- Workspace-scoped access control
- Gemini LLM integration (with fake provider fallback)
- Comprehensive unit and e2e testing with jest

## Quick Start

### Prerequisites

- **Node.js** 18+ (for NestJS service)
- **Python** 3.9+ (for FastAPI service)
- **PostgreSQL** 16+ (local or Docker)
- **Docker & Docker Compose** (for containerized Postgres)

### 1. Database Setup

Start PostgreSQL:

```bash
docker-compose up -d
```

This starts a PostgreSQL 16 container on `localhost:5432` with credentials:
- User: `assessment_user`
- Password: `assessment_pass`
- Database: `assessment_db`

### 2. FastAPI Service

```bash
cd python-service

# Install dependencies
pip install -r requirements.txt

# Run migrations
python -m app.db.run_migrations

# Start development server
python -m uvicorn app.main:app --reload

# Run tests
pytest
```

FastAPI server runs on `http://localhost:8000`

### 3. NestJS Service

```bash
cd ts-service

# Install dependencies
npm install

# Run migrations
npm run migration:run

# Start development server
npm run start:dev

# Run tests
npm test

# Run e2e tests
npm run test:e2e
```

NestJS server runs on `http://localhost:3000`

## API Documentation

### FastAPI Briefing API

#### Create Briefing
```
POST /briefings
Content-Type: application/json

{
  "title": "Leadership Evaluation",
  "keyPoints": [
    {"title": "Technical Skills", "description": "Strong in system design"}
  ],
  "risks": [
    {"title": "Limited Experience", "description": "First management role"}
  ],
  "metrics": [
    {"name": "Years Experience", "value": 5},
    {"name": "Team Size Led", "value": 3}
  ]
}
```

#### Get Briefing
```
GET /briefings/{id}
```

#### Generate & Render Report
```
POST /briefings/{id}/generate    # Returns JSON view model
GET /briefings/{id}/html          # Returns styled HTML report
```

### NestJS Document & Summary API

#### Create Candidate
```
POST /sample/candidates
Headers: x-user-id, x-workspace-id
{
  "fullName": "Alice Johnson",
  "email": "alice@example.com"
}
```

#### Upload Document
```
POST /candidates/{candidateId}/documents
Headers: x-user-id, x-workspace-id
{
  "documentType": "resume",
  "fileName": "resume.pdf",
  "storageKey": "s3://bucket/resume.pdf",
  "rawText": "Document content here..."
}
```

#### Generate Summary (Async)
```
POST /candidates/{candidateId}/summaries/generate
Headers: x-user-id, x-workspace-id
```
Returns immediately with status `pending`. Background worker processes every 2 seconds.

#### Check Summary Status
```
GET /candidates/{candidateId}/summaries/{summaryId}
Headers: x-user-id, x-workspace-id
```

## Authentication

NestJS service uses **header-based authentication** for development:

```
x-user-id: <any-string>
x-workspace-id: <workspace-identifier>
```

**Important**: All endpoints enforce workspace scoping. Users can only access resources within their workspace.

## Architecture

### Database Schema

#### FastAPI Service
- `sample_items` — Sample data for testing
- `briefings` — Briefing records with relationships
- `briefing_key_points` — Key points per briefing
- `briefing_risks` — Risk assessments
- `briefing_metrics` — Evaluation metrics (with unique name constraint per briefing)

#### NestJS Service
- `sample_workspaces` — Workspace isolation
- `sample_candidates` — Candidates within workspaces
- `candidate_documents` — Uploaded documents
- `candidate_summaries` — LLM-generated summaries with status tracking (pending/completed/failed)

### Data Flow

```
1. Create Candidate (auto-creates workspace if needed)
   ↓
2. Upload Documents (multiple per candidate)
   ↓
3. Request Summary Generation
   ↓
4. [Async] QueueWorkerService polls every 2 seconds
   ↓
5. LLM Provider (Gemini or Fake) generates summary
   ↓
6. Summary status transitions: pending → completed/failed
   ↓
7. Poll GET endpoint to retrieve completed summary with scores
```

### Access Control

- **Workspace Scoping**: Every query filters by `user.workspaceId`
- **Document Access**: Users can only see documents for candidates in their workspace
- **Summary Access**: Direct workspace checks prevent cross-workspace access
- **Guard Enforcement**: `FakeAuthGuard` validates headers on all protected routes

## Testing

### Unit Tests
```bash
# FastAPI
cd python-service && pytest

# NestJS
cd ts-service && npm test
```

### Integration Tests (e2e)
```bash
# NestJS full workflow
cd ts-service && npm run test:e2e
```

Tests include:
- CRUD operations with validation
- Workspace-scoped access control
- Access denial scenarios
- Full document → summary workflow
- Background worker processing
- Gemini provider mock handling with error scenarios

## Environment Variables

### FastAPI (.env)
```
DATABASE_URL=postgresql://assessment_user:assessment_pass@localhost:5432/assessment_db
```

### NestJS (.env)
```
DATABASE_URL=postgresql://assessment_user:assessment_pass@localhost:5432/assessment_db
GEMINI_API_KEY=<optional-for-real-provider>
```

If `GEMINI_API_KEY` is not set, the fake provider is used automatically.

## Project Structure

```
alpha-backend-tasks/
├── python-service/              # FastAPI service
│   ├── app/
│   │   ├── api/                # Route handlers
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic validation
│   │   ├── services/           # Business logic & formatting
│   │   ├── templates/          # Jinja2 HTML templates
│   │   └── config.py, main.py
│   ├── db/migrations/          # SQL migration files
│   ├── tests/                  # pytest test suite
│   └── requirements.txt
│
├── ts-service/                 # NestJS service
│   ├── src/
│   │   ├── documents/          # Document intake controllers & services
│   │   ├── entities/           # TypeORM models
│   │   ├── llm/                # Summarization providers (Gemini + Fake)
│   │   ├── queue/              # Job queue & async worker
│   │   ├── auth/               # Authentication guards
│   │   ├── sample/             # Sample candidate service
│   │   ├── health/             # Health check endpoint
│   │   └── migrations/         # TypeORM migrations
│   ├── test/                   # Jest e2e test suite
│   └── package.json
│
├── docker-compose.yml          # PostgreSQL service
├── README.md                   # This file
├── NOTES.md                    # Design decisions & improvements
└── POSTMAN_COLLECTION.json     # API testing
```

## Troubleshooting

### Database Connection Errors
- Verify PostgreSQL is running: `docker ps | grep postgres`
- Check connection string matches your environment
- Run migrations: `npm run migration:run` (NestJS) or `python -m app.db.run_migrations` (FastAPI)

### Async Summary Not Completing
- Check NestJS server logs for `QueueWorker started` message
- Verify documents exist for the candidate: `GET /candidates/{id}/documents`
- Worker processes every 2 seconds — wait 3-5 seconds and poll the GET endpoint

### Port Conflicts
- FastAPI: Change port in uvicorn command if 8000 is taken
- NestJS: Ensure 3000 is free or update `src/main.ts`

## Development Workflow

1. **Create a feature branch** from `Feat/isaac-assessment-solution`
2. **Make changes** to services following existing patterns
3. **Run tests** to verify functionality
4. **Commit with meaningful messages** (e.g., `feat: add new endpoint`)
5. **Push and create PR** for review

## Implementation Summary

This assessment demonstrates:
- ✅ Two-service microservice architecture
- ✅ Database schema design with migrations
- ✅ ORM best practices (SQLAlchemy, TypeORM)
- ✅ RESTful API design with proper status codes
- ✅ Asynchronous job processing with worker pattern
- ✅ Workspace-scoped access control
- ✅ Provider abstraction (Gemini + Fake)
- ✅ Comprehensive testing (unit, integration, e2e)
- ✅ Error handling and validation
- ✅ Clean architecture and separation of concerns

For detailed design decisions and potential improvements, see [NOTES.md](NOTES.md).