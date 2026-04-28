// Root layout — content rendered by [locale]/layout.tsx.
// We do NOT set <html lang> here; the locale layout owns that.
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return children;
}
