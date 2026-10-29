import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateRoomDto {
    @ApiProperty({
        description: 'Display name of the room (max 100 characters)',
        example: 'Deluxe Ocean View',
        type: String,
        maxLength: 100,
    })
    @IsString({ message: 'name must be a string' })
    @IsNotEmpty({ message: 'name should not be empty' })
    @MaxLength(100, { message: 'name must be shorter than or equal to 100 characters' })
    name!: string;

    @ApiPropertyOptional({
        description: 'Longer description of the room and its amenities',
        example: 'Spacious room with a king-size bed, balcony and sea view.',
        type: String,
    })
    @IsOptional()
    @IsString({ message: 'description must be a string' })
    description?: string;

    @ApiProperty({
        description: 'Maximum number of guests the room can accommodate',
        example: 2,
        type: Number,
        minimum: 1,
    })
    @IsNotEmpty({ message: 'capacity should not be empty' })
    capacity!: number;

    @ApiProperty({
        description: 'Price per night in THB (up to 2 decimal places)',
        example: 2500.0,
        type: Number,
        format: 'decimal',
    })
    @IsNotEmpty({ message: 'price_per_night should not be empty' })
    price_per_night!: number;

    @ApiPropertyOptional({
        description: 'URL of the room photo (max 255 characters)',
        example: 'https://example.com/images/rooms/deluxe-ocean-view.jpg',
        type: String,
        maxLength: 255,
    })
    @IsOptional()
    @IsString({ message: 'image_url must be a string' })
    image_url?: string;

    @ApiPropertyOptional({
        description: 'Whether the room can be booked. Defaults to true',
        example: true,
        type: Boolean,
        default: true,
    })
    @IsOptional()
    @IsBoolean({ message: 'is_active must be a boolean' })
    is_active?: boolean;
}
