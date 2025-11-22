import { SocketManager } from './SocketManager';
import { useChannelsStore } from 'src/stores/channels';
import type { SerializedMessage } from 'src/contracts';
import type { BootParams } from './SocketManager';

export class ChannelSocketManager extends SocketManager {
  private subscribed = false;
  public isJoined = false;

  // VOLAJ TOTO PRI PRVOM JOIN!
  public join(params?: BootParams): this {
    if (params) {
      this.subscribe(); // zavolá subscribe s Quasar boot params
    } else {
      if (!this.subscribed) {
        console.warn('ChannelSocketManager join called without boot params!');
      }
    }

    this.socket.connect();
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
    // Add BEFORE  this.subscribed = true;
    this.socket.off('members:update');
    this.socket.on('members:update', ({ channelId, members }) => {
      console.log('LIVE MEMBERS UPDATE:', channelId, members);

      const store = useChannelsStore();
      const ch = store.channelsList.find((c) => c.id === channelId);

      if (ch) {
        ch.members = members; // <- reactive update 🔥
      }

      // Optional: If current /list view is visible, reactive rerender handles it automatically
    });

    this.socket.off('member:left');
    this.socket.on('member:left', (payload) => {
      console.log('MEMBER LEFT:', payload);

      const store = useChannelsStore();
      const ch = store.channelsList.find((c) => c.name === payload.channelName);

      if (ch) {
        ch.members = ch.members.filter((m) => m.id !== payload.userId);
      }
    });

    this.socket.off('channel:deleted');
    this.socket.on('channel:deleted', ({ channelId, channelName }) => {
      console.log('CHANNEL DELETED:', channelName);

      const store = useChannelsStore();
      const index = store.channelsList.findIndex((c) => c.id === channelId);

      if (index !== -1) {
        store.channelsList.splice(index, 1);

        // Ak bol aktívny tento kanál, prepni na prvý dostupný
        if (store.activeChannel?.id === channelId) {
          store.setActive(store.channelsList[0]?.name || '');
        }
      }
    });

    this.subscribed = true;
    console.log('Subscribed to events for:', this.namespace);
  }
  public async leaveChannel(): Promise<void> {
    if (!this.isJoined) return;

    console.log('Leaving channel:', this.namespace);

    await this.emitAsync('leaveChannel');
    this.isJoined = false;
    this.socket.disconnect(); // Voliteľné, ak chceš úplne odpojiť socket
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
