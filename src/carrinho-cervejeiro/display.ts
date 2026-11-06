/**
 * Tela do medidor desenhada num canvas 2D (vira textura no modelo 3D).
 * Segue o visual do Picomag: fundo preto, cabeçalho "Picomag" com ícones de estado,
 * vazão grande em branco e temperatura em azul.
 */

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

/** Proporção do display no aparelho (70 × 56 mm). */
export const DISPLAY_SIZE = { width: 600, height: 480 };

const FONT = '"Inter Variable", "Inter", system-ui, sans-serif';
const WHITE = '#f4f7fa';
const BLUE = '#2ba8f0';
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
  ctx.fillStyle = '#000000';
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

  drawHeader(ctx, data);

  // Vazão.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  if (data.emptyPipe) {
    ctx.fillStyle = '#5d6670';
    ctx.font = `700 150px ${FONT}`;
    ctx.fillText('– –,– –', 572, 236);
    ctx.fillStyle = '#ffb020';
    ctx.font = `700 30px ${FONT}`;
    ctx.textAlign = 'left';
    drawWarning(ctx, 26, 112);
    ctx.fillText('TUBO VAZIO', 66, 122);
  } else {
    ctx.fillStyle = WHITE;
    ctx.font = `700 168px ${FONT}`;
    ctx.fillText(formatFlow(data.flow), 574, 238);
  }
  ctx.fillStyle = WHITE;
  ctx.font = `500 50px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('m³/h', 572, 300);

  // Produto na linha, discreto, à esquerda da unidade.
  ctx.textAlign = 'left';
  ctx.fillStyle = data.lineColor;
  ctx.beginPath();
  ctx.arc(36, 286, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9aa5b0';
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(data.line, 54, 296);

  // Separador.
  ctx.fillStyle = 'rgba(244,247,250,0.85)';
  ctx.fillRect(26, 322, W - 52, 4);

  // Temperatura em azul, com "°C" empilhado à direita.
  ctx.fillStyle = BLUE;
  ctx.textAlign = 'right';
  ctx.font = `700 140px ${FONT}`;
  ctx.fillText(formatTemperature(data.temperature), 506, 458);
  ctx.textAlign = 'left';
  ctx.font = `600 52px ${FONT}`;
  ctx.fillText('°', 520, 392);
  ctx.fillText('C', 516, 456);
  ctx.restore();
}

function drawHeader(ctx: CanvasRenderingContext2D, data: DisplayData) {
  ctx.fillStyle = WHITE;
  ctx.font = `600 44px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Picomag', 26, 62);

  // Bluetooth.
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 3.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(352, 28);
  ctx.lineTo(370, 46);
  ctx.lineTo(361, 55);
  ctx.lineTo(361, 19);
  ctx.lineTo(370, 28);
  ctx.lineTo(352, 46);
  ctx.stroke();

  // Onda: pulsa enquanto mede.
  const amplitude = data.measuring ? 7 + Math.sin(data.time * 8) * 2 : 5;
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const x = 388 + i;
    const y = 37 - Math.sin((i / 28) * Math.PI * 2) * amplitude;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Estado: verde com o tubo cheio, âmbar com o tubo vazio.
  ctx.fillStyle = data.emptyPipe ? '#ffb020' : '#2fc24f';
  ctx.fillRect(428, 20, 34, 34);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (data.emptyPipe) {
    ctx.moveTo(445, 27);
    ctx.lineTo(445, 40);
    ctx.moveTo(445, 46);
    ctx.lineTo(445, 47);
  } else {
    ctx.moveTo(435, 37);
    ctx.lineTo(443, 45);
    ctx.lineTo(456, 28);
  }
  ctx.stroke();

  // Bateria interna.
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 3;
  ctx.strokeRect(478, 24, 54, 26);
  ctx.fillStyle = WHITE;
  ctx.fillRect(532, 31, 5, 12);
  ctx.fillStyle = '#2fc24f';
  ctx.fillRect(482, 28, 46 * (data.battery / 100), 18);
  ctx.fillStyle = '#9aa5b0';
  ctx.font = `500 22px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${formatInteger(data.battery)}%`, 574, 74);

  ctx.fillStyle = 'rgba(244,247,250,0.85)';
  ctx.fillRect(26, 82, 300, 3);
}

function drawBoot(ctx: CanvasRenderingContext2D, data: DisplayData) {
  const { width: W } = DISPLAY_SIZE;
  ctx.globalAlpha = Math.min(1, data.boot * 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = WHITE;
  ctx.font = `700 96px ${FONT}`;
  ctx.fillText('Picomag', W / 2, 200);
  ctx.fillStyle = '#9aa5b0';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText('DN50 · bateria interna', W / 2, 252);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(110, 300, W - 220, 14);
  ctx.fillStyle = BLUE;
  ctx.fillRect(110, 300, (W - 220) * data.boot, 14);
  ctx.fillStyle = '#9aa5b0';
  ctx.font = `500 28px ${FONT}`;
  const step = data.boot < 0.35 ? 'Autoteste…' : data.boot < 0.7 ? 'Bobinas OK · eletrodos OK' : 'Bluetooth pronto';
  ctx.fillText(step, W / 2, 372);
  ctx.globalAlpha = 1;
}

function drawWarning(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.moveTo(x + 15, y - 4);
  ctx.lineTo(x + 31, y + 24);
  ctx.lineTo(x - 1, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 13.5, y + 5, 3, 10);
  ctx.fillRect(x + 13.5, y + 18, 3, 3);
  ctx.fillStyle = '#ffb020';
}
