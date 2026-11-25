ALTER TABLE "study_attempts" ALTER COLUMN "option_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "study_attempts" ADD COLUMN "option_ids" text[];