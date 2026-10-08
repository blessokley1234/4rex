import "./globals.css";
export const metadata = { title: "4REX NEWS — Global Forex Intelligence", description: "Global Forex Intelligence. Smarter Market Decisions." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
