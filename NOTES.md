# Design Decisions & Architectural Notes

This document outlines the key decisions made during the implementation and potential improvements for future iterations.

## Schema Design Decisions

### FastAPI Service

**Briefing Model Structure**

- **One-to-Many Relationships**: Briefings → KeyPoints, Risks, Metrics with cascade delete
- **Rationale**: Enables rich, structured briefing data. Cascade delete ensures data integrity when a briefing is removed.
- **Alternative**: Could use JSON columns for nested data, but relationships provide better query flexibility and type safety.

**Metric Name Uniqueness**

- **Constraint**: Unique constraint on (briefing_id, name) pair
- **Rationale**: Prevents duplicate metrics within a briefing while allowing same metric names across different briefings.

**Manual SQL Migrations**

- **Approach**: Pure SQL files with up/down support
- **Rationale**: Matches existing project pattern. Provides explicit control over schema changes and educational value.
- **Tradeoff**: Requires manual synchronization between schema and SQLAlchemy models.

### NestJS Service

**Workspace Scoping Pattern**

- **Design**: Every table has workspaceId foreign key. All queries filter by user.workspaceId.
- **Rationale**: Enables true multi-tenancy. Users can only access their workspace's data at the database level.
- **Alternative**: Could use row-level security (RLS) in Postgres, but application-level filtering is more portable.

**Status Enums**

- **Implementation**: Stored as VARCHAR in DB, type-safe enums in TypeScript
- **Rationale**: Provides database-agnostic solution (works with SQLite for tests, Postgres in production)
- **Alternative**: Could use Postgres ENUM type, but loses test flexibility.

**Summary Timestamps**

- **createdAt**: Auto-generated on insert
- **completedAt**: Nullable, set by worker when status changes to completed/failed
- **Rationale**: Tracks both creation and completion time for audit trail and performance analysis.

## Architectural Decisions

### Async Job Processing

**In-Memory Queue with Polling Worker**

- **Design**: Simple in-memory array with 2-second polling interval
- **Rationale**:
  - No external dependencies (Redis, RabbitMQ)
  - Sufficient for assessment scope
  - Easy to test and debug
  - Demonstrates understanding of async patterns

**Implementation Details**:

```
User → API → createPendingSummary() → enqueue(job) → return immediately
       ↓
    Worker loop (every 2s) → processPendingJobs() → LLM Provider → update DB → remove from queue
```

**Limitations & Future Improvements**:

- Queue lost on server restart (no persistence)
- No retry logic for failed jobs
- Single-threaded (no concurrency)
- No dead-letter queue

**Production Alternative**:

- Bull Queue (Redis-backed, NestJS native)
- RabbitMQ with proper acknowledgment
- AWS SQS/Lambda for serverless

### LLM Provider Abstraction

**Strategy Pattern Implementation**

```typescript
interface SummarizationProvider {
  generateCandidateSummary(input): Promise<CandidateSummaryResult>;
}

// Two implementations:
- FakeSummarizationProvider → Deterministic mock for testing
- GeminiSummarizationProvider → Real Gemini API with error handling
```

**Provider Selection**

- Uses environment variable: `GEMINI_API_KEY`
- If not set → uses FakeSummarizationProvider automatically
- Eliminates need for test/prod configuration complexity

**Error Handling**

- Gracefully degrades malformed responses
- Validates score (0-100), arrays, strings
- Returns safe defaults on API failures
- Prevents one bad LLM response from breaking the system

**Future Improvements**:

- Add OpenAI provider option
- Implement caching for repeated candidate evaluations
- Add rate limiting and retry logic
- Structured prompt versions for reproducibility

### Access Control

**Workspace-Scoped Multi-Tenancy**

```typescript
// Every service method pattern:
async someMethod(user: AuthUser, ...) {
  const resource = await repo.findOne({
    where: { id, workspaceId: user.workspaceId }
  });
  if (!resource) throw "Access denied";
}
```

**Advantages**:

- Prevents cross-workspace data leakage at database layer
- Simple to implement and understand
- Works with all ORM patterns
- Consistent across all endpoints

**Current Limitations**:

- Header-based auth (x-user-id, x-workspace-id) is fake
- No actual user authentication or authorization
- No role-based access control (RBAC)

**Production Upgrades**:

- JWT-based authentication with RS256
- OAuth2/OpenID Connect integration
- Role-based access control (admin, recruiter, viewer)
- Audit logging for all data access
- Row-level security (Postgres RLS) as additional layer

## Testing Strategy

### Unit Tests

- **Scope**: Service layer, business logic
- **Coverage**:
  - CRUD operations
  - Validation and error handling
  - Workspace access control
  - Provider error scenarios
- **Approach**: Mocked repositories, no database

### Integration Tests (e2e)

- **Scope**: Full workflow from API → Database → Worker
- **Coverage**:
  - Document upload → Summary generation → Completion
  - Async job processing
  - Status transitions
- **Database**: SQLite in-memory (fast, isolated)

### Manual API Testing with Postman

**Postman Collection** (`POSTMAN_COLLECTION.json`):

The project includes a comprehensive Postman collection with organized test groups:

- **FastAPI Service - Health & Sample**: Health check, sample item CRUD
- **FastAPI Service - Briefings**: Briefing creation, retrieval, report generation (JSON + HTML)
- **NestJS Service - Health**: Service health status
- **NestJS Service - Candidates & Sample**: Candidate creation and management
- **NestJS Service - Documents**: Document upload and retrieval
- **NestJS Service - Summaries (Async)**: Summary generation, status polling, completion tracking
- **NestJS Service - Access Control Tests**: Workspace boundary verification, cross-workspace denial
- **Full Workflow - Happy Path**: End-to-end workflow (5 steps) from candidate creation to summary completion

**How to Use**:

1. Import `POSTMAN_COLLECTION.json` into Postman
2. Ensure both services are running (`npm run start:dev` for NestJS, `uvicorn` for FastAPI)
3. Use the organized request groups to test endpoints
4. For async endpoints, follow the "Full Workflow - Happy Path" folder which demonstrates proper polling

**Key Testing Scenarios**:
- Create candidate → Upload documents → Request summary → Poll for completion
- Access control: Verify users cannot access other workspaces' data
- Workspace isolation: Different workspace IDs should block access

### What's Missing

- **API Contract Tests**: Verify request/response schemas
- **Load Testing**: Concurrent document uploads and summaries
- **Chaos Testing**: Simulate database failures, LLM timeouts
- **Performance Testing**: P99 latency for document upload
- **Security Testing**: SQL injection, XSS (if UI added), auth bypass

## Database Design Considerations

### Eager Loading Strategy

```typescript
// FastAPI:
selectinload(Briefing.keyPoints).selectinload(BriefingKeyPoint.risk_metrics);

// NestJS:
relations: ["candidate", "candidate.workspace"];
```

**Rationale**: Prevents N+1 queries. Single round-trip to fetch complete aggregates.

**Alternative**: Lazy loading + pagination (useful for large datasets).

### Indexing

**Current**: Only implicit indexes from primary/foreign keys

**Recommended Additions**:

```sql
-- NestJS
CREATE INDEX idx_candidates_workspace_id ON sample_candidates(workspace_id);
CREATE INDEX idx_documents_candidate_id ON candidate_documents(candidate_id);
CREATE INDEX idx_summaries_status ON candidate_summaries(status);
CREATE INDEX idx_summaries_candidate_id ON candidate_summaries(candidate_id);

-- FastAPI
CREATE INDEX idx_briefing_metrics_name ON briefing_metrics(briefing_id, name);
```

### Column Type Compatibility

**Issue**: TypeORM's `timestamptz` doesn't work with SQLite in tests

**Solution**: Removed explicit type annotations, allowing TypeORM to pick database-appropriate types

**Lesson**: When targeting multiple databases, avoid database-specific types in decorators.

## Code Organization Patterns

### FastAPI Service

**Service Layer Pattern**:

```python
class BriefingService:
    def create_briefing(self, session, dto) -> Briefing:
        # Validate, transform, persist
        # Return ORM object for further processing

    def get_briefing(self, session, id) -> Briefing:
        # Query with eager loading
```

**Formatter Layer**:

```python
class ReportFormatter:
    def briefing_to_view_model(self, briefing) -> dict:
        # Sort, transform, clean
        # Return DTO for JSON serialization

    def render_briefing(self, view_model) -> str:
        # Jinja2 template rendering
```

**Separation of Concerns**:

- Service: Data operations
- Formatter: Presentation logic
- Routes: Request handling
- Schemas: Validation

### NestJS Service

**Module Organization**:

```
DocumentsModule
├── DocumentsController
├── DocumentsService
├── DTOs
└── Tests

QueueModule
├── QueueService (in-memory storage)
├── QueueWorkerService (background processing)
└── Tests

LlmModule
├── SummarizationProvider (interface)
├── FakeSummarizationProvider
├── GeminiSummarizationProvider
└── Tests
```

**Dependency Injection**:

- All services injected via constructor
- Easy to mock for testing
- Clear dependency graph

## Improvements With More Time

### Short Term (1-2 days)

1. **API Documentation**
   - OpenAPI/Swagger specs for both services
   - Request/response examples
   - Error code documentation

2. **Rate Limiting & Throttling**
   - Prevent abuse of LLM API calls
   - Fair queuing for document processing

3. **Logging & Observability**
   - Structured logging (JSON format)
   - Request tracing across services
   - Prometheus metrics for alerts

4. **Database Transactions**
   - Atomic operations for summary updates
   - Retry logic with exponential backoff

5. **Input Sanitization**
   - HTML escaping for document text
   - SQL injection prevention (already handled by ORM)
   - File upload validation

### Medium Term (3-5 days)

1. **Real Authentication**
   - JWT tokens with RS256
   - User/role database table
   - Permission matrix enforcement

2. **Persistent Job Queue**
   - Redis-backed queue (Bull)
   - Automatic retries with backoff
   - Dead-letter queue for inspection

3. **Caching Layer**
   - Redis cache for frequently accessed summaries
   - Invalidation strategy
   - Cache-aside pattern for documents

4. **Advanced Async**
   - Batch processing for multiple candidates
   - Webhook callbacks when summaries complete
   - WebSocket real-time status updates

5. **Database Optimization**
   - Query analysis and index tuning
   - Connection pooling configuration
   - Partitioning for large tables

### Long Term (1-2 weeks)

1. **Microservices**
   - API Gateway (Kong/AWS API Gateway)
   - Service-to-service authentication
   - Circuit breakers for resilience

2. **Document Processing**
   - PDF/Word file upload handling
   - OCR for scanned documents
   - Chunking for large documents

3. **Multiple LLM Providers**
   - Provider registry
   - Cost optimization (cheaper models for simple tasks)
   - Fallback chain (Gemini → GPT-4 → Local model)

4. **Admin Console**
   - Workspace management
   - User onboarding workflow
   - Summary quality metrics dashboard

5. **Analytics & Reporting**
   - Candidate pipeline analytics
   - LLM accuracy metrics
   - Cost analysis per operation

## Production Readiness Checklist

- [ ] Error handling for all external API calls
- [ ] Comprehensive logging with correlation IDs
- [ ] Database backup and recovery procedures
- [ ] Load testing results and capacity planning
- [ ] Security audit and penetration testing
- [ ] API rate limiting and DDoS protection
- [ ] CORS configuration for frontend
- [ ] Health check endpoints for Kubernetes
- [ ] Graceful shutdown handling
- [ ] Environment-specific configurations
- [ ] Secret management (no hardcoded keys)
- [ ] Database migrations versioning
- [ ] Monitoring and alerting setup
- [ ] Disaster recovery plan

## Conclusion

This implementation demonstrates solid backend engineering fundamentals:

- Clean separation of concerns
- Type-safe code across both services
- Comprehensive testing coverage
- Scalable architecture patterns
- Security considerations (workspace scoping)
- Error handling and validation

The modular design allows each component to evolve independently, making it straightforward to add features, upgrade dependencies, or change implementations without affecting the overall system.
