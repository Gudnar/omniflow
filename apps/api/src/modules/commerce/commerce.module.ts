import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactsModule } from '../contacts/contacts.module';
import { BookingModule } from '../booking/booking.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { ConfirmationImagesModule } from '../confirmation-images/confirmation-images.module';
import { DeliveryZonesModule } from '../delivery/delivery-zones.module';
import { DeliveryProviderConfigModule } from '../delivery/delivery-provider-config.module';
import { QueueModule } from '../queue/queue.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { CommerceSessionsController } from './commerce-sessions.controller';
import { CommerceSessionsService } from './commerce-sessions.service';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ContactCommerceController } from './contact-commerce.controller';
import { ContactCommerceService } from './contact-commerce.service';

@Module({
  imports: [
    PrismaModule,
    ContactsModule,
    BookingModule,
    ConversationsModule,
    ConfirmationImagesModule,
    DeliveryZonesModule,
    DeliveryProviderConfigModule,
    QueueModule,
  ],
  controllers: [
    AddressesController,
    CommerceSessionsController,
    CartsController,
    OrdersController,
    ContactCommerceController,
  ],
  providers: [
    AddressesService,
    CommerceSessionsService,
    CartsService,
    OrdersService,
    ContactCommerceService,
  ],
  exports: [OrdersService, CommerceSessionsService, CartsService, AddressesService, ContactCommerceService],
})
export class CommerceModule {}
