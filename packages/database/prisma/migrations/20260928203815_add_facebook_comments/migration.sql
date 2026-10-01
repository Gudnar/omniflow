-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "message" TEXT,
    "permalink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "externalId" TEXT,
    "parentId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "authorExternalId" TEXT,
    "authorName" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_tenantId_idx" ON "Post"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_tenantId_externalId_key" ON "Post"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_externalId_key" ON "Comment"("externalId");

-- CreateIndex
CREATE INDEX "Comment_tenantId_postId_idx" ON "Comment"("tenantId", "postId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
