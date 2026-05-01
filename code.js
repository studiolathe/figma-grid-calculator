figma.showUI(__html__, {
  width: 360,
  height: 640
});

const PREVIEW_KEY = 'gridPreviewFrames';
const COLLECTION_NAME = 'Responsive Tokens';
const PREVIEW_HEIGHT = 900;
const PREVIEW_GAP = 80;

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'sync-preview') {
      syncPreviewFrames(msg.devices, msg.showPreview !== false);
    } else if (msg.type === 'upsert-variables') {
      upsertResponsiveVariables(msg.devices);
      figma.ui.postMessage({ type: 'variables-updated', silent: msg.silent === true });
    }
  } catch (err) {
    console.error(err);
    figma.ui.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
  }
};

// --- Preview frames -------------------------------------------------------

function loadPreviewIds() {
  const raw = figma.root.getPluginData(PREVIEW_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}

function savePreviewIds(ids) {
  figma.root.setPluginData(PREVIEW_KEY, JSON.stringify(ids));
}

function getExistingPreviewFrames() {
  const ids = loadPreviewIds();
  const frames = [];
  for (const id of ids) {
    const node = figma.getNodeById(id);
    if (node && node.type === 'FRAME' && !node.removed) {
      frames.push(node);
    }
  }
  return frames;
}

function applyDeviceToFrame(frame, device) {
  frame.resizeWithoutConstraints(device.maxWidth, PREVIEW_HEIGHT);
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  frame.layoutGrids = [{
    pattern: 'COLUMNS',
    sectionSize: device.columnWidth,
    gutterSize: device.gutterWidth,
    alignment: 'CENTER',
    count: device.columns,
  }];
  frame.name = `${device.name} — ${device.maxWidth}px / ${device.columns}col (${device.columnWidth}px)`;
}

function syncPreviewFrames(devices, showPreview) {
  const existing = getExistingPreviewFrames();

  if (!showPreview) {
    existing.forEach(f => f.remove());
    savePreviewIds([]);
    return;
  }

  if (!Array.isArray(devices) || devices.length === 0) return;

  // Defensive: skip if any device's columnWidth isn't valid (UI gates this anyway).
  const allValid = devices.every(d => Number.isFinite(d.columnWidth) && d.columnWidth > 0);
  if (!allValid) return;

  const frames = [];

  // Reuse existing frames by index.
  const reuseCount = Math.min(existing.length, devices.length);
  for (let i = 0; i < reuseCount; i++) {
    applyDeviceToFrame(existing[i], devices[i]);
    frames.push(existing[i]);
  }

  // Delete trailing frames if devices shrank.
  for (let i = devices.length; i < existing.length; i++) {
    existing[i].remove();
  }

  // Create frames for new devices.
  if (devices.length > existing.length) {
    let anchorX, anchorY;
    if (frames.length > 0) {
      const last = frames[frames.length - 1];
      anchorX = last.x + last.width + PREVIEW_GAP;
      anchorY = last.y;
    } else {
      const totalWidth = devices.reduce((sum, d, i) => sum + d.maxWidth + (i > 0 ? PREVIEW_GAP : 0), 0);
      const center = figma.viewport.center;
      anchorX = center.x - totalWidth / 2;
      anchorY = center.y - PREVIEW_HEIGHT / 2;
    }

    for (let i = existing.length; i < devices.length; i++) {
      const device = devices[i];
      const frame = figma.createFrame();
      applyDeviceToFrame(frame, device);
      frame.x = anchorX;
      frame.y = anchorY;
      anchorX += device.maxWidth + PREVIEW_GAP;
      frames.push(frame);
    }

    // Scroll into view only when new frames are created.
    if (existing.length === 0) {
      figma.viewport.scrollAndZoomIntoView(frames);
    }
  }

  savePreviewIds(frames.map(f => f.id));
}

// --- Variable upsert ------------------------------------------------------

function findCollection(name) {
  const all = figma.variables.getLocalVariableCollections();
  return all.find(c => c.name === name) || null;
}

function reconcileModes(collection, devices) {
  // Add modes if too few.
  while (collection.modes.length < devices.length) {
    const idx = collection.modes.length;
    collection.addMode(devices[idx].name);
  }
  // Remove trailing modes if too many.
  while (collection.modes.length > devices.length) {
    const last = collection.modes[collection.modes.length - 1];
    collection.removeMode(last.modeId);
  }
  // Rename modes by index.
  collection.modes.forEach((mode, i) => {
    if (mode.name !== devices[i].name) {
      collection.renameMode(mode.modeId, devices[i].name);
    }
  });
  return collection.modes.map(m => m.modeId);
}

function upsertVariable(collection, name, type) {
  const existing = figma.variables
    .getLocalVariables(type)
    .find(v => v.variableCollectionId === collection.id && v.name === name);
  return existing || figma.variables.createVariable(name, collection, type);
}

function upsertResponsiveVariables(devices) {
  if (!Array.isArray(devices) || devices.length === 0) {
    throw new Error('No devices provided');
  }

  let collection = findCollection(COLLECTION_NAME);
  if (!collection) {
    collection = figma.variables.createVariableCollection(COLLECTION_NAME);
    // Set initial mode name to first device.
    collection.renameMode(collection.modes[0].modeId, devices[0].name);
  }

  const modeIds = reconcileModes(collection, devices);

  const setForAll = (variable, valueFn) => {
    devices.forEach((device, i) => {
      variable.setValueForMode(modeIds[i], valueFn(device));
    });
  };

  setForAll(upsertVariable(collection, 'device', 'STRING'),
    (d) => String(d.name).toLowerCase());

  setForAll(upsertVariable(collection, 'displays/screen-width', 'FLOAT'),
    (d) => d.maxWidth);

  setForAll(upsertVariable(collection, 'grid/column-count', 'FLOAT'),
    (d) => d.columns);

  setForAll(upsertVariable(collection, 'grid/margin', 'FLOAT'),
    (d) => d.marginWidth);

  setForAll(upsertVariable(collection, 'grid/gutter', 'FLOAT'),
    (d) => d.gutterWidth);

  const maxCols = devices.reduce((m, d) => Math.max(m, d.columns), 0);
  for (let i = 1; i <= maxCols; i++) {
    const v = upsertVariable(collection, `grid/column-widths/${i} col`, 'FLOAT');
    setForAll(v, (d) => {
      if (i <= d.columns) {
        return d.columnWidth * i + d.gutterWidth * (i - 1);
      }
      return d.contentWidth;
    });
  }

  // Prune stale column-width variables beyond maxCols.
  const colWidthRegex = /^grid\/column-widths\/(\d+) col$/;
  figma.variables.getLocalVariables('FLOAT').forEach(v => {
    if (v.variableCollectionId !== collection.id) return;
    const match = colWidthRegex.exec(v.name);
    if (match && parseInt(match[1], 10) > maxCols) {
      v.remove();
    }
  });
}
