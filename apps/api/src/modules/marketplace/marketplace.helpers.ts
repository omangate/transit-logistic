import { BadRequestException, Injectable } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

@Injectable()
export class MarketplaceScoreValidator {
  validateScore(value: number, field: string): void {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new BadRequestException({
        code: 'INVALID_SCORE',
        message_en: `${field} must be between 1 and 5.`,
        message_ar: `${field} يجب أن يكون بين 1 و 5.`,
      });
    }
  }
}

export class ScoreField {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

export class OptionalScoreField {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;
}
