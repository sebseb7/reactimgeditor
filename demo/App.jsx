import { Component } from 'react';
import ImageEditor from 'reactimgeditor';

export default class App extends Component {
  imgObj = null;

  state = {
    status: 'Drop an image or use the controls below.',
  };

  setStatus = (msg) => this.setState({ status: msg });

  handleRotateLeft = () => {
    if (!this.imgObj?.hasImage()) {
      this.setStatus('No image loaded.');
      return;
    }
    const deg = this.imgObj.rotateLeft();
    this.setStatus(`Rotated left → ${deg}°`);
  };

  handleRotateRight = () => {
    if (!this.imgObj?.hasImage()) {
      this.setStatus('No image loaded.');
      return;
    }
    const deg = this.imgObj.rotateRight();
    this.setStatus(`Rotated right → ${deg}°`);
  };

  handleRotate45 = () => {
    if (!this.imgObj?.hasImage()) {
      this.setStatus('No image loaded.');
      return;
    }
    const deg = this.imgObj.rotate(45);
    this.setStatus(`Rotated +45° → ${deg}°`);
  };

  handleExport = async () => {
    if (!this.imgObj?.hasImage()) {
      this.setStatus('No image to export.');
      return;
    }
    const blob = await this.imgObj.getBlob('image/png');
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited-image.png';
    a.click();
    URL.revokeObjectURL(url);
    this.setStatus('Exported edited-image.png');
  };

  handleClear = () => {
    this.imgObj?.clear();
    this.setStatus('Editor cleared.');
  };

  handleEnterCrop = () => {
    if (!this.imgObj?.hasImage()) {
      this.setStatus('No image loaded.');
      return;
    }
    const ok = this.imgObj.enterCropMode();
    this.setStatus(ok ? 'Crop mode — drag handles to adjust, then apply.' : 'Could not enter crop mode.');
  };

  handleApplyCrop = async () => {
    if (!this.imgObj?.isCropMode()) {
      this.setStatus('Not in crop mode.');
      return;
    }
    try {
      await this.imgObj.applyCrop();
      this.setStatus('Crop applied.');
    } catch {
      this.setStatus('Crop failed.');
    }
  };

  handleExitCrop = () => {
    this.imgObj?.exitCropMode();
    this.setStatus('Crop cancelled.');
  };

  render() {
    return (
      <div>
        <h1>Image Editor</h1>
        <p className="subtitle">
          Drag &amp; drop an image, then rotate or crop via toolbar or ref API.
        </p>

        <ImageEditor
          ref={(img) => {
            this.imgObj = img;
          }}
          height="420px"
        />

        <div className="test-controls">
          <button type="button" onClick={this.handleRotateLeft}>
            Rotate Left (ref)
          </button>
          <button type="button" onClick={this.handleRotateRight}>
            Rotate Right (ref)
          </button>
          <button type="button" onClick={this.handleRotate45}>
            Rotate +45° (ref)
          </button>
          <button type="button" onClick={this.handleEnterCrop}>
            Crop (ref)
          </button>
          <button type="button" onClick={this.handleApplyCrop}>
            Apply Crop (ref)
          </button>
          <button type="button" onClick={this.handleExitCrop}>
            Cancel Crop (ref)
          </button>
          <button type="button" onClick={this.handleExport}>
            Export PNG (ref)
          </button>
          <button type="button" onClick={this.handleClear}>
            Clear (ref)
          </button>
        </div>

        <div className="status">{this.state.status}</div>
      </div>
    );
  }
}
