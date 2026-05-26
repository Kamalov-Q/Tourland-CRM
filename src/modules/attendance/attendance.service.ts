import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Attendance, AttendanceStatus } from "./entities/attendance.entity";
import { IsNull, Repository } from "typeorm";
import { ActivityLog } from "../archive/entities/activity-log.entity";
import { User, UserRole } from "../users/entities/user.entity";
import { CheckInDto } from "./dto/check-in.dto";
import { CheckOutDto } from "./dto/check-out.dto";
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { NotificationGateway } from "../notifications/gateways/notification.gateway";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "../notifications/enums/notification-type.enum";

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
        private readonly notificationsService: NotificationsService,
    ) {
        if (!fsSync.existsSync(this.uploadPath)) {
            fsSync.mkdirSync(this.uploadPath, { recursive: true });
            this.logger.log(`Created attendance upload directory at ${this.uploadPath}`);
        }
    }

    private async savePhoto(base64: string): Promise<string> {
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

        return `/uploads/attendance/${fileName}`;
    }

    private getTodayStr(): string {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
    }

    /** 
     * Round attendance time (check-in/out): 
     * 00-20 (inc) -> current hour :00
     * 21-45 (inc) -> current hour :30
     * 46-59 -> next hour :00
     */
    private roundAttendanceTime(date: Date): Date {
        // Since process.env.TZ = 'Asia/Tashkent', raw Date methods are safe here for the backend.
        // But for clarity, we ensure we are working with correct local time.
        const rounded = new Date(date);
        const minutes = date.getMinutes();
        
        if (minutes <= 20) {
            rounded.setMinutes(0, 0, 0);
        } else if (minutes <= 45) {
            rounded.setMinutes(30, 0, 0);
        } else {
            rounded.setHours(date.getHours() + 1, 0, 0, 0);
        }
        return rounded;
    }

    async checkIn(employeeId: string, dto: CheckInDto) {
        const date = this.getTodayStr();
        const exists = await this.attendanceRepo.findOne({ where: { employeeId, date } });

        if (exists) {
            throw new BadRequestException('Bugun allaqachon ishga kelgansiz');
        }

        const photoUrl = await this.savePhoto(dto.photo);

        const attendance = this.attendanceRepo.create({
            employeeId,
            date,
            checkInAt: this.roundAttendanceTime(new Date()),
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

            await this.notificationsService.createNotification(
                employee.parentId,
                NotificationType.ATTENDANCE_UPDATE,
                `${employee.firstName} ${employee.lastName} ishga keldi`,
                { employeeId }
            );
        }

        return saved;
    }

    async checkOut(employeeId: string, dto: CheckOutDto) {
        const date = this.getTodayStr();
        const attendance = await this.attendanceRepo.findOne({ where: { employeeId, date } });

        if (!attendance) {
            throw new BadRequestException('Ishdan ketishdan oldin ishga kelishni qayd eting');
        }

        if (attendance.checkOutAt) {
            throw new BadRequestException('Bugun allaqachon ishdan ketgansiz');
        }

        const photoUrl = dto.photo ? await this.savePhoto(dto.photo) : null;

        attendance.checkOutAt = this.roundAttendanceTime(new Date());
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

            await this.notificationsService.createNotification(
                employee.parentId,
                NotificationType.ATTENDANCE_UPDATE,
                `${employee.firstName} ${employee.lastName} ishdan ketdi`,
                { employeeId }
            );
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

        // Build the 20:00 timestamp for today in Tashkent time
        const tzDateStr = this.getTodayStr(); // YYYY-MM-DD in Tashkent
        const checkoutTime = new Date(tzDateStr);
        checkoutTime.setHours(20, 0, 0, 0);

        const defaultPhoto = '/uploads/attendance/default.jpg';

        for (const rec of active) {
            rec.checkOutAt = checkoutTime;
            rec.checkOutPhoto = defaultPhoto;
            rec.isAutoCheckout = true;
            rec.status = AttendanceStatus.ATTENDED;
            await this.attendanceRepo.save(rec);

            await this.activityRepo.save({
                userId: rec.employeeId,
                actionType: 'ATTENDANCE_AUTO_CHECKOUT',
                details: { attendanceId: rec.id, note: '20:00 da avtomatik checkout' }
            });

            // Notify director
            if (rec.employee && rec.employee.parentId) {
                this.notificationGateway.emitAttendanceCheckedOut(rec.employee.parentId, {
                    employeeId: rec.employeeId,
                    name: `${rec.employee.firstName} ${rec.employee.lastName}`,
                    checkOutAt: checkoutTime,
                    autoCheckout: true,
                });

                await this.notificationsService.createNotification(
                    rec.employee.parentId,
                    NotificationType.ATTENDANCE_UPDATE,
                    `${rec.employee.firstName} ${rec.employee.lastName} tizim tomonidan avtomatik ishdan chiqarildi (checkout)`,
                    { employeeId: rec.employeeId }
                );
            }
        }

        this.logger.log(`Auto-checked out ${active.length} employee(s) at 20:00`);
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
                    details: { date, note: 'Sistema tomonidan 20:00 da kelmagan deb belgilandi' }
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
