CREATE TYPE "public"."inventory_status" AS ENUM('available', 'on_hold', 'sold');--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"manufacturer" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"caliber" text DEFAULT '' NOT NULL,
	"price_cents" integer,
	"status" "inventory_status" DEFAULT 'available' NOT NULL,
	"sku" text,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"image_alt" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_sku_unique" UNIQUE("sku"),
	CONSTRAINT "inventory_price_nonnegative" CHECK ("inventory"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX "inventory_public_idx" ON "inventory" USING btree ("published","category","name");