import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'UCE — Universal Creator Ecosystem',description:'A shared home for creative projects, IP evidence and trusted knowledge.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
