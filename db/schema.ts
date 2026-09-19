import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  date,
  index,
  check,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { Business } from "../lib/business";
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
export const contentKind = pgEnum("content_kind", [
  "weekly",
  "monthly",
  "event",
  "announcement",
]);
export const content = pgTable(
  "content",
  {
    id: text("id").primaryKey(),
    kind: contentKind("kind").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url").notNull().default(""),
    imageAlt: text("image_alt").notNull().default(""),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    startTime: text("start_time").notNull().default(""),
    endTime: text("end_time").notNull().default(""),
    location: text("location").notNull().default(""),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("content_public_idx").on(t.kind, t.published, t.startsOn, t.endsOn),
    check("content_date_order", sql`${t.endsOn} >= ${t.startsOn}`),
  ],
);
export const inventoryStatus = pgEnum("inventory_status", [
  "available",
  "on_hold",
  "sold",
]);
export const inventory = pgTable(
  "inventory",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    manufacturer: text("manufacturer").notNull().default(""),
    category: text("category").notNull().default(""),
    caliber: text("caliber").notNull().default(""),
    // Whole cents avoid floating-point rounding. Null means "price on request".
    priceCents: integer("price_cents"),
    status: inventoryStatus("status").notNull().default("available"),
    // Null rather than "" so the unique index only constrains real stock numbers.
    sku: text("sku").unique(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    imageAlt: text("image_alt").notNull().default(""),
    published: boolean("published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inventory_public_idx").on(t.published, t.category, t.name),
    check("inventory_price_nonnegative", sql`${t.priceCents} >= 0`),
  ],
);
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    business: jsonb("business").$type<Business>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("settings_singleton", sql`${t.id} = 1`)],
);
