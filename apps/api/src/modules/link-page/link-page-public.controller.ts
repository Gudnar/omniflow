import { Controller, Get, Post, Param, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { safeDownloadFilename } from '@omniflow/utils';
import { Public } from '../auth/decorators';
import { LinkPageService } from './link-page.service';

// Public, unauthenticated "link in bio" page — freely shareable, no session
// token unlike /storefront (there's no cart/checkout state to protect here).
// @Public() bypasses the global JwtAuthGuard; LinkPageService resolves the
// tenant from the slug alone, same pattern as StorefrontController.
@Controller('link-page/public')
@Public()
export class LinkPagePublicController {
  constructor(private linkPageService: LinkPageService) {}

  @Get(':slug')
  @HttpCode(200)
  get(@Param('slug') slug: string) {
    return this.linkPageService.getPublicBySlug(slug);
  }

  @Post(':slug/items/:itemId/click')
  @HttpCode(204)
  async click(@Param('slug') slug: string, @Param('itemId') itemId: string) {
    await this.linkPageService.registerClick(slug, itemId);
  }

  // Navigating a plain <a href> here is enough to trigger a real browser
  // download regardless of cross-origin — res.download() sets
  // Content-Disposition: attachment, which (unlike the HTML `download`
  // attribute) isn't subject to the same-origin restriction browsers apply
  // to that attribute.
  @Get(':slug/items/:itemId/download')
  async download(@Param('slug') slug: string, @Param('itemId') itemId: string, @Res() res: Response) {
    const { filePath, label } = await this.linkPageService.resolveDownload(slug, itemId);
    const extension = filePath.slice(filePath.lastIndexOf('.'));
    res.download(filePath, safeDownloadFilename(label, extension));
  }
}
