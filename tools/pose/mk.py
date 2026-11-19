import json,sys
# usage: mk.py move prop "pri,.." > steps.json  (front+side at 0/.36/.65)
move,prop,pri=sys.argv[1],sys.argv[2],sys.argv[3].split(",")
wr=sys.argv[4] if len(sys.argv)>4 else None
import os
ats=json.loads(os.environ.get("ATS","[0,0.36,0.65]"))
steps=[{"vp":"desktop"},{"go":"#/lib"},{"waitFor":"body"},{"eval":"document.body.innerHTML='';document.body.style.background='#f4f1ee';1"}]
js="(async()=>{const m=await import('./js/view3d.js?'+Date.now());let i=0;const W=%d,H=%d,N=%d;for(const v of ['front','side'])for(const a of %s){const d=document.createElement('div');d.style.cssText='position:fixed;width:'+W+'px;height:'+H+'px;left:'+(i%%N)*W+'px;top:'+Math.floor(i/N)*H+'px';document.body.appendChild(d);await m.mount3d(d,{primary:%s,secondary:[],move:'p:%s',view:v,at:a,prop:%s,wrong:%s});i++}return 'ok'})()"%(int(os.environ.get("TW",300)),int(os.environ.get("TH",440)),len(ats),json.dumps(ats),json.dumps(pri),move,json.dumps(prop if prop!='-' else None),json.dumps(wr))
steps.append({"eval":js,"log":True,"wait":2500}); steps.append({"shot":move+("-w"+wr if wr else "")})
print(json.dumps(steps))
