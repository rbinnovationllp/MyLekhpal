import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';

export const businesses = sqliteTable(
  'businesses',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull().default(''),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    tradeName: text('trade_name').notNull(),
    entityType: text('entity_type').notNull().default(''),
    pan: text('pan').notNull(),
    gstin: text('gstin').notNull(),
    year: integer('year').notNull(),
    state: text('state').notNull(),
    address: text('address').notNull(),
    status: text('status').notNull().default('Onboarding draft'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('business_owner').on(t.owner),
    index('business_client_id').on(t.clientId),
  ],
);
export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('membership_business_user_role').on(
      t.businessId,
      t.userId,
      t.role,
    ),
    index('membership_user_status').on(t.userId, t.status),
  ],
);
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
  },
  (t) => [uniqueIndex('account_business_code').on(t.businessId, t.code)],
);
export const entries = sqliteTable(
  'entries',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    date: text('date').notNull(),
    narration: text('narration').notNull(),
    reference: text('reference').notNull(),
    lines: text('lines').notNull(),
    total: integer('total').notNull(),
    status: text('status').notNull().default('Draft'),
    source: text('source').notNull().default('Manual'),
    actor: text('actor').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('entry_business_date').on(t.businessId, t.date),
    uniqueIndex('entry_business_reference').on(t.businessId, t.reference),
  ],
);
export const audit = sqliteTable(
  'audit',
  {
    id: text('id').primaryKey(),
    businessId: text('business_id')
      .notNull()
      .references(() => businesses.id),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    recordId: text('record_id').notNull(),
    detail: text('detail').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('audit_business').on(t.businessId, t.createdAt)],
);
