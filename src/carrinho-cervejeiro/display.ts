/** Tela do medidor desenhada num canvas 2D (vira textura no modelo 3D). */

export interface DisplayData {
  mode: 'sleep' | 'boot' | 'on';
  /** 0 a 1 durante o autoteste. */
  boot: number;
  flow: number;
  maxFlow: number;
  temperature: number;
  totalizer: number;
  conductivity: number;
  velocity: number;
  emptyPipe: boolean;
  measuring: boolean;
  line: string;
  lineColor: string;
  battery: number;
  time: number;
}

export const DISPLAY_SIZE = { width: 640, height: 400 };

const FONT = '"Inter Variable", "Inter", system-ui, sans-serif';
const number = (digits: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const fmt2 = number(2);
const fmt1 = number(1);
const fmt0 = number(0);

export function formatFlow(value: number): string {
  return fmt2.format(value);
}
export function formatTemperature(value: number): string {
  return fmt1.format(value);
}
export function formatTotal(value: number): string {
  return fmt1.format(value);
}
export function formatInteger(value: number): string {
  return fmt0.format(value);
}

export function drawDisplay(ctx: CanvasRenderingContext2D, data: DisplayData): void {
  const { width: W, height: H } = DISPLAY_SIZE;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b1824');
  bg.addColorStop(1, '#050c13');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (data.mode === 'sleep') {
    ctx.restore();
    return;
  }
  if (data.mode === 'boot') {
    drawBoot(ctx, data);
    ctx.restore();
    return;
  }

  drawStatusBar(ctx, data);

  // Vazão.
  ctx.fillStyle = '#7f95a8';
  ctx.font = `500 24px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Vazão', 30, 96);

  if (data.emptyPipe) {
    ctx.fillStyle = '#4d6072';
    ctx.font = `600 112px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('– – , – –', 470, 196);
    // Alerta de tubo vazio.
    ctx.fillStyle = 'rgba(255,176,32,0.14)';
    roundRect(ctx, 30, 214, W - 60, 46, 10);
    ctx.fill();
    ctx.fillStyle = '#ffb020';
    ctx.font = `700 24px ${FONT}`;
    ctx.textAlign = 'left';
    drawWarning(ctx, 48, 237);
    ctx.fillText('TUBO VAZIO · aguardando produto', 84, 246);
  } else {
    ctx.fillStyle = '#f2f7fb';
    ctx.font = `600 116px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(formatFlow(data.flow), 470, 196);
    // Barra de escala 0–42 m³/h.
    const x = 30;
    const y = 222;
    const w = W - 60;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, x, y, w, 18, 9);
    ctx.fill();
    const f = Math.min(1, data.flow / data.maxFlow);
    if (f > 0.002) {
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, '#18c7a6');
      grad.addColorStop(0.75, '#36d6ff');
      grad.addColorStop(1, '#ff6b5a');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, Math.max(18, w * f), 18, 9);
      ctx.fill();
    }
    ctx.fillStyle = '#5f7488';
    ctx.font = `500 18px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('0', x, y + 40);
    ctx.textAlign = 'right';
    ctx.fillText(`${formatInteger(data.maxFlow)} m³/h`, x + w, y + 40);
    ctx.textAlign = 'center';
    ctx.fillText(formatInteger(data.maxFlow / 2), x + w / 2, y + 40);
  }
  ctx.fillStyle = '#9fb3c4';
  ctx.font = `500 38px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('m³/h', 486, 196);

  // Linha divisória e leituras secundárias.
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(30, 282, W - 60, 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#7f95a8';
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText('Temperatura', 30, 314);
  ctx.fillText('Totalizador Σ', 340, 314);
  ctx.fillStyle = '#e8eff5';
  ctx.font = `600 42px ${FONT}`;
  ctx.fillText(`${formatTemperature(data.temperature)} °C`, 30, 358);
  ctx.fillText(`${formatTotal(data.totalizer)} L`, 340, 358);

  ctx.fillStyle = '#62788c';
  ctx.font = `500 19px ${FONT}`;
  const kappa = Number.isNaN(data.conductivity) ? '– – –' : formatInteger(data.conductivity);
  ctx.fillText(`κ ${kappa} µS/cm`, 30, 388);
  ctx.fillText(`v ${fmt2.format(data.velocity)} m/s`, 340, 388);
  ctx.restore();
}

function drawStatusBar(ctx: CanvasRenderingContext2D, data: DisplayData) {
  const { width: W } = DISPLAY_SIZE;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 0, W, 52);

  // Bluetooth.
  ctx.strokeStyle = '#5fb4ff';
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(24, 17);
  ctx.lineTo(40, 33);
  ctx.lineTo(32, 41);
  ctx.lineTo(32, 11);
  ctx.lineTo(40, 19);
  ctx.lineTo(24, 35);
  ctx.stroke();

  // Linha ativa.
  ctx.font = `700 22px ${FONT}`;
  const text = data.line;
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = data.lineColor;
  roundRect(ctx, 62, 12, tw + 28, 30, 15);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 76, 28);

  // Indicador de medição.
  if (data.measuring) {
    const on = Math.sin(data.time * 6) > -0.2;
    ctx.fillStyle = on ? '#20d38a' : 'rgba(32,211,138,0.25)';
    ctx.beginPath();
    ctx.arc(62 + tw + 52, 27, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fe9c8';
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('MEDINDO', 62 + tw + 66, 28);
  }

  // Bateria.
  const bx = W - 92;
  ctx.strokeStyle = '#cfdbe6';
  ctx.lineWidth = 2.5;
  roundRect(ctx, bx, 16, 44, 22, 4);
  ctx.stroke();
  ctx.fillStyle = '#cfdbe6';
  ctx.fillRect(bx + 44, 22, 4, 10);
  ctx.fillStyle = '#20d38a';
  roundRect(ctx, bx + 3.5, 19.5, 37 * (data.battery / 100), 15, 2);
  ctx.fill();
  ctx.fillStyle = '#9fb3c4';
  ctx.font = `500 18px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${formatInteger(data.battery)}%`, bx - 8, 28);
  ctx.textBaseline = 'alphabetic';
}

function drawBoot(ctx: CanvasRenderingContext2D, data: DisplayData) {
  const { width: W, height: H } = DISPLAY_SIZE;
  ctx.globalAlpha = Math.min(1, data.boot * 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f2f7fb';
  ctx.font = `700 74px ${FONT}`;
  ctx.fillText('Picomag', W / 2, 170);
  ctx.fillStyle = '#7f95a8';
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText('DN50 · 2" · bateria interna', W / 2, 214);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRect(ctx, 120, 262, W - 240, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#36d6ff';
  roundRect(ctx, 120, 262, Math.max(12, (W - 240) * data.boot), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#62788c';
  ctx.font = `500 22px ${FONT}`;
  const step = data.boot < 0.35 ? 'Autoteste…' : data.boot < 0.7 ? 'Bobinas OK · eletrodos OK' : 'Bluetooth pronto';
  ctx.fillText(step, W / 2, 318);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, H - 4, W * data.boot, 4);
}

function drawWarning(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(x + 13, y - 13);
  ctx.lineTo(x + 27, y + 13);
  ctx.lineTo(x - 1, y + 13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a1206';
  ctx.fillRect(x + 11.5, y - 4, 3, 10);
  ctx.fillRect(x + 11.5, y + 8, 3, 3);
  ctx.fillStyle = '#ffb020';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
