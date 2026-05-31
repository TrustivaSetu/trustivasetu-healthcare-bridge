-- CreateTable
CREATE TABLE "TabSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TabSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TabSession_token_key" ON "TabSession"("token");
CREATE INDEX "TabSession_userId_idx" ON "TabSession"("userId");
CREATE INDEX "TabSession_expiresAt_idx" ON "TabSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "TabSession" ADD CONSTRAINT "TabSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
