-- CreateTable
CREATE TABLE "staff_registry" (
    "id" SERIAL NOT NULL,
    "attendant_id" TEXT NOT NULL,
    "attendant_name" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_sales" (
    "id" SERIAL NOT NULL,
    "week_start" DATE NOT NULL,
    "week_end" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "attendant_id" TEXT NOT NULL,
    "fuel_sales_litres" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lub_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_registry_attendant_id_key" ON "staff_registry"("attendant_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_sales_week_start_attendant_id_key" ON "weekly_sales"("week_start", "attendant_id");

-- AddForeignKey
ALTER TABLE "weekly_sales" ADD CONSTRAINT "weekly_sales_attendant_id_fkey" FOREIGN KEY ("attendant_id") REFERENCES "staff_registry"("attendant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
