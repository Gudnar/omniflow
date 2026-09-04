import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserById(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async listUsersByTenant(tenantId: string) {
    const users = await this.prisma.client.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        status: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });

    return users;
  }
}
