-- AlterTable
ALTER TABLE "employee_kpis" ADD COLUMN     "bonus_earned" DOUBLE PRECISION,
ADD COLUMN     "evidence_notes" JSONB,
ADD COLUMN     "kpi_schedule_signed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overall_score" DOUBLE PRECISION,
ADD COLUMN     "rating_band" TEXT,
ADD COLUMN     "signed_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "contract_end_date" TIMESTAMP(3),
ADD COLUMN     "contract_status" TEXT,
ADD COLUMN     "entity" TEXT;

-- AlterTable
ALTER TABLE "work_items" ADD COLUMN     "entity" TEXT NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "escalation_note" TEXT;

-- CreateTable
CREATE TABLE "pip_records" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "trigger_reason" TEXT NOT NULL,
    "issued_date" TIMESTAMP(3) NOT NULL,
    "review_date" TIMESTAMP(3) NOT NULL,
    "improvement_targets" TEXT NOT NULL,
    "current_progress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "outcome" TEXT,
    "closed_date" TIMESTAMP(3),
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pip_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pip_records_user_id_idx" ON "pip_records"("user_id");

-- AddForeignKey
ALTER TABLE "pip_records" ADD CONSTRAINT "pip_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pip_records" ADD CONSTRAINT "pip_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: rename legacy role strings to new hierarchy
UPDATE "users" SET "role" = 'OPERATIONS_DIRECTOR' WHERE "role" = 'Manager';
UPDATE "users" SET "role" = 'ACCOUNTANT'          WHERE "role" = 'Accountant';
UPDATE "users" SET "role" = 'WAREHOUSE'            WHERE "role" = 'StorageClerk';
