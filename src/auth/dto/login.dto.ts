import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Account username', example: 'admin' })
  @IsString({ message: 'username must be a string' })
  @IsNotEmpty({ message: 'username should not be empty' })
  username!: string;

  @ApiProperty({ description: 'Account password', example: 'secret123' })
  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password should not be empty' })
  password!: string;
}
