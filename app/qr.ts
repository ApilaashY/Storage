import QRCode from "qrcode";

const WIDTH = 480;
const HEADER = 110;
const QR_SIZE = 400;
const PADDING = (WIDTH - QR_SIZE) / 2;

export async function downloadBoxQr(boxId: string): Promise<void> {
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, boxId, { width: QR_SIZE, margin: 0 });

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEADER + QR_SIZE + PADDING;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000";
  ctx.font = "bold 64px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(boxId, WIDTH / 2, HEADER / 2 + 10);

  ctx.drawImage(qr, PADDING, HEADER, QR_SIZE, QR_SIZE);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not create image");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `box-${boxId}.png`;
  link.click();
  URL.revokeObjectURL(url);
}
