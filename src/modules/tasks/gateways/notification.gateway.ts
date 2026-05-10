import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
@WebSocketGateway({
    cors: true
})
export class NotificationGateway implements OnGatewayConnection {
    @WebSocketServer()
    server: Server;

    handleConnection(client: Socket) {
        const isActive = client.handshake.query.isActive === 'true';

        if (!isActive) {
            client.disconnect();
            return;
        }

        const userId = client.handshake.query.userId as string;
        if (userId) {
            client.join(userId);
        }
    }

    emitTaskCreated(
        userId: string,
        payload: any
    ) {
        this.server.to(userId).emit('taskCreated', payload);
    }

    emitTaskStatusChanged(
        userId: string,
        payload: any
    ) {
        this.server.to(userId).emit('taskStatusChanged', payload);
    }

    emitTaskVerified(
        userId: string,
        payload: any
    ) {
        this.server.to(userId).emit('taskVerified', payload);
    }

    emitTaskIncomplete(
        userId: string,
        payload: any
    ) {
        this.server.to(userId).emit('taskIncomplete', payload);
    }

}