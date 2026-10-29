-- Manual Google indexing requests for layoff pages (CRM > WARN > Layoff publishing). Additive.
CREATE TABLE "LayoffIndexRequest" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT,
    CONSTRAINT "LayoffIndexRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LayoffIndexRequest_path_key" ON "LayoffIndexRequest"("path");
