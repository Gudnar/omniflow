import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { RequirePermission } from '../auth/decorators';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Controller('contacts/:contactId/notes')
export class NotesController {
  constructor(private notesService: NotesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.read')
  @HttpCode(200)
  list(@Param('contactId') contactId: string) {
    return this.notesService.list(contactId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  create(@Param('contactId') contactId: string, @Request() req: any, @Body() dto: CreateNoteDto) {
    return this.notesService.create(contactId, req.user.userId, dto);
  }

  @Patch(':noteId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  update(
    @Param('contactId') contactId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(contactId, noteId, dto);
  }

  @Delete(':noteId')
  @UseGuards(JwtAuthGuard)
  @RequirePermission('contacts.manage')
  @HttpCode(200)
  remove(@Param('contactId') contactId: string, @Param('noteId') noteId: string) {
    return this.notesService.remove(contactId, noteId);
  }
}
