import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telegraf, Context, Markup } from 'telegraf';
import { TelegramUser } from './entities/telegram-user.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TelegramService implements OnModuleInit {
    private readonly logger = new Logger(TelegramService.name);
    private bot: Telegraf;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(TelegramUser)
        private readonly telegramUserRepo: Repository<TelegramUser>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) {
        const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
        if (token) {
            this.bot = new Telegraf(token);
            this.setupBot();
        } else {
            this.logger.warn('TELEGRAM_BOT_TOKEN is not set. Telegram bot will not start.');
        }
    }

    onModuleInit() {
        if (this.bot) {
            this.bot.launch().catch(err => {
                this.logger.error(`Failed to launch Telegram bot: ${err.message}`);
            });
        }
    }

    private setupBot() {
        this.bot.start(async (ctx) => {
            const userId = ctx.from.id.toString();
            let user = await this.telegramUserRepo.findOne({ where: { telegramId: userId } });

            if (!user) {
                user = this.telegramUserRepo.create({
                    telegramId: userId,
                    username: ctx.from.username || null,
                    firstName: ctx.from.first_name,
                    lastName: ctx.from.last_name || null,
                });
                await this.telegramUserRepo.save(user);
            }

            await ctx.reply(
                `Assalomu alaykum, ${ctx.from.first_name}! \n\nTourland CRM botiga xush kelibsiz. Iltimos, ro'yxatdan o'tish uchun to'liq ismingizni (F.I.O) kiriting:`,
            );
        });

        this.bot.on('contact', async (ctx) => {
            const contact = ctx.message.contact;
            const userId = ctx.from.id.toString();
            const user = await this.telegramUserRepo.findOne({ where: { telegramId: userId } });

            if (user) {
                user.phoneNumber = contact.phone_number.replace('+', '');
                await this.telegramUserRepo.save(user);

                await ctx.reply(
                    "Rahmat! Siz muvaffaqiyatli ro'yxatdan o'tdingiz. Tez orada sizga xabarlar yuboriladi.",
                    Markup.removeKeyboard(),
                );

                // Optional: Attempt to link with CRM employee
                this.linkWithEmployee(user);
            }
        });

        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id.toString();
            const user = await this.telegramUserRepo.findOne({ where: { telegramId: userId } });

            if (user && !user.phoneNumber && !user.tempFullName) {
                user.tempFullName = ctx.message.text;
                await this.telegramUserRepo.save(user);

                await ctx.reply(
                    "Ajoyib! Endi telefon raqamingizni tasdiqlash uchun quyidagi tugmani bosing:",
                    Markup.keyboard([
                        [Markup.button.contactRequest('📞 Telefon raqamni yuborish')]
                    ]).oneTime().resize(),
                );
            } else if (user && user.phoneNumber) {
                // Handle other text if needed, or just ignore
            }
        });
    }

    private async linkWithEmployee(telegramUser: TelegramUser) {
        if (!telegramUser.phoneNumber) return;

        const employee = await this.userRepo.findOne({ 
            where: { phoneNumber: telegramUser.phoneNumber } 
        });

        if (employee) {
            this.logger.log(`Linking Telegram user ${telegramUser.telegramId} with CRM employee ${employee.id}`);
            employee.telegramId = telegramUser.telegramId;
            await this.userRepo.save(employee);
        }
    }

    async findAll() {
        return this.telegramUserRepo.find({ order: { createdAt: 'DESC' } });
    }

    async sendMessage(telegramIds: string[], text: string) {
        for (const id of telegramIds) {
            try {
                await this.bot.telegram.sendMessage(id, text, { parse_mode: 'HTML' });
            } catch (err) {
                this.logger.error(`Failed to send message to ${id}: ${err.message}`);
            }
        }
    }

    async sendToEmployee(phoneNumber: string, text: string) {
        // First try to find by already linked telegramId in User repo
        const employee = await this.userRepo.findOne({ where: { phoneNumber: phoneNumber.replace('+', '') } });
        
        if (employee && employee.telegramId) {
            await this.sendMessage([employee.telegramId], text);
            return;
        }

        // Fallback to searching in TelegramUser repo
        const tUser = await this.telegramUserRepo.findOne({ where: { phoneNumber: phoneNumber.replace('+', '') } });
        if (tUser) {
            await this.sendMessage([tUser.telegramId], text);
        }
    }
}
