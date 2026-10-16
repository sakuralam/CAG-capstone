// Loads a .glb model and colours each named part by its pass/fail status.
// Click a part to select it; hover to highlight.
import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export const STATUS_COLORS = {
  pass: "#16a34a",
  fail: "#dc2626",
  none: "#9ca3af", // part has no readings in this run
};

// Walk up from a clicked mesh to the nearest object whose name is a known part
function partOf(obj, parts) {
  for (let o = obj; o; o = o.parent) {
    if (parts[o.name]) return o.name;
  }
  return null;
}

export default function CadModel({ url, parts, partStatus, selectedPart, onSelectPart }) {
  const { scene } = useGLTF(url);
  // Clone so our material changes don't leak into the cached original
  const model = useMemo(() => scene.clone(true), [scene]);
  const [hovered, setHovered] = useState(null);

  // Give every mesh its own material once
  useEffect(() => {
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.2 });
      }
    });
  }, [model]);

  // Re-colour whenever status, selection or hover changes
  useEffect(() => {
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      const part = partOf(obj, parts);
      const status = partStatus[part]?.result ?? "none";
      const mat = obj.material;
      const color = STATUS_COLORS[status] ?? STATUS_COLORS.none;
      mat.color.set(color);

      const translucent = parts[part]?.translucent;
      mat.transparent = !!translucent;
      mat.opacity = translucent ? 0.35 : 1;
      mat.depthWrite = !translucent;

      // Selected/hovered parts glow in their own status colour
      const glow = part === selectedPart ? 0.6 : part === hovered ? 0.3 : 0;
      mat.emissive.set(glow ? color : "#000000");
      mat.emissiveIntensity = glow;
      mat.needsUpdate = true;
    });
  }, [model, parts, partStatus, selectedPart, hovered]);

  // Prefer solid parts over translucent ones, so you can click the pit
  // and rod "through" the see-through ground.
  const pick = (e) => {
    const hits = e.intersections.map((i) => partOf(i.object, parts)).filter(Boolean);
    return hits.find((p) => !parts[p].translucent) ?? hits[0] ?? null;
  };

  return (
    <primitive
      object={model}
      onClick={(e) => { e.stopPropagation(); onSelectPart(pick(e)); }}
      onPointerMove={(e) => { e.stopPropagation(); setHovered(pick(e)); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(null); document.body.style.cursor = ""; }}
    />
  );
}
