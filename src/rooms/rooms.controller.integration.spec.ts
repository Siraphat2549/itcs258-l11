/*
AI Declaration:
I used Claude Code as a coding assistant for this lab. It wrote the Room service unit tests,
the controller integration tests and the Room API E2E tests, following the lecture's Terms examples.

Reflection:
Overriding the guards and the cache interceptor showed me how to test the controller's own job,
calling the service and turning errors into 404 responses, without tokens or caching getting in the way.
Using AI made the lab faster, but I had to compare it with the lecture example to understand why each override was needed.
*/

import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER, CacheInterceptor } from '@nestjs/cache-manager';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Mock RoomsService: the controller talks to this instead of the real service and database
const mockRoomsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

// The controller clears the cache after every write, so it needs a CACHE_MANAGER to inject
const mockCacheManager = {
  clear: jest.fn(),
};

const ROOM = {
  id: 1,
  name: 'Deluxe Ocean View',
  description: 'Spacious room with a king-size bed, balcony and sea view.',
  capacity: 2,
  price_per_night: '2500.00',
  image_url: null,
  is_active: true,
};

// Prisma's "record not found" error, as thrown by update/delete when the row is gone
function prismaNotFoundError(message: string) {
  return Object.assign(new Error(message), { code: 'P2025' });
}

describe('RoomsController Integration', () => {
  let controller: RoomsController;
  let service: typeof mockRoomsService;

  beforeEach(async () => {
    // Override the guards and the interceptor to isolate the controller:
    // 1. JwtAuthGuard & RolesGuard: allow every request (no token or role checks)
    // 2. CacheInterceptor: pass straight through to the handler (no caching)
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [
        { provide: RoomsService, useValue: mockRoomsService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideInterceptor(CacheInterceptor)
      .useValue({ intercept: (_ctx: ExecutionContext, next: { handle: () => unknown }) => next.handle() })
      .compile();

    controller = module.get<RoomsController>(RoomsController);
    service = module.get(RoomsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // POST /rooms
  describe('create', () => {
    it('should call service.create, clear the cache and return the created room', async () => {
      const dto: CreateRoomDto = { name: 'Deluxe Ocean View', capacity: 2, price_per_night: 2500 };
      service.create.mockResolvedValue(ROOM);

      await expect(controller.create(dto)).resolves.toBe(ROOM);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(mockCacheManager.clear).toHaveBeenCalled();
    });
  });

  // GET /rooms
  describe('findAll', () => {
    it('should call service.findAll with the paging/filter params and return the rooms', async () => {
      const result = { items: [ROOM], total: 1, limit: 20, offset: 0 };
      service.findAll.mockResolvedValue(result);

      await expect(controller.findAll(20, 0, undefined)).resolves.toBe(result);
      expect(service.findAll).toHaveBeenCalledWith(20, 0, undefined);
    });
  });

  // GET /rooms/:id
  describe('findOne', () => {
    it('should call service.findOne and return the room', async () => {
      service.findOne.mockResolvedValue(ROOM);

      await expect(controller.findOne(1)).resolves.toBe(ROOM);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it('should propagate NotFoundException when the service cannot find the room', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Room 999 not found'));

      await expect(controller.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the service returns null', async () => {
      service.findOne.mockResolvedValue(null);

      await expect(controller.findOne(999)).rejects.toThrow('Room 999 not found');
    });
  });

  // PUT /rooms/:id
  describe('update', () => {
    const dto: UpdateRoomDto = { price_per_night: 2800 };

    it('should call service.update with the id and DTO and return the updated room', async () => {
      const updated = { ...ROOM, price_per_night: '2800.00' };
      service.update.mockResolvedValue(updated);

      await expect(controller.update(1, dto)).resolves.toBe(updated);
      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(mockCacheManager.clear).toHaveBeenCalled();
    });

    it('should throw NotFoundException when the service throws P2025', async () => {
      service.update.mockRejectedValue(prismaNotFoundError('Record to update not found.'));

      await expect(controller.update(999, dto)).rejects.toThrow(NotFoundException);
      expect(mockCacheManager.clear).not.toHaveBeenCalled();
    });
  });

  // DELETE /rooms/:id
  describe('remove', () => {
    it('should call service.remove and return a success message with the deleted room', async () => {
      service.remove.mockResolvedValue(ROOM);

      await expect(controller.remove(1)).resolves.toEqual({
        message: 'Room 1 deleted successfully',
        room: ROOM,
      });
      expect(service.remove).toHaveBeenCalledWith(1);
      expect(mockCacheManager.clear).toHaveBeenCalled();
    });

    it('should throw NotFoundException when the service throws P2025', async () => {
      service.remove.mockRejectedValue(prismaNotFoundError('Record to delete not found.'));

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
      expect(mockCacheManager.clear).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException thrown by the service', async () => {
      service.remove.mockRejectedValue(new NotFoundException('Room 999 not found'));

      await expect(controller.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should rethrow other errors unchanged', async () => {
      service.remove.mockRejectedValue(new Error('Connection lost'));

      await expect(controller.remove(1)).rejects.toThrow('Connection lost');
    });
  });
});
