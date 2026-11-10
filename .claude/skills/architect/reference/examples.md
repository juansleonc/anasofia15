# Architect Skill — Worked Examples

Relocated from `SKILL.md` to keep the live body under the ~400-line ceiling.

All examples below are from a Ruby/Rails + GraphQL + ClickHouse origin project — the patterns
generalize, the tool names don't. Swap in this project's actual ORM, API layer, and observability
oracle (`.claude/skills/shared/stack.md#observability`).
<!-- residue-ok: file -->

---

## Example 1: Push Notifications Feature (Ruby/Rails)

```
/architect push notifications system

## ADR: Push Notifications

### Context
Need to send push notifications to mobile users for reservations,
membership renewals, and promotions.

### Grounding (production data — via this project's observability oracle)
- Users table: 450k records
- Active users (last 30 days): 52k
- Tenants (facilities): 180
- Avg users per tenant: 2,500

### Decision
**Location:** `packs/push_notifications/`
**Pattern:**
  - `PushNotifications::SendService` (Workflow/Interactor) for sending
  - `PushNotifications::TokenManager` for device tokens
  - Background job for bulk sends

**Schema:**
```ruby
create_table :push_notification_tokens do |t|
  t.references :facility, null: false   # tenant key
  t.references :user, null: false
  t.string :device_token, null: false
  t.string :platform, null: false  # ios, android
  t.boolean :active, default: true
  t.timestamps
end
add_index :push_notification_tokens, [:facility_id, :user_id]
add_index :push_notification_tokens, [:device_token], unique: true
```

**API:**
- `registerPushToken` mutation
- `unregisterPushToken` mutation

### Implementation Plan
1. Create module/pack structure
2. Add migration for tokens table
3. Implement TokenManager service
4. Add API mutations
5. Implement SendService with the push-provider integration
6. Add background job for bulk notifications
```

---

## Example 2: Grounding query shapes (Ruby/Rails + ClickHouse)

Illustrative only — replace the warehouse/table names with this project's actual observability
oracle per `stack.md#observability`. If no such oracle exists, skip this and declare the design
ungrounded in the ADR instead of improvising queries against nothing.

```sql
-- 1. Volume
SELECT count(*) AS total_rows FROM warehouse.<related_table>;

-- 2. Distribution by tenant (data-isolation key)
SELECT facility_id, count(*) AS records
FROM warehouse.<table>
GROUP BY facility_id
ORDER BY records DESC
LIMIT 20;

-- 3. Growth rate
SELECT toStartOfMonth(created_at) AS month, count(*) AS new_records
FROM warehouse.<table>
WHERE created_at > now() - INTERVAL 12 MONTH
GROUP BY month
ORDER BY month;

-- 4. Cardinality
SELECT
  count(DISTINCT user_id) AS unique_users,
  count(*) AS total_records,
  round(count(*) / count(DISTINCT user_id), 2) AS avg_per_user
FROM warehouse.<table>;

-- 5. NULL patterns
SELECT
  countIf(<field> IS NULL) AS nulls,
  countIf(<field> IS NOT NULL) AS non_nulls,
  round(countIf(<field> IS NULL) / count(*) * 100, 2) AS null_pct
FROM warehouse.<table>;
```
