// src/components/store/AmbientCircles.tsx
export function AmbientCircles() {
  return (
    <div
      className="ambient-circles pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Grande forme beige à gauche */}
      <span className="ambient-blob ambient-blob--sand" />

      {/* Cercle taupe derrière le titre */}
      <span className="ambient-blob ambient-blob--taupe" />

      {/* Forme bleu-vert à droite */}
      <span className="ambient-blob ambient-blob--aqua" />

      {/* Forme vert très clair en bas */}
      <span className="ambient-blob ambient-blob--mint" />

      {/* Petite touche ocre (bonus) */}
      <span className="ambient-blob ambient-blob--ocre" />
    </div>
  );
}