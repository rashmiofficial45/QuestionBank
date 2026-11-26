CREATE TABLE "study_notes" (
	"profile_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "study_notes_profile_id_question_id_pk" PRIMARY KEY("profile_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "study_notes" ADD CONSTRAINT "study_notes_question_id_published_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."published_questions"("id") ON DELETE no action ON UPDATE no action;