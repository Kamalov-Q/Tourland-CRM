import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from "@nestjs/common";
import { ToursService } from "./tours.service";
import { CreateTourDto } from "./dto/create-tour.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../users/entities/user.entity";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

@ApiTags('Tours')
@Controller('tours')
export class ToursController {
    constructor(private readonly toursService: ToursService) {}

    @Post()
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.DIRECTOR)
    create(@Body() createTourDto: CreateTourDto) {
        return this.toursService.create(createTourDto);
    }

    @Get()
    findAll() {
        return this.toursService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.toursService.findOne(id);
    }

    @Patch(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.DIRECTOR)
    update(@Param('id') id: string, @Body() updateTourDto: UpdateTourDto) {
        return this.toursService.update(id, updateTourDto);
    }

    @Delete(':id')
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.DIRECTOR)
    remove(@Param('id') id: string) {
        return this.toursService.remove(id);
    }
}
