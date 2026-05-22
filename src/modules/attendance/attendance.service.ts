import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Attendance, AttendanceStatus } from "./entities/attendance.entity";
import { IsNull, Repository } from "typeorm";
import { ActivityLog } from "../archive/entities/activity-log.entity";
import { NotificationGateway } from "../tasks/gateways/notification.gateway";
import { User, UserRole } from "../users/entities/user.entity";
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
        private readonly attendanceRepo: Repository<Attendance>,
        @InjectRepository(ActivityLog)
        private readonly activityRepo: Repository<ActivityLog>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly notificationGateway: NotificationGateway,
    ) {
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

    /** Round check-in time: minutes < 30 → floor to hour, minutes >= 30 → ceil to next hour */
    private roundCheckInTime(date: Date): Date {
        const rounded = new Date(date);
        if (date.getMinutes() < 30) {
            rounded.setMinutes(0, 0, 0);
        } else {
            rounded.setHours(date.getHours() + 1, 0, 0, 0);
        }
        return rounded;
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
            checkInAt: this.roundCheckInTime(new Date()),
            photo: photoUrl,
            status: AttendanceStatus.PRESENT,
        });
        const saved = await this.attendanceRepo.save(attendance);

        await this.activityRepo.save({
            userId: employeeId,
            actionType: 'ATTENDANCE_CHECK_IN',
            details: { attendanceId: saved.id, time: saved.checkInAt }
        });

        // Notify director of check-in
        const employee = await this.userRepo.findOne({ where: { id: employeeId } });
        if (employee && employee.parentId) {
            this.notificationGateway.emitAttendanceCheckedIn(employee.parentId, {
                employeeId,
                name: `${employee.firstName} ${employee.lastName}`,
                checkInAt: saved.checkInAt
            });
        }

        return saved;
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

        const photoUrl = dto.photo ? await this.savePhoto(dto.photo) : null;

        attendance.checkOutAt = new Date();
        attendance.checkOutPhoto = photoUrl;
        attendance.status = AttendanceStatus.ATTENDED;

        const saved = await this.attendanceRepo.save(attendance);

        await this.activityRepo.save({
            userId: employeeId,
            actionType: 'ATTENDANCE_CHECK_OUT',
            details: { attendanceId: saved.id, time: saved.checkOutAt }
        });

        // Notify director of check-out
        const employee = await this.userRepo.findOne({ where: { id: employeeId } });
        if (employee && employee.parentId) {
            this.notificationGateway.emitAttendanceCheckedOut(employee.parentId, {
                employeeId,
                name: `${employee.firstName} ${employee.lastName}`,
                checkOutAt: saved.checkOutAt
            });
        }

        return saved;
    }

    /**
     * Auto-checkout all employees still PRESENT at 7 PM.
     * Sets checkOutAt to 19:00, uses a default placeholder photo, status → ATTENDED.
     */
    async autoCheckoutAll(): Promise<void> {
        const date = this.getTodayStr();

        const active = await this.attendanceRepo.find({
            where: {
                date,
                status: AttendanceStatus.PRESENT,
                checkOutAt: IsNull(),
            },
            relations: ['employee'],
        });

        if (active.length === 0) return;

        // Build the 19:00 timestamp for today in Tashkent time
        const checkoutTime = new Date();
        checkoutTime.setHours(19, 0, 0, 0);

        const defaultPhoto = '/uploads/attendance/default.jpg';

        for (const rec of active) {
            rec.checkOutAt = checkoutTime;
            rec.checkOutPhoto = defaultPhoto;
            rec.status = AttendanceStatus.ATTENDED;
            await this.attendanceRepo.save(rec);

            await this.activityRepo.save({
                userId: rec.employeeId,
                actionType: 'ATTENDANCE_AUTO_CHECKOUT',
                details: { attendanceId: rec.id, note: 'Auto-checked out at 19:00' }
            });

            // Notify director
            if (rec.employee && rec.employee.parentId) {
                this.notificationGateway.emitAttendanceCheckedOut(rec.employee.parentId, {
                    employeeId: rec.employeeId,
                    name: `${rec.employee.firstName} ${rec.employee.lastName}`,
                    checkOutAt: checkoutTime,
                    autoCheckout: true,
                });
            }
        }

        this.logger.log(`Auto-checked out ${active.length} employee(s) at 19:00`);
    }

    /**
     * Mark ABSENT for all active employees who have no attendance record today.
     */
    async markAbsentAll(): Promise<void> {
        const date = this.getTodayStr();

        // Get all active employees
        const employees = await this.userRepo.find({
            where: { role: UserRole.EMPLOYEE, isActive: true },
        });

        for (const emp of employees) {
            const existing = await this.attendanceRepo.findOne({
                where: { employeeId: emp.id, date },
            });

            if (!existing) {
                const absent = this.attendanceRepo.create({
                    employeeId: emp.id,
                    date,
                    checkInAt: null,
                    checkOutAt: null,
                    photo: null,
                    checkOutPhoto: null,
                    status: AttendanceStatus.ABSENT,
                });
                await this.attendanceRepo.save(absent);

                await this.activityRepo.save({
                    userId: emp.id,
                    actionType: 'ATTENDANCE_ABSENT',
                    details: { date, note: 'Marked absent by system at 19:00' }
                });

                this.logger.log(`Marked ${emp.firstName} ${emp.lastName} as ABSENT for ${date}`);
            }
        }
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
