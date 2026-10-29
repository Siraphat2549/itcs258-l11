import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  Inject,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorator.ts/roles.decorator';
import { Role } from '@prisma/client';
import {
  ROOM_EXAMPLE,
  ROOM_SCHEMA,
  ROOM_LIST_SCHEMA,
  PAGINATED_ROOMS_SCHEMA,
  VALIDATION_ERROR_SCHEMA,
  UNAUTHORIZED_SCHEMA,
  FORBIDDEN_SCHEMA,
  NOT_FOUND_SCHEMA,
  TOO_MANY_REQUESTS_SCHEMA,
  errorSchema,
} from './rooms.swagger';

const ROOM_ID_PARAM = {
  name: 'id',
  type: Number,
  description: 'Numeric ID of the room',
  example: 1,
};

const TOO_MANY_REQUESTS_RESPONSE = {
  status: 429,
  description: 'Too many requests (rate limit exceeded)',
  schema: TOO_MANY_REQUESTS_SCHEMA,
};

const INVALID_ID_SCHEMA = errorSchema(
  400,
  'Bad Request',
  'Validation failed (numeric string is expected)',
);

// CacheInterceptor only caches GET requests; the key is the request URL (e.g. /rooms, /rooms/1)
@ApiTags('rooms')
@UseInterceptors(CacheInterceptor)
// All room endpoints: 10 requests per minute per client (overrides the global 30/min)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly roomsService: RoomsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // Drop all cached room responses so reads don't serve stale data for up to 5 minutes after a write.
  // A full clear is needed because list URLs carry query strings (/rooms?limit=5&offset=10, ...)
  private async clearRoomCache() {
    await this.cacheManager.clear();
  }

  // Prisma throws P2025 when the record to update/delete no longer exists (e.g. removed between the
  // service's existence check and the write); map it to a 404 instead of letting it surface as a 500
  private rethrowNotFound(error: unknown, id: number): never {
    if ((error as { code?: string })?.code === 'P2025') {
      throw new NotFoundException(`Room ${id} not found`);
    }
    throw error;
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular rooms', description: 'Returns up to 10 featured rooms. Public endpoint.' })
  @ApiResponse({ status: 200, description: 'List of popular rooms', schema: ROOM_LIST_SCHEMA })
  @ApiResponse(TOO_MANY_REQUESTS_RESPONSE)
  async getPopular() {
    return this.roomsService.getPopular();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a room', description: 'Creates a new room. Requires the ADMIN role.' })
  @ApiResponse({ status: 201, description: 'Room created', schema: ROOM_SCHEMA })
  @ApiResponse({ status: 400, description: 'Request body failed validation', schema: VALIDATION_ERROR_SCHEMA })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired token', schema: UNAUTHORIZED_SCHEMA })
  @ApiResponse({ status: 403, description: 'Authenticated user is not an ADMIN', schema: FORBIDDEN_SCHEMA })
  @ApiResponse(TOO_MANY_REQUESTS_RESPONSE)
  async create(@Body() createRoomDto: CreateRoomDto) {
    const room = await this.roomsService.create(createRoomDto);
    await this.clearRoomCache();
    return room;
  }

  @Get()
  @ApiOperation({
    summary: 'List rooms',
    description: 'Returns a paginated list of rooms, optionally filtered by active status. Public endpoint.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of rooms to return (1-100, default 20)', example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of rooms to skip (default 0)', example: 0 })
  @ApiQuery({
    name: 'is_active',
    required: false,
    type: Boolean,
    description: 'Only return rooms that are active (true) or disabled (false). Omit to return all rooms',
    example: true,
  })
  @ApiResponse({ status: 200, description: 'Paginated list of rooms', schema: PAGINATED_ROOMS_SCHEMA })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameter',
    schema: errorSchema(400, 'Bad Request', 'limit must be between 1 and 100'),
  })
  @ApiResponse(TOO_MANY_REQUESTS_RESPONSE)
  findAll(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('is_active', new ParseBoolPipe({ optional: true })) isActive?: boolean,
  ) {
    return this.roomsService.findAll(limit, offset, isActive);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a room by ID', description: 'Requires a valid JWT (any role).' })
  @ApiParam(ROOM_ID_PARAM)
  @ApiResponse({ status: 200, description: 'The room', schema: ROOM_SCHEMA })
  @ApiResponse({ status: 400, description: 'id is not a number', schema: INVALID_ID_SCHEMA })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired token', schema: UNAUTHORIZED_SCHEMA })
  @ApiResponse({ status: 404, description: 'Room not found', schema: NOT_FOUND_SCHEMA })
  @ApiResponse(TOO_MANY_REQUESTS_RESPONSE)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const room = await this.roomsService.findOne(id);
    if (!room) {
      throw new NotFoundException(`Room ${id} not found`);
    }
    return room;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a room', description: 'Updates a room (only the fields sent are changed). Requires the ADMIN role.' })
  @ApiParam(ROOM_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Updated room',
    schema: { ...ROOM_SCHEMA, example: { ...ROOM_EXAMPLE, price_per_night: '2800.00' } },
  })
  @ApiResponse({ status: 400, description: 'Invalid id or request body', schema: VALIDATION_ERROR_SCHEMA })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired token', schema: UNAUTHORIZED_SCHEMA })
  @ApiResponse({ status: 403, description: 'Authenticated user is not an ADMIN', schema: FORBIDDEN_SCHEMA })
  @ApiResponse({ status: 404, description: 'Room not found', schema: NOT_FOUND_SCHEMA })
  @ApiResponse(TOO_MANY_REQUESTS_RESPONSE)
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateRoomDto: UpdateRoomDto) {
    const room = await this.roomsService
      .update(id, updateRoomDto)
      .catch((error) => this.rethrowNotFound(error, id));
    await this.clearRoomCache();
    return room;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a room', description: 'Permanently deletes a room. Requires the ADMIN role.' })
  @ApiParam(ROOM_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Room deleted',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Room 1 deleted successfully' },
        room: ROOM_SCHEMA,
      },
      example: { message: 'Room 1 deleted successfully', room: ROOM_EXAMPLE },
    },
  })
  @ApiResponse({ status: 400, description: 'id is not a number', schema: INVALID_ID_SCHEMA })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired token', schema: UNAUTHORIZED_SCHEMA })
  @ApiResponse({ status: 403, description: 'Authenticated user is not an ADMIN', schema: FORBIDDEN_SCHEMA })
  @ApiResponse({ status: 404, description: 'Room not found', schema: NOT_FOUND_SCHEMA })
  @ApiResponse(TOO_MANY_REQUESTS_RESPONSE)
  async remove(@Param('id', ParseIntPipe) id: number) {
    const room = await this.roomsService
      .remove(id)
      .catch((error) => this.rethrowNotFound(error, id));
    await this.clearRoomCache();
    return { message: `Room ${id} deleted successfully`, room };
  }

  @Patch(':id/disable')
  @ApiOperation({ summary: 'Disable a room', description: 'Sets is_active to false so the room cannot be booked.' })
  @ApiParam(ROOM_ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Room disabled',
    schema: { ...ROOM_SCHEMA, example: { ...ROOM_EXAMPLE, is_active: false } },
  })
  @ApiResponse({ status: 400, description: 'id is not a number', schema: INVALID_ID_SCHEMA })
  @ApiResponse({ status: 404, description: 'Room not found', schema: NOT_FOUND_SCHEMA })
  @ApiResponse(TOO_MANY_REQUESTS_RESPONSE)
  async disable(@Param('id', ParseIntPipe) id: number) {
    const room = await this.roomsService.disable(id);
    await this.clearRoomCache();
    return room;
  }

  @Patch(':id/enable')
  @ApiOperation({ summary: 'Enable a room', description: 'Sets is_active to true so the room can be booked again.' })
  @ApiParam(ROOM_ID_PARAM)
  @ApiResponse({ status: 200, description: 'Room enabled', schema: ROOM_SCHEMA })
  @ApiResponse({ status: 400, description: 'id is not a number', schema: INVALID_ID_SCHEMA })
  @ApiResponse({ status: 404, description: 'Room not found', schema: NOT_FOUND_SCHEMA })
  @ApiResponse(TOO_MANY_REQUESTS_RESPONSE)
  async enable(@Param('id', ParseIntPipe) id: number) {
    const room = await this.roomsService.enable(id);
    await this.clearRoomCache();
    return room;
  }
}
