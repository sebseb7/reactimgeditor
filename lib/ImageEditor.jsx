import { Component, createRef } from 'react';
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';

const MIN_CROP = 24;
const CROP_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const HANDLE_CURSORS = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

/**
 * Canvas-based image editor with drag-and-drop, rotation, and crop.
 *
 * Imperative API (via ref):
 *   rotate(degrees)     – add degrees to current rotation
 *   setRotation(deg)    – set absolute rotation
 *   getRotation()       – current rotation in degrees
 *   rotateLeft()        – rotate -90°
 *   rotateRight()       – rotate +90°
 *   enterCropMode()     – show crop overlay
 *   exitCropMode()      – hide crop overlay
 *   isCropMode()        – whether crop mode is active
 *   getCropRect()       – current crop rect in screen px
 *   applyCrop()         – apply crop (Promise)
 *   getDataURL(type)    – export canvas as data URL
 *   getBlob(type)       – export canvas as Blob (Promise)
 *   loadFile(file)      – load an image File/Blob
 *   clear()             – reset editor
 *   hasImage()          – whether an image is loaded
 */
export default class ImageEditor extends Component {
  canvasRef = createRef();
  handleElements = {};
  handleCleanups = [];
  dragSession = null;

  image = null;
  rotation = 0;

  state = {
    dragOver: false,
    hasImage: false,
    cropMode: false,
    cropRect: null,
  };

  setHandleRef = (handle) => (el) => {
    if (el) this.handleElements[handle] = el;
    else delete this.handleElements[handle];
  };

  /* ── imperative API ─────────────────────────────── */

  rotate = (degrees) => {
    this.rotation = (this.rotation + degrees) % 360;
    this.draw();
    if (this.state.cropMode) this.resetCropToImageBounds();
    return this.rotation;
  };

  setRotation = (degrees) => {
    this.rotation = degrees % 360;
    this.draw();
    if (this.state.cropMode) this.resetCropToImageBounds();
    return this.rotation;
  };

  getRotation = () => this.rotation;

  rotateLeft = () => this.rotate(-90);

  rotateRight = () => this.rotate(90);

  hasImage = () => this.state.hasImage;

  isCropMode = () => this.state.cropMode;

  getCropRect = () => (this.state.cropRect ? { ...this.state.cropRect } : null);

  enterCropMode = () => {
    if (!this.state.hasImage) return false;
    const bounds = this.getScreenImageBounds();
    if (!bounds) return false;
    this.setState({
      cropMode: true,
      cropRect: {
        x: bounds.left,
        y: bounds.top,
        w: bounds.width,
        h: bounds.height,
      },
    });
    return true;
  };

  exitCropMode = () => {
    this.unbindCropHandles();
    this.setState({ cropMode: false, cropRect: null });
  };

  applyCrop = () => {
    const { cropRect, hasImage } = this.state;
    if (!hasImage || !cropRect || !this.image) {
      return Promise.reject(new Error('Nothing to crop'));
    }

    const layout = this.getImageLayout();
    const bounds = this.getScreenImageBounds();
    if (!layout || !bounds) {
      return Promise.reject(new Error('Cannot compute crop'));
    }

    const { rad, imgW, imgH } = layout;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));

    const offscreen = document.createElement('canvas');
    offscreen.width = imgW * cos + imgH * sin;
    offscreen.height = imgW * sin + imgH * cos;

    const ctx = offscreen.getContext('2d');
    ctx.translate(offscreen.width / 2, offscreen.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(this.image, -imgW / 2, -imgH / 2);

    const relX = (cropRect.x - bounds.left) / bounds.width;
    const relY = (cropRect.y - bounds.top) / bounds.height;
    const relW = cropRect.w / bounds.width;
    const relH = cropRect.h / bounds.height;

    const sx = relX * offscreen.width;
    const sy = relY * offscreen.height;
    const sw = relW * offscreen.width;
    const sh = relH * offscreen.height;

    const cropped = document.createElement('canvas');
    cropped.width = Math.max(1, Math.round(sw));
    cropped.height = Math.max(1, Math.round(sh));
    cropped.getContext('2d').drawImage(
      offscreen,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      cropped.width,
      cropped.height,
    );

    return new Promise((resolve, reject) => {
      cropped.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Crop failed'));
          return;
        }
        const url = URL.createObjectURL(blob);
        this.loadFromSource(url)
          .then(() => {
            URL.revokeObjectURL(url);
            this.rotation = 0;
            this.unbindCropHandles();
            this.setState({ cropMode: false, cropRect: null }, resolve);
          })
          .catch(reject);
      }, 'image/png');
    });
  };

  clear = () => {
    this.unbindCropHandles();
    this.image = null;
    this.rotation = 0;
    this.setState({ hasImage: false, cropMode: false, cropRect: null }, this.draw);
  };

  getDataURL = (type = 'image/png', quality) => {
    const canvas = this.canvasRef.current;
    if (!canvas || !this.state.hasImage) return null;
    return quality !== undefined
      ? canvas.toDataURL(type, quality)
      : canvas.toDataURL(type);
  };

  getBlob = (type = 'image/png', quality) =>
    new Promise((resolve) => {
      const canvas = this.canvasRef.current;
      if (!canvas || !this.state.hasImage) {
        resolve(null);
        return;
      }
      canvas.toBlob(resolve, type, quality);
    });

  loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      return Promise.reject(new Error('Not an image file'));
    }
    return this.loadFromSource(URL.createObjectURL(file));
  };

  /* ── layout / crop math ─────────────────────────── */

  getImageLayout = () => {
    if (!this.image) return null;
    const canvas = this.canvasRef.current;
    if (!canvas) return null;

    const { width, height } = canvas;
    const rad = (this.rotation * Math.PI) / 180;
    const imgW = this.image.naturalWidth;
    const imgH = this.image.naturalHeight;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const rotatedW = imgW * cos + imgH * sin;
    const rotatedH = imgW * sin + imgH * cos;
    const scale = Math.min(width / rotatedW, height / rotatedH, 1);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    return {
      width,
      height,
      centerX: width / 2,
      centerY: height / 2,
      drawW,
      drawH,
      scale,
      rad,
      imgW,
      imgH,
    };
  };

  getScreenImageBounds = () => {
    const layout = this.getImageLayout();
    if (!layout) return null;

    const { centerX, centerY, drawW, drawH, rad } = layout;
    const hw = drawW / 2;
    const hh = drawH / 2;
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ].map(([x, y]) => {
      const rx = x * Math.cos(rad) - y * Math.sin(rad);
      const ry = x * Math.sin(rad) + y * Math.cos(rad);
      return [centerX + rx, centerY + ry];
    });

    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  };

  resetCropToImageBounds = () => {
    const bounds = this.getScreenImageBounds();
    if (!bounds) return;
    this.setState({
      cropRect: {
        x: bounds.left,
        y: bounds.top,
        w: bounds.width,
        h: bounds.height,
      },
    });
  };

  clampCropRect = (rect) => {
    const bounds = this.getScreenImageBounds();
    if (!bounds) return rect;

    let { x, y, w, h } = rect;

    if (w < MIN_CROP) w = MIN_CROP;
    if (h < MIN_CROP) h = MIN_CROP;

    if (x < bounds.left) {
      w -= bounds.left - x;
      x = bounds.left;
    }
    if (y < bounds.top) {
      h -= bounds.top - y;
      y = bounds.top;
    }
    if (x + w > bounds.right) w = bounds.right - x;
    if (y + h > bounds.bottom) h = bounds.bottom - y;

    w = Math.max(MIN_CROP, Math.min(w, bounds.right - x));
    h = Math.max(MIN_CROP, Math.min(h, bounds.bottom - y));
    x = Math.max(bounds.left, Math.min(x, bounds.right - MIN_CROP));
    y = Math.max(bounds.top, Math.min(y, bounds.bottom - MIN_CROP));

    return { x, y, w, h };
  };

  updateCropFromHandle = (handle, dx, dy, startCrop) => {
    let { x, y, w, h } = startCrop;

    switch (handle) {
      case 'move':
        x += dx;
        y += dy;
        break;
      case 'nw':
        x += dx;
        y += dy;
        w -= dx;
        h -= dy;
        break;
      case 'ne':
        y += dy;
        w += dx;
        h -= dy;
        break;
      case 'sw':
        x += dx;
        w -= dx;
        h += dy;
        break;
      case 'se':
        w += dx;
        h += dy;
        break;
      case 'n':
        y += dy;
        h -= dy;
        break;
      case 's':
        h += dy;
        break;
      case 'w':
        x += dx;
        w -= dx;
        break;
      case 'e':
        w += dx;
        break;
      default:
        break;
    }

    this.setState({ cropRect: this.clampCropRect({ x, y, w, h }) });
  };

  /* ── pragmatic-drag-and-drop crop handles ───────── */

  syncCropHandles = () => {
    this.unbindCropHandles();
    if (!this.state.cropMode) return;

    const handles = ['move', ...CROP_HANDLES];

    this.handleCleanups = handles
      .map((handle) => {
        const element = this.handleElements[handle];
        if (!element) return null;

        return draggable({
          element,
          getInitialData: () => ({ type: 'crop-handle', handle }),
          onGenerateDragPreview: ({ nativeSetDragImage }) => {
            disableNativeDragPreview({ nativeSetDragImage });
          },
          onDragStart: ({ location }) => {
            this.dragSession = {
              handle,
              startX: location.initial.input.clientX,
              startY: location.initial.input.clientY,
              cropRect: { ...this.state.cropRect },
            };
          },
          onDrag: ({ location }) => {
            if (!this.dragSession) return;
            const dx = location.current.input.clientX - this.dragSession.startX;
            const dy = location.current.input.clientY - this.dragSession.startY;
            this.updateCropFromHandle(
              this.dragSession.handle,
              dx,
              dy,
              this.dragSession.cropRect,
            );
          },
          onDrop: () => {
            this.dragSession = null;
          },
        });
      })
      .filter(Boolean);
  };

  unbindCropHandles = () => {
    this.handleCleanups.forEach((cleanup) => cleanup());
    this.handleCleanups = [];
    this.dragSession = null;
  };

  /* ── internal ───────────────────────────────────── */

  loadFromSource = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.rotation = 0;
        this.setState({ hasImage: true, cropMode: false, cropRect: null }, () => {
          this.draw();
          resolve(img);
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });

  draw = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    if (!this.image) return;

    const layout = this.getImageLayout();
    const { centerX, centerY, drawW, drawH, rad, imgW, imgH, scale } = layout;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rad);
    ctx.drawImage(
      this.image,
      (-imgW * scale) / 2,
      (-imgH * scale) / 2,
      imgW * scale,
      imgH * scale,
    );
    ctx.restore();
  };

  isFileDrag = (e) => {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  };

  handleDrop = (e) => {
    if (!this.isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: false });

    const file = e.dataTransfer?.files?.[0];
    if (file) this.loadFile(file).catch(console.error);
  };

  handleDragOver = (e) => {
    if (!this.isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: true });
  };

  handleDragLeave = (e) => {
    if (!this.isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    this.setState({ dragOver: false });
  };

  handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) this.loadFile(file).catch(console.error);
    e.target.value = '';
  };

  handleToggleCrop = () => {
    if (this.state.cropMode) {
      this.exitCropMode();
    } else {
      this.enterCropMode();
    }
  };

  handleApplyCrop = () => {
    this.applyCrop().catch(console.error);
  };

  componentDidMount() {
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.cropMode && (!prevState.cropMode || prevState.hasImage !== this.state.hasImage)) {
      requestAnimationFrame(() => this.syncCropHandles());
    }
    if (!this.state.cropMode && prevState.cropMode) {
      this.unbindCropHandles();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeCanvas);
    this.unbindCropHandles();
  }

  resizeCanvas = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    this.draw();
    if (this.state.cropMode) this.resetCropToImageBounds();
  };

  renderCropOverlay() {
    const { cropRect } = this.state;
    if (!cropRect) return null;

    const { x, y, w, h } = cropRect;

    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: w,
            height: h,
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
            pointerEvents: 'auto',
            outline: 'none',
          }}
        >
          <div
            ref={this.setHandleRef('move')}
            style={{
              position: 'absolute',
              inset: 10,
              cursor: 'move',
              outline: 'none',
            }}
          />

          {CROP_HANDLES.map((handle) => (
            <div
              key={handle}
              ref={this.setHandleRef(handle)}
              style={{
                position: 'absolute',
                width: 12,
                height: 12,
                background: '#fff',
                border: '1px solid #333',
                borderRadius: 2,
                cursor: HANDLE_CURSORS[handle],
                outline: 'none',
                ...getHandleOffset(handle),
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  render() {
    const { height = '400px', className = '' } = this.props;
    const { dragOver, hasImage, cropMode } = this.state;

    return (
      <div
        className={`image-editor ${className}`}
        style={{
          position: 'relative',
          height,
          border: `2px dashed ${dragOver ? '#4cc9f0' : '#444'}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: 'transparent',
          transition: 'border-color 0.2s',
        }}
        onDrop={this.handleDrop}
        onDragOver={this.handleDragOver}
        onDragLeave={this.handleDragLeave}
      >
        <canvas
          ref={this.canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', background: 'transparent' }}
        />

        {cropMode && this.renderCropOverlay()}

        {!hasImage && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              pointerEvents: 'none',
              color: '#666',
            }}
          >
            <span style={{ fontSize: '2.5rem' }}>🖼</span>
            <span>Drop an image here</span>
            <label
              style={{
                pointerEvents: 'auto',
                padding: '0.4rem 1rem',
                background: '#2a2a4a',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: '#ccc',
              }}
            >
              or browse
              <input
                type="file"
                accept="image/*"
                onChange={this.handleFileInput}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {hasImage && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              display: 'flex',
              gap: 4,
            }}
          >
            {cropMode ? (
              <>
                <button type="button" onClick={this.handleApplyCrop} title="Apply crop" style={toolbarBtn}>
                  ✓
                </button>
                <button type="button" onClick={this.exitCropMode} title="Cancel crop" style={toolbarBtn}>
                  ✕
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={this.handleToggleCrop} title="Crop" style={toolbarBtn}>
                  ⬚
                </button>
                <button type="button" onClick={this.rotateLeft} title="Rotate left" style={toolbarBtn}>
                  ↺
                </button>
                <button type="button" onClick={this.rotateRight} title="Rotate right" style={toolbarBtn}>
                  ↻
                </button>
                <button type="button" onClick={this.clear} title="Clear" style={toolbarBtn}>
                  ✕
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }
}

function getHandleOffset(handle) {
  const half = -6;
  switch (handle) {
    case 'nw':
      return { top: half, left: half };
    case 'n':
      return { top: half, left: '50%', marginLeft: half };
    case 'ne':
      return { top: half, right: half };
    case 'e':
      return { top: '50%', right: half, marginTop: half };
    case 'se':
      return { bottom: half, right: half };
    case 's':
      return { bottom: half, left: '50%', marginLeft: half };
    case 'sw':
      return { bottom: half, left: half };
    case 'w':
      return { top: '50%', left: half, marginTop: half };
    default:
      return {};
  }
}

const toolbarBtn = {
  width: 32,
  height: 32,
  border: 'none',
  borderRadius: 6,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  fontSize: '1.1rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
