# ImageEditor

A React **class component** for basic image editing: file drop, rotation, and crop with draggable handles.

Built for projects that use callback refs and an imperative API:

```jsx
<ImageEditor ref={(img) => { this.imgObj = img; }} height="420px" />
```

## Install from GitHub

```bash
npm install github:sebseb7/reactimgeditor
```


Then import in your app:

```jsx
import ImageEditor from 'reactimgeditor';
```

The package bundles `@atlaskit/pragmatic-drag-and-drop` as a dependency. You only need `react` and `react-dom` (peer dependencies) in your project.

### Requirements

- React 18+
- A bundler that supports ES modules (Vite, Webpack 5, etc.)

## Usage

**Class component parent** (recommended — matches the ref pattern above):

```jsx
import { Component } from 'react';
import ImageEditor from 'reactimgeditor';

export default class MyPage extends Component {
  imgObj = null;

  handleSave = async () => {
    if (!this.imgObj?.hasImage()) return;

    const blob = await this.imgObj.getBlob('image/png');
    // upload blob, attach to form, etc.
  };

  render() {
    return (
      <div>
        <ImageEditor
          ref={(img) => { this.imgObj = img; }}
          height="400px"
        />
        <button type="button" onClick={this.handleSave}>Save</button>
      </div>
    );
  }
}
```

**Functional parent** — use a ref to hold the instance:

```jsx
import { useRef } from 'react';
import ImageEditor from 'reactimgeditor';

export default function MyPage() {
  const imgRef = useRef(null);

  return (
    <>
      <ImageEditor
        ref={(instance) => { imgRef.current = instance; }}
        height="400px"
      />
      <button type="button" onClick={() => imgRef.current?.rotateRight()}>
        Rotate
      </button>
    </>
  );
}
```

> **Note:** `ImageEditor` is a class component, so you get the instance directly from the ref callback. You do not need `forwardRef`.

## Props

| Prop        | Type     | Default    | Description                          |
|-------------|----------|------------|--------------------------------------|
| `height`    | `string` | `"400px"`  | CSS height of the editor container   |
| `className` | `string` | `""`       | Extra class on the root element      |

## Imperative API (via ref)

All methods are called on the ref instance (`this.imgObj` or `imgRef.current`).

### Loading & state

| Method | Returns | Description |
|--------|---------|-------------|
| `hasImage()` | `boolean` | Whether an image is loaded |
| `loadFile(file)` | `Promise<Image>` | Load a `File` / `Blob` (must be an image MIME type) |
| `clear()` | `void` | Remove image and reset rotation/crop |

### Rotation

| Method | Returns | Description |
|--------|---------|-------------|
| `rotate(degrees)` | `number` | Add degrees to current rotation |
| `setRotation(degrees)` | `number` | Set absolute rotation |
| `getRotation()` | `number` | Current rotation in degrees |
| `rotateLeft()` | `number` | Rotate −90° |
| `rotateRight()` | `number` | Rotate +90° |

### Crop

Crop handles are draggable via `@atlaskit/pragmatic-drag-and-drop`. The built-in toolbar also provides crop controls when an image is loaded.

| Method | Returns | Description |
|--------|---------|-------------|
| `enterCropMode()` | `boolean` | Show crop overlay (`false` if no image) |
| `exitCropMode()` | `void` | Hide crop overlay without applying |
| `isCropMode()` | `boolean` | Whether crop mode is active |
| `getCropRect()` | `{ x, y, w, h } \| null` | Crop rectangle in screen pixels |
| `applyCrop()` | `Promise<void>` | Apply crop, replace image, exit crop mode |

### Export

| Method | Returns | Description |
|--------|---------|-------------|
| `getDataURL(type?, quality?)` | `string \| null` | Canvas as data URL (default `image/png`) |
| `getBlob(type?, quality?)` | `Promise<Blob \| null>` | Canvas as `Blob` |

### Example: full edit workflow

```jsx
// Load from an <input type="file" />
await this.imgObj.loadFile(file);

// Rotate
this.imgObj.rotateRight();

// Crop
this.imgObj.enterCropMode();
// user adjusts handles in the UI…
await this.imgObj.applyCrop();

// Download
const blob = await this.imgObj.getBlob('image/png');
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'edited.png';
a.click();
URL.revokeObjectURL(url);
```

## Built-in UI

When an image is loaded, a small toolbar appears in the bottom-right corner:

- **Crop** — enter crop mode (drag handles to resize/move; ✓ apply, ✕ cancel)
- **Rotate left / right**
- **Clear**

File drop and browse-to-upload work on the empty state without calling the ref API.

## Local development (this repo)

```bash
npm install
npm run dev        # demo app with hot reload
npm run build      # build library to dist/
npm run build:demo # build demo app
npm run preview    # preview demo build
```

The demo app in `demo/` exercises every ref method and imports the package the same way consumers do (`import ImageEditor from 'reactimgeditor'`).

## Project layout

```
lib/
  ImageEditor.jsx   ← library source
  index.js          ← package entry
demo/
  App.jsx           ← demo / test page
  main.jsx
  index.html
dist/
  reactimgeditor.js    ← built output (created by npm run build)
```
