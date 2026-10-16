// CAD models per component. The CAD page reads this by URL: /cad/receptacle, /cad/lpbd ...
//
// Part keys MUST match the object names inside the .glb file AND the partId
// values in the result data. That's what links a reading to a 3D part.
//
// When the real model arrives: change `url`, update `parts` to the real names,
// set `placeholder: false`. Nothing else should need to change.

export const MODELS = {
  receptacle: {
    component: "Receptacle",          // must match scenario/run `component`
    title: "Earth receptacle",
    url: "/models/receptacle.glb",
    placeholder: false,
    // Names come from the CAD file (Receptacle_with_lid). "Lif" is the lid's name in the file.
    parts: {
      "Lif":           { label: "Lid" },
      "BODY":          { label: "Body" },
      "Removable Pin": { label: "Removable pin (bonding bridge)" },
    },
  },

  // lpbd: { component: "LPBD", title: "Bonding device (LPBD)", url: "/models/lpbd.glb", parts: { ... } },
};
