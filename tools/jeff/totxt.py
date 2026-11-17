import json,sys,os
d,out=sys.argv[1],sys.argv[2]
for f in os.listdir(d):
    if f.endswith('.info.json'):
        vid=f[:-10]; info=json.load(open(os.path.join(d,f)))
        with open(os.path.join(out,vid+'.chap'),'w') as o:
            o.write(info.get('title','')+' | '+info.get('channel','')+' | dur '+str(info.get('duration'))+'\n')
            for c in info.get('chapters') or []: o.write('%d %s\n'%(c['start_time'],c['title']))
        sf=os.path.join(d,vid+'.en.json3')
        if os.path.exists(sf):
            s=json.load(open(sf))
            with open(os.path.join(out,vid+'.txt'),'w') as o:
                for e in s.get('events',[]):
                    t=''.join(x.get('utf8','') for x in e.get('segs',[]) or []).strip()
                    if t: o.write('%d %s\n'%(e['tStartMs']//1000,t.replace('\n',' ')))
