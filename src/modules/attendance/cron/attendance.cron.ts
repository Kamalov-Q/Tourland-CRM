import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AttendanceService } from "../attendance.service";

@Injectable()
export class AttendanceCron {
    private readonly logger = new Logger(AttendanceCron.name);

    constructor(private readonly attendanceSvc: AttendanceService) {}

    /**
     * Runs every day at 20:00 Tashkent time.
     * 1. Auto-checks-out all employees still PRESENT (forgot to leave) → status: ATTENDED
     * 2. Marks all active employees who never checked in as ABSENT
     */
    @Cron('0 20 * * *', { timeZone: 'Asia/Tashkent' })
    async dailyAttendanceCron() {
        this.logger.log('Running daily attendance cron at 20:00');
        try {
            await this.attendanceSvc.autoCheckoutAll();
        } catch (err) {
            this.logger.error('Auto-checkout failed', err);
        }
        try {
            await this.attendanceSvc.markAbsentAll();
        } catch (err) {
            this.logger.error('Mark absent failed', err);
        }
        this.logger.log('Daily attendance cron complete');
    }
}
