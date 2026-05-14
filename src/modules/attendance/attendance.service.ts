import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Attendance } from "./entities/attendance.entity";
import { Repository } from "typeorm";
import { CheckInDto } from "./dto/check-in.dto";
import { CheckOutDto } from "./dto/check-out.dto";
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AttendanceService {
    private readonly uploadPath = path.join(process.cwd(), 'uploads', 'attendance');
    private readonly logger = new Logger(AttendanceService.name);

    constructor(
        @InjectRepository(Attendance)
        private readonly attendanceRepo: Repository<Attendance>
    ) {
        // Ensure upload directory exists (sync is fine once at startup)
        if (!fsSync.existsSync(this.uploadPath)) {
            fsSync.mkdirSync(this.uploadPath, { recursive: true });
            this.logger.log(`Created attendance upload directory at ${this.uploadPath}`);
        }
    }

    private async savePhoto(base64: string): Promise<string> {
        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            throw new BadRequestException('Invalid photo format — expected base64 data URI');
        }

        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${uuidv4()}.jpg`;
        const filePath = path.join(this.uploadPath, fileName);

        try {
            await fs.writeFile(filePath, buffer);
        } catch {
            throw new BadRequestException('Failed to save photo');
        }

        return `/uploads/attendance/${fileName}`;
    }

    private getTodayStr(): string {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
    }

    async checkIn(employeeId: string, dto: CheckInDto) {
        const date = this.getTodayStr();
        const exists = await this.attendanceRepo.findOne({ where: { employeeId, date } });

        if (exists) {
            throw new BadRequestException('Already checked in today');
        }

        const photoUrl = await this.savePhoto(dto.photo);

        const attendance = this.attendanceRepo.create({
            employeeId,
            date,
            checkInAt: new Date(),
            photo: photoUrl
        });

        return this.attendanceRepo.save(attendance);
    }

    async checkOut(employeeId: string, dto: CheckOutDto) {
        const date = this.getTodayStr();
        const attendance = await this.attendanceRepo.findOne({ where: { employeeId, date } });

        if (!attendance) {
            throw new BadRequestException('Must check in before checking out');
        }

        if (attendance.checkOutAt) {
            throw new BadRequestException('Already checked out today');
        }

        const photoUrl = await this.savePhoto(dto.photo);

        attendance.checkOutAt = new Date();
        attendance.checkOutPhoto = photoUrl;

        return this.attendanceRepo.save(attendance);
    }

    find(query: { employeeId?: string; date?: string }) {
        return this.attendanceRepo.find({
            where: {
                ...(query.employeeId && { employeeId: query.employeeId }),
                ...(query.date && { date: query.date }),
            },
            order: { date: 'DESC', checkInAt: 'DESC' },
            relations: ['employee']
        });
    }

    /** Employee's own history */
    getHistory(employeeId: string) {
        return this.attendanceRepo.find({
            where: { employeeId },
            order: { date: 'DESC' }
        });
    }
}
