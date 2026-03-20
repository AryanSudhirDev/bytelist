# ByteList Build Plan (Java-First, Phased)

## 1) Product Goal

Build ByteList as a hyperlocal, item-level food recommendation platform for students near Mission San Jose High School.

Primary user outcome:
- Users can quickly answer: **"What should I order?"** at a nearby restaurant.

Core product principles from the source brief:
- Focus on **dish/order-level** data, not only restaurant-level ratings.
- Keep the scope **hyperlocal** (local + fast food range first).
- Add social proof through rankings, likes, badges, streaks, and leaderboards.
- Validate demand via survey data and usage analytics.

---

## 2) Execution Strategy (Important)

- Build in controlled phases with strict scope gates.
- Prioritize correctness, data quality, and low complexity over flashy UI.
- Keep frontend simple: server-rendered HTML + light CSS, minimal JS.
- Avoid overbuilding features before core data loop is stable.

---

## 3) Recommended Tech Stack

## Backend (Primary)
- Java 21
- Spring Boot 3.x
- Spring MVC
- Spring Data JPA + Hibernate
- PostgreSQL
- Flyway for schema migrations
- Bean Validation (Jakarta Validation)
- Spring Security (email/password or OAuth later)

## Frontend (Lightweight)
- Thymeleaf templates (server-side rendering)
- Plain HTML + small custom CSS file
- Optional tiny vanilla JS only for basic interactions (search/filter)

## Dev/Infra
- Gradle or Maven (pick one, default Gradle)
- Docker (Postgres + app for local reproducibility)
- JUnit 5 + MockMvc for backend tests
- GitHub Actions CI (build + test)

---

## 4) Functional Scope Breakdown

## Must-Have (MVP Core)
- User accounts
- Restaurant directory (local area only)
- Dish/order posting:
  - restaurant
  - dish name
  - optional customization text
  - rating
  - short reason/review
  - optional dietary tags
- Dish ranking by restaurant
- "Top Orders Overall" page
- Search by restaurant + dish
- Basic profile view (orders, average rating, recent activity)

## Should-Have (Phase 2)
- Like/upvote on posted orders
- Leaderboards (most contributions, most liked orders)
- Badges (first post, 7-day streak, etc.)
- Streak tracking
- Personalized feed/ranking (simple weighted formula)
- Secret menu tagging

## Nice-to-Have (Phase 3)
- "Order Wrapped" style recap
- Survey dashboard integration
- Admin moderation tools
- Social links/marketing pages

---

## 5) High-Level Architecture

Use a modular monolith:

- `web` layer: controllers + Thymeleaf views
- `service` layer: ranking logic, badges, streak processing
- `data` layer: JPA entities, repositories
- `domain` package grouping:
  - users
  - restaurants
  - orders
  - rankings
  - gamification (badges, streaks, leaderboards)
  - survey (optional early)

Rationale:
- Fastest path to stable product with Java-first ownership.
- Easy to split later if scale requires.

---

## 6) Data Model (Initial)

Core tables/entities:

- `users`
  - id, name, email, password_hash, created_at
- `restaurants`
  - id, name, category (fast_food/coffee/etc), distance_bucket, is_active
- `dishes`
  - id, restaurant_id, canonical_name
- `orders`
  - id, user_id, restaurant_id, dish_id (nullable if new dish), custom_name
  - customization_text
  - rating (1-5)
  - review_reason (short text)
  - created_at
- `order_tags`
  - id, order_id, tag (vegan, halal, gluten_free, high_protein, etc)
- `order_likes`
  - id, order_id, user_id, created_at
- `badges`
  - id, code, title, description
- `user_badges`
  - id, user_id, badge_id, earned_at
- `user_streaks`
  - user_id, current_streak, longest_streak, last_active_date

Derived views/materialized queries:
- top orders by restaurant
- top orders overall
- trending orders (recent window)

---

## 7) Ranking Logic (Simple First, Then Iterate)

Initial rank score (Phase 1):
- weighted_score = (avg_rating * 0.7) + (log10(1 + like_count) * 0.3)
- minimum vote/order threshold to reduce noise

Personalized rank (Phase 2):
- base score +
- affinity boost from user dietary tags +
- similarity boost from user past likes/ratings

Keep formulas configurable in one service class for quick tuning.

---

## 8) Phased Implementation Plan

## Phase 0 - Setup and Definition (1-2 days)
Deliverables:
- Initialize Spring Boot project
- Configure DB, Flyway, base layout templates, CSS baseline
- Define coding standards and package structure
- Seed script for initial restaurant list (local target)

Acceptance:
- App boots, DB migrates, `/health` works, base page renders

---

## Phase 1 - Core Data Loop MVP (4-6 days)
Goal:
- Users can post and discover dish-level recommendations.

Build:
- Auth (basic local login/signup)
- Restaurant list + detail page
- Add order flow (dish + rating + reason + customization + tags)
- Top orders overall page
- Search (restaurant/dish)
- Basic profile page

Acceptance:
- End-to-end manual test from signup -> post order -> appears in rankings
- No blocking validation/security issues

---

## Phase 2 - Social and Gamification (4-5 days)
Goal:
- Increase retention and social proof.

Build:
- Likes/upvotes
- Leaderboards
- Badges and streak engine (daily activity)
- Secret menu marker
- "Most liked by restaurant" blocks

Acceptance:
- Like counts affect leaderboard and ranking refresh
- Badges awarded deterministically from activity events

---

## Phase 3 - Personalization + Insights (4-6 days)
Goal:
- Make recommendations more relevant and engaging.

Build:
- Personalized ranking logic
- Dietary restriction filtering UX
- "Order Wrapped" prototype (periodic recap page)
- Survey results ingestion endpoint + simple analytics view

Acceptance:
- Personalized results differ from global list for test users
- Filtering by dietary tags works correctly

---

## Phase 4 - Reliability, Moderation, and Launch (3-4 days)
Goal:
- Prepare for real student usage.

Build:
- Admin tools (flag/review/remove order)
- Rate limiting + anti-spam controls
- Error handling hardening
- Logging + basic analytics events
- Production deployment checklist

Acceptance:
- No P0/P1 defects in smoke tests
- Monitoring and rollback steps documented

---

## 9) UI/UX Guidelines (Keep It Basic)

- Single-column, clean layout
- Neutral color palette, minimal components
- Prioritize readability and speed:
  - clear restaurant names
  - prominent "Top orders"
  - simple forms with strong validation messages
- No heavy animations or complex frontend frameworks

Core pages:
- Home (trending + top orders)
- Restaurants list
- Restaurant detail with ranked dishes
- Add order form
- Leaderboard
- Profile

---

## 10) Non-Functional Requirements

- Performance:
  - target <300ms for common read endpoints (excluding cold starts)
- Security:
  - hashed passwords
  - CSRF enabled for form posts
  - input validation + output escaping
- Data quality:
  - dedupe strategy for near-identical dish names
- Reliability:
  - DB backups, migration discipline, predictable seeds

---

## 11) Testing Plan by Phase

- Unit tests:
  - ranking formulas
  - badge/streak rules
- Integration tests:
  - create order, like order, leaderboard queries
- Web tests:
  - key form validation and controller routes via MockMvc
- Manual smoke:
  - signup/login, post order, search, filter, like

Minimum gate before each phase completion:
- all tests green in CI
- no critical lints
- migration scripts reversible or safe-forward

---

## 12) Survey and Validation Plan

Use two lightweight external forms:
- order collection form (if needed for early bootstrap)
- problem-validation survey (multi-select pain points)

Track:
- "know where to eat, not what to order"
- "too many customization options"
- "don't know what's popular"
- "friends suggest places but not dishes"
- "menu too large/overwhelming"

Use findings to prioritize personalization and filtering work.

---

## 13) Suggested Timeline (Conservative)

- Week 1: Phase 0 + most of Phase 1
- Week 2: finish Phase 1 + Phase 2
- Week 3: Phase 3
- Week 4: Phase 4 + polish + launch readiness

If team bandwidth is low, defer:
- wrapped feature
- advanced personalization
- external marketing integrations

---

## 14) Risks and Mitigations

- Risk: low initial data density
  - Mitigation: seed known dishes, run targeted survey, encourage first 50 entries
- Risk: noisy/inconsistent dish names
  - Mitigation: canonical dish mapping + merge tools
- Risk: spam/low-quality submissions
  - Mitigation: rate limits, report flow, moderation queue
- Risk: overcomplex UI slowing delivery
  - Mitigation: stick to server-rendered HTML/CSS and strict scope gates

---

## 15) Definition of Done (Project)

Project is considered complete when:
- Users can reliably discover best dish recommendations by restaurant
- Core social proof (likes + leaderboard + badges) is functioning
- Basic personalization and dietary filtering are usable
- Application is deployable with monitoring, moderation, and test coverage

---

## 16) Immediate Next Step

After plan approval:
1. Scaffold Spring Boot app + package structure.
2. Add DB schema migrations for core entities.
3. Implement Phase 1 routes/views first (no Phase 2+ work until Phase 1 passes acceptance).
