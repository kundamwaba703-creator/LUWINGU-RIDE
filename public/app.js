async function api(url,data,token){
  const o={headers:{'Content-Type':'application/json'}};
  if(token)o.headers.Authorization='Bearer '+token;
  if(data!==undefined){o.method='POST';o.body=JSON.stringify(data)}
  const r=await fetch(url,o);const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(j.error||'Something went wrong.'),{status:r.status});return j;
}
const $=s=>document.querySelector(s);
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
const when=t=>new Date(t).toLocaleString([], {dateStyle:'short',timeStyle:'short'});
const PAYL={airtel:'Airtel Money',mtn:'MTN MoMo',zamtel:'Zamtel Money',cash:'Cash on arrival'};
