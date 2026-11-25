CREATE TABLE "study_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"option_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_bookmarks" (
	"profile_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_bookmarks_profile_id_question_id_unique" UNIQUE("profile_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "question_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"page" integer NOT NULL,
	"content" jsonb NOT NULL,
	"original" jsonb NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edited_at" timestamp with time zone,
	CONSTRAINT "question_drafts_import_id_number_unique" UNIQUE("import_id","number")
);
--> statement-breakpoint
CREATE TABLE "paper_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"paper_name" text NOT NULL,
	"key_name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'Waiting for worker' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"claim_token" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid,
	"import_id" uuid,
	"slug" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"source" text NOT NULL,
	"difficulty" text NOT NULL,
	"number" integer NOT NULL,
	"content" jsonb NOT NULL,
	"search_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "published_questions_draft_id_unique" UNIQUE("draft_id"),
	CONSTRAINT "published_questions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "study_attempts" ADD CONSTRAINT "study_attempts_question_id_published_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."published_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_bookmarks" ADD CONSTRAINT "study_bookmarks_question_id_published_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."published_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_drafts" ADD CONSTRAINT "question_drafts_import_id_paper_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."paper_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_questions" ADD CONSTRAINT "published_questions_draft_id_question_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."question_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_questions" ADD CONSTRAINT "published_questions_import_id_paper_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."paper_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_profile_idx" ON "study_attempts" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "import_queue_idx" ON "paper_imports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "published_subject_idx" ON "published_questions" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "published_search_idx" ON "published_questions" USING gin (to_tsvector('english', "search_text"));