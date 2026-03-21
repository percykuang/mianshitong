ALTER TABLE "QuestionBankItem" DROP COLUMN "rubric";

ALTER TABLE "QuestionBankItem" ALTER COLUMN "prompt" DROP NOT NULL;

UPDATE "QuestionBankItem" SET "tags" = '[]'::jsonb WHERE "tags" IS NULL;

ALTER TABLE "QuestionBankItem" ALTER COLUMN "tags" SET DEFAULT '[]'::jsonb;
ALTER TABLE "QuestionBankItem" ALTER COLUMN "tags" SET NOT NULL;
ALTER TABLE "QuestionBankItem" ALTER COLUMN "keyPoints" SET DEFAULT '[]'::jsonb;
ALTER TABLE "QuestionBankItem" ALTER COLUMN "followUps" SET DEFAULT '[]'::jsonb;
