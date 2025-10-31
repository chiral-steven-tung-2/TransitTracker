import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { Moon, Sun, Menu } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const initialTheme = savedTheme || systemTheme
    
    setTheme(initialTheme)
    document.documentElement.classList.toggle('dark', initialTheme === 'dark')
  }, [])

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full px-3 md:px-6 py-3 md:py-4">
          {/* Mobile Layout */}
          <div className="flex items-center justify-between gap-2 lg:hidden">
            {/* Logo and Title */}
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="TransitScope Logo" className="w-8 h-8" />
              <h1 className="text-lg font-bold">
                TransitScope
              </h1>
            </div>

            {/* Navigation Dropdown and Theme Toggle */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Menu className="h-4 w-4" />
                    <span className="text-sm">
                      {isActive('/bus') ? 'Bus' : 
                       isActive('/sbu-bus') ? 'SBU Bus' : 
                       isActive('/metro') ? 'Subway' : 
                       isActive('/railroad') ? 'Railroad' : 
                       isActive('/service-status') ? 'Service Status' : 'Menu'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/bus')}>
                    Bus
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/sbu-bus')}>
                    SBU Bus
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/metro')}>
                    Subway
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/railroad')}>
                    Railroad
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/service-status')}>
                    Service Status
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-primary-foreground hover:bg-primary/90 h-9 w-9"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center justify-between gap-6">
            {/* Title with Logo */}
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="TransitScope Logo" className="w-10 h-10" />
              <h1 className="text-3xl font-bold whitespace-nowrap">
                TransitScope
              </h1>
            </div>

            {/* Navigation Buttons - Grouped together */}
            <div className="flex rounded-md overflow-hidden border">
              <Button 
                variant={isActive('/bus') ? 'default' : 'ghost'} 
                className={`rounded-none border-r ${isActive('/bus') ? 'dark:text-white' : ''}`}
                onClick={() => navigate('/bus')}
              >
                Bus
              </Button>
              <Button 
                variant={isActive('/sbu-bus') ? 'default' : 'ghost'} 
                className={`rounded-none border-r ${isActive('/sbu-bus') ? 'dark:text-white' : ''}`}
                onClick={() => navigate('/sbu-bus')}
              >
                SBU Bus
              </Button>
              <Button 
                variant={isActive('/metro') ? 'default' : 'ghost'} 
                className={`rounded-none border-r ${isActive('/metro') ? 'dark:text-white' : ''}`}
                onClick={() => navigate('/metro')}
              >
                Subway
              </Button>
              <Button 
                variant={isActive('/railroad') ? 'default' : 'ghost'} 
                className={`rounded-none border-r ${isActive('/railroad') ? 'dark:text-white' : ''}`}
                onClick={() => navigate('/railroad')}
              >
                Railroad
              </Button>
              <Button 
                variant={isActive('/service-status') ? 'default' : 'ghost'} 
                className={`rounded-none ${isActive('/service-status') ? 'dark:text-white' : ''}`}
                onClick={() => navigate('/service-status')}
              >
                Service Status
              </Button>
            </div>

            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-primary-foreground hover:bg-primary/90"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1 w-full">
        {children}
      </main>
    </div>
  )
}
