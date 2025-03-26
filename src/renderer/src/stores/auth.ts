import { defineStore } from 'pinia'

interface AuthState {
  isAuthenticated: boolean
  token: string | null
  user: {
    username: string
    // 可以根据需要添加更多用户信息字段
  } | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    isAuthenticated: false,
    token: null,
    user: null
  }),

  actions: {
    async login(username: string, password: string) {
      // TODO: 实现实际的登录API调用
      // 这里暂时使用模拟数据
      if (username === 'admin' && password === 'admin') {
        this.isAuthenticated = true
        this.token = 'mock-token'
        this.user = { username }
        localStorage.setItem('auth', JSON.stringify({
          token: this.token,
          user: this.user
        }))
        return true
      }
      throw new Error('Invalid credentials')
    },

    logout() {
      this.isAuthenticated = false
      this.token = null
      this.user = null
      localStorage.removeItem('auth')
    },

    initAuth() {
      const auth = localStorage.getItem('auth')
      if (auth) {
        const { token, user } = JSON.parse(auth)
        this.token = token
        this.user = user
        this.isAuthenticated = true
      }
    }
  }
})