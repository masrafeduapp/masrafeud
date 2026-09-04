'use client'
import { useState } from 'react'
export default function RewardRoulette({names}:{names:string[]}){
 const [result,setResult]=useState(''); const [spinning,setSpinning]=useState(false)
 function spin(){if(!names.length||spinning)return;setSpinning(true);setResult('');setTimeout(()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);setResult(names[a[0]%names.length]);setSpinning(false)},700)}
 return <div className="rouletteBox"><div className={`rouletteDisc ${spinning?'spin':''}`}>★</div><div><h3>روليت الجوائز</h3><p className="muted">يختار عشوائيًا من الجوائز المفعلة. الاختيار لا يخصم نقاطًا إلا عند تسجيل الاستبدال.</p><button className="btn btn-primary" type="button" onClick={spin} disabled={!names.length||spinning}>{spinning?'جاري الاختيار...':'تدوير الروليت'}</button>{result&&<div className="success" style={{marginTop:12}}>النتيجة: <b>{result}</b></div>}</div></div>
}
