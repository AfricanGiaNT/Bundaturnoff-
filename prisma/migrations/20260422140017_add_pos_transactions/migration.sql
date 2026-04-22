-- CreateTable
CREATE TABLE "pos_transactions" (
    "id" SERIAL NOT NULL,
    "card_number" TEXT NOT NULL,
    "card_last4" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "datetime_local" TIMESTAMP(3) NOT NULL,
    "datetime_gmt" TIMESTAMP(3) NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "switch_key" TEXT NOT NULL,
    "account_no" TEXT,
    "sheet_month" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_transactions_switch_key_key" ON "pos_transactions"("switch_key");

-- CreateIndex
CREATE INDEX "pos_transactions_card_last4_idx" ON "pos_transactions"("card_last4");

-- CreateIndex
CREATE INDEX "pos_transactions_card_number_idx" ON "pos_transactions"("card_number");
