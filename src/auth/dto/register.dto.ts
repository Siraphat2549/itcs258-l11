import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ description: 'Unique username (max 50 characters)', example: 'admin', maxLength: 50 })
  @IsString({ message: 'username must be a string' })
  @IsNotEmpty({ message: 'username should not be empty' })
  @MaxLength(50, { message: 'username must be shorter than or equal to 50 characters' })
  username!: string;

  @ApiProperty({ description: 'Password (min 6 characters)', example: 'secret123', minLength: 6 })
  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password should not be empty' })
  @MinLength(6, { message: 'password must be at least 6 characters long' })
  password!: string;

  // Optional so existing register calls keep defaulting to USER; lets test scripts create an
  // ADMIN account directly for RBAC testing without touching the database by hand.
  @ApiPropertyOptional({ description: 'Account role. Defaults to USER', enum: Role, example: Role.ADMIN })
  @IsOptional()
  @IsEnum(Role, { message: 'role must be either USER or ADMIN' })
  role?: Role;
}
