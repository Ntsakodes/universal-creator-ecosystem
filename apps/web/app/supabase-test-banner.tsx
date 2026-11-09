'use client';
import { useEffect,useState } from 'react';
export default function SupabaseTestBanner() {
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{
    let active=true;
    fetch('/api/v1/supabase-test/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active)setEnabled(data?.enabled===true);}).catch(()=>{});
    return()=>{active=false;};
  },[]);
  return enabled?<aside role="status" style={{background:'#f4e4b5',color:'#17302f',padding:'12px 20px',textAlign:'center',fontSize:13}}>SUPABASE TEST ONLY · Dummy data · Payments and live AI disabled</aside>:null;
}
