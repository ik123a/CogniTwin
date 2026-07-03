import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'auto' | 'high-contrast'

interface ThemeState {
  theme: Theme
  fontSize: number
  setTheme: (theme: Theme) => void
  setFontSize: (size: number) => void
  initTheme: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark', // Default to Dark Mode as per spec principles (vibrant aesthetics)
  fontSize: 14,

  setTheme: (theme) => {
    set({ theme })
    localStorage.setItem('cognitwin_theme', theme)

    // Apply theme
    let resolvedTheme: 'light' | 'dark' | 'high-contrast' = 'dark'
    if (theme === 'auto') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      resolvedTheme = systemPrefersDark ? 'dark' : 'light'
    } else {
      resolvedTheme = theme
    }

    document.documentElement.setAttribute('data-theme', resolvedTheme)
  },

  setFontSize: (fontSize) => {
    set({ fontSize })
    localStorage.setItem('cognitwin_font_size', String(fontSize))
    document.documentElement.style.fontSize = `${fontSize}px`
  },

  initTheme: () => {
    const savedTheme = localStorage.getItem('cognitwin_theme') as Theme | null
    const savedSize = localStorage.getItem('cognitwin_font_size')

    const themeToApply = savedTheme || 'dark'
    const sizeToApply = savedSize ? Number(savedSize) : 14

    get().setTheme(themeToApply)
    get().setFontSize(sizeToApply)

    // If 'auto', listen for system color scheme changes
    if (themeToApply === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const listener = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      }
      mediaQuery.addEventListener('change', listener)
    }
  }
}))
