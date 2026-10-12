"use client";

import "./App.css";
import { useRef, useState } from "react";
import {
  addItem,
  createBox,
  getBoxes,
  removeItem,
  reorderBoxes,
  reorderItems,
} from "./actions";
import type { Box, BoxItem } from "./types";
import QrScanner from "./QrScanner";
import { downloadBoxQr } from "./qr";

function generateBoxCode(existing: Box[]): string {
  let code: string;
  do {
    code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  } while (existing.some((b) => b.id === code));
  return code;
}

export default function BoxGrid({ initialBoxes }: { initialBoxes: Box[] }) {
  const [boxes, setBoxes] = useState<Box[]>(initialBoxes);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;

  const [openId, setOpenId] = useState<string | null>(null);
  const openBox = boxes.find((b) => b.id === openId);

  const [creating, setCreating] = useState(false);
  const [newBoxCode, setNewBoxCode] = useState("");
  const [createError, setCreateError] = useState("");
  const [newBoxDescription, setNewBoxDescription] = useState("");
  const [dragBoxId, setDragBoxId] = useState<string | null>(null);

  const [newItem, setNewItem] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  function handleScan(text: string): boolean {
    const id = text.trim();
    if (!boxesRef.current.some((b) => b.id === id)) {
      setScanError("No box with that code");
      return false;
    }
    setScanning(false);
    setOpenId(id);
    return true;
  }
  // Reload from the database after a failed write so the UI doesn't drift.
  async function resync() {
    setBoxes(await getBoxes());
  }

  function persist(write: () => Promise<unknown>) {
    write().catch(resync);
  }

  function openCreate() {
    setNewBoxCode(generateBoxCode(boxes));
    setCreateError("");
    setNewBoxDescription("");
    setCreating(true);
  }

  async function addBox() {
    if (!/^\d{4}$/.test(newBoxCode)) {
      setCreateError("Code must be 4 digits");
      return;
    }
    if (boxes.some((b) => b.id === newBoxCode)) {
      setCreateError("Code is already in use");
      return;
    }
    setCreating(false);
    try {
      const box = await createBox(newBoxCode, newBoxDescription);
      setBoxes((prev) => [...prev, box]);
    } catch {
      await resync();
    }
  }

  function reorderBoxesLocal(fromId: string, toId: string) {
    setBoxes((prev) => {
      const from = prev.findIndex((b) => b.id === fromId);
      const to = prev.findIndex((b) => b.id === toId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function updateItems(boxId: string, fn: (items: BoxItem[]) => BoxItem[]) {
    setBoxes((prev) =>
      prev.map((b) => (b.id === boxId ? { ...b, items: fn(b.items) } : b)),
    );
  }

  async function addBoxItem(boxId: string, name: string, description: string) {
    if (!name.trim()) return;
    setNewItem("");
    setNewDescription("");
    try {
      const item = await addItem(boxId, name, description);
      updateItems(boxId, (items) => [...items, item]);
    } catch {
      await resync();
    }
  }

  function removeBoxItem(boxId: string, itemId: string) {
    updateItems(boxId, (items) => items.filter((i) => i.id !== itemId));
    persist(() => removeItem(boxId, itemId));
  }

  function reorderBoxItem(boxId: string, from: number, to: number) {
    updateItems(boxId, (items) => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function finishBoxDrag() {
    setDragBoxId(null);
    persist(() => reorderBoxes(boxesRef.current.map((b) => b.id)));
  }

  function finishItemDrag(boxId: string) {
    setDragIndex(null);
    const box = boxesRef.current.find((b) => b.id === boxId);
    if (box)
      persist(() =>
        reorderItems(
          boxId,
          box.items.map((i) => i.id),
        ),
      );
  }

  return (
    <>
      <div className="toolbar">
        <button
          onClick={() => {
            setScanError("");
            setScanning(true);
          }}
        >
          Scan QR
        </button>
      </div>
      <div className="grid">
        {boxes.map((box) => (
          <button
            key={box.id}
            className={`tile${dragBoxId === box.id ? " dragging" : ""}`}
            draggable
            onClick={() => setOpenId(box.id)}
            onDragStart={() => setDragBoxId(box.id)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragBoxId && dragBoxId !== box.id)
                reorderBoxesLocal(dragBoxId, box.id);
            }}
            onDragEnd={finishBoxDrag}
          >
            <h2>{box.id}</h2>
            {box.description && <p className="tile-desc">{box.description}</p>}
            <ul>
              {box.items.slice(0, 3).map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
            {box.items.length > 3 && (
              <span className="more">+{box.items.length - 3} more</span>
            )}
          </button>
        ))}
        <button className="tile tile-new" onClick={openCreate}>
          <h2>+ New Box</h2>
        </button>
      </div>

      {scanning && (
        <QrScanner
          onScan={handleScan}
          onClose={() => setScanning(false)}
          error={scanError}
        />
      )}

      {creating && (
        <div className="overlay" onClick={() => setCreating(false)}>
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              addBox();
            }}
          >
            <h2>New Box</h2>
            <div className="add-form">
              <input
                value={newBoxCode}
                onChange={(e) => {
                  setNewBoxCode(e.target.value.replace(/\D/g, "").slice(0, 4));
                  setCreateError("");
                }}
                inputMode="numeric"
                maxLength={4}
                placeholder="4-digit code"
                aria-label="Code"
              />
            </div>
            {createError && <p className="form-error">{createError}</p>}
            <div className="add-form">
              <input
                autoFocus
                value={newBoxDescription}
                onChange={(e) => setNewBoxDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
            <div className="add-form">
              <button type="submit">Create</button>
              <button type="button" onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {openBox && (
        <div className="overlay" onClick={() => setOpenId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{openBox.id}</h2>
            {openBox.description && <p>{openBox.description}</p>}
            <ul className="item-list">
              {openBox.items.map((item, index) => (
                <li
                  key={item.id}
                  draggable
                  className={dragIndex === index ? "dragging" : undefined}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIndex === null || dragIndex === index) return;
                    reorderBoxItem(openBox.id, dragIndex, index);
                    setDragIndex(index);
                  }}
                  onDragEnd={() => finishItemDrag(openBox.id)}
                >
                  <span className="handle" aria-hidden>
                    ⠿
                  </span>
                  <span className="item-text">
                    {item.name}
                    {item.description && <small>{item.description}</small>}
                  </span>
                  <button
                    aria-label="Remove"
                    onClick={() => removeBoxItem(openBox.id, item.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="add-form"
              onSubmit={(e) => {
                e.preventDefault();
                addBoxItem(openBox.id, newItem, newDescription);
              }}
            >
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Name"
              />
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description"
              />
              <button type="submit">Add</button>
            </form>
            <button onClick={() => downloadBoxQr(openBox.id)}>
              Download QR
            </button>{" "}
            <button onClick={() => setOpenId(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
