import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { ConfirmationImagesService } from './confirmation-images.service';

@Module({
  imports: [StorageModule, ConversationsModule],
  providers: [ConfirmationImagesService],
  exports: [ConfirmationImagesService],
})
export class ConfirmationImagesModule {}
