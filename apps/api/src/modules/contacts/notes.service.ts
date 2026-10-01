import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '@omniflow/utils';
import { ContactsService } from './contacts.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  constructor(
    private prisma: PrismaService,
    private contactsService: ContactsService,
  ) {}

  async list(contactId: string) {
    await this.contactsService.findOne(contactId);
    return this.prisma.client.note.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(contactId: string, authorId: string, dto: CreateNoteDto) {
    await this.contactsService.findOne(contactId);
    return this.prisma.client.note.create({
      data: { contactId, authorId, body: dto.body },
    });
  }

  async update(contactId: string, noteId: string, dto: UpdateNoteDto) {
    const note = await this.prisma.client.note.findFirst({ where: { id: noteId, contactId } });
    if (!note) throw new NotFoundError('Note');
    return this.prisma.client.note.update({ where: { id: noteId }, data: { body: dto.body } });
  }

  async remove(contactId: string, noteId: string) {
    const note = await this.prisma.client.note.findFirst({ where: { id: noteId, contactId } });
    if (!note) throw new NotFoundError('Note');
    await this.prisma.client.note.delete({ where: { id: noteId } });
    return { success: true };
  }
}
