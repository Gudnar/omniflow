import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, RequirePermission } from './decorators';
import { JwtAuthGuard } from './guards';
import { RegisterDto, LoginDto, RefreshTokenDto, MfaVerifyDto, MfaEnrollVerifyDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Public()
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.userId);
    return { message: 'Logged out successfully' };
  }

  @Post('mfa/enroll')
  @UseGuards(JwtAuthGuard)
  async enrollMfa(@Request() req: any) {
    return this.authService.enrollMfa(req.user.userId);
  }

  @Post('mfa/enroll/verify')
  @UseGuards(JwtAuthGuard)
  async verifyMfaEnroll(
    @Request() req: any,
    @Body() dto: MfaEnrollVerifyDto,
  ) {
    await this.authService.verifyMfaEnroll(req.user.userId, dto.code);
    return { message: 'MFA enabled successfully' };
  }

  @Post('mfa/verify')
  @Public()
  async verifyMfa(@Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfaLogin(dto.mfaChallengeToken, dto.code);
  }
}
