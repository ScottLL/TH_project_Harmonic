# 🎯 Todo List for “Select All / Batch Add via Cursor” Feature

## Project Goal

- Build a robust and type-safe full‑stack implementation that enables users to **select** individual or **Select All** companies from one list (e.g., `MyList`) and **batch-add** them to another list (e.g., `LikedCompanies`), using a **cursor‑based pagination** approach to deliver a smooth UX even with slow database operations.

---

## 1. Project Setup & Initialization

- [ ] Fork or clone the repository and `git init` if needed (if not already).
- [ ] Ensure the existing backend (`backend/`) and frontend (`frontend/`) directories are intact.
- [ ] Add feature branches (`select-all-cursor`) to track work.
- [ ] Add necessary environment variables to `.env` files, including:
  - Cursor pagination config: e.g. `PAGE_SIZE=100` or throttle simulation flags.
- [ ] Install / update dependencies:
  - Backend may require `fastapi-pagination`, `pydantic`.
  - Frontend may require UI library enhancements or state-management tool (e.g., React Query, Zustand).
- [ ] Setup linting and formatting tools if not present (e.g. `prettier`, `flake8`, `black`).

---

## 2. Backend Development

### 2.1 Design & Schema

- [ ] Review current database schema (`companies`, `lists`, `list_items` join table).
- [ ] Design **cursor-based pagination** parameters (e.g. `cursor`, `limit`, `reverseCursor`) for listing company IDs.
- [ ] Implement **batch-add job** model:
  - Track each job’s status (`IN_PROGRESS`, `COMPLETED`, `FAILED`, with timestamps).
  - Store job metadata: `id`, `source_list`, `target_list`, `total_count`, `processed_count`.

### 2.2 API Endpoints

- [ ] Create endpoint to fetch a page of companies with a cursor:
  - `GET /lists/{listId}/companies?cursor=&limit=`
  - Returns `{ items: Company[], nextCursor: string | null }`.
- [ ] Create endpoint to **add selected companies**:
  - `POST /lists/{targetList}/batch-add`
  - Accepts `company_ids: string[]`, `source_list_id, target_list_id`.
  - Returns a job ID.
- [ ] Create endpoint to **check job status**:
  - `GET /batch-add/{jobId}/status`
  - Returns status and progress `processed_count / total_count`.
- [ ] API validations:
  - Ensure no duplicates.
  - Handle simultaneous requests (idempotency).
- [ ] Slow-process simulation:
  - Sleep / yield per batch push (e.g. `time.sleep` or `sleep(100ms)` per 100 records, as throttle).
  - Batch writes (e.g. `batch_insert` every `PAGE_SIZE` ids) to avoid timeouts.

### 2.3 Business Logic

- [ ] Backend should queue jobs in a background task (e.g. FastAPI background tasks, Celery, APIRQ, etc.).
- [ ] Ensure database transactions safeguard data integrity: if a batch fails, mark job as failed and rollback that batch.
- [ ] Use cursor to continue batch-add across pages until complete.
- [ ] Handle cancellation if user aborts job request.

---

## 3. Frontend Development

### 3.1 UI Components

- [ ] **List View Component** (`MyList`, `LikedCompanies`) shows paginated company list, fetches next cursor page.
- [ ] **Checkboxes for each row** for selecting companies.
- [ ] **“Select All” toggle**:
  - Either selects **only the current page**, or:
  - Offers “Select All 50,000” option—shows a modal/alert summarizing cost/time.
- [ ] **Progress Modal / Snackbar**:
  - When a batch-add job is triggered, shows an "In Progress" UI:
    - Displays progress percentage (e.g. “125 / 50,000 companies added”).
    - Accepts cancel command (if implemented).
- [ ] **Completion UI**:
  - Once job status is COMPLETED, show message: “Successfully added N companies,” with link to open target list.
  - Button to close / reset selection.

### 3.2 State Management

- [ ] Use React Query or SWR to manage:
  - Paginated fetches.
  - Job polling (`GET /batch-add/{jobId}/status`) every few seconds.
- [ ] Maintain selection state:
  - Individual item selections.
  - “global select all” across all pages: manage a "fetchedAllIds" set or use server-supplied list of all IDs for select‑all context.
- [ ] Reset UI selection after job completes.

### 3.3 Error Handling & UX

- [ ] Show error UI if API fails:
  - Retry button for failed jobs.
- [ ] Disable “Add Selected / Add All” buttons when a job is in-progress.
- [ ] Show spinner or skeleton loader while fetching company pages.

---

## 4. Database & Infrastructure

- [ ] Setup **Postgres** indexes on relevant columns:
  - `list_items (list_id, company_id)` unique constraint/index.
- [ ] If needed, configure a **message queue** or background task runner (Celery, Redis, etc.) to facilitate cursor job processing.
- [ ] Ensure batch size is configurable via environment or config file.
- [ ] If caching is used (e.g. Redis), allow storing job progress/count in Redis to reduce DB hits.

---

## 5. Integration & Testing

### 5.1 Backend Unit / Integration Tests

- [ ] Write tests for:
  - Cursor-based listing endpoint pagination correctness with various cursor values.
  - `batch-add` endpoint handling:
    - Small batch (e.g. 5 ids).
    - Full list (simulated large).
    - Duplicate adds.
- [ ] Test job status polling transitions (IN_PROGRESS → COMPLETED → FAILED).
- [ ] Simulate cancellation mid‑job.

### 5.2 Frontend Tests

- [ ] Write unit tests for:
  - Selection logic: individual vs. global select all.
  - Button state transitions (disabled, loading).
- [ ] Write end‑to‑end tests (using Cypress or Playwright) for:
  - User selects a few companies and adds them.
  - User selects all companies (with simulated slower page fetching).
  - User sees progress, completes, and views updated list.

### 5.3 Manual Testing

- [ ] Use staging environment (local) with:
  - Small lists (~10 items).
  - Large lists (~50k items), throttle turned on to simulate slow backend.
- [ ] Verify:
  - “Select All” for current page vs. full list behavior.
  - Job progress accuracy and responsiveness.
  - Backend resilience when paused or cancelled.

---

## 6. Deployment & CI/CD

- [ ] Ensure Dockerfiles (if provided) are updated to include any new dependencies.
- [ ] Add CI test runners:
  - Backend tests (`pytest`, `FastAPI`).
  - Frontend tests (`jest`, `react-testing-library`, or E2E test framework).
- [ ] Ensure GitHub Actions scripts:
  - Linting / formatting checks.
  - Test suite runs on PRs to `main` and merge actions.
  - Deployment to staging or preview environment on commit to feature branch.

---

## 7. Performance Optimization & Security

- [ ] On the backend:
  - Use **batched inserts** (e.g. `COPY`, or `INSERT … ON CONFLICT DO NOTHING`) to reduce write calls.
  - Use cursor pagination with proper ORDER BY + indexed column (e.g. created_at or id).
- [ ] On the frontend:
  - Debounce or sample job polling (e.g. backoff when tailing progress).
- [ ] Security checks:
  - Verify user authorization for both source and target lists.
  - Rate-limit the batch-add endpoint to prevent abuse (in addition to DB throttling).
  - Sanitization of inputs (`company_id` array length, types).
- [ ] Monitor timeout or long-polling behavior: adjust cursor page size to minimize wall-clock lag.

---

## 8. Documentation & Maintenance

- [ ] Update **README.md** in root, `backend/`, `frontend/` covering:
  - New API endpoints and expected request/response payloads.
  - Feature workflow description.
  - Pagination scheme and cursor usage.
- [ ] Write inline comments and docstrings for:
  - Cursor logic.
  - Batch job lifecycle.
- [ ] Add tech notes for future maintainers:
  - How to adjust batch size / throttle settings.
  - How to observe running jobs.
  - Rollback strategy if batch-add partially fails.
- [ ] Plan for maintenance:
  - Scheduled cleanup of old batch-add job records.
  - Visibility into stuck or orphaned jobs.
- [ ] Reflect in pull request: include written reflection/docs of tradeoffs, assumptions, and next steps.
- [ ] Record a short Loom or video (≤ 2 mins) demonstrating:
  - The UI flows for small vs. large adds.
  - The difference in behavior (with/without throttle).
  - Progress reporting.

---

## 🧩 Summary Table

| Deliverable                  | Owner          | Status |
| ---------------------------- | -------------- | ------ |
| Backend cursor endpoints     | Back‑end dev  | ☐     |
| Batch-job progress tracking  | Back‑end dev  | ☐     |
| Frontend selection UI        | Front‑end dev | ☐     |
| Progress & completion modal  | Front‑end dev | ☐     |
| Unit & E2E tests             | QA / Dev       | ☐     |
| CI/CD & Docker configuration | DevOps         | ☐     |
| Documentation updates        | Tech writer    | ☐     |
| Loom demo                    | Candidate      | ☐     |

---

### Next Steps & Zoning Thoughts

- Confirm if “Select All” should apply **across paginated results** or only **current page**, or both (with clear UX distinction).
- Determine whether to implement backend cancellation or client-only abort (i.e. just UI stop polling).
- Plan to support streaming of progress updates via WebSockets or SSE for improved responsiveness.
- Consider feature flag toggling: e.g. `ENABLE_CURSOR_BATCH_ADD = true` for controlled rollout.

---

By following this `todolist.md`, you’ll deliver a well‑structured, high‑quality feature that handles large list operations gracefully, maintains a smooth end‑user experience even under throttled backend load, and uses modern full‑stack best practices.
