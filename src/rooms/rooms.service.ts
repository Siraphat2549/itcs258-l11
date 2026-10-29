import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger('RoomsService');

  constructor(private readonly prisma: PrismaService) {}
  
  async create(createRoomDto: CreateRoomDto) {
    this.logger.log(`Creating room: ${createRoomDto.name}`);

    try {
      const room = await this.prisma.rooms.create({
        data: createRoomDto,
      });
      return room;
    } catch (error) {
        const err = error as Error;
        this.logger.error(`Failed to create room: ${err.message}`, err.stack);
      throw error;
    }
  }

  async findAll(limit = 20, offset = 0, isActive?: boolean) {
    this.logger.log(`Fetching rooms limit=${limit} offset=${offset} is_active=${isActive ?? 'any'}`);

    if (limit < 1 || limit > 100) {
      throw new BadRequestException('limit must be between 1 and 100');
    }
    if (offset < 0) {
      throw new BadRequestException('offset must be 0 or greater');
    }

    const where = isActive === undefined ? {} : { is_active: isActive };
    const [items, total] = await Promise.all([
      this.prisma.rooms.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { id: 'asc' },
      }),
      this.prisma.rooms.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async findOne(id: number) {
    this.logger.log(`Fetching room id=${id}`);

    const room = await this.prisma.rooms.findUnique({
      where: { id },
    });
    
    if (!room) {
      this.logger.warn(`Room ${id} not found`);
      throw new NotFoundException(`Room ${id} not found`);}
      return room;
  }

  async update(id: number, updateRoomDto: UpdateRoomDto) {
    this.logger.log(`Updating room with id ${id}`);
    await this.findOne(id);

    return this.prisma.rooms.update({
      where: { id },
      data: updateRoomDto,
    });
  }

  async remove(id: number) {
     this.logger.log(`Deleting room id=${id}`);
     // Throws 404 for a missing room instead of letting Prisma's delete fail with a 500
     await this.findOne(id);

     return this.prisma.rooms.delete({
       where: { id },
     });
   }

  async disable(id: number) {
    this.logger.log(`Disabling room id=${id}`);

    try {
      await this.findOne(id);

      return await this.prisma.rooms.update({
        where: { id },
        data: { is_active: false },
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to disable room ${id}: ${err.message}`, err.stack);
      throw error;
    }
  }

  async enable(id: number) {
    this.logger.log(`Enabling room id=${id}`);

    try {
      await this.findOne(id);

      return await this.prisma.rooms.update({
        where: { id },
        data: { is_active: true },
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to enable room ${id}: ${err.message}`, err.stack);
      throw error;
    }
  }
  async getPopular() {
    this.logger.log('Fetching popular rooms');
    return this.prisma.rooms.findMany({ take: 10 });
}
}
