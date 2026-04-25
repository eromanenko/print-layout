# Print Layout Generator Implementation Plan

## Goal Description
The objective is to establish `print-layout` as a standalone web application dedicated to generating print-ready PDF files from uploaded playing card images. This separates the logic from the main `cut-image` tool for better modularity and focus.

## Proposed Architecture
- **Standalone App**: The application consists of an `index.html` file housing the UI, `css/style.css` for the flexbox-based layout, and ES6 modules in `js/layout/` managing logic.
- **Dependencies**: Uses `pdf-lib` for PDF creation and manipulation, and `jszip` if zip uploads are to be supported.
- **UI Structure**: A 320px left sidebar for controls (paper size, card dimensions, bleed, crop marks, back types, file uploads), and a fluid main area for previews.

## Code Separation
- Move `js/layout/*` from `cut-image` repository to `print-layout/js/layout/`.
- Strip down the main `index.html` to only include the layout UI structure.
- Copy necessary styles into `css/style.css`.
