import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient, RedisClientType } from "redis";
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions } from "socket.io";

export class RedisIoAdapter extends IoAdapter {

    private adapterConstructor: ReturnType<typeof createAdapter>;
    private pubClient: RedisClientType;
    private subClient: RedisClientType;
    private readonly logger = new Logger(RedisIoAdapter.name);

    constructor(app: INestApplicationContext) {
        super(app);
    }

    async connectToRedis(configSvc: ConfigService) {
        const redisHost = configSvc.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configSvc.get<number>('REDIS_PORT', 6379);
        const redisUrl = `redis://${redisHost}:${redisPort}`;

        this.pubClient = createClient({ url: redisUrl }) as RedisClientType;
        this.subClient = this.pubClient.duplicate() as RedisClientType;

        await this.pubClient.connect();
        await this.subClient.connect();

        this.adapterConstructor = createAdapter(this.pubClient, this.subClient);

        this.logger.log(`Redis Socket Adapter connected to ${redisUrl}`);
    }

    createIOServer(port: number, options?: ServerOptions) {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: '*',
                credentials: true
            }
        });

        server.adapter(this.adapterConstructor);

        return server;
    }
}