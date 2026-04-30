figma.showUI(__html__, {
  width: 360,
  height: 600
});

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'create-grids') {
      await createGrids(msg.devices);
      figma.ui.postMessage({ type: 'grids-created' });
    } else if (msg.type === 'create-variables') {
      await createResponsiveVariables(msg.devices);
      figma.ui.postMessage({ type: 'variables-created' });
    }
  } catch (err) {
    console.error(err);
    figma.ui.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
  }
};

async function createGrids(devices) {
  if (!Array.isArray(devices) || devices.length === 0) {
    throw new Error('No devices provided');
  }

  const frameHeight = 900;
  const verticalGap = 80;
  const center = figma.viewport.center;
  const totalHeight = devices.length * frameHeight + (devices.length - 1) * verticalGap;
  const startY = center.y - totalHeight / 2;
  const frames = [];

  devices.forEach((device, index) => {
    const frame = figma.createFrame();
    frame.resizeWithoutConstraints(device.maxWidth, frameHeight);
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    frame.layoutGrids = [{
      pattern: 'COLUMNS',
      sectionSize: device.columnWidth,
      gutterSize: device.gutterWidth,
      alignment: 'CENTER',
      count: device.columns,
    }];
    frame.name = `${device.name} — ${device.maxWidth}px / ${device.columns}col (${device.columnWidth}px)`;
    frame.x = center.x - device.maxWidth / 2;
    frame.y = startY + index * (frameHeight + verticalGap);
    frames.push(frame);
  });

  figma.viewport.scrollAndZoomIntoView(frames);
}

async function createResponsiveVariables(devices) {
  if (!Array.isArray(devices) || devices.length === 0) {
    throw new Error('No devices provided');
  }

  const collection = figma.variables.createVariableCollection('Responsive Tokens');

  // Rename the auto-created first mode and add the rest.
  collection.renameMode(collection.modes[0].modeId, devices[0].name);
  for (let i = 1; i < devices.length; i++) {
    collection.addMode(devices[i].name);
  }

  // Refresh modes list so each entry has a stable modeId in declaration order.
  const modeIds = collection.modes.map(m => m.modeId);

  const setForAll = (variable, valueFn) => {
    devices.forEach((device, i) => {
      variable.setValueForMode(modeIds[i], valueFn(device));
    });
  };

  const deviceVar = figma.variables.createVariable('device', collection, 'STRING');
  setForAll(deviceVar, (d) => String(d.name).toLowerCase());

  const screenWidthVar = figma.variables.createVariable('displays/screen-width', collection, 'FLOAT');
  setForAll(screenWidthVar, (d) => d.maxWidth);

  const columnCountVar = figma.variables.createVariable('grid/column-count', collection, 'FLOAT');
  setForAll(columnCountVar, (d) => d.columns);

  const marginVar = figma.variables.createVariable('grid/margin', collection, 'FLOAT');
  setForAll(marginVar, (d) => d.marginWidth);

  const gutterVar = figma.variables.createVariable('grid/gutter', collection, 'FLOAT');
  setForAll(gutterVar, (d) => d.gutterWidth);

  const maxCols = devices.reduce((m, d) => Math.max(m, d.columns), 0);
  for (let i = 1; i <= maxCols; i++) {
    const v = figma.variables.createVariable(`grid/column-widths/${i} col`, collection, 'FLOAT');
    setForAll(v, (d) => {
      if (i <= d.columns) {
        return d.columnWidth * i + d.gutterWidth * (i - 1);
      }
      return d.contentWidth;
    });
  }
}
