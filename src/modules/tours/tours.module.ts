import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Tour } from "./entities/tour.entity";
import { ToursService } from "./tours.service";
import { ToursController } from "./tours.controller";

@Module({
    imports: [TypeOrmModule.forFeature([Tour])],
    providers: [ToursService],
    controllers: [ToursController],
    exports: [ToursService],
})
export class ToursModule {}
