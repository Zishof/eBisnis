import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Permissions } from '../../common/decorators';
import { EducationService } from './education.service';
import type { EducationProduct } from './education-catalog';

const PRODUCTS = ['epesantren', 'eschool', 'ecampus'] as const;

class EducationQuery {
  @ApiPropertyOptional({ enum: PRODUCTS })
  @IsOptional()
  @IsIn(PRODUCTS as unknown as string[])
  product?: EducationProduct;
}

@ApiTags('education')
@ApiBearerAuth('access-token')
@Controller('education')
export class EducationController {
  constructor(private readonly education: EducationService) {}

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('modules')
  @ApiOperation({ summary: 'Katalog modul dan status gap ePesantren, eSchool, dan eCampus' })
  modules(@Query() query: EducationQuery) {
    return this.education.modules(query.product);
  }

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('datasets')
  @ApiOperation({ summary: 'Dataset nasional education: DAPODIK, EMIS, dan Feeder/PD-Dikti' })
  datasets(@Query() query: EducationQuery) {
    return this.education.datasets(query.product);
  }

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('roadmap')
  @ApiOperation({ summary: 'Roadmap implementasi prioritas education' })
  roadmap() {
    return this.education.roadmap();
  }
}

@ApiTags('eschool')
@ApiBearerAuth('access-token')
@Controller('eschool')
export class EschoolController {
  constructor(private readonly education: EducationService) {}

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard eSchool dan kesiapan modul sekolah formal' })
  dashboard() {
    return this.education.eschoolDashboard();
  }

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('navigation')
  @ApiOperation({ summary: 'Navigasi modul eSchool lengkap' })
  navigation() {
    return this.education.eschoolNavigation();
  }

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('modules')
  @ApiOperation({ summary: 'Katalog modul eSchool dan status implementasinya' })
  modules() {
    return this.education.modules('eschool');
  }

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('datasets')
  @ApiOperation({ summary: 'Dataset nasional yang relevan untuk eSchool' })
  datasets() {
    return this.education.datasets('eschool');
  }
}

@ApiTags('ecampus')
@ApiBearerAuth('access-token')
@Controller('ecampus')
export class EcampusController {
  constructor(private readonly education: EducationService) {}

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('modules')
  @ApiOperation({ summary: 'Katalog modul eCampus dan status implementasinya' })
  modules() {
    return this.education.modules('ecampus');
  }

  @Permissions('EPESANTREN_EDUCATION_IMPLEMENTASI.READ')
  @Get('datasets')
  @ApiOperation({ summary: 'Dataset nasional yang relevan untuk eCampus' })
  datasets() {
    return this.education.datasets('ecampus');
  }
}
