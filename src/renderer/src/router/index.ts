import { createRouter, createWebHashHistory } from 'vue-router'
import ChatTabView from '@/views/ChatTabView.vue'
import SettingsTabView from '@/views/SettingsTabView.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import LoginView from '@/views/LoginView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {
        titleKey: 'routes.login',
        icon: 'lucide:log-in'
      }
    },
    {
      path: '/',
      name: 'chat',
      component: ChatTabView,
      meta: {
        titleKey: 'routes.chat',
        icon: 'lucide:message-square'
      }
    },
    {
      path: '/welcome',
      name: 'welcome',
      component: WelcomeView,
      meta: {
        titleKey: 'routes.welcome',
        icon: 'lucide:message-square'
      }
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsTabView,
      meta: {
        titleKey: 'routes.settings',
        icon: 'lucide:settings'
      },
      children: [
        {
          path: 'common',
          name: 'settings-common',
          component: () => import('@/components/settings/CommonSettings.vue'),
          meta: {
            titleKey: 'routes.settings-common',
            icon: 'lucide:bolt'
          }
        },
        {
          path: 'provider/:providerId?',
          name: 'settings-provider',
          component: () => import('@/components/settings/ModelProviderSettings.vue'),
          meta: {
            titleKey: 'routes.settings-provider',
            icon: 'lucide:cloud-cog'
          }
        },
        {
          path: 'mcp',
          name: 'settings-mcp',
          component: () => import('@/components/settings/McpSettings.vue'),
          meta: {
            titleKey: 'routes.settings-mcp',
            icon: 'lucide:server'
          }
        },
        {
          path: 'database',
          name: 'settings-database',
          component: () => import('@/components/settings/DataSettings.vue'),
          meta: {
            titleKey: 'routes.settings-database',
            icon: 'lucide:database'
          }
        },
        {
          path: 'shortcut',
          name: 'settings-shortcut',
          component: () => import('@/components/settings/ShortcutSettings.vue'),
          meta: {
            titleKey: 'routes.settings-shortcut',
            icon: 'lucide:keyboard'
          }
        },
        {
          path: 'about',
          name: 'settings-about',
          component: () => import('@/components/settings/AboutUsSettings.vue'),
          meta: {
            titleKey: 'routes.settings-about',
            icon: 'lucide:info'
          }
        }
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const isAuthenticated = authStore.isAuthenticated

  // 初始化认证状态
  if (!from.name) {
    authStore.initAuth()
  }

  // 如果用户未登录且访问的不是登录页面，则重定向到登录页
  if (!isAuthenticated && to.name !== 'login') {
    next({ name: 'login' })
  } else if (isAuthenticated && to.name === 'login') {
    // 如果用户已登录且尝试访问登录页，则重定向到首页
    next({ name: 'chat' })
  } else {
    next()
  }
})

export default router
