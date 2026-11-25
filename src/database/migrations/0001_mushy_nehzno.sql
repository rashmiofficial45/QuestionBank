CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "published_trigram_idx" ON "published_questions" USING gin ("search_text" gin_trgm_ops);
