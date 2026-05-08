import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConfigModule } from '../config/config.module';
import { FileModule } from '../file/file.module';

@Module({
  imports: [ConfigModule, FileModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
