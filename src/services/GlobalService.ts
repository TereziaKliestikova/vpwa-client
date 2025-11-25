// src/services/GlobalSocketService.ts
import { SocketManager } from './SocketManager';
import { useChannelsStore } from 'src/stores/channels';
import type { Invitation, InvitationWithUserId } from 'src/types/invitation';
import { useAuthStore } from 'src/stores/auth';

class GlobalSocketService extends SocketManager {
  private subscribed = false;
  private invitations: Invitation[] = [];

  constructor() {
    super('/'); // Root namespace
  }

  public boot(): this {
    this.subscribe();
    this.socket.connect();
    return this;
  }

  public subscribe(): void {
    if (this.subscribed) {
      console.log('Already subscribed to global socket');
      return;
    }
    this.socket.on('connect', () => {
      console.log('Global socket CONNECTED');
    });

    this.socket.on('connect_error', (err) => {
      console.error('Global socket CONNECT ERROR:', err);
    });

    // Listen for invitations
    this.socket.on('invitation:received', (data: InvitationWithUserId) => {
      const authStore = useAuthStore();
      if (!authStore.user) {
        console.warn('Invitation received but user not logged in yet');
        return;
      }

      if (data.userId !== authStore.user?.id) return;

      const { ...invitation } = data;
      this.invitations.push(invitation);

      window.dispatchEvent(new CustomEvent('invitation:received', { detail: invitation }));
    });

    // Listen for user removed event
    this.socket.on(
      'user:removed',
      (data: { userId: number; channelId: number; channelName: string; removedBy: string }) => {
        const authStore = useAuthStore();

        if (data.userId === authStore.user?.id) {
          window.dispatchEvent(new CustomEvent('user:removed', { detail: data }));
        }
      },
    );

    this.subscribed = true;
    console.log('Subscribed to global socket');
  }

  public async getInvitations(): Promise<Invitation[]> {
    return this.emitAsync<Invitation[]>('getInvitations');
  }

  public removeInvitation(id: number): void {
    this.invitations = this.invitations.filter((inv) => inv.id !== id);
  }

  public async loadInitialInvitations(): Promise<Invitation[]> {
    try {
      // Load from any channel socket (they all share the same backend)
      const channelStore = useChannelsStore();
      if (channelStore.channelsList.length > 0) {
        const firstChannel = channelStore.channelsList[0];
        const channelService = (await import('./ChannelService')).default;
        const socket = channelService.in(firstChannel.name);

        if (socket) {
          this.invitations = await socket.getInvitations();
          return this.invitations;
        }
      }
      return [];
    } catch (err) {
      console.error('Failed to load invitations:', err);
      return [];
    }
  }
}

export default new GlobalSocketService();
