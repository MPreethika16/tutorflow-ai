import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UserRole } from '../generated/prisma/client';

import { GeneratePaperDto } from './dto/generate-paper.dto';
import { PaperGenerationService } from './paper-generation.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER)
export class AiController {
  constructor(
    private readonly paperGenerationService: PaperGenerationService,
  ) {}

  @Post('papers/generate')
  generatePaper(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GeneratePaperDto,
  ) {
    return this.paperGenerationService.generateAndSaveDraft(
      user.sub,
      dto,
    );
  }
}