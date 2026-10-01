import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContactsController, NotesController, ActivitiesController],
  providers: [ContactsService, NotesService, ActivitiesService],
  exports: [ContactsService, NotesService],
})
export class ContactsModule {}
