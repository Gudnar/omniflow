#!/bin/bash

echo "=========================================="
echo "OmniFlow Setup Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Starting Docker containers...${NC}"
docker-compose up -d

echo -e "${BLUE}Waiting for services to be ready...${NC}"
sleep 10

echo ""
echo -e "${BLUE}2. Installing dependencies...${NC}"
pnpm install

echo ""
echo -e "${BLUE}3. Running Prisma migrations...${NC}"
pnpm db:migrate

echo ""
echo -e "${BLUE}4. Building the project...${NC}"
pnpm build

echo ""
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo -e "Terminal 1 - ${GREEN}Frontend (Next.js)${NC}:"
echo "  cd apps/web && pnpm dev"
echo "  Open: http://localhost:3000/login"
echo ""
echo -e "Terminal 2 - ${GREEN}Backend API (NestJS)${NC}:"
echo "  cd apps/api && pnpm dev"
echo "  API runs on: http://localhost:3001"
echo ""
echo -e "Terminal 3 - ${GREEN}Worker${NC}:"
echo "  cd apps/worker && pnpm dev"
echo ""
echo -e "${BLUE}To stop containers:${NC}"
echo "  docker-compose down"
echo ""
echo -e "${BLUE}To view database:${NC}"
echo "  pnpm db:studio"
echo ""
