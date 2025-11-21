import { SocketManager } from './SocketManager';
import { useChannelsStore } from 'src/stores/channels';
import type { SerializedMessage } from 'src/contracts';

export class ChannelSocketManager extends SocketManager {
  private subscribed = false;
  public isJoined = false;

  // VOLAJ TOTO PRI PRVOM JOIN!
  public join(): this {
    this.socket.connect();
    this.subscribe(); // ← len raz!
    return this;
  }

  public subscribe(): void {
    if (this.subscribed) {
      console.log('Already subscribed to:', this.namespace);
      return;
    }

    const channelStore = useChannelsStore();
    const channel = this.namespace.split('/').pop() as string;

    this.socket.on('connect', () => {
      console.log('Socket CONNECTED:', this.namespace);
    });

    this.socket.on('connect_error', (err) => {
      console.error('CONNECT ERROR:', err.message, err);
    });

    this.socket.onAny((event, ...args) => {
      console.log(`[SOCKET] ${this.namespace} [${event}]`, args);
    });

    // ZABRAŇ DUPLIKÁCII!
    this.socket.off('message');
    this.socket.on('message', (msg: SerializedMessage) => {
      console.log('Received message:', msg);
      channelStore.newMessage(channel, msg);
    });

    this.subscribed = true;
    console.log('Subscribed to events for:', this.namespace);
  }

  public async joinChannel(): Promise<unknown> {
    if (this.isJoined) {
      console.log('Already joined channel:', this.namespace);
      return { success: true }; // ← vráť niečo, aby sa nezaseklo
    }

    console.log('Sending joinChannel to:', this.namespace);
    const result = await this.emitAsync('joinChannel');
    this.isJoined = true; // ← označ, že si už v kanáli
    return result;
  }

  public async loadMessages(): Promise<SerializedMessage[]> {
    console.log('Loading messages from:', this.namespace);
    return this.emitAsync('loadMessages');
  }

  public async addMessage(content: string): Promise<SerializedMessage> {
    console.log('Sending addMessage:', content);
    return this.emitAsync('addMessage', content);
  }
}

class ChannelService {
  private channels: Map<string, ChannelSocketManager> = new Map();

  // Normalizácia len na vyhľadávanie v mape
  private normalize(name: string): string {
    return name.trim().toLowerCase();
  }

  public join(name: string): ChannelSocketManager {
    const normalized = this.normalize(name);

    // Ak už existuje (napr. "general" alebo "General"), vráť ho
    if (this.channels.has(normalized)) {
      const socket = this.channels.get(normalized)!;
      socket.join(); // ← už je subscribed, nič sa nestane
      return socket;
    }

    // Použi PÔVODNÝ názov do namespace (case-sensitive!)
    const socket = new ChannelSocketManager(`/channels/${name}`);
    this.channels.set(normalized, socket);
    return socket;
  }

  public in(name: string): ChannelSocketManager | undefined {
    return this.channels.get(this.normalize(name));
  }

  public leave(name: string): boolean {
    const normalized = this.normalize(name);
    const socket = this.channels.get(normalized);
    if (!socket) return false;
    socket.destroy();
    return this.channels.delete(normalized);
  }
}

export default new ChannelService();
