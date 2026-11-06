'use client';
import { useEffect, useState } from 'react';
export default function LocalTestBanner() {
  const [local,setLocal]=useState(false);
  useEffect(()=>{
    let active=true;
    fetch('/api/v1/local-test/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active)setLocal(data?.enabled===true);}).catch(()=>{});
    return()=>{active=false;};
  },[]);
  return local?<aside role="status" style={{background:'#f4e4b5',color:'#17302f',padding:'12px 20px',textAlign:'center',fontSize:13}}>LOCAL TEST ONLY · Synthetic accounts and dummy files · No payments or live AI</aside>:null;
}
