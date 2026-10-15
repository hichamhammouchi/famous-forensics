import { fmt, count, pct, escape, valid, mean, BUCKETS, GROUP_COLORS } from './core.js';
const D = () => window.d3;
let serial = 0;
export function tip(event, html) {
  const el=document.querySelector('#chart-tip');el.innerHTML=html;el.hidden=false;
  el.style.left=`${Math.max(8,Math.min(event.clientX+13,window.innerWidth-325))}px`;
  el.style.top=`${Math.max(8,Math.min(event.clientY+13,window.innerHeight-160))}px`;
}
export function hideTip(){document.querySelector('#chart-tip').hidden=true;}
function base(id,height=250,label='Data chart') {
  const el=document.getElementById(id);if(!el)return null;
  el.innerHTML='';const w=Math.max(el.clientWidth,290);
  const svg=D().select(el).append('svg').attr('viewBox',`0 0 ${w} ${height}`).attr('role','img').attr('aria-label',label);
  return {el,svg,w,h:height};
}
function bind(selection,html,click){
  selection.on('pointermove',(e,d)=>tip(e,html(d))).on('pointerleave',hideTip);
  if(click)selection.attr('class','chart-action').attr('tabindex',0).attr('role','button').attr('aria-label',d=>html(d).replace(/<[^>]*>/g,' ')).on('click',(e,d)=>{hideTip();click(d);}).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();click(d);}});
}
export function bars(id,data,{height,format=v=>count(v),color='#74accb',labelWidth=145,onClick,description='Bar chart'}={}) {
  const b=base(id,height||Math.max(190,data.length*31+32),description);if(!b)return;
  const {svg,w,h}=b, left=Math.min(labelWidth,w*.44),right=58;
  const x=D().scaleLinear().domain([0,D().max(data,d=>valid(d.value)?d.value:0)||1]).range([left,w-right]);
  const y=D().scaleBand().domain(data.map(d=>d.label)).range([9,h-25]).padding(.43);
  svg.append('g').attr('transform',`translate(0,${h-20})`).attr('class','axis').call(D().axisBottom(x).ticks(4).tickSize(0).tickFormat(v=>format(v)));
  for(const t of x.ticks(4))svg.append('line').attr('class','gridline').attr('x1',x(t)).attr('x2',x(t)).attr('y1',0).attr('y2',h-28);
  const rows=svg.selectAll('.bar-row').data(data).join('g');
  rows.append('text').attr('class','chart-label').attr('x',left-12).attr('y',d=>y(d.label)+y.bandwidth()/2+3).attr('text-anchor','end').text(d=>d.label.length>Math.floor(left/5.8)?d.label.slice(0,Math.floor(left/5.8)-1)+'…':d.label);
  const rects=rows.append('rect').attr('x',left).attr('y',d=>y(d.label)).attr('height',y.bandwidth()).attr('width',d=>valid(d.value)?Math.max(0,x(d.value)-left):0).attr('rx',3).attr('fill',d=>d.color||color);
  rows.append('text').attr('x',d=>(valid(d.value)?x(d.value):left)+7).attr('y',d=>y(d.label)+y.bandwidth()/2+3).attr('font-size',12).text(d=>valid(d.value)?format(d.value):'N/A');
  bind(rects,d=>`<b>${escape(d.label)}</b><br>${d.tip||format(d.value)}`,onClick);
}
export function histogram(id,rows,key='total_risk') {
  const b=base(id,240,'Distribution of saved combined indicator scores');if(!b)return;
  const {svg,w,h}=b,vals=rows.map(d=>d[key]).filter(valid);
  const x=D().scaleLinear().domain([0,Math.max(1,D().max(vals)||1)]).nice().range([36,w-15]);
  const bins=D().bin().domain(x.domain()).thresholds(x.ticks(15))(vals);
  const y=D().scaleLinear().domain([0,D().max(bins,d=>d.length)||1]).nice().range([h-35,12]);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-35})`).call(D().axisBottom(x).ticks(6).tickSize(0));
  svg.append('g').attr('class','axis').attr('transform','translate(36,0)').call(D().axisLeft(y).ticks(4).tickSize(0));
  const rects=svg.selectAll('rect.bin').data(bins).join('rect').attr('x',d=>x(d.x0)+1).attr('width',d=>Math.max(0,x(d.x1)-x(d.x0)-3)).attr('y',d=>y(d.length)).attr('height',d=>h-35-y(d.length)).attr('rx',2).attr('fill','#74accb');
  bind(rects,d=>`<b>${fmt(d.x0)}–${fmt(d.x1)} points</b><br>${count(d.length)} domains`);
  svg.append('text').attr('x',(w+36)/2).attr('y',h-3).attr('text-anchor','middle').text('Combined score (points)');
}
export function bucketGroups(id,rows) {
  const data=[0,1,2].map(g=>({key:g,rows:rows.filter(d=>d.cluster===g)})).filter(g=>g.rows.length);
  const b=base(id,265,'Mean saved bucket scores by original behavior group');if(!b)return;
  const {svg,w,h}=b;
  const labels=['User impact','Weaknesses','Malware-related','Infrastructure'];
  const x=D().scaleBand().domain(labels).range([34,w-10]).padding(.28);
  const inner=D().scaleBand().domain(data.map(d=>d.key)).range([0,x.bandwidth()]).padding(.12);
  const y=D().scaleLinear().domain([0,10]).range([h-45,10]);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-45})`).call(D().axisBottom(x).tickSize(0)).selectAll('text').attr('font-size',11);
  svg.append('g').attr('class','axis').attr('transform','translate(34,0)').call(D().axisLeft(y).ticks(5).tickSize(0));
  const entries=BUCKETS.flatMap(([key,label],i)=>data.map(g=>({key,label,short:labels[i],group:g.key,value:mean(g.rows.map(d=>d[key])),n:g.rows.length})));
  const rects=svg.selectAll('rect.bucket').data(entries).join('rect').attr('x',d=>x(d.short)+inner(d.group)).attr('y',d=>y(d.value||0)).attr('height',d=>h-45-y(d.value||0)).attr('width',inner.bandwidth()).attr('rx',2).attr('fill',d=>GROUP_COLORS[d.group]);
  bind(rects,d=>`<b>Group ${d.group}; ${escape(d.label)}</b><br>Mean ${fmt(d.value,2)} points; ${count(d.n)} domains`);
}
export function scatter(id,rows,onClick) {
  const b=base(id,350,'PCA projection of saved forensic features; dots represent sites, colored by behavior group');if(!b)return;
  const {svg,w,h}=b,data=rows.filter(d=>valid(d.pca_x)&&valid(d.pca_y));
  if(!data.length)return;
  const extent=k=>{const e=D().extent(data,d=>d[k]);return e[0]===e[1]?[e[0]-1,e[1]+1]:e;};
  const x=D().scaleLinear().domain(extent('pca_x')).nice().range([40,w-20]);
  const y=D().scaleLinear().domain(extent('pca_y')).nice().range([h-37,15]);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-37})`).call(D().axisBottom(x).ticks(6).tickSize(0));
  svg.append('g').attr('class','axis').attr('transform','translate(40,0)').call(D().axisLeft(y).ticks(6).tickSize(0));
  const circles=svg.selectAll('circle.point').data(data.slice().sort((a,b)=>(b.total_risk||0)-(a.total_risk||0))).join('circle').attr('cx',d=>x(d.pca_x)).attr('cy',d=>y(d.pca_y)).attr('r',d=>3+Math.sqrt(Math.max(d.total_risk||0,0))*.9).attr('fill',d=>GROUP_COLORS[d.cluster]||'#9ca6b7').attr('opacity',.65).attr('stroke','white').attr('stroke-width',.5);
  bind(circles,d=>`<b>Behavior group ${d.cluster}</b><br>Position: saved PCA projection<br>Dot size: combined score`,onClick);
  svg.append('text').attr('x',w/2).attr('y',h-4).attr('text-anchor','middle').text('Principal component 1');
  svg.append('text').attr('transform',`translate(11,${h/2}) rotate(-90)`).attr('text-anchor','middle').text('Principal component 2');
}
export function matrix(id,xlabels,ylabels,cells,{format=v=>count(v),description='Data matrix',diverging=false,onClick}={}) {
  const h=Math.max(235,ylabels.length*28+84),b=base(id,h,description);if(!b)return;
  const {svg,w}=b,left=Math.min(126,w*.3),bottom=70;
  const x=D().scaleBand().domain(xlabels).range([left,w-55]).padding(.06);
  const y=D().scaleBand().domain(ylabels).range([10,h-bottom]).padding(.06);
  const max=D().max(cells,d=>valid(d.value)?Math.abs(d.value):0)||1;
  const color=diverging?D().scaleDiverging([-max,0,max],D().interpolatePuOr):D().scaleSequential([0,max],t=>D().interpolateRgb('#26394d','#7dbbd5')(t));
  const rects=svg.selectAll('rect.cell').data(cells).join('rect').attr('x',d=>x(d.x)).attr('y',d=>y(d.y)).attr('width',x.bandwidth()).attr('height',y.bandwidth()).attr('rx',2).attr('fill',d=>valid(d.value)?color(d.value):'#303946');
  bind(rects,d=>`<b>${escape(d.y)}; ${escape(d.x)}</b><br>${d.tip||format(d.value)}`,onClick);
  if(x.bandwidth()>38)svg.selectAll('text.cell-value').data(cells).join('text').attr('x',d=>x(d.x)+x.bandwidth()/2).attr('y',d=>y(d.y)+y.bandwidth()/2+3).attr('text-anchor','middle').style('fill',d=>valid(d.value)&&Math.abs(d.value)>max*.6?'#101923':'#dbe8f3').style('font-size',11).attr('pointer-events','none').text(d=>valid(d.value)?format(d.value):'—');
  for(const label of xlabels)svg.append('text').attr('transform',`translate(${x(label)+x.bandwidth()/2},${h-bottom+12}) rotate(35)`).attr('text-anchor','start').style('font-size',11).text(label.length>13?label.slice(0,12)+'…':label).append('title').text(label);
  for(const label of ylabels)svg.append('text').attr('x',left-8).attr('y',y(label)+y.bandwidth()/2+3).attr('text-anchor','end').style('font-size',11).text(label.length>13?label.slice(0,12)+'…':label).append('title').text(label);
}
export function differences(id,data,{onClick}={}) {
  const b=base(id,295,'VirusTotal flagged rate compared with the selection average, in percentage points');if(!b)return;
  const {svg,w,h}=b,left=Math.min(153,w*.43),right=53;
  const max=Math.max(.01,D().max(data,d=>Math.abs(d.vtDiff||0))||.01);
  const x=D().scaleLinear().domain([-max,max]).range([left,w-right]);
  const y=D().scaleBand().domain(data.map(d=>d.label)).range([10,h-28]).padding(.4);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-22})`).call(D().axisBottom(x).ticks(4).tickFormat(v=>`${fmt(v*100)} pp`).tickSize(0));
  svg.append('line').attr('x1',x(0)).attr('x2',x(0)).attr('y1',0).attr('y2',h-30).attr('stroke','#b9bfcc').attr('stroke-dasharray','3 3');
  const groups=svg.selectAll('g.diff').data(data).join('g');
  groups.append('text').attr('class','chart-label').attr('x',left-9).attr('y',d=>y(d.label)+y.bandwidth()/2+3).attr('text-anchor','end').style('font-size',11).text(d=>d.label);
  const bars=groups.append('rect').attr('x',d=>x(Math.min(d.vtDiff||0,0))).attr('y',d=>y(d.label)).attr('width',d=>valid(d.vtDiff)?Math.abs(x(d.vtDiff)-x(0)):0).attr('height',y.bandwidth()).attr('rx',2).attr('fill',d=>d.vtDiff>0?'#ae7952':'#6d95b5');
  bind(bars,d=>`<b>${escape(d.label)}</b><br>Sites with this pattern: ${pct(d.vt.value)} (${d.vt.positive}/${d.vt.observed} flagged)<br>Selection average: ${pct(d.baseVT)} (${d.baseVTPositive}/${d.baseVTObserved} flagged)<br>Difference: ${valid(d.vtDiff)?(d.vtDiff>0?'+':'')+fmt(d.vtDiff*100)+' percentage points':'Unavailable'}`,onClick);
}
export function boxes(id,data) {
  const labels=[...new Set(data.map(d=>d.platform))],positive=data.filter(d=>valid(d.median)&&d.median>0);
  const b=base(id,280,'Distribution of saved per-domain median prices on a logarithmic axis');if(!b)return;
  const {svg,w,h}=b;if(!positive.length){b.el.innerHTML='<div class="empty">No positive prices for a logarithmic plot.</div>';return;}
  const extent=D().extent(positive,d=>d.median);if(extent[0]===extent[1]){extent[0]/=2;extent[1]*=2;}
  const y=D().scaleLog().domain(extent).nice().range([h-52,12]);
  const x=D().scaleBand().domain(labels).range([52,w-10]).padding(.48);
  svg.append('g').attr('class','axis').attr('transform','translate(52,0)').call(D().axisLeft(y).ticks(5, '~g').tickSize(0));
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-52})`).call(D().axisBottom(x).tickSize(0)).selectAll('text').attr('transform','rotate(25)').attr('text-anchor','start');
  for(const label of labels){
    const a=positive.filter(d=>d.platform===label).map(d=>d.median).sort((a,b)=>a-b);if(!a.length)continue;
    const q1=D().quantile(a,.25),q2=D().quantile(a,.5),q3=D().quantile(a,.75),iqr=q3-q1;
    const lo=a.find(v=>v>=q1-1.5*iqr),hi=[...a].reverse().find(v=>v<=q3+1.5*iqr),cx=x(label)+x.bandwidth()/2;
    svg.append('line').attr('x1',cx).attr('x2',cx).attr('y1',y(lo)).attr('y2',y(hi)).attr('stroke','#80b8d0');
    const rect=svg.append('rect').datum({label,a,q1,q2,q3}).attr('x',x(label)).attr('y',y(q3)).attr('width',x.bandwidth()).attr('height',Math.max(1,y(q1)-y(q3))).attr('fill','#34566d').attr('stroke','#80b8d0');
    svg.append('line').attr('x1',x(label)).attr('x2',x(label)+x.bandwidth()).attr('y1',y(q2)).attr('y2',y(q2)).attr('stroke','#b6e0ee').attr('stroke-width',2);
    for(const v of a.filter(v=>v<lo||v>hi))svg.append('circle').attr('cx',cx).attr('cy',y(v)).attr('r',2).attr('fill','#80b8d0').attr('opacity',.55);
    bind(rect,d=>`<b>${escape(d.label)}</b><br>Median ${fmt(d.q2,4)} source units<br>Q1 ${fmt(d.q1,4)}; Q3 ${fmt(d.q3,4)}<br>${count(d.a.length)} positive records`);
  }
}
export function countryMap(id,topology,stats,key,label,onClick) {
  const b=base(id,390,`European country associations: ${label}`);if(!b)return;
  const {svg,w,h}=b,features=window.topojson.feature(topology,topology.objects.countries).features;
  const aliases={'Czech Republic':'Czechia','Russian Federation':'Russia','Republic of Serbia':'Serbia','Macedonia':'North Macedonia','Bosnia and Herz.':'Bosnia and Herzegovina','Vatican':'Vatican City','Türkiye':'Turkey'};
  const lookup=new Map(stats.map(d=>[d.key,d])),max=D().max(stats,d=>valid(d[key])?d[key]:0)||1;
  const color=D().scaleSequential([0,max],t=>D().interpolateRgb('#26394d','#7dbbd5')(t));
  const proj=D().geoMercator().center([17,54]).scale(w*.65).translate([w*.5,h*.52]);
  const path=D().geoPath(proj),clip=`clip-${++serial}`;
  svg.append('defs').append('clipPath').attr('id',clip).append('rect').attr('width',w).attr('height',h);
  const g=svg.append('g').attr('clip-path',`url(#${clip})`);
  const paths=g.selectAll('path').data(features).join('path').attr('d',path).attr('class','country').attr('fill',f=>{
    const d=lookup.get(aliases[f.properties.name]||f.properties.name);return d&&valid(d[key])?color(d[key]):'#303946';
  });
  bind(paths,f=>{const name=aliases[f.properties.name]||f.properties.name,d=lookup.get(name);return `<b>${escape(name)}</b><br>${d?.n?`${label}: ${['vt_rate','mo_share'].includes(key)?pct(d[key]):fmt(d[key],key==='risk_mean'?2:0)}<br>${count(d.n)} matched domains`:'No matched observations in this view'}`;},f=>{
    const name=aliases[f.properties.name]||f.properties.name;if(lookup.has(name))onClick(name);
  });
  return max;
}
