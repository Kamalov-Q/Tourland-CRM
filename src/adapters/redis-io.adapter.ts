import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient, RedisClientType } from "redis";
import { INestApplicationContext } from '@nestjs/common';
import { ServerOptions } from "socket.io";

export class RedisIoAdapter extends IoAdapter {

    private adapterConstructor: ReturnType<typeof createAdapter>;

    private pubClient: RedisClientType;

    private subClient: RedisClientType;

    constructor(
        app: INestApplicationContext
    ) {
        super(app);
    }

    async connectToRedis() {

        //publisher
        this.pubClient = createClient({
            url: 'redis://localhost:6379'
        });

        //subscriber 
        this.subClient = this.pubClient.duplicate();

        //connect
        await this.pubClient.connect();

        await this.subClient.connect();

        //socket adapter
        this.adapterConstructor = createAdapter(this.pubClient, this.subClient);

        console.log(`Redis Socket Adapter connected`);
    }

    createIOServer(port: number, options?: ServerOptions) {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: '*',
                credentials: true
            }
        });

        // using redis adapter
        server.adapter(
            this.adapterConstructor,
        );

        return server;
    }


}