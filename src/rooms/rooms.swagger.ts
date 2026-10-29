// Inline OpenAPI schemas shared by the RoomsController @ApiResponse decorators

export const ROOM_EXAMPLE = {
  id: 1,
  name: 'Deluxe Ocean View',
  description: 'Spacious room with a king-size bed, balcony and sea view.',
  capacity: 2,
  price_per_night: '2500.00',
  image_url: 'https://example.com/images/rooms/deluxe-ocean-view.jpg',
  is_active: true,
  created_at: '2026-10-21T08:00:00.000Z',
  updated_at: '2026-10-21T08:00:00.000Z',
};

export const ROOM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    name: { type: 'string', example: 'Deluxe Ocean View' },
    description: { type: 'string', nullable: true, example: ROOM_EXAMPLE.description },
    capacity: { type: 'integer', example: 2 },
    // Prisma serialises Decimal columns as strings
    price_per_night: { type: 'string', example: '2500.00' },
    image_url: { type: 'string', nullable: true, example: ROOM_EXAMPLE.image_url },
    is_active: { type: 'boolean', nullable: true, example: true },
    created_at: { type: 'string', format: 'date-time', nullable: true },
    updated_at: { type: 'string', format: 'date-time', nullable: true },
  },
  example: ROOM_EXAMPLE,
};

export const ROOM_LIST_SCHEMA = {
  type: 'array',
  items: ROOM_SCHEMA,
  example: [ROOM_EXAMPLE],
};

export const PAGINATED_ROOMS_SCHEMA = {
  type: 'object',
  properties: {
    items: ROOM_LIST_SCHEMA,
    total: { type: 'integer', example: 25, description: 'Total rooms matching the filter' },
    limit: { type: 'integer', example: 20, description: 'Page size used for this response' },
    offset: { type: 'integer', example: 0, description: 'Number of rooms skipped' },
  },
  example: {
    items: [ROOM_EXAMPLE],
    total: 25,
    limit: 20,
    offset: 0,
  },
};

// Same shape Nest's built-in HttpExceptions produce: { statusCode, message, error }
export function errorSchema(statusCode: number, error: string, message: string | string[]) {
  return {
    type: 'object',
    properties: {
      statusCode: { type: 'integer', example: statusCode },
      message: Array.isArray(message)
        ? { type: 'array', items: { type: 'string' }, example: message }
        : { type: 'string', example: message },
      error: { type: 'string', example: error },
    },
    example: { statusCode, message, error },
  };
}

export const VALIDATION_ERROR_SCHEMA = errorSchema(400, 'Bad Request', [
  'name should not be empty',
  'name must be a string',
  'capacity should not be empty',
]);

export const UNAUTHORIZED_SCHEMA = errorSchema(401, 'Unauthorized', 'Invalid or expired token');

export const FORBIDDEN_SCHEMA = errorSchema(
  403,
  'Forbidden',
  'You do not have permission to perform this action',
);

export const NOT_FOUND_SCHEMA = errorSchema(404, 'Not Found', 'Room 1 not found');

export const TOO_MANY_REQUESTS_SCHEMA = {
  type: 'object',
  properties: {
    statusCode: { type: 'integer', example: 429 },
    message: { type: 'string', example: 'ThrottlerException: Too Many Requests' },
  },
  example: { statusCode: 429, message: 'ThrottlerException: Too Many Requests' },
};
