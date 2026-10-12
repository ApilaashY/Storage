import { Suspense } from "react";
import { connection } from "next/server";
import BoxGrid from "./BoxGrid";
import { getBoxes } from "./actions";

async function Boxes() {
  await connection();
  return <BoxGrid initialBoxes={await getBoxes()} />;
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Boxes />
    </Suspense>
  );
}
