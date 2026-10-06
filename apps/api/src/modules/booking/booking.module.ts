import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfirmationImagesModule } from '../confirmation-images/confirmation-images.module';
import { BookingServicesController } from './booking-services.controller';
import { BookingServicesService } from './booking-services.service';
import { BookingResourcesController } from './booking-resources.controller';
import { BookingResourcesService } from './booking-resources.service';
import { UserSchedulesController } from './user-schedules.controller';
import { UserSchedulesService } from './user-schedules.service';
import { AppointmentsController, BookingAvailabilityController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { BookingBlackoutDatesController } from './booking-blackout-dates.controller';
import { BookingBlackoutDatesService } from './booking-blackout-dates.service';

@Module({
  imports: [PrismaModule, ConfirmationImagesModule],
  controllers: [
    BookingServicesController,
    BookingResourcesController,
    UserSchedulesController,
    AppointmentsController,
    BookingAvailabilityController,
    BookingBlackoutDatesController,
  ],
  providers: [
    BookingServicesService,
    BookingResourcesService,
    UserSchedulesService,
    AppointmentsService,
    BookingBlackoutDatesService,
  ],
  exports: [AppointmentsService, BookingServicesService],
})
export class BookingModule {}
