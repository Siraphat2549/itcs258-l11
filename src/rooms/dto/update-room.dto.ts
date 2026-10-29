import { PartialType } from '@nestjs/swagger';
import { CreateRoomDto } from './create-room.dto';

// PartialType from @nestjs/swagger (not @nestjs/mapped-types) keeps the @ApiProperty metadata,
// so every field shows up in Swagger as optional with its description and example
export class UpdateRoomDto extends PartialType(CreateRoomDto) {}
