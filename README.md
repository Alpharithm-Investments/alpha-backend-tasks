
## NOTES.md

```markdown
# Engineering Notes

## Key Technical Decisions

### 1. Database Design Choices

**Briefing Points Single Table Inheritance**
- Chose to store key_points and risks in single table with `point_type` enum rather than separate tables
- **Rationale**: Identical schema, simplifies queries, easy to add new point types
- **Trade-off**: Slightly less type safety at DB level, but ORM enforces constraints

**Candidate Summary Status Enum**
- Used PostgreSQL native enum for status
- **Rationale**: Data integrity, self-documenting, efficient storage
- **Trade-off**: Harder to add new statuses without migration

### 2. Validation Strategy

**Python Service:**
- Pydantic handles structural validation
- Custom validators for business rules (min items, uniqueness)
- Normalization (ticker uppercase) happens at boundary

**TypeScript Service:**
- class-validator DTOs for API input
- Business validation in service layer (workspace checks)
- LLM output validation with Zod-like runtime checks

### 3. Async Architecture

**Queue Abstraction:**
- Created simple queue interface that can be backed by Bull, SQS, or in-memory
- **Rationale**: Assessment constraints, but production-ready pattern
- Worker registered as NestJS provider with lifecycle management

**Status Tracking:**
- Explicit state machine: pending → completed/failed
- Error messages persisted for debugging
- No retry logic implemented (would add with BullMQ)

### 4. Security Considerations

**HTML Escaping:**
- Jinja2 auto-escaping enabled
- Explicit `|e` filter used in templates
- No user input rendered as raw HTML

**Workspace Isolation:**
- Every service method verifies workspace ownership
- Database queries always include workspace_id filter
- No global candidate listing endpoint (would add pagination/filtering)

### 5. LLM Provider Design

**Interface Segregation:**
- Simple interface: input documents → structured output
- Provider handles prompt engineering internally
- Parser validates and transforms raw LLM output

**Error Handling:**
- Network errors bubble up to worker
- Parse errors indicate model misalignment
- Graceful degradation to fake provider

### 6. Testing Strategy

**Unit Tests:**
- Repository mocked in service tests
- Provider mocked in controller tests
- FastAPI TestClient for integration

**Test Data:**
- Factories would be added with more time (faker.js, factory-boy)
- Currently using inline fixtures

## Known Limitations

1. **No File Upload Handling**: TypeScript service accepts text content directly. Real implementation would use Multer for multipart/form-data with file streaming to S3.

2. **In-Memory Queue**: Current queue implementation is in-memory and loses jobs on restart. Production would use Redis-backed BullMQ.

3. **No Pagination**: List endpoints return all records. Would add cursor-based pagination for large datasets.

4. **LLM Token Limits**: No chunking strategy for long documents. Would implement text splitting for resumes > 10k tokens.

5. **No Caching**: Briefing HTML regenerated on every request. Would cache with Redis keyed by briefing ID + updated_at timestamp.

## Performance Considerations

- **N+1 Queries**: Used `selectin` loading in SQLAlchemy to eager load relationships
- **Database Indexes**: Added on foreign keys and frequently queried fields
- **LLM Timeouts**: No timeout implemented on Gemini calls (would add 30s limit)

## Code Organization

Followed existing starter patterns:
- Python: Feature-based organization (api/, services/, models/, schemas/)
- TypeScript: NestJS module pattern with entities/, dto/, processors/


## Setup Instructions

### Step 1: Start Infrastructure

From the repository root, start PostgreSQL:

```bash
docker compose up -d postgres


### Step 2: Python Service Setup (Briefing Reports)

# Navigate to service directory
cd python-service

# Create virtual environment
python3.12 -m venv .venv

# Activate virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment configuration
cp .env.example .env
# Edit .env if needed (defaults work with docker compose above)


### Step 3: Python Service Setup (Briefing Reports)

# Navigate to service directory
cd ts-service

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

cd python-service
source .venv/bin/activate

# Apply all pending migrations (UP)
python -m app.db.run_migrations up

# Check status (shows applied vs pending)
python -m app.db.run_migrations status

# Rollback last migration (DOWN)
python -m app.db.run_migrations down --steps 1

# Rollback specific number
python -m app.db.run_migrations down --steps 3


cd ts-service

# Generate new migration (if you modify entities)
npm run migration:generate -- src/migrations/MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show

```
### Terminal 1 - Python Service:

cd python-service
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000

### Terminal 2 - TypeScript Service:
cd ts-service
npm run start:dev

### Run Test

## Python Test
cd python-service
source .venv/bin/activate

# Run all tests
python -m pytest

# Run with coverage report
python -m pytest --cov=app --cov-report=html

# Run specific test file
python -m pytest tests/test_briefings.py

# Run with verbose output
python -m pytest -v

# Run only unit tests (exclude integration)
python -m pytest -m unit

## Typescript Test
cd ts-service

# Unit tests (Jest)
npm test

# Unit tests with coverage
npm run test:cov

# Unit tests in watch mode
npm run test:watch

# End-to-end tests (requires DB running)
npm run test:e2e

# E2E tests in debug mode
npm run test:e2e -- --debug

# Linting
npm run lint
