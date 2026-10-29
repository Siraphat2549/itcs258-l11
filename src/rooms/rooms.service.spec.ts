/*
AI Declaration:
I used Claude Code as a coding assistant for this lab. It wrote the Room service unit tests,
the controller integration tests and the Room API E2E tests, following the lecture's Terms examples.

Reflection:
Mocking PrismaService showed me that a unit test checks only the service's own logic, such as throwing
NotFoundException before calling update or delete, without needing a database.
Using AI made the lab faster, but I had to read each mock to understand what each test really proves.
*/

import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

// Mock PrismaService so the tests never touch a real database.
// Only the prisma.rooms methods the service calls are defined, each as a jest.fn()
// whose return value is set per test.
const mockPrismaService = {
  rooms: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const ROOM = {
  id: 1,
  name: 'Deluxe Ocean View',
  description: 'Spacious room with a king-size bed, balcony and sea view.',
  capacity: 2,
  price_per_night: '2500.00',
  image_url: null,
  is_active: true,
  created_at: new Date('2026-10-28T08:00:00.000Z'),
  updated_at: new Date('2026-10-28T08:00:00.000Z'),
};

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: typeof mockPrismaService;

  // Inject the mock in place of PrismaService to isolate the service logic from the database layer
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();
    // The failure tests make the service log errors on purpose; silence them to keep the output
    // readable (done after compile(), which installs its own logger)
    Logger.overrideLogger(false);

    service = module.get<RoomsService>(RoomsService);
    prisma = module.get(PrismaService);
  });

  // Reset call history and mocked return values so tests do not depend on each other
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateRoomDto = {
      name: 'Deluxe Ocean View',
      description: 'Spacious room with a king-size bed, balcony and sea view.',
      capacity: 2,
      price_per_night: 2500,
    };

    it('should pass the DTO to prisma.rooms.create and return the created room', async () => {
      prisma.rooms.create.mockResolvedValue(ROOM);

      await expect(service.create(dto)).resolves.toEqual(ROOM);
      expect(prisma.rooms.create).toHaveBeenCalledWith({ data: dto });
    });

    it('should rethrow when the database rejects the data', async () => {
      prisma.rooms.create.mockRejectedValue(new Error('Data too long for column name'));

      await expect(service.create(dto)).rejects.toThrow('Data too long for column name');
    });
  });

  describe('findAll', () => {
    it('should return the rooms and total with default paging', async () => {
      prisma.rooms.findMany.mockResolvedValue([ROOM]);
      prisma.rooms.count.mockResolvedValue(1);

      await expect(service.findAll()).resolves.toEqual({ items: [ROOM], total: 1, limit: 20, offset: 0 });
      expect(prisma.rooms.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { id: 'asc' },
      });
      expect(prisma.rooms.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should apply limit, offset and the is_active filter', async () => {
      prisma.rooms.findMany.mockResolvedValue([]);
      prisma.rooms.count.mockResolvedValue(0);

      await service.findAll(5, 10, false);

      expect(prisma.rooms.findMany).toHaveBeenCalledWith({
        where: { is_active: false },
        skip: 10,
        take: 5,
        orderBy: { id: 'asc' },
      });
      expect(prisma.rooms.count).toHaveBeenCalledWith({ where: { is_active: false } });
    });

    it('should throw BadRequestException when limit is out of range', async () => {
      await expect(service.findAll(0, 0)).rejects.toThrow(BadRequestException);
      await expect(service.findAll(101, 0)).rejects.toThrow('limit must be between 1 and 100');
      expect(prisma.rooms.findMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when offset is negative', async () => {
      await expect(service.findAll(20, -1)).rejects.toThrow('offset must be 0 or greater');
      expect(prisma.rooms.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return the room with the given id', async () => {
      prisma.rooms.findUnique.mockResolvedValue(ROOM);

      await expect(service.findOne(1)).resolves.toEqual(ROOM);
      expect(prisma.rooms.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException when the room does not exist', async () => {
      prisma.rooms.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('Room 999 not found');
    });
  });

  describe('update', () => {
    const dto: UpdateRoomDto = { name: 'Deluxe Ocean View (Renovated)', price_per_night: 2800 };

    it('should call prisma.rooms.update with the id and DTO', async () => {
      const updated = { ...ROOM, name: dto.name, price_per_night: '2800.00' };
      prisma.rooms.findUnique.mockResolvedValue(ROOM);
      prisma.rooms.update.mockResolvedValue(updated);

      await expect(service.update(1, dto)).resolves.toEqual(updated);
      expect(prisma.rooms.update).toHaveBeenCalledWith({ where: { id: 1 }, data: dto });
    });

    it('should throw NotFoundException and skip the update when the room does not exist', async () => {
      prisma.rooms.findUnique.mockResolvedValue(null);

      await expect(service.update(999, dto)).rejects.toThrow(NotFoundException);
      expect(prisma.rooms.update).not.toHaveBeenCalled();
    });

    it('should rethrow when the database update fails', async () => {
      prisma.rooms.findUnique.mockResolvedValue(ROOM);
      prisma.rooms.update.mockRejectedValue(new Error('Record to update not found.'));

      await expect(service.update(1, dto)).rejects.toThrow('Record to update not found.');
    });
  });

  describe('remove', () => {
    it('should call prisma.rooms.delete with the id and return the deleted room', async () => {
      prisma.rooms.findUnique.mockResolvedValue(ROOM);
      prisma.rooms.delete.mockResolvedValue(ROOM);

      await expect(service.remove(1)).resolves.toEqual(ROOM);
      expect(prisma.rooms.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException and skip the delete when the room does not exist', async () => {
      prisma.rooms.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(prisma.rooms.delete).not.toHaveBeenCalled();
    });

    it('should rethrow when the database delete fails', async () => {
      prisma.rooms.findUnique.mockResolvedValue(ROOM);
      prisma.rooms.delete.mockRejectedValue(new Error('Record to delete not found.'));

      await expect(service.remove(1)).rejects.toThrow('Record to delete not found.');
    });
  });
});
