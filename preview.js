import { faviconNetwork, relationLabel } from './favicon-network.js';

const selector = document.getElementById('favicon-group');
const container = document.getElementById('network');
const status = document.getElementById('selection');
const reset = document.getElementById('reset');
let groups = [], cy, resizeTimer;

function clearSelection() {
  cy?.elements().removeClass('faded highlighted');
  status.textContent = 'Select a site to highlight its connections.';
}
function draw() {
  cy?.destroy();
  const selected = groups.find(group => group.id === selector.value);
  if (!selected) return;
  const graph = faviconNetwork(selected.rows);
  document.getElementById('counts').textContent = `${graph.nodes.length} sites, ${graph.edges.length} connections`;
  container.setAttribute('aria-label', `${selected.label}: ${graph.nodes.length} sites, ${graph.edges.length} connections`);
  cy = window.cytoscape({
    container, elements: [...graph.nodes, ...graph.edges],
    layout: { name: 'preset', padding: 32, positions: node => {
      const angle = 2 * Math.PI * graph.nodes.findIndex(item => item.data.id === node.id()) / graph.nodes.length;
      return { x: Math.cos(angle) * Math.max(65, (container.clientWidth - 100) / 2), y: Math.sin(angle) * Math.max(50, (container.clientHeight - 100) / 2) };
    } },
    // Leave wheel/touch scrolling to the surrounding homepage.
    userZoomingEnabled: false, userPanningEnabled: false, boxSelectionEnabled: false,
    style: [
      { selector: 'node', style: { width: 15, height: 15, 'background-color': '#81bdd7', 'border-color': '#152230', 'border-width': 1, label: graph.nodes.length <= 12 ? 'data(label)' : '', color: '#cedce9', 'font-size': 11, 'text-valign': 'bottom', 'text-margin-y': 6 } },
      { selector: 'edge', style: { width: 1.1, 'line-color': '#7894ae', opacity: .65, 'curve-style': 'haystack' } },
      { selector: '.faded', style: { opacity: .12 } },
      { selector: 'node.highlighted', style: { label: 'data(label)', 'background-color': '#c6e8f3', 'border-width': 2, 'border-color': '#96d5e5' } },
    ],
  });
  clearSelection();
  cy.on('tap', 'node', event => {
    const node = event.target;
    cy.elements().addClass('faded');
    node.closedNeighborhood().removeClass('faded');
    cy.nodes().removeClass('highlighted');
    node.addClass('highlighted');
    const types = [...new Set(Array.from(node.connectedEdges()).flatMap(edge => edge.data('evidence').map(item => relationLabel(item.type))))];
    status.textContent = `${node.data('label')}: ${node.neighborhood('node').length} connected sites${types.length ? '. ' + types.join(', ') : ''}.`;
  });
  cy.on('tap', 'edge', event => {
    status.textContent = event.target.data('evidence').map(item => relationLabel(item.type)).join(', ') + '.';
  });
  cy.on('tap', event => { if (event.target === cy) clearSelection(); });
}
async function init() {
  try {
    const response = await fetch('./data/domains.json');
    if (!response.ok) throw new Error('Unable to load network data');
    const data = await response.json(), memberships = new Map();
    for (const row of data) {
      if (!row.favicon_hash || row.cluster_size < 2) continue;
      if (!memberships.has(row.favicon_hash)) memberships.set(row.favicon_hash, { id: row.favicon_hash, label: row.favicon_id, rows: [] });
      memberships.get(row.favicon_hash).rows.push(row);
    }
    groups = [...memberships.values()].sort((a, b) => b.rows.length - a.rows.length || a.id.localeCompare(b.id));
    selector.replaceChildren(...groups.map(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = `${group.label} (${group.rows.length} sites)`;
      return option;
    }));
    if (!groups.length) throw new Error('No shared favicon groups are available');
    selector.disabled = reset.disabled = false;
    selector.addEventListener('change', draw);
    reset.addEventListener('click', () => { clearSelection(); cy?.fit(undefined, 32); });
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(draw, 150); });
    draw();
  } catch (error) {
    status.textContent = error.message;
    console.error(error);
  }
}
init();
