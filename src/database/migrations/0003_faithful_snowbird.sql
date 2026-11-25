CREATE TABLE "editorial_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"question_number" integer,
	"type" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"manifest" jsonb NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correct_points" integer NOT NULL,
	"wrong_points" integer NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_versions" (
	"question_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"content" jsonb NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"difficulty" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_versions_question_id_revision_pk" PRIMARY KEY("question_id","revision")
);
--> statement-breakpoint
ALTER TABLE "study_attempts" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "study_attempts" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "question_drafts" ADD COLUMN "generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "question_drafts" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "question_drafts" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "question_drafts" ADD COLUMN "difficulty" text;--> statement-breakpoint
ALTER TABLE "question_drafts" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "published_questions" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "published_questions" ADD COLUMN "draft_generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "published_questions" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "published_questions" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "editorial_events" ADD CONSTRAINT "editorial_events_import_id_paper_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."paper_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_question_id_published_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."published_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "editorial_import_date_idx" ON "editorial_events" USING btree ("import_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_practice_per_profile" ON "practice_sessions" USING btree ("profile_id") WHERE "practice_sessions"."submitted_at" is null;--> statement-breakpoint
CREATE INDEX "practice_profile_date_idx" ON "practice_sessions" USING btree ("profile_id","created_at");--> statement-breakpoint
ALTER TABLE "study_attempts" ADD CONSTRAINT "study_attempts_session_id_practice_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_attempts" ADD CONSTRAINT "study_attempts_session_id_question_id_unique" UNIQUE("session_id","question_id");
--> statement-breakpoint
INSERT INTO "question_versions" ("question_id", "revision", "content", "subject", "topic", "difficulty", "tags", "created_at")
SELECT "id", "revision", "content", "subject", "topic", "difficulty", "tags", "created_at" FROM "published_questions";
--> statement-breakpoint
UPDATE "question_drafts" d SET "generation" = 2 FROM "published_questions" q
WHERE q."draft_id" = d."id" AND q."content" IS DISTINCT FROM d."content";
