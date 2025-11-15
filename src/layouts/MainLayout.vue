<template>
  <q-layout view="lHh Rpr lFf">
    <!-- HEADER -->
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title class="text-left">
          Shello
        </q-toolbar-title>

        <div v-if="isChatPage" class="row items-center q-gutter-sm">
          <div class="relative-position">
            <q-btn
              flat
              dense
              round
              aria-label="User"
              @click="toggleRightDrawer"
            >
              <ProfilePicture
                :avatar="uploadedAvatar"
                size="33px"
                bgColor="grey-4"
              />
            </q-btn>
            <q-badge color="red" floating transparent>
              {{ notifications.length }}
            </q-badge>
          </div>

          <!-- LOGOUT BUTTON -->
          <q-btn color="dark" flat>
            <q-icon name="logout" class="q-mr-xs"></q-icon>
            Log out
            <q-menu
              v-model="showLogoutMenu"
              anchor="bottom right"
              self="top right"
              :offset="[0, 16]"
            >
              <q-card style="min-width:200px;">
                <q-card-section class="text-center">
                  Do you want to log out?
                </q-card-section>
                <q-card-actions align="right">
                  <q-btn flat label="Cancel" color="black" v-close-popup />
                  <q-btn color="primary" label="Log out" @click="confirmLogout" />
                </q-card-actions>
              </q-card>
            </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <!-- SIDE MENU -->
    <q-drawer side="right" v-model="rightDrawerOpen" bordered overlay :width="drawerWidth">
      <q-item class="row items-center justify-between">
        <q-item-label header>User Menu</q-item-label>
        <q-btn flat icon="close" size="sm" @click="rightDrawerOpen = false" />
      </q-item>

      <q-list>
        <q-expansion-item
          :model-value="profileExpanded"
          @update:model-value="toggleProfile"
          icon="person"
          :label="`${userProfile.first_name} ${userProfile.last_name}`"
          header-class="text-dark"
        >
          <q-card flat class="q-pa-md">
            <q-card-section>
              <div><strong>Name:</strong> {{ userProfile.first_name }} {{ userProfile.last_name }}</div>
              <div><strong>Nickname:</strong> {{ userProfile.nickname }}</div>
              <div><strong>Email:</strong> {{ userProfile.email }}</div>
              <div><strong>Password:</strong> ********</div>

              <q-btn flat color="primary" label="Edit" class="q-mt-md" @click="editProfile" />
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <q-item clickable @click.stop="openSettingsMenu" class="text-dark">
          <q-item-section avatar>
            <q-icon name="settings" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Settings</q-item-label>
            <q-item-label caption>Account preferences</q-item-label>
          </q-item-section>
        </q-item>

        <q-menu v-model="settingsMenuVisible" anchor="bottom middle" self="top middle" :offset="[0,8]">
          <q-list style="min-width:150px;">
            <q-item clickable v-close-popup @click="showStatusDialog = true">
              <q-item-section>Statuses</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-list>
    </q-drawer>

    <!-- STATUS DIALOG -->
    <q-dialog v-model="showStatusDialog">
      <q-card style="min-width: 300px;">
        <q-card-section><div class="text-h6">Set your status</div></q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="primary" label="Save" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import ProfilePicture from '../components/ProfilePicture.vue'
import { authManager } from 'src/services'
import {api} from 'src/boot/axios'

const $q = useQuasar()
const router = useRouter()
const route = useRoute()

// RESPONSIVE DRAWER
const drawerWidth = computed(() => ($q.screen.xs ? $q.screen.width : 350))

// SHOW ELEMENTS ONLY ON CHAT PAGE
const isChatPage = computed(() => route.path === '/channels')

// USER MOCK DATA
const uploadedAvatar = ref<string | undefined>(undefined)
const userProfile = ref({
  first_name: 'Terezia',
  last_name: 'Stevulova',
  nickname: 'Ivanka',
  email: 'tereza.stevulova@example.com',
  password: '12345'
})

// NOTIFICATIONS
const notifications = ref([{ message: 'This channel has been inactive for 30 days...' }])

// MENU STATES
const rightDrawerOpen = ref(false)
const showLogoutMenu = ref(false)
const profileExpanded = ref(false)
const settingsMenuVisible = ref(false)
const showStatusDialog = ref(false)

// ACTIONS
function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value
}

function toggleProfile(v: boolean) {
  profileExpanded.value = v
  settingsMenuVisible.value = false
}

function openSettingsMenu() {
  settingsMenuVisible.value = !settingsMenuVisible.value
}

function editProfile() {}

async function confirmLogout() {
  showLogoutMenu.value = false

  try{
    await api.post('/auth/logout', {})
  } catch (error) {
    console.error('Logout API call failed:', error)
  }
  authManager.logout()
  await router.push({ name: 'login' })
}
</script>

<style scoped>
.notification-message {
  background-color: #F44336;
  padding: 8px;
  border-radius: 4px;
}
.text-dark {
  color: #424242 !important;
}

</style>
