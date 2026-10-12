"use server";

import { db } from "@/src/prisma/db";
import type { Box, BoxItem } from "./types";

const MAX_TEXT = 500;

function clean(value: string, label: string): string {
  const text = String(value).trim();
  if (text.length > MAX_TEXT) throw new Error(`${label} is too long`);
  return text;
}

export async function getBoxes(): Promise<Box[]> {
  const rows = await db.orm.public.Box.orderBy((b) => b.position.asc())
    .include("items", (items) => items.orderBy((i) => i.position.asc()))
    .all();
  return rows.map((b) => ({
    id: b.id,
    description: b.description,
    items: b.items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
    })),
  }));
}

export async function createBox(
  code: string,
  description: string,
): Promise<Box> {
  if (!/^\d{4}$/.test(code)) throw new Error("Code must be 4 digits");

  const existing = await db.orm.public.Box.select("id", "position").all();
  if (existing.some((b) => b.id === code)) {
    throw new Error("Code is already in use");
  }
  const position =
    existing.reduce((max, b) => Math.max(max, b.position), -1) + 1;
  const text = clean(description, "Description");
  await db.orm.public.Box.create({ id: code, description: text, position });
  return { id: code, description: text, items: [] };
}

export async function addItem(
  boxId: string,
  name: string,
  description: string,
): Promise<BoxItem> {
  const trimmed = clean(name, "Name");
  if (!trimmed) throw new Error("Name is required");

  const siblings = await db.orm.public.Item.where({ boxId })
    .select("position")
    .all();
  const position =
    siblings.reduce((max, i) => Math.max(max, i.position), -1) + 1;

  const item = await db.orm.public.Item.create({
    name: trimmed,
    description: clean(description, "Description"),
    position,
    boxId,
  });
  return { id: item.id, name: item.name, description: item.description };
}

export async function removeItem(boxId: string, itemId: string): Promise<void> {
  await db.orm.public.Item.where({ id: itemId, boxId }).delete();
}

export async function reorderItems(
  boxId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx.orm.public.Item.where({ id, boxId }).update({ position });
    }
  });
}

export async function reorderBoxes(orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of orderedIds.entries()) {
      await tx.orm.public.Box.where({ id }).update({ position });
    }
  });
}
