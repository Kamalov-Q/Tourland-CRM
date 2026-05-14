import { Logger } from '@nestjs/common';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
    cors: true
})
export class NotificationGateway implements OnGatewayConnection {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationGateway.name);

    constructor(private readonly jwtService: JwtService) {}

    handleConnection(client: Socket) {
        try {
            // Verify JWT token from handshake auth or query
            const token =
                (client.handshake.auth?.token as string) ||
                (client.handshake.query?.token as string);

            if (!token) {
                this.logger.warn(`WS: No token provided, disconnecting ${client.id}`);
                client.disconnect();
                return;
            }

            const payload = this.jwtService.verify(token);
            const userId = payload.sub as string;

            if (!userId) {
                client.disconnect();
                return;
            }

            // Join user-specific room
            client.join(userId);
            client.data.userId = userId;

            this.logger.debug(`WS: User ${userId} connected (${client.id})`);
        } catch (err) {
            this.logger.warn(`WS: Invalid token, disconnecting ${client.id}: ${err.message}`);
            client.disconnect();
        }
    }

    emitTaskCreated(userId: string, payload: any) {
        this.server.to(userId).emit('taskCreated', payload);
    }

    emitTaskStatusChanged(userId: string, payload: any) {
        this.server.to(userId).emit('taskStatusChanged', payload);
    }

    emitTaskVerified(userId: string, payload: any) {
        this.server.to(userId).emit('taskVerified', payload);
    }

    emitTaskIncomplete(userId: string, payload: any) {
        this.server.to(userId).emit('taskIncomplete', payload);
    }
}