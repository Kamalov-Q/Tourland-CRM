import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Tour } from "./entities/tour.entity";
import { CreateTourDto } from "./dto/create-tour.dto";
import { UpdateTourDto } from "./dto/update-tour.dto";
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ToursService {
    private readonly uploadPath = path.join(process.cwd(), 'uploads', 'tours');

    constructor(
        @InjectRepository(Tour)
        private readonly tourRepo: Repository<Tour>,
    ) {
        if (!fsSync.existsSync(this.uploadPath)) {
            fsSync.mkdirSync(this.uploadPath, { recursive: true });
        }
    }

    private async saveImage(base64: string): Promise<string> {
        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new BadRequestException('Surat formati noto\'g\'ri — kutilayotgan base64 data URI');
        }

        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${uuidv4()}.jpg`;
        const filePath = path.join(this.uploadPath, fileName);

        try {
            await fs.writeFile(filePath, buffer);
        } catch {
            throw new BadRequestException('Suratni saqlashda xatolik');
        }

        return `/uploads/tours/${fileName}`;
    }

    async create(dto: CreateTourDto) {
        let imageUrl = dto.imageUrl;
        if (dto.imageUrl && dto.imageUrl.startsWith('data:')) {
            imageUrl = await this.saveImage(dto.imageUrl);
        }

        const tour = this.tourRepo.create({
            ...dto,
            imageUrl,
        });
        return this.tourRepo.save(tour);
    }

    findAll() {
        return this.tourRepo.find({ order: { orders: 'ASC', createdAt: 'DESC' } });
    }

    findOne(id: string) {
        return this.tourRepo.findOne({ where: { id } });
    }

    async update(id: string, dto: UpdateTourDto) {
        let imageUrl = dto.imageUrl;
        if (dto.imageUrl && dto.imageUrl.startsWith('data:')) {
            imageUrl = await this.saveImage(dto.imageUrl);
        }

        const current = await this.findOne(id);
        if (!current) throw new BadRequestException('Tur topilmadi');

        const updated = Object.assign(current, {
            ...dto,
            ...(imageUrl && { imageUrl }),
        });
        
        return this.tourRepo.save(updated);
    }

    async remove(id: string) {
        await this.tourRepo.delete(id);
        return { deleted: true };
    }
}
