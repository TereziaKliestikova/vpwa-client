import { defineStore } from 'pinia';
import type { SerializedMessage } from 'src/contracts';
import channelService from 'src/services/ChannelService';
import type { DisplayMessage } from 'src/types/message';
import { useAuthStore } from 'src/stores/auth';
import { api } from 'src/boot/axios';

interface Member {
  id: number;
  name: string;
  avatar: string;
  isAdmin: boolean;
}

interface ChannelData {
  id: number;
  name: string;
  type: 'public' | 'private';
  members: Member[];
  isAdmin: boolean;
}

export const useChannelsStore = defineStore('channels', {
  state: () => ({
    loading: false,
    error: null as Error | null,
    messages: {} as Record<string, DisplayMessage[]>,
    active: null as string | null,
    channelsList: [] as ChannelData[],
  }),

  getters: {
    joinedChannels(state) {
      return Object.keys(state.messages);
    },
    currentMessages(state) {
      return state.active !== null ? state.messages[state.active] : [];
    },
    lastMessageOf: (state) => (channel: string) => {
      const msgs = state.messages[channel];
      return msgs?.length ? msgs[msgs.length - 1] : null;
    },
    activeChannel(state) {
      if (!state.active) return null;
      return state.channelsList.find((ch) => ch.name === state.active) || null;
    },
    activeChannelMembers(state) {
      const channel = state.channelsList.find((ch) => ch.name === state.active);
      return channel?.members || [];
    },
  },

  actions: {
    // Pripojenie k channel a načítanie histórie
    async join(channel: string) {
      try {
        this.loading = true;
        this.error = null;

        const socket = channelService.join(channel);
        const messages = await socket.loadMessages();

        this.messages[channel] = messages.map((m) => ({
          id: m.id,
          user: m.author.nickname || m.author.email.split('@')[0],
          text: m.content,
        }));
        this.active = channel;
      } catch (err) {
        this.error = err as Error;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchChannels() {
      try {
        this.loading = true;
        const response = await api.get('/api/channels');
        this.channelsList = response.data;

        // Set first channel as active if none selected
        if (!this.active && this.channelsList.length > 0) {
          this.active = this.channelsList[0].name;
        }
      } catch (err) {
        this.error = err as Error;
        console.error('Failed to fetch channels:', err);
      } finally {
        this.loading = false;
      }
    },

    // Odpojenie z channel
    leave(channel: string | null) {
      const leaving = channel ? [channel] : this.joinedChannels;

      leaving.forEach((c) => {
        channelService.leave(c); // sync, žiadne await
        delete this.messages[c];
        if (this.active === c) this.active = null;
      });
    },

    // Odoslanie správy
    async addMessage(channel: string, text: string) {
      const socket = channelService.in(channel);
      if (!socket) return;

      const newMessage = await socket.addMessage(text);

      if (!this.messages[channel]) this.messages[channel] = [];

      this.messages[channel].push({
        id: newMessage.id,
        user: newMessage.author.nickname || newMessage.author.email.split('@')[0],
        text: newMessage.content,
      });
    },

    // prijatie spravy zo socketu (real-time)
    newMessage(channel: string, message: SerializedMessage) {
      if (!this.messages[channel]) {
        this.messages[channel] = [];
      }

      // zabran duplikatom podla id
      const exists = this.messages[channel].some((m) => m.id === message.id);
      if (exists) {
        console.log('DUPLICATE IGNORED:', message.id, message.content);
        return;
      }
      // mention detekcia
      const authStore = useAuthStore();
      const myNickname = authStore.user?.nickname || authStore.user?.email.split('@')[0];

      const mentionRegex = new RegExp(`@(${myNickname})\\b`, 'i'); // case-insensitive
      const isMentioned = mentionRegex.test(message.content);

      const user = message.author.nickname;

      this.messages[channel].push({
        id: message.id,
        user,
        text: message.content,
        isMentioned,
      } as DisplayMessage);
    },

    setActive(channel: string) {
      this.active = channel;
    },
  },
});
