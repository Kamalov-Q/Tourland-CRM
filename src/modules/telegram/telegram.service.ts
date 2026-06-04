import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telegraf, Context, Markup } from 'telegraf';
import { TelegramUser } from './entities/telegram-user.entity';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ToursService } from '../tours/tours.service';

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
        @InjectRepository(Client)
        private readonly clientRepo: Repository<Client>,
        @InjectRepository(Notification)
        private readonly notificationRepo: Repository<Notification>,
        private readonly toursService: ToursService,
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
        const mainMenu = {
            keyboard: [
                [{ text: '📁 Yangiliklar' }, { text: '📞 Biz bilan bog\'lanish' }],
                [{ text: '🔔 Yangi bildirishnomalar' }, { text: '💳 To\'lov qoldig\'i' }]
            ],
            resize_keyboard: true,
        };

        // ============================================
        // 1. /start command
        // ============================================
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

            if (user.phoneNumber) {
                await ctx.reply(
                    `✅ Siz allaqachon ro'yxatdan o'tgansiz!\n\n👤 ${user.tempFullName || `${user.firstName} ${user.lastName || ''}`.trim()}\n📞 +${user.phoneNumber}`,
                    { reply_markup: mainMenu }
                );
                return;
            }

            await ctx.reply(
                `👋 Assalomu alaykum, ${ctx.from.first_name || 'foydalanuvchi'}!\n\n` +
                `<b>Tourland</b> yordamchi botimizga xush kelibsiz! 😊\n\n` +
                `Ro'yxatdan o'tish uchun, iltimos, <b>Ism va Familiyangizni</b> kiriting (Masalan: Eshmat Toshmatov):`,
                { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
            );
        });

        // ============================================
        // 2. Contact sharing (registration step 2)
        // ============================================
        this.bot.on('contact', async (ctx) => {
            const contact = ctx.message.contact;
            const userId = ctx.from.id.toString();
            const user = await this.telegramUserRepo.findOne({ where: { telegramId: userId } });

            if (user) {
                user.phoneNumber = contact.phone_number.replace('+', '');
                await this.telegramUserRepo.save(user);

                await ctx.reply(
                    `✅ <b>Muvaffaqiyatli ro'yxatdan o'tdingiz!</b>\n\n` +
                    `👤 ${user.tempFullName || `${user.firstName} ${user.lastName || ''}`.trim()}\n` +
                    `📞 +${user.phoneNumber}\n\n` +
                    `Endi siz tizimdan to'liq foydalana olasiz!`,
                    { parse_mode: 'HTML', reply_markup: mainMenu },
                );

                this.linkWithEmployee(user);
            }
        });

        // ============================================
        // 3. ALL command + hears handlers BEFORE bot.on('text')
        //    (Telegraf processes handlers in registration order)
        // ============================================

        // /help
        this.bot.command('help', async (ctx) => {
            await ctx.reply(
                `<b>Mavjud buyruqlar:</b>\n\n` +
                `/start - Bosh menu\n` +
                `/news - Yangi turlar va paketlar\n` +
                `/history - Xabarlar tarixi\n` +
                `/notifications - Yangi bildirishnomalar\n` +
                `/payment - To'lov qoldig'i\n` +
                `/contact - Biz bilan bog'lanish\n` +
                `/help - Buyruqlar ro'yxati`,
                { parse_mode: 'HTML' }
            );
        });

        // /contact + keyboard button
        const contactHandler = async (ctx: Context) => {
            await ctx.reply(
                `<b>Biz bilan bog'lanish:</b>\n\n` +
                `📍 <b>Manzil:</b> Toshkent shahri\n` +
                `📞 <b>Telefon:</b> +998 93 100 40 27\n` +
                `🌐 <b>Sayt:</b> <a href="https://tourland.uz">tourland.uz</a>`,
                { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
            );
        };
        this.bot.command('contact', contactHandler);
        this.bot.hears('📞 Biz bilan bog\'lanish', contactHandler);

        // /news + keyboard button
        const newsHandler = async (ctx: Context) => {
            try {
                const tours = await this.toursService.findAll();
                if (!tours || tours.length === 0) {
                    await ctx.reply(`Hozircha yangi turlar mavjud emas.`);
                    return;
                }

                let message = `<b>🔥 So'nggi tur paketlar:</b>\n\n`;
                for (const tour of tours.slice(0, 5)) {
                    message += `📍 <b>${tour.nameUz}</b>\n`;
                    if (tour.link) message += `🔗 <a href="${tour.link}">Batafsil</a>\n`;
                    message += `-------------------\n`;
                }
                
                await ctx.reply(message, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
            } catch (err) {
                this.logger.error(`Failed to handle /news: ${err.message}`);
                await ctx.reply(`Xatolik yuz berdi. Iltimos, keyinroq urinib ko'ring.`);
            }
        };
        this.bot.command('news', newsHandler);
        this.bot.hears('📁 Yangiliklar', newsHandler);

        // /notifications + keyboard button
        const notificationsHandler = async (ctx: Context) => {
            if (!ctx.from) return;
            const userId = ctx.from.id.toString();
            try {
                const employee = await this.userRepo.findOne({ where: { telegramId: userId } });
                if (employee) {
                    const unread = await this.notificationRepo.find({
                        where: { userId: employee.id, isRead: false },
                        order: { createdAt: 'DESC' }
                    });
                    if (unread.length === 0) {
                        return ctx.reply(`Yangi bildirishnomalar mavjud emas.`);
                    }
                    let message = `<b>🔔 Yangi bildirishnomalar:</b>\n\n`;
                    unread.slice(0, 10).forEach(n => {
                        message += `📩 ${n.message}\n`;
                    });
                    await ctx.reply(message, { parse_mode: 'HTML' });
                } else {
                    const client = await this.clientRepo.findOne({ where: { telegramId: userId } });
                    if (client) {
                        if (client.saleStatus === 'partial' && client.nextPaymentAt) {
                            const date = client.nextPaymentAt.toLocaleDateString('uz-UZ');
                            await ctx.reply(`🔔 <b>Eslatma:</b> Sizning keyingi to'lovingiz: ${date} da kutilmoqda.`, { parse_mode: 'HTML' });
                        } else {
                            await ctx.reply(`Hozircha sizda yangi xabarlar yo'q.`);
                        }
                    } else {
                        await ctx.reply(`Ro'yxatdan to'liq o'tmagansiz.`);
                    }
                }
            } catch (err) {
                await ctx.reply(`Xatolik yuz berdi.`);
            }
        };
        this.bot.command('notifications', notificationsHandler);
        this.bot.hears('🔔 Yangi bildirishnomalar', notificationsHandler);

        // /payment + keyboard button
        const paymentHandler = async (ctx: Context) => {
            if (!ctx.from) return;
            const userId = ctx.from.id.toString();
            try {
                const client = await this.clientRepo.findOne({
                    where: { telegramId: userId },
                    relations: ['payments']
                });
                if (!client) {
                    return ctx.reply(`Sizning ma'lumotlaringiz tizimda mijoz sifatida topilmadi.`);
                }
                
                if (client.saleStatus === 'partial') {
                    const totalAmount = client.saleTotalAmount || 0;
                    const paid = (client.payments || []).reduce((sum, p) => sum + p.amount, 0);
                    const remaining = Math.max(0, totalAmount - paid);
                    const dateInfo = client.nextPaymentAt ? `\n\n📅 <b>Keyingi to'lov:</b> ${client.nextPaymentAt.toLocaleDateString('uz-UZ')}` : '';

                    let msg = `<b>💳 To'lov qoldig'ingiz:</b>\n\n` +
                              `📊 <b>Umumiy summa:</b> ${totalAmount.toLocaleString('uz-UZ')} so'm\n` +
                              `✅ <b>To'langan:</b> ${paid.toLocaleString('uz-UZ')} so'm\n` +
                              `❌ <b>Qarz:</b> ${remaining.toLocaleString('uz-UZ')} so'm` + dateInfo;
                    await ctx.reply(msg, { parse_mode: 'HTML' });
                } else if (client.saleStatus === 'full') {
                    await ctx.reply(`Sizda to'lanmagan qarz mavjud emas. To'lovingiz to'liq! 😊`);
                } else {
                    await ctx.reply(`Sizning faol buyurtmangiz topilmadi.`);
                }
            } catch (err) {
                await ctx.reply(`Xatolik yuz berdi.`);
            }
        };
        this.bot.command('payment', paymentHandler);
        this.bot.hears('💳 To\'lov qoldig\'i', paymentHandler);

        // /history
        this.bot.command('history', async (ctx) => {
            const userId = ctx.from.id.toString();
            const tUser = await this.telegramUserRepo.findOne({ where: { telegramId: userId } });

            if (!tUser || !tUser.phoneNumber) {
                await ctx.reply(`⚠️ Xabarlar tarixini ko'rish uchun avval ro'yxatdan o'ting: /start`);
                return;
            }

            try {
                const employee = await this.userRepo.findOne({ where: { telegramId: userId } });
                
                if (employee) {
                    const notifications = await this.notificationRepo.find({
                        where: { userId: employee.id },
                        order: { createdAt: 'DESC' },
                        take: 10
                    });

                    if (notifications.length === 0) {
                        await ctx.reply(`Sizda xabarlar mavjud emas.`);
                        return;
                    }

                    let message = `<b>🔔 Oxirgi xabarlaringiz:</b>\n\n`;
                    for (const n of notifications) {
                        const date = n.createdAt.toLocaleDateString('uz-UZ');
                        message += `📅 ${date}\n📩 ${n.message}\n\n`;
                    }
                    await ctx.reply(message, { parse_mode: 'HTML' });
                } else {
                    await ctx.reply(`Sizning xabarlar tarixingiz hozircha bo'sh.`);
                }
            } catch (err) {
                this.logger.error(`Failed to handle /history: ${err.message}`);
                await ctx.reply(`Xatolik yuz berdi.`);
            }
        });

        // ============================================
        // 4. Generic text handler — MUST be LAST
        //    Only handles registration flow (name input)
        // ============================================
        this.bot.on('text', async (ctx) => {
            const userId = ctx.from.id.toString();
            const user = await this.telegramUserRepo.findOne({ where: { telegramId: userId } });
            const text = ctx.message.text;

            // Only handle registration flow — user hasn't finished registering yet
            if (user && !user.tempFullName && text && !text.startsWith('/')) {
                user.tempFullName = text.trim();
                await this.telegramUserRepo.save(user);

                await ctx.reply(
                    `Rahmat, <b>${user.tempFullName}</b>! 😊\n\n` +
                    `Endi oxirgi qadam: pastdagi tugmani bosib <b>telefon raqamingizni</b> yuboring.\n\n` +
                    `⚠️ <b>DIQQAT:</b> Tizimda sizni aniqlashimiz uchun aynan o'zingiz foydalanayotgan raqamni yuborishingiz shart.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]],
                            one_time_keyboard: true,
                            resize_keyboard: true,
                        },
                    }
                );
            } else if (user && user.tempFullName && !user.phoneNumber) {
                await ctx.reply(
                    `⚠️ <b>${user.tempFullName}</b>, iltimos, pastdagi tugma orqali telefon raqamingizni yuboring:`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]],
                            one_time_keyboard: true,
                            resize_keyboard: true,
                        },
                    }
                );
            }
            // If user is fully registered, do nothing — let the keyboard buttons handle it
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
        const employee = await this.userRepo.findOne({ where: { phoneNumber: phoneNumber.replace('+', '') } });
        
        if (employee && employee.telegramId) {
            await this.sendMessage([employee.telegramId], text);
            return;
        }

        const tUser = await this.telegramUserRepo.findOne({ where: { phoneNumber: phoneNumber.replace('+', '') } });
        if (tUser) {
            await this.sendMessage([tUser.telegramId], text);
        }
    }

    async sendClientMessage(clientId: string, telegramId: string, text: string) {
        await this.sendMessage([telegramId], text);

        const client = await this.clientRepo.findOne({ where: { id: clientId } });
        if (client) {
            client.telegramId = telegramId;
            await this.clientRepo.save(client);
        }
    }
}
