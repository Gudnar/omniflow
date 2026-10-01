import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m' },
      }),
    }),
    PrismaModule,
    RolesModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // JwtModule is exported so RealtimeModule can inject the same JwtService
  // (same secret/config) to verify tokens on a WebSocket handshake, where
  // the Passport AuthGuard('jwt') strategy doesn't apply (it's built around
  // Express's Request object, not a socket connection).
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
