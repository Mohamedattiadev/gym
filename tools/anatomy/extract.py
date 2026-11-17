import re, json, sys
src = sys.argv[1]; out = sys.argv[2]
res = {}
for view in ("Front","Back"):
    t = open(f"{src}/dist/assets/body{view}.js").read()
    parts = []
    for blk in re.split(r'\n    \{', t)[1:]:
        slug = re.search(r'slug: "([a-z-]+)"', blk).group(1)
        for side in ("left","right","common"):
            m = re.search(side + r': \[(.*?)\]', blk, re.S)
            if m:
                for d in re.findall(r'"([^"]+)"', m.group(1)):
                    parts.append({"slug":slug,"side":side,"d":d})
    res[view.lower()] = parts
w = open(f"{src}/dist/components/SvgMaleWrapper.js").read()
outs = re.findall(r'd="([^"]+)" accessible=\{true\} accessibilityLabel="male-body-outline-(front|back)"', w)
for d, v in outs: res[v+"_outline"] = d
json.dump(res, open(out,"w"))
print({k:(len(v) if isinstance(v,list) else len(v)) for k,v in res.items()})
