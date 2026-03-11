InsightOps Python Service
=========================

FastAPI service for generating internal analyst briefing reports.


Prerequisites
-------------

Python 3.11 or higher
PostgreSQL installed and running locally
pip


Setup
-----

Install dependencies:

    cd python-service
    pip install -r requirements.txt

Copy the environment file:

    cp .env.example .env

Open .env and update DATABASE_URL to point to your local Postgres instance.
For example:

    DATABASE_URL=postgresql+psycopg://youruser:yourpassword@localhost:5432/assessment_db

Make sure the database exists before running migrations:

    psql -U youruser -c "CREATE DATABASE assessment_db;"


Run Migrations
--------------

    cd python-service
    python -m app.db.run_migrations up

To rollback one step:

    python -m app.db.run_migrations down --steps 1

Migrations are plain SQL files located in db/migrations/.
They are applied in filename order and tracked in a schema_migrations table.


Start the Service
-----------------

    fastapi run app/main.py

The service will be available at http://localhost:8000
Interactive API docs are at http://localhost:8000/docs


API Endpoints
-------------

POST   /briefings
Create a new briefing from structured JSON input.
Validates all fields, normalizes ticker to uppercase,
requires at least 2 key points and 1 risk.

GET    /briefings/{id}
Retrieve the stored structured data for a briefing.

POST   /briefings/{id}/generate
Renders the HTML report from stored data and marks the briefing as generated.
Must be called before fetching HTML.

GET    /briefings/{id}/html
Returns the fully rendered HTML report as text/html.
Returns 409 if generate has not been called yet.


Example Request Body for POST /briefings
-----------------------------------------

{
  "companyName": "Acme Holdings",
  "ticker": "ACME",
  "sector": "Industrial Technology",
  "analystName": "Jane Doe",
  "summary": "Acme is benefiting from strong enterprise demand and improving operating leverage.",
  "recommendation": "Monitor for margin expansion and customer diversification before increasing exposure.",
  "keyPoints": [
    "Revenue grew 18% year-over-year in the latest quarter.",
    "Management raised full-year guidance.",
    "Enterprise subscriptions now account for 62% of recurring revenue."
  ],
  "risks": [
    "Top two customers account for 41% of total revenue.",
    "International expansion may pressure margins over the next two quarters."
  ],
  "metrics": [
    { "name": "Revenue Growth", "value": "18%" },
    { "name": "Operating Margin", "value": "22.4%" },
    { "name": "P/E Ratio", "value": "28.1x" }
  ]
}


Validation Rules
----------------

companyName     required
ticker          required, normalized to uppercase
sector          required
analystName     required
summary         required
recommendation  required
keyPoints       required, minimum 2 entries
risks           required, minimum 1 entry
metrics         optional, but names must be unique within the same briefing


Testing
-------

Tests live in the tests/ folder. They use SQLite in-memory so you do not
need a running Postgres instance or any external services to run them.
Every test gets a fresh isolated database that is torn down after the
test completes.

Install the required test dependencies if not already installed:

    pip install pytest httpx

Run all tests from the python-service directory:

    cd python-service
    pytest tests/ -v

The -v flag gives you a line per test so you can see exactly what passed
or failed. You should see output like this:

    tests/test_briefings.py::test_create_briefing                    PASSED
    tests/test_briefings.py::test_retrieve_briefing                  PASSED
    tests/test_briefings.py::test_retrieve_briefing_not_found        PASSED
    tests/test_briefings.py::test_generate_briefing                  PASSED
    tests/test_briefings.py::test_get_html                           PASSED
    tests/test_briefings.py::test_get_html_before_generate           PASSED
    tests/test_briefings.py::test_validation_requires_two_key_points PASSED
    tests/test_briefings.py::test_validation_requires_one_risk       PASSED
    tests/test_briefings.py::test_validation_duplicate_metric_names  PASSED
    tests/test_briefings.py::test_briefing_without_metrics           PASSED
    tests/test_briefings.py::test_ticker_normalized_to_uppercase     PASSED

To run a single test by name:

    pytest tests/test_briefings.py::test_create_briefing -v

To stop on the first failure:

    pytest tests/ -x


Docker
------

To run the service in Docker you need two things: a Dockerfile for the
service and a docker-compose.yml to wire it up with Postgres.

Create python-service/Dockerfile:

    FROM python:3.11-slim

    WORKDIR /app

    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt

    COPY . .

    EXPOSE 8000

    CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]

Create or update docker-compose.yml at the root of the project:

    version: "3.9"

    services:
      db:
        image: postgres:16
        environment:
          POSTGRES_USER: assessment_user
          POSTGRES_PASSWORD: assessment_pass
          POSTGRES_DB: assessment_db
        ports:
          - "5432:5432"
        volumes:
          - pgdata:/var/lib/postgresql/data

      python-service:
        build:
          context: ./python-service
        ports:
          - "8000:8000"
        environment:
          DATABASE_URL: postgresql+psycopg://assessment_user:assessment_pass@db:5432/assessment_db
        depends_on:
          - db

    volumes:
      pgdata:

Build and start everything:

    docker-compose up --build

Run migrations inside the running container:

    docker-compose exec python-service python -m app.db.run_migrations up

The service will be available at http://localhost:8000

To stop everything:

    docker-compose down

To stop and remove the database volume as well:

    docker-compose down -v

Note that the DATABASE_URL in the docker-compose environment uses db as
the hostname, not localhost. That is the name of the Postgres service
defined in docker-compose.yml and is how the two containers communicate.


Assumptions and Tradeoffs
--------------------------

The rendered HTML is generated once and stored in the briefings table.
This means the GET /html endpoint is a simple database read with no
re-rendering on each request. A regenerate call would overwrite it.

Key points and risks share a single briefing_points table, distinguished
by a point_type column. This avoids two near-identical tables and keeps
the schema clean.

The migration runner is the custom hand-rolled runner provided in the
starter. Migration files are written manually as plain SQL and live in
db/migrations/. They are applied in filename order.

The Jinja2 template uses autoescape on all user-supplied content.
No frontend framework is used. All HTML is rendered server-side.


Recommendations
---------------

Async database sessions for large projects.
The current service uses synchronous SQLAlchemy sessions which is fine
for low to moderate traffic. For a production service handling high
concurrency, switching to async is strongly recommended. FastAPI has
native async support and SQLAlchemy 2.0 supports async sessions out of
the box using asyncpg as the driver. The change involves replacing
Session with AsyncSession, get_db with an async generator, and all
service functions with async def. This allows the event loop to handle
other requests while waiting on database IO instead of blocking a thread,
which makes a significant difference under load.

Add Alembic for migration autogeneration rather than writing SQL by hand.
This becomes important once the schema grows.

Add a GET /briefings endpoint to list all briefings with pagination.

Add soft delete or archive support so briefings are not permanently lost.

Move the rendered HTML out of the database and into object storage such
as S3 if report size grows significantly. Store only a reference key in
the row.

Add request logging and structured error responses for easier debugging
in production.



TalentFlow TypeScript Service
==============================

NestJS service implementing candidate document intake and AI-powered summary generation.

This service includes:

- NestJS bootstrap with global validation
- TypeORM with migration setup
- Fake auth context (x-user-id, x-workspace-id)
- Workspace-scoped candidate document and summary workflow
- In-memory queue with background worker for async summary generation
- LLM provider abstraction that switches automatically between Gemini 2.5 Flash Lite
  when GEMINI_API_KEY is set and a fake provider for local dev and tests
- Jest unit tests


LLM Provider
------------

Provider: Google Gemini 2.5 Flash Lite via the Generative Language REST API.

Configuration: Set GEMINI_API_KEY in your .env file. Obtain a free key from
https://aistudio.google.com/app/apikey

When GEMINI_API_KEY is present the app uses GeminiSummarizationProvider.
When it is absent or in tests FakeSummarizationProvider is used automatically
with no code change required.

Why Gemini 2.5 Flash Lite instead of 1.5 Flash:
Gemini 2.5 Flash Lite is significantly cheaper per token than 1.5 Flash while
still returning structured JSON output reliably. For a use case like candidate
summarization where prompts can be long due to resume text, 1.5 Flash exhausts
free tier credits quickly. 2.5 Flash Lite handles the same task at a fraction
of the cost making it the more practical choice for development and low volume
production use. If you need higher reasoning quality for complex documents
you can swap to gemini-2.5-flash or gemini-2.5-pro by changing the model
constant in src/llm/gemini-summarization.provider.ts.

Assumptions and limitations:
- The Gemini model is asked to return application/json directly. Responses are
  validated against the expected schema before being persisted. Malformed
  responses cause the summary to be marked failed.
- Document text is concatenated and sent in a single prompt. Very large documents
  may exceed the model context window.
- The free tier has rate limits. Concurrent summary jobs may hit quota errors
  which are handled gracefully as failed status with an error message.


Prerequisites
-------------

Node.js 22 or higher
npm
PostgreSQL running locally or via Docker


Setup
-----

    cd ts-service
    npm install
    cp .env.example .env


Environment Variables
---------------------

PORT              No   HTTP port, default 3000
DATABASE_URL      No   Postgres connection string
                       default: postgres://assessment_user:assessment_pass@localhost:5432/assessment_db
NODE_ENV          No   development or production
GEMINI_API_KEY    No   Google Gemini API key. When set real LLM calls are made.
                       When absent the fake provider is used automatically.

Do not commit API keys or secrets to the repository. The .env file is
excluded by .gitignore.


Run Migrations
--------------

    cd ts-service
    npm run migration:run

To revert the last migration:

    npm run migration:revert

To check which migrations have run:

    npm run migration:show


Run Service
-----------

    npm run start:dev

The service will be available at http://localhost:3000
start:dev runs with hot reload so file changes restart the server automatically.

To run without hot reload:

    npm run start


API Endpoints
-------------

All candidate endpoints require fake auth headers on every request:

    x-user-id: user-1
    x-workspace-id: ws-1

Without these headers the FakeAuthGuard rejects the request with 401.


POST   /sample/candidates
Create a candidate. Required before uploading documents.

Body:
{
  "fullName": "Ada Lovelace",
  "email": "ada@example.com"
}


POST   /candidates/:candidateId/documents
Upload a candidate document. The rawText field contains the full text content
of the document. No actual file upload is required.

Body:
{
  "documentType": "resume",
  "fileName": "ada_cv.pdf",
  "rawText": "Ada Lovelace is a senior engineer with 8 years experience..."
}

documentType must be one of: resume, cover_letter, other


POST   /candidates/:candidateId/summaries/generate
Queue async summary generation. Returns 202 Accepted immediately.
The worker picks up the job in the background and updates the summary
status to completed or failed.

No body required.


GET    /candidates/:candidateId/summaries
List all summaries for a candidate ordered by most recent first.

No body required.


GET    /candidates/:candidateId/summaries/:summaryId
Get a single summary. Check the status field:
  pending    job is queued or being processed
  completed  summary is ready with score, strengths, concerns, and decision
  failed     something went wrong, check errorMessage field

No body required.


GET    /sample/candidates
List all candidates in the current workspace.

No body required.


Run Tests
---------

Unit tests use mocked repositories and do not require a running database
or a real Gemini API key. The fake provider is used automatically.

    cd ts-service
    npm test

To run with coverage:

    npm test -- --coverage

To run e2e tests (requires a running database):

    npm run test:e2e


Fake Auth Headers
-----------------

All endpoints are protected by a fake local auth guard that reads two headers:

x-user-id       any non-empty string identifying the user
x-workspace-id  workspace identifier used to scope all data access

A recruiter can only access candidates belonging to their own workspace.
Attempting to access a candidate from a different workspace returns 403.


Layout Highlights
-----------------

src/auth/           fake auth guard, user decorator, auth types
src/candidates/     document upload, summary request, worker, DTOs, service, controller
src/entities/       TypeORM entities for workspace, candidate, document, summary
src/llm/            provider interface, fake provider, Gemini provider
src/queue/          in-memory queue with markProcessed support
src/migrations/     TypeORM migration files
src/config/         TypeORM options and data source config
src/sample/         starter example module


Recommendations
---------------

Replace the in-memory queue with BullMQ backed by Redis for production.
The current QueueService is an in-process array that works well for
development and testing but does not survive restarts and cannot scale
across multiple instances. BullMQ with Redis gives you persistent jobs,
retries, dead letter queues, and a dashboard out of the box. The worker
interface in this service is already abstracted so the swap would be
contained to the queue module and worker.

Use async/await throughout and avoid blocking the event loop.
NestJS runs on Node.js which is single-threaded. Any synchronous CPU-bound
work blocks all requests. All database calls, HTTP calls to Gemini, and
file operations should always use async await. This is already the case
in this service but worth enforcing as the codebase grows.

Add pagination to list endpoints.
GET /candidates/:id/summaries returns all records. As the number of
summaries grows this becomes a performance problem. Adding limit and
offset or cursor-based pagination keeps response times predictable.

Add Swagger documentation.
NestJS has first-class Swagger support via @nestjs/swagger. Adding
decorators to the DTOs and controllers generates interactive API docs
at /api similar to FastAPI. This makes the service much easier for
reviewers and teammates to explore without needing Postman.

Add a GET /candidates/:id/documents endpoint.
Currently there is no way to list uploaded documents for a candidate.
This is a natural endpoint to add for completeness.

Rate limit the summary generation endpoint.
Each call to POST /summaries/generate triggers a Gemini API call which
costs tokens. Without rate limiting a single user could exhaust quota
quickly. Adding a simple per-candidate or per-workspace cooldown prevents
accidental or malicious over-use.

Chunk large documents before sending to the LLM.
Currently all document text is concatenated into one prompt. For long
resumes or cover letters this can exceed the model context window or
produce lower quality summaries. Splitting documents into chunks and
summarizing each before combining gives more reliable results.

Store documents in object storage for production.
Currently rawText is stored directly in the database and storageKey is
a local path string. For production files should be uploaded to S3 or
equivalent, text extracted server-side, and only the storage key kept
in the database row.