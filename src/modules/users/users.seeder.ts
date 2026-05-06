import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User, UserRole } from "./entities/user.entity";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersSeeder implements OnModuleInit {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly config: ConfigService
    ) { }

    async onModuleInit() {
        const phoneNumber = '998931004027';

        const exists = await this.userRepo.findOne({
            where: { phoneNumber }
        });

        if (exists) return;

        const director = this.userRepo.create({
            firstName: 'Main',
            lastName: 'Director',
            phoneNumber,
            role: UserRole.DIRECTOR,
            parentId: null,
            password: await bcrypt.hash('director123', 10)
        });

        await this.userRepo.save(director);

    }


}