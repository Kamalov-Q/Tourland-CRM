import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Attendance } from "./entities/attendance.entity";
import { Repository } from "typeorm";
import { CheckInDto } from "./dto/check-in.dto";
import { CheckOutDto } from "./dto/check-out.dto";
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AttendanceService {
    private readonly uploadPath = path.join(process.cwd(), 'uploads', 'attendance');

    constructor(
        @InjectRepository(Attendance)
        private readonly attendanceRepo: Repository<Attendance>
    ) {
        if (!fs.existsSync(this.uploadPath)) {
            fs.mkdirSync(this.uploadPath, { recursive: true });
        }
    }

    private savePhoto(base64: string): string {
        try {
            const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                throw new Error('Invalid base64 string');
            }

            const buffer = Buffer.from(matches[2], 'base64');
            const fileName = `${uuidv4()}.jpg`;
            const filePath = path.join(this.uploadPath, fileName);
            fs.writeFileSync(filePath, buffer);

            return `/uploads/attendance/${fileName}`;
        } catch (error) {
            throw new BadRequestException('Failed to save photo');
        }
    }

    private getTodayStr(): string {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${d.getFullYear()}-${m}-${day}`;
    }

    async checkIn(userId: string, dto: CheckInDto) {
        const date = this.getTodayStr();
        const exists = await this.attendanceRepo.findOne({
            where: { userId, date }
        });

        if (exists) {
            throw new BadRequestException('Already checked in today');
        }

        const photoUrl = this.savePhoto(dto.photo);

        const attendance = this.attendanceRepo.create({
            userId,
            date,
            checkInAt: new Date(),
            checkInPhoto: photoUrl
        });

        return this.attendanceRepo.save(attendance);
    }

    async checkOut(userId: string, dto: CheckOutDto) {
        const date = this.getTodayStr();
        const attendance = await this.attendanceRepo.findOne({
            where: { userId, date }
        });

        if (!attendance) {
            throw new BadRequestException('Must check in before checking out');
        }

        if (attendance.checkOutAt) {
            throw new BadRequestException('Already checked out today');
        }

        const photoUrl = this.savePhoto(dto.photo);

        attendance.checkOutAt = new Date();
        attendance.checkOutPhoto = photoUrl;

        return this.attendanceRepo.save(attendance);
    }

    async getMyHistory(userId: string) {
        return this.attendanceRepo.find({
            where: { userId },
            order: { date: 'DESC' }
        });
    }

    async getEmployeeHistory(employeeId: string) {
        return this.attendanceRepo.find({
            where: { userId: employeeId },
            order: { date: 'DESC' }
        });
    }

    async getAllAttendance() {
        return this.attendanceRepo.find({
            relations: ['user'],
            order: { createdAt: 'DESC' }
        });
    }
}
