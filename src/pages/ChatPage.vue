<template>
  <q-page class="row no-wrap bg-secondary">
    <!-- Sidebar na lavo -->
    <div class="column items-center bg-secondary q-pa-md" :style="{ width: sidebarWidth }">
      <q-btn
        flat
        round
        icon="groups"
        :color="showChannels ? 'black' : 'primary'"
        :size="iconSize"
        class="q-mb-md"
        title="Channels"
        @click="toggleChannels"
      />
      <!-- Invitations -->
      <div class="relative-position q-mb-md">
        <q-btn
          flat
          round
          icon="mail"
          color="primary"
          :size="iconSize"
          title="Invitations"
          @click="openInvitations"
        />
        <q-badge v-if="invitationCount > 0" color="red" floating transparent>{{
          invitationCount
        }}</q-badge>
      </div>
    </div>

    <!-- Hlavna cast chatu -->
    <div class="column col bg-white">
      <div class="notification-positioner">
        <ChatNotification
          v-if="showChatNotification"
          :sender-name="notificationData.senderName"
          :sender-avatar="notificationData.senderAvatar"
          :message="notificationData.message"
          :duration="4000"
          @close="handleNotificationClose"
        />
      </div>
      <!-- hlavna chatova cast -->
      <div class="row col">
        <!-- pouzijeme nas komponenet ChannelListSide -->
        <ChannelListSide
          :show-channels="showChannels"
          :is-small-screen="isSmallScreen"
          :channels="filteredChannels"
          :active-channel="activeChannel"
          @update:show-channels="showChannels = $event"
          @update:channel-filter="channelFilter = $event"
          @select-channel="selectChannel"
          @open-create-channel-dialog="showCreateChannelDialog = true"
        />
        <!-- chatting -->
        <div class="column relative-position" style="flex: 1">
          <!-- obsah chatu -->
          <div v-if="activeChannel" class="column" style="flex: 1; overflow: hidden">
            <div class="q-pa-md row items-center justify-between">
              <div class="text-h6">
                {{ activeChannel?.name }}
              </div>
              <!-- menu: only if channel -->
              <div v-if="activeChannel">
                <q-btn flat round dense icon="more_vert">
                  <q-menu>
                    <q-list style="min-width: 150px">
                      <q-item clickable v-close-popup @click="showAddPeopleDialog = true">
                        <q-item-section>Add people</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup @click="showRemovePeopleDialog = true">
                        <q-item-section>Remove people</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup @click="leaveChannel">
                        <q-item-section>Leave channel</q-item-section>
                      </q-item>
                      <q-item clickable v-close-popup @click="showMembersDialog = true">
                        <q-item-section>Members</q-item-section>
                      </q-item>
                      <q-item
                        clickable
                        v-close-popup
                        v-if="activeChannel?.isAdmin"
                        @click="deleteChannel"
                      >
                        <q-item-section class="text-negative">Delete channel</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
            </div>
            <q-separator />
            <!-- messages -->
            <q-scroll-area
              ref="chatScrollArea"
              class="q-pl-md q-pr-md"
              style="flex: 1; display: flex; flex-direction: column"
            >
              <q-infinite-scroll @load="onLoadMore" :offset="250" reverse :disable="noMoreMessages">
                <div v-if="isLoadingMore" class="flex justify-center q-my-sm">
                  <q-spinner size="24px" color="primary" />
                </div>
                <div v-for="msg in visibleMessages" :key="msg.id" class="q-mb-sm">
                  <!-- nasa sprava je napravo a zlta -->
                  <div v-if="isMyMessage(msg)" class="row justify-end">
                    <div class="my-message q-pa-sm rounded-borders">
                      {{ msg.text }}
                    </div>
                  </div>

                  <!-- CUDZIA SPRÁVA → NA ĽAVO -->
                  <div v-else class="row justify-start items-end q-gutter-sm">
                    <div class="relative-position">
                      <ProfilePicture
                        :avatar="getUserByName(msg.user).avatar"
                        size="40px"
                        bgColor="grey-3"
                        class="q-mr-sm"
                      />
                      <div
                        class="status-indicator q-ml-sm"
                        :class="`status-${getUserByName(msg.user).status}`"
                      ></div>
                    </div>
                    <div class="column items-start">
                      <div class="text-caption text-grey-6 q-mb-xs">
                        {{ msg.user }}
                      </div>

                      <div
                        class="q-pa-sm rounded-borders transition-all"
                        :class="[
                          'other-message',
                          {
                            'mention-highlight': msg.isMentioned,
                            'mention-pulse': msg.isMentioned,
                          },
                        ]"
                      >
                        {{ msg.text }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Milan nam pise -->
                <div
                  v-if="activeChannel?.name === 'UniLife'"
                  class="typing-message row justify-start items-end q-gutter-sm text-grey-7"
                >
                  <ProfilePicture
                    :avatar="getUserByName('Milan').avatar"
                    size="40px"
                    bgColor="grey-3"
                  />
                  <div class="column items-start">
                    <!-- meno nad správou -->
                    <div class="message-username text-caption text-grey-6 q-mb-xs">
                      Milan is typing ...
                    </div>

                    <!-- text správy -->
                    <div class="bg-grey-2 q-pa-sm rounded-borders">
                      Caute prosim kde najdem github r|
                    </div>
                  </div>
                </div>
              </q-infinite-scroll>
            </q-scroll-area>
          </div>
          <!-- ak nie je vybrate nic -->
          <div v-else class="flex flex-center col text-grey" style="flex: 1; text-align: center">
            <div>Select a channel or friend to start chatting</div>
          </div>
          <!-- fixny riadok na pisanie -->
          <div
            class="column bg-grey-2"
            style="position: sticky; bottom: 0; border-top: 1px solid #444"
          >
            <div
              ref="alertBox"
              class="system-message"
              style="
                height: 25px;
                padding: 6px 12px;
                font-family: monospace;
                font-size: 14px;
                color: #222;
              "
            >
              {{ systemMessage }}
            </div>
            <!-- command line -->
            <div class="row q-pa-sm bg-grey-2" style="position: sticky; bottom: 0">
              <q-input
                ref="cliInput"
                v-model="newMessage"
                placeholder="Enter a message or command"
                input-class="command-input"
                outlined
                dense
                class="col"
                @keyup.enter="sendMessage"
              />
              <q-btn color="primary" label="Send" class="q-ml-sm" @click="sendMessage" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- dialogy -->
    <!-- <q-dialog v-model="showAddFriendDialog">
      <q-card style="min-width: 300px;">
        <q-card-section>
          <div class="text-h6">Add new friend</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newFriendName"
            label="Friend name"
            outlined
            dense
            autofocus
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Add" color="primary" @click="addFriend" />
        </q-card-actions>
      </q-card>
    </q-dialog> -->

    <q-dialog v-model="showInvitationsDialog">
      <q-card style="min-width: 350px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Invitations</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-list bordered separator>
          <q-item v-for="invite in invitations" :key="invite.id">
            <q-item-section> {{ invite.from }} invited you to {{ invite.channel }} </q-item-section>
            <q-item-section side>
              <q-btn dense flat color="primary" label="Accept" @click="acceptInvite(invite.id)" />
              <q-btn dense flat color="black" label="Decline" @click="declineInvite(invite.id)" />
            </q-item-section>
          </q-item>

          <q-item v-if="invitations.length === 0">
            <q-item-section>No invitations yet</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <!-- create channel -->
    <q-dialog v-model="showCreateChannelDialog">
      <q-card style="width: 400px">
        <q-card-section>
          <div class="text-h6">Create Channel</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newChannelName"
            label="Channel name"
            outlined
            dense
            maxlength="20"
            autofocus
          />

          <div class="relative-position q-mt-md">
            <q-select
              v-model="selectedNicknames"
              multiple
              use-input
              use-chips
              input-debounce="0"
              new-value-mode="add-unique"
              label="Invite people (type nicknames)"
              outlined
              dense
              class="q-mt-md"
              hint="Press Enter after each nickname"
              @new-value="validateNickname"
            />
            <div v-if="invalidNicknamesError" class="text-negative text-caption q-mt-xs q-pl-sm">
              {{ invalidNicknamesError }}
            </div>
          </div>

          <q-select
            v-model="newChannelType"
            :options="[
              { label: 'Public', value: 'public' },
              { label: 'Private', value: 'private' },
            ]"
            label="Channel type"
            outlined
            dense
            class="q-mt-md"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Create" color="primary" @click="createChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- pridaj/delete ludi z kanalov -->
    <q-dialog v-model="showAddPeopleDialog">
      <q-card style="min-width: 400px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Add people to {{ activeChannel?.name }}</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="selectedNicknames"
            multiple
            :options="users.map((f) => ({ label: f.name, value: f.id }))"
            label="Select friends to add"
            outlined
            dense
            use-chips
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Add" color="primary" @click="addPeopleToChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showRemovePeopleDialog">
      <q-card style="min-width: 400px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Remove people from {{ activeChannel?.name }}</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="selectedNicknames"
            multiple
            :options="getChannelMembers()"
            label="Select members to remove"
            outlined
            dense
            use-chips
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Remove" color="primary" @click="removePeopleFromChannel" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog pre nastavenie statusu usera -->
    <q-dialog v-model="showStatusDialog">
      <q-card style="min-width: 300px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Set your status</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section>
          <q-select
            v-model="userStatus"
            :options="statusOptions"
            option-value="value"
            option-label="label"
            label="Status"
            outlined
            dense
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="black" v-close-popup />
          <q-btn flat label="Save" color="primary" @click="saveUserStatus" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog pre zoznam členov kanála -->
    <q-dialog v-model="showMembersDialog">
      <q-card style="min-width: 300px">
        <q-card-section class="row justify-between items-center">
          <div class="text-h6">Members of {{ activeChannel?.name }}</div>
          <q-btn flat icon="close" v-close-popup></q-btn>
        </q-card-section>

        <q-card-section style="max-height: 300px; overflow-y: auto">
          <!-- toto je scrolling -->
          <q-list bordered separator>
            <q-item v-for="member in channelMembers" :key="member.id">
              <q-item-section>
                <div class="row items-center">
                  <div class="relative-position">
                    <ProfilePicture
                      :avatar="member.avatar"
                      size="40px"
                      bgColor="grey-3"
                      class="q-mr-sm"
                    />
                    <div class="status-indicator q-ml-sm" :class="`status-${member.status}`"></div>
                  </div>
                  <span>{{ member.name }}</span>
                </div>
              </q-item-section>
            </q-item>

            <q-item v-if="!channelMembers.length">
              <q-item-section>No members in this channel</q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="black" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import { useQuasar } from 'quasar';
import ProfilePicture from '../components/ProfilePicture.vue';
import ChatNotification from '../components/ChatNotification.vue';
import ChannelListSide from '../components/ChannelListSide.vue';
import type { QScrollArea } from 'quasar';
import type { Channel } from 'src/types/channel';
import channelService from 'src/services/ChannelService';

// backend
import { api } from 'src/boot/axios';
import { useChannelsStore } from 'src/stores/channels';

type UserStatus = 'online' | 'dnd' | 'offline';

interface User {
  id: number;
  name: string;
  avatar: string;
  status: UserStatus;
  messages?: Message[];
}

interface Message {
  id: number;
  user: string;
  text: string;
}

interface Invitation {
  id: number;
  from: string;
  channel: string;
}

const channelMembers = computed(() => {
  return channelsStore.activeChannelMembers.map((m) => ({
    id: m.id,
    name: m.name,
    avatar: m.avatar,
    status: 'online' as UserStatus, // TODO: Add real status
  }));
});

// Quasar breakpoint
const $q = useQuasar();
const isSmallScreen = computed(() => $q.screen.width < 700);

// responzivny lavy sidebar width
const sidebarWidth = computed(() => {
  if ($q.screen.xl) return '120px';
  if ($q.screen.lg) return '100px';
  if ($q.screen.md) return '80px';
  if ($q.screen.sm) return '80px';
  return '60px';
});

// responzivna velkost ikon sidebar quasar velkosti
const iconSize = computed(() => {
  if ($q.screen.xl) return 'xl';
  if ($q.screen.lg) return 'lg';
  if ($q.screen.md) return 'md';
  if ($q.screen.sm) return 'md';
  return 'sm';
});

// Status options
const statusOptions = [
  { label: 'Online', value: 'online' as const },
  { label: 'Do Not Disturb', value: 'dnd' as const },
  { label: 'Offline', value: 'offline' as const },
];

// Aktuálny stav používateľa
const userStatus = ref<UserStatus>('online');

// zobrazenie channel a friends listu
const showChannels = ref(true);
const showFriends = ref(false);
const channels = computed(() => channelsStore.channelsList);
const activeChannel = computed(() => channelsStore.activeChannel);
const channelFilter = ref<'all' | 'public' | 'private'>('all');

const toggleChannels = () => {
  showChannels.value = !showChannels.value;
  if (showChannels.value) showFriends.value = false;
};

const users = ref<User[]>([
  {
    id: 1,
    name: 'Milan',
    avatar: 'https://cdn.quasar.dev/img/avatar1.jpg',
    status: 'online',
    messages: [],
  },
  {
    id: 2,
    name: 'Katka',
    avatar: 'https://cdn.quasar.dev/img/avatar2.jpg',
    status: 'offline',
    messages: [
      { id: 1, user: 'Katka', text: 'Ahoj' },
      { id: 2, user: 'Katka', text: 'Nevieš kedy máme odovzdať VPWA?' },
      { id: 3, user: 'Katka', text: 'Neviem či stíham' },
    ],
  },
  {
    id: 3,
    name: 'Kubo',
    avatar: 'https://cdn.quasar.dev/img/avatar3.jpg',
    status: 'dnd',
    messages: [],
  },
  {
    id: 4,
    name: 'Maggie',
    avatar: 'https://cdn.quasar.dev/img/avatar4.jpg',
    status: 'dnd',
    messages: [],
  },
  {
    id: 5,
    name: 'Tomas',
    avatar: 'https://cdn.quasar.dev/img/avatar5.jpg',
    status: 'online',
    messages: [],
  },
  {
    id: 6,
    name: 'Martin',
    avatar: 'https://cdn.quasar.dev/img/avatar4.jpg',
    status: 'offline',
    messages: [],
  },
  {
    id: 7,
    name: 'Andrej',
    avatar: 'https://cdn.quasar.dev/img/avatar4.jpg',
    status: 'dnd',
    messages: [],
  },
  {
    id: 8,
    name: 'Ema',
    avatar: 'https://cdn.quasar.dev/img/avatar1.jpg',
    status: 'online',
    messages: [],
  },
  {
    id: 9,
    name: 'Miska',
    avatar: 'https://cdn.quasar.dev/img/avatar4.jpg',
    status: 'online',
    messages: [],
  },
  {
    id: 10,
    name: 'Juraj',
    avatar: 'https://cdn.quasar.dev/img/avatar2.jpg',
    status: 'online',
    messages: [],
  },
  {
    id: 11,
    name: 'MAx',
    avatar: 'https://cdn.quasar.dev/img/avatar4.jpg',
    status: 'offline',
    messages: [],
  },
]);

const getUserByName = (name: string): User => {
  return (
    users.value.find((u) => u.name === name) || {
      id: -1,
      name,
      avatar: 'https://cdn.quasar.dev/img/avatar.png',
      status: 'offline' as const,
    }
  );
};

const newChannelType = ref<'public' | 'private'>('public');

// async function fetchChannels() {
//   try {
//     const response = await api.get('/api/channels');
//     channels.value = response.data;
//     if (channels.value.length > 0) {
//       activeChannel.value = channels.value[0];
//     }
//   } catch (error) {
//     console.error('Failed to fetch channels:', error);
//     // $q.notify({
//     //   type: 'negative',
//     //   message: 'Nepodarilo sa načítať kanály',
//     // });
//   }
// }

const invitations = ref<Invitation[]>([{ id: 1, from: 'Tomas', channel: 'Developers' }]);

const invitationCount = computed(() => invitations.value.length);

const channelsStore = useChannelsStore();
const currentMessages = computed(() => {
  if (!activeChannel.value) return [];
  return channelsStore.messages[activeChannel.value.name] || [];
});

// const showAddFriendDialog = ref(false);
const showInvitationsDialog = ref(false);
const showCreateChannelDialog = ref(false);
const showAddPeopleDialog = ref(false);
const showRemovePeopleDialog = ref(false);
const showStatusDialog = ref(false);
const showMembersDialog = ref(false);
// const newFriendName = ref('');
const newChannelName = ref('');
const selectedNicknames = ref<string[]>([]);

const validateNickname = (
  val: string,
  done: (item?: string, mode?: 'toggle' | 'add' | 'add-unique') => void,
) => {
  // Just add the nickname - we'll validate on backend
  if (val.length > 0) {
    done(val, 'add-unique');
  }
};

// const dummyMessages = Array.from({ length: 40 }, (_, i) => ({
//   id: i + 1,
//   user: i % 2 === 0 ? 'You' : 'Maggie',
//   text: i % 2 === 0 ? `Tvoja správa ${i + 1}` : `Maggie odpoveď ${i + 1}`,
// }));

// const dummy_chat = channels.value.find((f) => f.name === 'General');
// if (dummy_chat) dummy_chat.messages = dummyMessages;

// Definícia channelMembers
// const channelMembers = computed(() => {
//   if (!activeChannel.value?.members) return [];
//   return users.value.filter(f => activeChannel.value!.members!.includes(f.id));
// });

// tu je efektivny scroll
const isLoadingMore = ref(false);
const loadedMessagesCount = ref(20); //batch mame na 20 sprav
const chatScrollArea = ref<QScrollArea | null>(null);
const batchSize = 10;

const visibleMessages = computed(() => {
  if (!activeChannel.value) return [];
  const msgs = currentMessages.value || [];
  return msgs.slice(-loadedMessagesCount.value); //ukaze nam tych poslednych 20
});

// const loadMoreMessages = async () => {
//   if (isLoadingMore.value) return;
//   if (loadedMessagesCount.value >= (currentMessages.value?.length || 0)) return; //uz je nacitane vsetko

//   isLoadingMore.value = true;
//   await new Promise(resolve => setTimeout(resolve, 1000)); //simulujeme nacitavanie
//   loadedMessagesCount.value += 10; //nacita nam dalsich 10
//   isLoadingMore.value = false;
// };

//uz mame nacitane vsetko
const noMoreMessages = computed(() => {
  return loadedMessagesCount.value >= (currentMessages.value?.length || 0);
});

const onLoadMore = async (index: number, done: (stop?: boolean) => void) => {
  if (noMoreMessages.value) {
    done(true); // zastav infinite scroll
    return;
  }

  isLoadingMore.value = true;
  await new Promise((resolve) => setTimeout(resolve, 800)); // simulácia načítania
  loadedMessagesCount.value += batchSize;
  isLoadingMore.value = false;
  done();
};

const scrollToBottom = async () => {
  await nextTick();
  if (!chatScrollArea.value) return;
  const target = chatScrollArea.value.getScrollTarget();
  target.scrollTop = target.scrollHeight;
};

const selectChannel = async (ch: Channel) => {
  channelsStore.setActive(ch.name);
  const socket = channelService.join(ch.name);

  await new Promise<void>((resolve) => socket.socket.once('connect', resolve));

  try {
    await socket.joinChannel();
  } catch {
    systemMessage.value = 'Failed to join';
    return;
  }

  try {
    const messages = await socket.loadMessages();
    const store = useChannelsStore();
    messages.forEach((m) => store.newMessage(ch.name, m));
  } catch {
    systemMessage.value = 'You are not a member';
    return;
  }

  if (isSmallScreen.value) showChannels.value = false;
  await nextTick();
  await scrollToBottom();
};

// const addFriend = () => {
//   const name = newFriendName.value.trim();
//   if (!name) return;
//   const nicknameExists = friends.value.some(f => f.name.toLowerCase() === name.toLowerCase());
//   if (nicknameExists) {
//     alert('You are already friends with this person!');
//     return;
//   }

//   const newFr: Friend = {
//     id: friends.value.length + 1,
//     name,
//     avatar: 'https://cdn.quasar.dev/img/avatar.png',
//     status: 'offline' as const,
//     messages: [],
//   };
//   friends.value.unshift(newFr);
//   activeFriend.value = newFr;
//   newFriendName.value = '';
//   showAddFriendDialog.value = false;
// };

// const removeFriend = (id: number) => {
//   friends.value = friends.value.filter(f => f.id !== id);
//   if (activeFriend.value?.id === id) activeFriend.value = null;
// };

const openInvitations = () => (showInvitationsDialog.value = true);
const acceptInvite = (id: number) => {
  const inv = invitations.value.find((i) => i.id === id);
  if (inv) {
    const existingChannel = channels.value.find((c) => c.name === inv.channel);
    if (existingChannel) {
      channelsStore.setActive(existingChannel.name);
    }
  }
  invitations.value = invitations.value.filter((i) => i.id !== id);
};

const declineInvite = (id: number) =>
  (invitations.value = invitations.value.filter((i) => i.id !== id));

// na filtrovanie v tych side baroch channel
const filteredChannels = computed(() => {
  if (channelFilter.value === 'all') return channels.value;
  return channels.value.filter((ch) => ch.type === channelFilter.value);
});

const invalidNicknamesError = ref('');

const createChannel = async () => {
  const name = newChannelName.value.trim();
  if (!name) return;

  // Clear previous errors
  invalidNicknamesError.value = '';

  const nameExists = channels.value.some((ch) => ch.name.toLowerCase() === name.toLowerCase());
  if (nameExists) {
    alert('Channel name already exists!');
    return;
  }

  const myNickname = authStore.user?.nickname; //nech sa neinvituje sam seba
  if (myNickname && selectedNicknames.value.includes(myNickname)) {
    invalidNicknamesError.value = 'You cannot invite yourself';
    return;
  }

  // VALIDATE NICKNAMES FIRST
  if (selectedNicknames.value.length > 0) {
    try {
      const response = await api.post('/auth/validate-nicknames', {
        nicknames: selectedNicknames.value,
      });

      const invalidNicknames = response.data.invalidNicknames;
      if (invalidNicknames && invalidNicknames.length > 0) {
        invalidNicknamesError.value = `These users don't exist: ${invalidNicknames.join(', ')}`;
        return; // Stop here, don't create channel
      }
    } catch (err) {
      console.error('Failed to validate nicknames:', err);
      invalidNicknamesError.value = 'Failed to validate nicknames';
      return;
    }
  }

  // NOW CREATE THE CHANNEL (only if nicknames are valid)
  try {
    const response = await api.post('/api/channels', {
      name,
      type: newChannelType.value,
      nicknames: selectedNicknames.value,
    });

    channelsStore.channelsList.unshift(response.data);
    channelsStore.setActive(response.data.name);

    // Join via WebSocket
    const socket = channelService.join(response.data.name);

    if (!socket.socket.connected) {
      await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
    }

    try {
      await socket.joinChannel();
      systemMessage.value = `Joined ${response.data.name}`;
    } catch (err) {
      systemMessage.value = 'Failed to join channel';
      console.error(err);
    }

    try {
      const messages = await socket.loadMessages();
      messages.forEach((m) => channelsStore.newMessage(response.data.name, m));
    } catch (err) {
      console.error('Failed to load messages:', err);
    }

    // Reset form
    newChannelName.value = '';
    selectedNicknames.value = [];
    newChannelType.value = 'public';
    showCreateChannelDialog.value = false;

    await nextTick();
    await scrollToBottom();
  } catch (err: unknown) {
    console.error('Failed to create channel:', err);
    alert('Failed to create channel');
  }
};

const leaveChannel = () => {
  if (!activeChannel.value) return;
  //call back end to leave channel
};

const deleteChannel = () => {
  if (!activeChannel.value) return;
  //call back end to leave channel
};

const getChannelMembers = () => {
  return channelMembers.value.map((m) => ({
    label: m.name,
    value: m.id,
  }));
};

const addPeopleToChannel = () => {
  if (!activeChannel.value) return;
  // TODO: Call backend API to add people
  // await api.post(`/api/channels/${activeChannel.value.id}/members`, { userIds: selectedFriends.value })
  showAddPeopleDialog.value = false;
  selectedNicknames.value = [];
};

const removePeopleFromChannel = () => {
  if (!activeChannel.value) return;
  // TODO: Call backend API to remove people
  // await api.delete(`/api/channels/${activeChannel.value.id}/members`, { data: { userIds: selectedFriends.value }})
  showRemovePeopleDialog.value = false;
  selectedNicknames.value = [];
};

// to bude funkcia ktorou ulozime status usera na server- momentalne len zavrieme dialog
const saveUserStatus = () => {
  showStatusDialog.value = false;
};

// CLI fixne
const newMessage = ref('');
const systemMessage = ref('');

// notifikacia data
interface NotificationData {
  senderName: string;
  senderAvatar: string;
  message: string;
}

const showChatNotification = ref(false);
const notificationData = ref<NotificationData>({
  senderName: 'Katka',
  senderAvatar: 'https://cdn.quasar.dev/img/avatar2.jpg',
  message: 'Ahoj pocuj ako mam spravit toto??',
});

const triggerChatNotification = () => {
  showChatNotification.value = true;
};

const handleNotificationClose = () => {
  showChatNotification.value = false;
};

// spustame fixne notifikaciu pri kazdom reloadnuti stranky
onMounted(async () => {
  await authStore.check();
  await channelsStore.fetchChannels(); // ← Fetch channel metadata
  triggerChatNotification();

  if (isSmallScreen.value) {
    showChannels.value = false;
    showFriends.value = false;
  }
});

// Po zmene kanála
watch(
  activeChannel,
  async () => {
    loadedMessagesCount.value = 20; // reset načítania
    isLoadingMore.value = false;
    await nextTick();
    await scrollToBottom();
    // Ak máš málo správ, môžeš rovno načítať viac
    if (currentMessages.value.length > 20) {
      // voliteľne: spusti infinite scroll manuálne
    }
  },
  { immediate: true },
);

// aby sa nam input na vytvorenie channel resetoval po kliknuti na cencel alebo mimo dialogu
watch(showCreateChannelDialog, (newVal) => {
  if (!newVal) {
    newChannelName.value = '';
    selectedNicknames.value = []; // ← Reset nicknames
    newChannelType.value = 'public';
    invalidNicknamesError.value = '';
  }
});

watch(selectedNicknames, () => {
  invalidNicknamesError.value = '';
});
// aby sa nam input na pridanie friend resetoval po kliknuti na cencel alebo mimo dialogu
// watch(showAddFriendDialog,(newVal) => {
//   if (!newVal) {
//     newFriendName.value = ''
//   }}
// )

import { useAuthStore } from 'src/stores/auth';
import type { DisplayMessage } from 'src/types/message';
import type { SerializedMessage } from 'src/contracts';

const authStore = useAuthStore();

const isMyMessage = (msg: DisplayMessage) => {
  const myName = authStore.user?.nickname;
  return msg.user === myName;
};

const sendMessage = async () => {
  const text = newMessage.value.trim();
  if (!text || !activeChannel.value) return;

  const channelName = activeChannel.value.name;
  let socket = channelService.in(channelName);
  if (!socket) socket = channelService.join(channelName);

  try {
    // === 1. PRÍKAZY (nechaj ako je) ===
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ');
      const command = parts[0]?.toLowerCase() ?? '';
      if (command === 'join') {
        const inputName = parts[1]?.trim();
        if (!inputName) {
          systemMessage.value = 'Usage: /join channelName [private]';
          newMessage.value = '';
          return;
        }

        // fetch ALL channels from DB
        const allChannels = await channelsStore.fetchAllChannels();

        // check if channel exists in DB
        const existingChannel = allChannels.find(
          (c: Channel) => c.name.toLowerCase() === inputName.toLowerCase(),
        );

        if (existingChannel) {
          // channel exists - join it
          const socket = channelService.join(existingChannel.name);
          if (!socket.socket.connected) {
            await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
          }

          try {
            await socket.joinChannel();
            systemMessage.value = `Joined ${existingChannel.name}`;
          } catch (err) {
            systemMessage.value = 'Failed to join channel';
            console.error(err);
            newMessage.value = '';
            return;
          }

          try {
            const messages = await socket.loadMessages();
            messages.forEach((m) => channelsStore.newMessage(existingChannel.name, m));

            // refresh channel list usera, teraz by tam mal byt aj ten novy
            await channelsStore.fetchChannels();

            // bude topovany
            const channelIndex = channelsStore.channelsList.findIndex(
              (c) => c.name === existingChannel.name,
            );
            if (channelIndex > 0) {
              //dame ho na prve miesto listu
              const [channel] = channelsStore.channelsList.splice(channelIndex, 1);
              channelsStore.channelsList.unshift(channel);
            }

            // dame ho na active
            channelsStore.setActive(existingChannel.name);
          } catch (err) {
            systemMessage.value = 'You are not a member';
            console.error(err);
          }

          await nextTick();
          await scrollToBottom();
          newMessage.value = '';
          return;
        }

        // channel doesn't exist - create it
        const type: 'public' | 'private' = parts
          .slice(2)
          .join(' ')
          .toLowerCase()
          .includes('private')
          ? 'private'
          : 'public';

        try {
          const response = await api.post('/api/channels', {
            name: inputName,
            type: type,
            memberIds: [],
          });

          // pridaj do store
          channelsStore.channelsList.unshift(response.data);
          channelsStore.setActive(response.data.name);

          systemMessage.value = `Channel "${inputName}" created (${type})`;

          // pripoj sa cez websocket
          const socket = channelService.join(response.data.name);
          if (!socket.socket.connected) {
            await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
          }

          try {
            await socket.joinChannel();
          } catch (err) {
            systemMessage.value = 'Failed to join channel';
            console.error(err);
            newMessage.value = '';
            return;
          }

          // load messages
          try {
            const messages = await socket.loadMessages();
            messages.forEach((m) => channelsStore.newMessage(response.data.name, m));
          } catch (err) {
            systemMessage.value = 'You are not a member';
            console.error(err);
          }

          await nextTick();
          await scrollToBottom();
          newMessage.value = '';
          return;
        } catch (err: unknown) {
          console.error('Failed to create channel:', err);
          systemMessage.value = 'Failed to create channel';
          newMessage.value = '';
          return;
        }
      } else if (command === 'list') {
        showMembersDialog.value = true;
        newMessage.value = '';
        return;
      } else {
        systemMessage.value = 'Unknown command: ' + text;
        newMessage.value = '';
        return;
      }
    }

    // === 2. NORMÁLNA SPRÁVA ===
    else {
      const myNickname = authStore.user?.nickname;

      // 1. OPTIMISTICKY PRIDAJ (žltá bublina hneď!)
      const tempId = Date.now();
      const store = useChannelsStore();
      store.newMessage(channelName, {
        id: tempId,
        createdBy: authStore.user!.id,
        content: text,
        channelId: 0, // dočasné
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: authStore.user!.id,
          email: authStore.user!.email,
          nickname: myNickname,
        },
      } as SerializedMessage);

      await nextTick();
      await scrollToBottom();

      // posli na server
      await socket.addMessage(text);

      // (server pošle správu cez WebSocket)
      const idx = store.messages[channelName].findIndex((m) => m.id === tempId);
      if (idx !== -1) {
        store.messages[channelName].splice(idx, 1);
      }
    }
  } catch (err: unknown) {
    console.error('Send error:', err);
    systemMessage.value = err instanceof Error ? err.message : 'Failed to send';
  } finally {
    newMessage.value = '';
  }
};

// IVKINE:
// if (command === 'join') {
//   const inputName = parts[1]?.trim()
//   if (!inputName) {
//     systemMessage.value = 'Usage: /join channelName [private]'
//     return
//   }

//   const type: 'public' | 'private' = parts
//     .slice(2)
//     .join(' ')
//     .toLowerCase()
//     .includes('private')
//     ? 'private'
//     : 'public'

//   // Try to find existing channel locally
//   let ch = channels.value.find(
//     (c) => c.name.toLowerCase() === inputName.toLowerCase()
//   )

//   if (!ch) {
//     // Create locally first (like the old days)
//     const tempChannel: Channel = {
//       id: Date.now(), // temporary ID, will be replaced by real one from server
//       name: inputName,
//       type,
//       members: [],
//       isAdmin: true,
//     }

//     // Add to store immediately (optimistic UI)
//     channelsStore.channelsList.unshift(tempChannel)
//     ch = tempChannel

//     systemMessage.value = `Channel "${inputName}" created (${type})`
//   } else {
//     systemMessage.value = `Joined channel "${ch.name}"`
//   }

//   // Switch to it
//   channelsStore.setActive(ch.name)

//   // Join via socket
//   const socket = channelService.join(ch.name)
//   if (!socket.socket.connected) {
//     await new Promise<void>((resolve) => socket.socket.once('connect', resolve))
//   }

//   try {
//     await socket.joinChannel()
//     systemMessage.value = `Joined ${ch.name}`
//   } catch (err) {
//     systemMessage.value = 'Failed to join channel'
//     console.error(err)
//     return
//   }

//   try {
//     const messages = await socket.loadMessages()
//     messages.forEach((m) => channelsStore.newMessage(ch.name, m))
//   } catch (err) {
//     systemMessage.value = 'You are not a member'
//     console.error(err)
//   }

//   await nextTick()
//   await scrollToBottom()

//   return // stop further processing (important!)
// }
</script>

<style scoped>
.my-message {
  background: #ffd700 !important;
  color: black;
  max-width: 70%;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.other-message {
  background: #f5f5f5;
  color: black;
  max-width: 700px;
}

.q-pa-sm.rounded-borders {
  word-break: break-word;
  overflow-wrap: anywhere;
}

.scroll {
  overflow-y: auto;
  height: 100%;
}
.relative-position {
  position: relative;
}
.command-input {
  font-family: monospace;
  max-height: 150px;
  overflow-y: auto;
}
.mention-highlight {
  background: #fff8c4 !important; /* jemne žltá */
  border-left: 4px solid #f59e0b !important;
  font-weight: 600;
}

.mention-pulse {
  animation: mentionPulse 2s infinite;
}
@keyframes mentionPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
  }
}
.transition-all {
  transition: all 0.3s ease;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  position: absolute;
  bottom: 2px;
  right: 2px;
  z-index: 1;
}
.status-online {
  background-color: #4caf50;
}
.status-dnd {
  background-color: #f44336;
}
.status-offline {
  background-color: #9e9e9e;
}
.notification-wrapper {
  position: relative;
  min-height: 80px;
}
.notification-positioner {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
}
.friends-list-content {
  z-index: 1;
}
.typing-message {
  position: absolute;
  bottom: 10px;
  left: 12px;
  display: flex;
}
.typing-text {
  color: #666;
}
</style>

<!-- const sendMessage = async () => {
  const text = newMessage.value.trim();
  if (!text || !activeChannel.value) return;

  const channelName = activeChannel.value.name;
  let socket = channelService.in(channelName);
  if (!socket) socket = channelService.join(channelName);

  try {
    // === 1. PRÍKAZY (nechaj ako je) ===
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ');
      const command = parts[0]?.toLowerCase() ?? '';
      if (command === 'join') {
        const inputName = parts[1]?.trim();
        if (!inputName) {
          systemMessage.value = 'Usage: /join channelName [private]';
          newMessage.value = '';
          return;
        }

        // Debug: Log all channels
        console.log(
          '🔍 DEBUG: All channels:',
          channels.value.map((c) => c.name),
        );
        console.log('🔍 DEBUG: Looking for channel:', inputName);

        // Check if channel already exists locally
        const existingChannel = channels.value.find(
          (c) => c.name.toLowerCase() === inputName.toLowerCase(),
        );

        console.log('🔍 DEBUG: Found existing channel?', existingChannel ? 'YES' : 'NO');
        if (existingChannel) {
          console.log('🔍 DEBUG: Existing channel data:', existingChannel);
        }

        if (existingChannel) {
          // Channel exists - just join it (don't create!)
          console.log('✅ Channel exists - joining without creating');
          channelsStore.setActive(existingChannel.name);

          const socket = channelService.join(existingChannel.name);
          if (!socket.socket.connected) {
            await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
          }

          try {
            await socket.joinChannel();
            systemMessage.value = `Joined ${existingChannel.name}`;
          } catch (err) {
            systemMessage.value = 'Failed to join channel';
            console.error(err);
            newMessage.value = '';
            return;
          }

          try {
            const messages = await socket.loadMessages();
            messages.forEach((m) => channelsStore.newMessage(existingChannel.name, m));
          } catch (err) {
            systemMessage.value = 'You are not a member';
            console.error(err);
          }

          await nextTick();
          await scrollToBottom();
          newMessage.value = '';
          return;
        }

        // Channel doesn't exist - create it
        console.log('❌ Channel does NOT exist - creating new one');
        const type: 'public' | 'private' = parts
          .slice(2)
          .join(' ')
          .toLowerCase()
          .includes('private')
          ? 'private'
          : 'public';

        try {
          console.log('📡 Calling API to create channel:', inputName, 'type:', type);
          const response = await api.post('/api/channels', {
            name: inputName,
            type: type,
            memberIds: [],
          });

          // Add to store
          channelsStore.channelsList.unshift(response.data);
          channelsStore.setActive(response.data.name);

          systemMessage.value = `Channel "${inputName}" created (${type})`;

          // Now join via WebSocket
          const socket = channelService.join(response.data.name);
          if (!socket.socket.connected) {
            await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
          }

          try {
            await socket.joinChannel();
          } catch (err) {
            systemMessage.value = 'Failed to join channel';
            console.error(err);
            newMessage.value = '';
            return;
          }

          // Load messages
          try {
            const messages = await socket.loadMessages();
            messages.forEach((m) => channelsStore.newMessage(response.data.name, m));
          } catch (err) {
            systemMessage.value = 'You are not a member';
            console.error(err);
          }

          await nextTick();
          await scrollToBottom();
          newMessage.value = '';
          return;
        } catch (err: unknown) {
          console.error('❌ API ERROR creating channel:', err);

          const axiosError = err as {
            response?: { data?: { message?: string; code?: string }; status?: number };
          };
          console.error('❌ Error response:', axiosError.response?.data);
          console.error('❌ Error status:', axiosError.response?.status);

          // Check if channel already exists (409 Conflict OR 500 with UNIQUE constraint error)
          const isUniqueConstraintError =
            axiosError.response?.data?.code === 'SQLITE_CONSTRAINT' ||
            axiosError.response?.data?.message?.includes('UNIQUE constraint failed');
          const channelExists = axiosError.response?.status === 409 || isUniqueConstraintError;

          if (channelExists) {
            console.log('⚠️ Channel already exists, trying to join it instead');
            systemMessage.value = `Joining existing channel "${inputName}"`;

            // Try to join via WebSocket
            const socket = channelService.join(inputName);
            if (!socket.socket.connected) {
              await new Promise<void>((resolve) => socket.socket.once('connect', resolve));
            }

            try {
              await socket.joinChannel();
              systemMessage.value = `Joined ${inputName}`;

              // Load messages
              try {
                const messages = await socket.loadMessages();
                messages.forEach((m) => channelsStore.newMessage(inputName, m));

                // Add channel to local list if not already there
                if (!channels.value.find((c) => c.name === inputName)) {
                  // Fetch fresh channel list from server
                  await channelsStore.fetchChannels();
                }

                // Set as active
                channelsStore.setActive(inputName);

                await nextTick();
                await scrollToBottom();
              } catch (loadErr) {
                systemMessage.value = 'You are not a member of this channel';
                console.error(loadErr);
              }
            } catch (joinErr) {
              systemMessage.value = 'Failed to join channel';
              console.error(joinErr);
            }

            newMessage.value = '';
            return;
          }

          systemMessage.value = axiosError.response?.data?.message || 'Failed to create channel';
          console.error(err);
          newMessage.value = '';
          return;
        }
      } else if (command === 'list') {
        showMembersDialog.value = true;
        newMessage.value = '';
        return;
      } else {
        systemMessage.value = 'Unknown command: ' + text;
        newMessage.value = '';
        return;
      }
    }

    // === 2. NORMÁLNA SPRÁVA ===
    else {
      const myNickname = authStore.user?.nickname;

      // 1. OPTIMISTICKY PRIDAJ (žltá bublina hneď!)
      const tempId = Date.now();
      const store = useChannelsStore();
      store.newMessage(channelName, {
        id: tempId,
        createdBy: authStore.user!.id,
        content: text,
        channelId: 0, // dočasné
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: authStore.user!.id,
          email: authStore.user!.email,
          nickname: myNickname,
        },
      } as SerializedMessage);

      await nextTick();
      await scrollToBottom();

      // posli na server
      await socket.addMessage(text);

      // (server pošle správu cez WebSocket)
      const idx = store.messages[channelName].findIndex((m) => m.id === tempId);
      if (idx !== -1) {
        store.messages[channelName].splice(idx, 1);
      }
    }
  } catch (err: unknown) {
    console.error('Send error:', err);
    systemMessage.value = err instanceof Error ? err.message : 'Failed to send';
  } finally {
    newMessage.value = '';
  }
}; -->
