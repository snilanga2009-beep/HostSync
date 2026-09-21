import { Response } from 'express';

interface Client {
  id: string;
  role?: string;
  userId?: string;
  roomToken?: string;
  trackingToken?: string;
  res: Response;
}

class SSEService {
  private clients: Client[] = [];

  addClient(client: Client) {
    this.clients.push(client);

    // Keep connection alive with heartbeat every 30 seconds
    const intervalId = setInterval(() => {
      try {
        client.res.write(': heartbeat\n\n');
      } catch (err) {
        clearInterval(intervalId);
      }
    }, 30000);

    client.res.on('close', () => {
      clearInterval(intervalId);
      this.removeClient(client.id);
    });
  }

  removeClient(clientId: string) {
    this.clients = this.clients.filter(c => c.id !== clientId);
  }

  /**
   * Broadcast an event to specific roles, users, or all
   */
  broadcast(event: string, data: any, filter?: { role?: string; userId?: string; trackingToken?: string }) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    this.clients.forEach(client => {
      let shouldSend = true;

      if (filter?.role && client.role !== filter.role && client.role !== 'Super Admin' && client.role !== 'Hotel Admin') {
        shouldSend = false;
      }
      if (filter?.userId && client.userId !== filter.userId) {
        shouldSend = false;
      }
      if (filter?.trackingToken && client.trackingToken !== filter.trackingToken) {
        shouldSend = false;
      }

      if (shouldSend) {
        try {
          client.res.write(payload);
        } catch (e) {
          // Handled on close
        }
      }
    });
  }

  broadcastToRole(role: string, event: string, data: any) {
    this.broadcast(event, data, { role });
  }

  broadcastToUser(userId: string, event: string, data: any) {
    this.broadcast(event, data, { userId });
  }

  broadcastToTrackingToken(trackingToken: string, event: string, data: any) {
    this.broadcast(event, data, { trackingToken });
  }
}

export const sseService = new SSEService();
