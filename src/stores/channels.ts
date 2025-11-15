// src/stores/channels.ts
//toto este nikde nevyuzivame ale povedal mi to claude
import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

interface Member {
  id: number;
  name: string;
  avatar: string;
  isAdmin: boolean;
}

interface Message {
  id: number;
  user: string;
  text: string;
}

interface Channel {
  id: number;
  name: string;
  type: 'public' | 'private';
  members: Member[];
  messages?: Message[];
  isAdmin: boolean;
}

export const useChannelsStore = defineStore('channels', {
  state: () => ({
    channels: [] as Channel[],
    activeChannel: null as Channel | null,
    loading: false,
  }),

  getters: {
    getChannelById: (state) => (id: number) => {
      return state.channels.find((ch) => ch.id === id);
    },

    channelMembers: (state) => {
      return state.activeChannel?.members || [];
    },

    publicChannels: (state) => {
      return state.channels.filter((ch) => ch.type === 'public');
    },

    privateChannels: (state) => {
      return state.channels.filter((ch) => ch.type === 'private');
    },
  },

  actions: {
    async fetchChannels() {
      this.loading = true;
      try {
        const response = await api.get('/api/channels');
        this.channels = response.data;

        // Set first channel as active if none selected
        if (!this.activeChannel && this.channels.length > 0) {
          this.activeChannel = this.channels[0];
        }
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      } finally {
        this.loading = false;
      }
    },

    setActiveChannel(channel: Channel | null) {
      this.activeChannel = channel;
    },

    async createChannel(name: string, type: 'public' | 'private', memberIds: number[]) {
      try {
        const response = await api.post('/api/channels', {
          name,
          type,
          memberIds,
        });
        this.channels.unshift(response.data);
        this.activeChannel = response.data;
      } catch (error) {
        console.error('Failed to create channel:', error);
        throw error;
      }
    },

    async leaveChannel(channelId: number) {
      try {
        await api.post(`/api/channels/${channelId}/leave`);
        this.channels = this.channels.filter((ch) => ch.id !== channelId);
        if (this.activeChannel?.id === channelId) {
          this.activeChannel = null;
        }
      } catch (error) {
        console.error('Failed to leave channel:', error);
        throw error;
      }
    },

    async deleteChannel(channelId: number) {
      try {
        await api.delete(`/api/channels/${channelId}`);
        this.channels = this.channels.filter((ch) => ch.id !== channelId);
        if (this.activeChannel?.id === channelId) {
          this.activeChannel = null;
        }
      } catch (error) {
        console.error('Failed to delete channel:', error);
        throw error;
      }
    },
  },
});
