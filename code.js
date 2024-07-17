figma.showUI(__html__, {
  height: 400
});

figma.ui.onmessage = msg => {
  if (msg.type === 'calculate-grid') {
    const columnCount = parseInt(msg.columns);
    const gutterWidth = parseFloat(msg.gutterWidth);
    const maxWidth = parseFloat(msg.maxWidth);
    const marginWidth = parseFloat(msg.marginWidth);

    if (isNaN(columnCount) || isNaN(gutterWidth) || isNaN(maxWidth) || isNaN(marginWidth) || columnCount <= 0 || gutterWidth < 0 || maxWidth <= 0 || marginWidth < 0) {
      figma.ui.postMessage({ type: 'error', message: 'Invalid input values' });
      return;
    }

    const containerWidth = maxWidth - 2 * marginWidth;
    const totalGutterWidth = gutterWidth * (columnCount - 1);
    const columnWidth = (containerWidth - totalGutterWidth) / columnCount;

    const isExact = Number.isInteger(columnWidth);

    if (msg.displayOnly) {
      figma.ui.postMessage({
        type: 'result',
        columnWidth: columnWidth.toFixed(2),
        pageWidth: (containerWidth + 2 * marginWidth).toFixed(2),
        isExact: isExact
      });
    } else {
      // Calculate the center of the viewport
      const viewportCenter = figma.viewport.center;
      const frameX = viewportCenter.x - maxWidth / 2;
      const frameY = viewportCenter.y - 450; // Half of the frame height

      // Create a frame with the specified container width if the calculation is exact
      if (isExact) {
        const frame = figma.createFrame();
        frame.resizeWithoutConstraints(maxWidth, 900); // Adjust the height as needed
        frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; // Set the background color
        frame.layoutGrids = [{
          pattern: 'COLUMNS',
          sectionSize: columnWidth,
          gutterSize: gutterWidth,
          alignment: 'CENTER',
          count: columnCount,
        }];

        console.log(frame);

        frame.name = `${maxWidth}px - ${columnCount} columns (${columnWidth}px)`; // Set the name of the frame

        // Set the frame position to center it in the viewport
        frame.x = frameX;
        frame.y = frameY;

        figma.viewport.scrollAndZoomIntoView([frame]);
      }

      figma.ui.postMessage({
        type: 'result',
        columnWidth: columnWidth,
        pageWidth: (containerWidth + 2 * marginWidth),
        isExact: isExact
      });
    }
  } else if (msg.type === 'create-variables') {
    const columnWidth = parseFloat(msg.columnWidth);
    const columnCount = parseInt(msg.columns);
    const gutterWidth = parseFloat(msg.gutterWidth);

    if (isNaN(columnWidth) || isNaN(columnCount) || columnCount <= 0) {
      figma.ui.postMessage({ type: 'error', message: 'Invalid input values for creating variables' });
      return;
    }

    // Create a variable collection
    const collection = figma.variables.createVariableCollection("Column Widths");
    const collectionModeId = collection.modes[0].modeId;

    // Create variables for each column count
    for (let i = 1; i <= columnCount; i++) {
      const variable = figma.variables.createVariable(`${i} col`, collection, "FLOAT");
      if (i === 1) {
        variable.setValueForMode(collectionModeId, columnWidth);
      } else {
        variable.setValueForMode(collectionModeId, (columnWidth * i + gutterWidth * (i - 1)));
      }
    }

    figma.ui.postMessage({ type: 'variables-created' });
  }
};
