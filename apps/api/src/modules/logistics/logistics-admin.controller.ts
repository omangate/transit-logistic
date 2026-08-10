import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { User } from '@/types/user';
import { UserRole } from '@transit-logistic/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { ChecklistTemplatesService } from './checklist-templates.service';
import { LogisticsChargesService } from './logistics-charges.service';
import { LogisticsContainersService } from './logistics-containers.service';
import { LogisticsPdfService } from './logistics-pdf.service';
import { LogisticsVehiclesService } from './logistics-vehicles.service';

type MulterFile = { buffer: Buffer; mimetype: string; size: number; originalname?: string };

@Controller('admin/logistics/checklist-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminChecklistTemplatesController {
  constructor(private readonly templates: ChecklistTemplatesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.templates.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.templates.create(user, body as never);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.templates.update(user, id, body as never);
  }

  @Patch(':id/active')
  setActive(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: { isActive: boolean }) {
    return this.templates.setActive(user, id, body.isActive);
  }

  @Put(':id/items')
  replaceItems(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: { items: Array<Record<string, unknown>> }) {
    return this.templates.replaceItems(user, id, body.items as never);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.remove(user, id);
  }
}

@Controller('logistics/containers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsContainersController {
  constructor(private readonly containers: LogisticsContainersService) {}

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  list(
    @CurrentUser() user: User,
    @Query('logisticsOrderId') logisticsOrderId?: string,
    @Query('customsRequestId') customsRequestId?: string,
    @Query('freightRequestId') freightRequestId?: string,
  ) {
    return this.containers.list(user, { logisticsOrderId, customsRequestId, freightRequestId });
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.containers.get(user, id);
  }

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.containers.create(user, body as never);
  }

  @Patch(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.containers.update(user, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  archive(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.containers.archive(user, id);
  }
}

@Controller('logistics/vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsVehiclesController {
  constructor(private readonly vehicles: LogisticsVehiclesService) {}

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  list(
    @CurrentUser() user: User,
    @Query('logisticsOrderId') logisticsOrderId?: string,
    @Query('customsRequestId') customsRequestId?: string,
  ) {
    return this.vehicles.list(user, { logisticsOrderId, customsRequestId });
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  get(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.get(user, id);
  }

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.vehicles.create(user, body as never);
  }

  @Patch(':id')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.vehicles.update(user, id, body as never);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.remove(user, id);
  }

  @Post('import/preview')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  previewImport(@CurrentUser() user: User, @Body() body: { logisticsOrderId: string; rows: Array<Record<string, string>> }) {
    return this.vehicles.previewImport(user, body.logisticsOrderId, body.rows);
  }

  @Post('import/commit')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  commitImport(
    @CurrentUser() user: User,
    @Body() body: { logisticsOrderId: string; rows: Array<Record<string, unknown>>; skipInvalid?: boolean },
  ) {
    return this.vehicles.commitImport(user, body.logisticsOrderId, body.rows as never, { skipInvalid: body.skipInvalid });
  }

  @Post('import/file')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @CurrentUser() user: User,
    @UploadedFile() file: MulterFile,
    @Body('logisticsOrderId') logisticsOrderId: string,
    @Body('commit') commit?: string,
  ) {
    const rows = parseSpreadsheet(file);
    if (commit === 'true') {
      return this.vehicles.commitImport(user, logisticsOrderId, rows as never, { skipInvalid: true });
    }
    return this.vehicles.previewImport(user, logisticsOrderId, rows);
  }
}

@Controller('logistics/charges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsChargesController {
  constructor(private readonly charges: LogisticsChargesService) {}

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  list(@CurrentUser() user: User, @Query('logisticsOrderId') logisticsOrderId: string) {
    return this.charges.list(user, logisticsOrderId);
  }

  @Get('totals')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  totals(@CurrentUser() user: User, @Query('logisticsOrderId') logisticsOrderId: string) {
    return this.charges.totals(user, logisticsOrderId);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: User, @Body() body: Record<string, unknown>) {
    return this.charges.create(user, body as never);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    return this.charges.update(user, id, body as never);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.charges.remove(user, id);
  }
}

@Controller('logistics/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsReportsController {
  constructor(private readonly pdf: LogisticsPdfService) {}

  @Get('quotes/:id/pdf')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async quotePdf(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.pdf.quotePdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get('orders/:id/invoice.pdf')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async invoice(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.pdf.invoicePdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get('orders/:id/cost-statement.pdf')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async costStatement(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.pdf.costStatementPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(file.buffer);
  }

  @Get('customs/:id/summary.pdf')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async customsSummary(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.pdf.customsSummaryPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(file.buffer);
  }

  @Get('orders/:id/containers.pdf')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async containers(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.pdf.containerListPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(file.buffer);
  }

  @Get('orders/:id/vehicles.pdf')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async vehicles(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.pdf.vehicleListPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(file.buffer);
  }

  @Get('orders/:id/summary.pdf')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async summary(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.pdf.shipmentSummaryPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(file.buffer);
  }

  @Get('orders/:id/delivery.pdf')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  async delivery(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const file = await this.pdf.deliveryConfirmationPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(file.buffer);
  }
}

function parseSpreadsheet(file: MulterFile): Array<Record<string, string>> {
  const name = file.originalname?.toLowerCase() ?? '';
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || file.mimetype.includes('spreadsheet')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
  }

  const text = file.buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? '').trim();
    });
    return row;
  });
}
