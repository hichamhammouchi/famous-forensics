// Connections come only from equality of recorded technical attributes.
export function faviconNetwork(rows, { limit = 150, links = ['ip', 'org_name', 'reverse_dns'] } = {}) {
  const shown = rows.slice(0, limit);
  const nodes = shown.map(row => ({ data: {
    id: `domain:${row.domain}`, label: row.domain, type: 'domain',
    score: row.total_risk, group: row.cluster,
  } }));
  const edges = [];
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const evidence = links.filter(key => shown[i][key] && shown[i][key] === shown[j][key])
        .map(type => ({ type, value: shown[i][type] }));
      if (evidence.length) edges.push({ data: {
        id: `link:${i}:${j}`, source: nodes[i].data.id, target: nodes[j].data.id,
        evidence, type: 'shared', value: evidence.map(item => relationLabel(item.type)).join(', '),
      } });
    }
  }
  return { nodes, edges, totalNodes: rows.length, totalDomains: rows.length, shownDomains: shown.length };
}
export function relationLabel(key) {
  return { ip: 'Shared IP', org_name: 'Shared hosting provider', reverse_dns: 'Shared reverse DNS' }[key] || key;
}
