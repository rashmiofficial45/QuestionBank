CREATE TABLE "study_drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"manifest" jsonb NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_revision_queue" (
	"profile_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_revision_queue_profile_id_question_id_pk" PRIMARY KEY("profile_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "study_revision_queue" ADD CONSTRAINT "study_revision_queue_question_id_published_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."published_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "study_drills_profile_date_idx" ON "study_drills" USING btree ("profile_id","created_at");