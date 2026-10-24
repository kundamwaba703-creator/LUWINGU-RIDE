// Luwingu Rider server. No packages needed: just Node.js 16+.  Run: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const PORT=process.env.PORT||3000, ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'admin123';
const DBF=path.join(process.env.DATA_DIR||__dirname,'data.json'), PUB=path.join(__dirname,'public');
if(process.env.DATA_DIR)fs.mkdirSync(process.env.DATA_DIR,{recursive:true});
let db={drivers:[],rides:[]}; try{db=JSON.parse(fs.readFileSync(DBF))}catch{}
const save=()=>fs.writeFileSync(DBF,JSON.stringify(db,null,1));
const sessions={}, uid=()=>crypto.randomBytes(6).toString('hex');
const hash=(p,s)=>crypto.scryptSync(p,s,32).toString('hex');
const num=v=>{v=Number(v);return v&&isFinite(v)&&Math.abs(v)<=180?v:null};
const PER_KM=Number(process.env.FARE_PER_KM)||10; // kwacha per km
const hav=(a,b,c,d)=>{const r=Math.PI/180,x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 12742*Math.asin(Math.sqrt(x))};
// Distance by road (OpenStreetMap routing). Falls back to straight-line if the service can't be reached.
async function roadKm(a,b,c,d){
  try{const r=await fetch('https://router.project-osrm.org/route/v1/driving/'+b+','+a+';'+d+','+c+'?overview=false',{signal:AbortSignal.timeout(6000)});
    const j=await r.json();if(j.routes&&j.routes[0])return {km:Math.round(j.routes[0].distance/100)/10,road:true}}catch{}
  return {km:Math.round(hav(a,b,c,d)*10)/10,road:false}}
async function quote(a,b,c,d){const q=await roadKm(a,b,c,d);return {km:q.km,road:q.road,fare:Math.round(q.km*PER_KM),perKm:PER_KM}}
const PAY={airtel:'Airtel Money',mtn:'MTN MoMo',zamtel:'Zamtel Money',cash:'Cash on arrival'};
const clean=(v,n=100)=>String(v||'').trim().slice(0,n);
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript'};
const pub=d=>({id:d.id,name:d.name,phone:d.phone,vehicle:d.vehicle,plate:d.plate,status:d.status,created:d.created});
const rideView=r=>{const d=db.drivers.find(x=>x.id===r.driverId);return {...r,driver:d?{name:d.name,phone:d.phone,vehicle:d.vehicle,plate:d.plate}:null}};
const send=(res,code,obj)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj))};
const auth=(req,role)=>{const s=sessions[(req.headers.authorization||'').replace('Bearer ','')];return s&&s.role===role?s:null};
const body=req=>new Promise(r=>{let b='';req.on('data',c=>{b+=c;if(b.length>1e5)req.destroy()});req.on('end',()=>{try{r(JSON.parse(b||'{}'))}catch{r({})}})});

async function api(req,res,p){
  const m=req.method, b=m==='POST'?await body(req):{}; let x;
  if(m==='GET'&&p==='/api/fare'){const s=new URL(req.url,'http://x').searchParams,v=['pLat','pLng','dLat','dLng'].map(k=>num(s.get(k)));
    if(v.some(z=>z==null)) return send(res,400,{error:'Missing map pins.'});return send(res,200,await quote(...v))}
  if(m==='GET'&&p==='/api/config') return send(res,200,{perKm:PER_KM});
  if(m==='POST'&&p==='/api/rides'){ // passenger requests a ride
    const r={id:uid(),name:clean(b.name),phone:clean(b.phone,20),pickup:clean(b.pickup,150),dropoff:clean(b.dropoff,150),pLat:num(b.pLat),pLng:num(b.pLng),dLat:num(b.dLat),dLng:num(b.dLng),payment:PAY[clean(b.payment,10)]?clean(b.payment,10):'',status:'pending',driverId:null,created:Date.now()};
    if(!r.name||!r.phone||!r.pickup||!r.dropoff) return send(res,400,{error:'Fill in all fields.'});
    if(!r.payment) return send(res,400,{error:'Choose how you will pay.'});
    if(r.pLat!=null&&r.dLat!=null){const q=await quote(r.pLat,r.pLng,r.dLat,r.dLng);r.km=q.km;r.fare=q.fare;r.road=q.road}
    db.rides.push(r);save();return send(res,200,rideView(r));
  }
  if((x=p.match(/^\/api\/rides\/(\w+)(\/cancel)?$/))){
    const r=db.rides.find(q=>q.id===x[1]); if(!r) return send(res,404,{error:'Ride not found.'});
    if(x[2]&&m==='POST'){ if(r.status==='pending'||r.status==='accepted'){r.status='cancelled';save()} }
    return send(res,200,rideView(r));
  }
  if(m==='POST'&&p==='/api/driver/register'){
    const d={id:uid(),name:clean(b.name),phone:clean(b.phone,20),vehicle:clean(b.vehicle),plate:clean(b.plate,20),license:clean(b.license,40),status:'pending',salt:uid(),created:Date.now()};
    if(!d.name||!d.phone||!d.vehicle||!d.plate||!d.license||clean(b.password,100).length<6) return send(res,400,{error:'Fill in all fields. Password needs 6+ characters.'});
    if(db.drivers.some(q=>q.phone===d.phone)) return send(res,400,{error:'This phone number is already registered.'});
    d.hash=hash(clean(b.password,100),d.salt);db.drivers.push(d);save();return send(res,200,{ok:true});
  }
  if(m==='POST'&&p==='/api/driver/login'){
    const d=db.drivers.find(q=>q.phone===clean(b.phone,20));
    if(!d||hash(clean(b.password,100),d.salt)!==d.hash) return send(res,401,{error:'Wrong phone or password.'});
    if(d.status!=='approved') return send(res,403,{error:d.status==='pending'?'Your registration is waiting for admin approval.':'Your registration was rejected.'});
    const t=uid()+uid();sessions[t]={role:'driver',id:d.id};return send(res,200,{token:t,name:d.name});
  }
  if(p.startsWith('/api/driver/')){
    const s=auth(req,'driver'); if(!s) return send(res,401,{error:'Please log in.'});
    if(m==='GET'&&p==='/api/driver/rides') return send(res,200,{
      open:db.rides.filter(r=>r.status==='pending').reverse(),
      mine:db.rides.filter(r=>r.driverId===s.id&&r.status==='accepted').reverse(),
      done:db.rides.filter(r=>r.driverId===s.id&&r.status==='completed').length});
    if((x=p.match(/^\/api\/driver\/rides\/(\w+)\/(accept|complete)$/))&&m==='POST'){
      const r=db.rides.find(q=>q.id===x[1]); if(!r) return send(res,404,{error:'Ride not found.'});
      if(x[2]==='accept'){ if(r.status!=='pending') return send(res,409,{error:'Another driver already took this ride.'}); r.status='accepted';r.driverId=s.id}
      else if(r.driverId===s.id&&r.status==='accepted') r.status='completed';
      save();return send(res,200,{ok:true});
    }
  }
  if(m==='POST'&&p==='/api/admin/login'){
    if(b.password!==ADMIN_PASSWORD) return send(res,401,{error:'Wrong admin password.'});
    const t=uid()+uid();sessions[t]={role:'admin'};return send(res,200,{token:t});
  }
  if(p.startsWith('/api/admin/')){
    if(!auth(req,'admin')) return send(res,401,{error:'Please log in.'});
    if(m==='GET'&&p==='/api/admin/data') return send(res,200,{drivers:db.drivers.map(pub).map(d=>({...d,license:db.drivers.find(q=>q.id===d.id).license})),rides:db.rides.slice().reverse().map(rideView)});
    if((x=p.match(/^\/api\/admin\/drivers\/(\w+)\/(approve|reject|delete)$/))&&m==='POST'){
      const d=db.drivers.find(q=>q.id===x[1]); if(!d) return send(res,404,{error:'Driver not found.'});
      if(x[2]==='delete') db.drivers=db.drivers.filter(q=>q!==d); else d.status=x[2]==='approve'?'approved':'rejected';
      save();return send(res,200,{ok:true});
    }
  }
  send(res,404,{error:'Not found.'});
}

http.createServer((req,res)=>{
  const p=decodeURIComponent(req.url.split('?')[0]);
  if(p.startsWith('/api/')) return api(req,res,p).catch(e=>send(res,500,{error:'Server error.'}));
  const pages={'/':'index.html','/driver':'driver.html','/admin':'admin.html'};
  const f=path.join(PUB,pages[p]||p);
  if(!f.startsWith(PUB)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);
}).listen(PORT,'0.0.0.0',()=>{
  console.log('\nLuwingu Rider is running.\n  This laptop:   http://localhost:'+PORT);
  for(const l of Object.values(os.networkInterfaces()).flat()) if(l.family==='IPv4'&&!l.internal) console.log('  Other phones/laptops on the same Wi-Fi:  http://'+l.address+':'+PORT);
  console.log('  Drivers: /driver    Admin: /admin  (password: '+ADMIN_PASSWORD+')\n');
});
