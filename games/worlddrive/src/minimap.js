// Circular minimap (north fixed, car at the centre)
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.size = canvas.width;
    this.off = null;
    this.offScale = 1;
    this.half = 1;
  }

  setWorld(lines, half) {
    this.half = half;
    const S = 1024;
    this.off = document.createElement('canvas');
    this.off.width = this.off.height = S;
    this.offScale = S / (half * 2);
    const g = this.off.getContext('2d');
    g.clearRect(0, 0, S, S);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const ln of lines) {
      const isPath = ln.kind === 'path';
      g.strokeStyle = isPath ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.78)';
      g.lineWidth = Math.max(isPath ? 1 : 1.6, ln.width * this.offScale);
      g.beginPath();
      for (let i = 0; i < ln.pts.length; i++) {
        const [x, z] = ln.pts[i];
        const px = (x + half) * this.offScale;
        const pz = (z + half) * this.offScale;
        if (i === 0) g.moveTo(px, pz); else g.lineTo(px, pz);
      }
      g.stroke();
    }
  }

  draw(x, z, heading) {
    const c = this.canvas.getContext('2d');
    const S = this.size;
    c.clearRect(0, 0, S, S);
    if (!this.off) return;
    c.save();
    c.beginPath();
    c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = 'rgba(8,10,14,0.78)';
    c.fillRect(0, 0, S, S);

    // crop of the offscreen centred on the car; visible radius ~230m
    const viewM = 230;
    const px = (x + this.half) * this.offScale;
    const pz = (z + this.half) * this.offScale;
    const srcHalf = viewM * this.offScale;
    c.drawImage(this.off, px - srcHalf, pz - srcHalf, srcHalf * 2, srcHalf * 2, 0, 0, S, S);

    // the car's arrow
    c.translate(S / 2, S / 2);
    c.rotate(heading);
    c.fillStyle = '#ff4444';
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.beginPath();
    c.moveTo(0, -8);
    c.lineTo(5.5, 6);
    c.lineTo(0, 3);
    c.lineTo(-5.5, 6);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();

    c.beginPath();
    c.arc(S / 2, S / 2, S / 2 - 1.5, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = 2;
    c.stroke();

    // indicador de norte
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = 'bold 11px system-ui';
    c.textAlign = 'center';
    c.fillText('N', S / 2, 13);
  }
}
