import { IsObject } from 'class-validator';

export class PutAppStateDto {
  @IsObject()
  payload!: Record<string, unknown>;
}
