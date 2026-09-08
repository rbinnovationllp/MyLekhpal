import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Mylekhpal | Daily records to CA-ready books',description:'A simpler shared workspace for Indian businesses and their Chartered Accountants.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
