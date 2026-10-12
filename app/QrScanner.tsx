"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

interface Props {
  // Return true when the code was accepted; false keeps scanning.
  onScan: (text: string) => boolean;
  onClose: () => void;
  error?: string;
}

export default function QrScanner({ onScan, onClose, error }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    let lastText = "";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    function tick() {
      const video = videoRef.current;
      if (stopped || !video) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(image.data, image.width, image.height);
        // Skip repeats of a rejected code so the parent isn't spammed every frame.
        if (result && result.data !== lastText) {
          lastText = result.data;
          if (onScanRef.current(result.data)) return;
        } else if (!result) {
          lastText = "";
        }
      }
      frame = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        return video.play().then(tick);
      })
      .catch(() => setCameraError("Camera unavailable or permission denied"));

    if (!navigator.mediaDevices) setCameraError("Camera not supported");

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Scan Box Code</h2>
        <video ref={videoRef} className="scanner-video" playsInline muted />
        {(cameraError || error) && (
          <p className="form-error">{cameraError || error}</p>
        )}
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
