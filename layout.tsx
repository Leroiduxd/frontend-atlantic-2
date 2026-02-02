import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* bg-background permet de changer le fond global derrière tes composants */}
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <ThemeProvider
          attribute="class"
          defaultTheme="system" // <-- Utilise le thème du navigateur par défaut
          enableSystem          // <-- Active la détection système
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}