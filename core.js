export const BUCKETS = [
  ['bucket_user_harm', 'User-impact indicators', '#ab9bdb'],
  ['bucket_weakness', 'Security weaknesses', '#78a9d7'],
  ['bucket_malware', 'Malware-related indicators', '#d5a277'],
  ['bucket_stealth', 'Infrastructure & history', '#75b8ab'],
];
export const FLAGS = [
  ['js_eval_usage', 'eval()', 'An eval() pattern appears in inline script text.'],
  ['js_function_constructor_usage', 'Function constructor', 'A new Function() pattern appears in inline script text.'],
  ['js_settimeout_string_usage', 'String-based timer', 'A setTimeout() call with a string argument appears in inline script text.'],
  ['js_keylogging_detected', 'Keyboard-event pattern', 'A keyboard-event listener pattern appears in inline script text; this does not establish keystroke theft.'],
  ['js_redirection_detected', 'Redirect pattern', 'A location assignment or replacement pattern appears in inline script text.'],
  ['js_content_injection_detected', 'DOM-write pattern', 'An innerHTML assignment or document.write() pattern appears in inline script text.'],
  ['js_cookie_access_detected', 'Cookie-access pattern', 'A document.cookie pattern appears in inline script text.'],
];
export const GROUP_COLORS = ['#79a9db', '#d5b36e', '#b796cc'];
export const valid = v => typeof v === 'number' && Number.isFinite(v);
export const sum = values => values.filter(valid).reduce((a, b) => a + b, 0);
export const mean = values => { const a = values.filter(valid); return a.length ? sum(a) / a.length : null; };
export const median = values => { const a = values.filter(valid).sort((a,b) => a-b); return a.length ? (a[Math.floor((a.length-1)/2)] + a[Math.ceil((a.length-1)/2)]) / 2 : null; };
export const fmt = (v, n = 1) => valid(v) ? v.toLocaleString('en-GB', { maximumFractionDigits:n, minimumFractionDigits:n }) : 'Unavailable';
export const count = n => Number(n).toLocaleString('en-GB');
export const pct = v => valid(v) ? `${fmt(v * 100)}%` : 'Unavailable';
export const pp = v => valid(v) ? `${v > 0 ? '+' : ''}${fmt(v * 100)} pp` : 'Unavailable';
export const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const unique = a => [...new Set(a.filter(x => x !== null && x !== undefined && x !== ''))];
export function rate(rows, key, predicate = v => v === true) {
  const a = rows.filter(r => r[key] !== null && r[key] !== undefined);
  const positive = a.filter(r => predicate(r[key])).length;
  return { value: a.length ? positive/a.length : null, positive, observed:a.length, unavailable:rows.length-a.length };
}
export function filterRows(rows, f) {
  return rows.filter(d =>
    (!f.q || d.domain.toLowerCase().includes(f.q.toLowerCase())) &&
    (!f.country || d.europe_countries.includes(f.country)) &&
    (!f.provider || d.org_name === f.provider) &&
    (!f.registrar || d.whois_registrar === f.registrar) &&
    (f.group === '' || f.group === undefined || String(d.cluster) === String(f.group)) &&
    (!f.platform || d.platforms.some(p => p.platform === f.platform && (!f.service || p.service === f.service))) &&
    (!f.service || d.platforms.some(p => p.service === f.service && (!f.platform || p.platform === f.platform))) &&
    (!f.vt || d.virustotal_malicious === true) &&
    (!f.cf || d.cloudflare_protected === true) &&
    (!f.multi || d.cluster_size > 1) &&
    (!f.js || (valid(d.js_malicious_behavior_score_10) && d.js_malicious_behavior_score_10 >= Number(f.js))) &&
    (!f.zap || (valid(d.zap_high_risk_count) && d.zap_high_risk_count >= Number(f.zap)))
  );
}
export function groupBy(rows, key) {
  const m = new Map();
  for (const row of rows) { const k = typeof key === 'function' ? key(row) : row[key]; if (k === null || k === undefined || k === '') continue; if (!m.has(k)) m.set(k, []); m.get(k).push(row); }
  return [...m].map(([key, rows]) => ({ key, rows, n:rows.length }));
}
export function countryStats(rows, countries) {
  return countries.map(key => {
    const ds = rows.filter(d => d.europe_countries.includes(key));
    const multi = ds.filter(d => d.cluster_size > 1);
    return { key, rows:ds, n:ds.length, mo_domains:multi.length, mo_clusters:unique(multi.map(d => d.favicon_hash)).length, mo_share:ds.length ? multi.length/ds.length : null, vt_rate:rate(ds,'virustotal_malicious').value, risk_mean:mean(ds.map(d => d.total_risk)) };
  });
}
export function associations(rows) {
  return FLAGS.map(([key,label]) => {
    const ds = rows.filter(d => d[key] === true);
    // A baseline with the same measured flag/outcome population; no unknown-as-negative coding.
    const measuredVT = rows.filter(d => typeof d[key] === 'boolean' && typeof d.virustotal_malicious === 'boolean');
    const measuredZAP = rows.filter(d => typeof d[key] === 'boolean' && valid(d.zap_high_risk_count));
    const vt = rate(ds,'virustotal_malicious');
    const zap = rate(ds,'zap_high_risk_count',v => v>0);
    const baseVT = rate(measuredVT,'virustotal_malicious').value;
    const baseZAP = rate(measuredZAP,'zap_high_risk_count',v => v>0).value;
    return {key,label,baseVTPositive:rate(measuredVT,'virustotal_malicious').positive,baseVTObserved:measuredVT.length,n:ds.length,prevalence:rate(rows,key),vt,zap,baseVT,baseZAP,vtDiff:valid(vt.value)&&valid(baseVT)?vt.value-baseVT:null,zapDiff:valid(zap.value)&&valid(baseZAP)?zap.value-baseZAP:null,score:mean(ds.map(d=>d.total_risk))};
  });
}
export function priceRows(rows, {platform='', service='', exclude=false}={}) {
  return rows.flatMap(d => d.platforms.filter(p => (!platform||p.platform===platform)&&(!service||p.service===service)&&(!exclude||p.outlier!==true)).map(p=>({...p,domain:d.domain})));
}
export function graphData(rows, {mode='favicon',hash='',links=['ip','org_name','reverse_dns'],focus='',limit=150,minDegree=0}={}) {
  const selected = mode === 'favicon' ? rows.filter(d => d.favicon_hash === hash) : rows;
  const nodes = new Map(), edges = new Map();
  const add = (id,label,type,extra={}) => {if (!nodes.has(id)) nodes.set(id,{data:{id,label,type,...extra}});};
  const link = (a,b,type,value) => { const id=`${a}→${b}:${type}`; if (!edges.has(id)) edges.set(id,{data:{id,source:a,target:b,type,value}}); };
  const addDomain=d=>add(`domain:${d.domain}`,d.domain,'domain',{domain:d.domain,score:d.total_risk,group:d.cluster});
  for(const d of selected) {
    addDomain(d);
    const attributes = mode==='full' ? ['ip'] : mode==='provider' ? ['org_name'] : links;
    for(const key of attributes) {
      const value=d[key]; if (!value || value==='nan') continue;
      const id=`${key}:${value}`;
      add(id,value,key); link(`domain:${d.domain}`,id,key,value);
      if(mode!=='favicon' && (d.asn_description||d.asn)) {
        const av=d.asn_description||d.asn, ai=`asn:${av}`; add(ai,av,'asn');link(id,ai,'asn',av);
      }
    }
    if(mode==='favicon' && links.includes('favicon_hash') && hash) {
      const id=`favicon_hash:${hash}`;add(id,`Favicon ${hash.slice(0,8)}…`,'favicon_hash');link(`domain:${d.domain}`,id,'favicon_hash',hash);
    }
  }
  const degree=new Map();for(const e of edges.values())for(const id of [e.data.source,e.data.target])degree.set(id,(degree.get(id)||0)+1);
  let eligible=[...nodes.values()].filter(n=>n.data.type!=='domain'||(degree.get(n.data.id)||0)>minDegree||minDegree===0);
  if(focus) {
    const center=`domain:${focus}`,keep=new Set([center]);
    for(const e of edges.values())if([e.data.source,e.data.target].includes(center)){keep.add(e.data.source);keep.add(e.data.target);}
    const attrs=new Set([...keep].filter(x=>x!==center));
    for(const e of edges.values())if(attrs.has(e.data.source)||attrs.has(e.data.target)){keep.add(e.data.source);keep.add(e.data.target);}
    eligible=eligible.filter(n=>keep.has(n.data.id));
  }
  const eligibleIds=new Set(eligible.map(n=>n.data.id));
  const adjacency=new Map();for(const e of edges.values()){const {source:a,target:b}=e.data;if(!eligibleIds.has(a)||!eligibleIds.has(b))continue;for(const [x,y]of[[a,b],[b,a]]){if(!adjacency.has(x))adjacency.set(x,[]);adjacency.get(x).push(y);}}
  // Budget complete domain–attribute–ASN bundles, rather than consuming the cap with high-degree hubs.
  const domainNodes=eligible.filter(n=>n.data.type==='domain');
  const reachable=new Set();for(const n of domainNodes){reachable.add(n.data.id);for(const attr of adjacency.get(n.data.id)||[]){reachable.add(attr);for(const end of adjacency.get(attr)||[])if(!end.startsWith('domain:'))reachable.add(end);}}
  eligible=eligible.filter(n=>reachable.has(n.data.id));
  const order=domainNodes.slice().sort((a,b)=>(a.data.domain===focus?-1:b.data.domain===focus?1:0)||((b.data.score??-1)-(a.data.score??-1))||a.data.id.localeCompare(b.data.id));
  const keep=new Set();for(const n of order){
    const bundle=new Set([n.data.id]);for(const attr of adjacency.get(n.data.id)||[]){bundle.add(attr);for(const end of adjacency.get(attr)||[])if(!end.startsWith('domain:'))bundle.add(end);}
    const additions=[...bundle].filter(id=>!keep.has(id));
    if(keep.size+additions.length<=limit)for(const id of additions)keep.add(id);
  }
  const keptEdges=[...edges.values()].filter(e=>keep.has(e.data.source)&&keep.has(e.data.target));
  return {nodes:eligible.filter(n=>keep.has(n.data.id)),edges:keptEdges,totalNodes:eligible.length,totalDomains:selected.length,shownDomains:eligible.filter(n=>keep.has(n.data.id)&&n.data.type==='domain').length};
}
