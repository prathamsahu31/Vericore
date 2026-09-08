const STEPS = [
  {
    number: "01",
    title: "Upload the NIT",
    description:
      "Add the tender notice. Vericore reads it and turns its eligibility conditions into a checklist you review line by line.",
  },
  {
    number: "02",
    title: "Add each bidder's documents",
    description:
      "One file per document, and let Vericore sort them, or upload the whole bundle. Either way it isolates each page's evidence.",
  },
  {
    number: "03",
    title: "Decide, on the evidence",
    description:
      "Every verdict opens to the exact page it came from. The system recommends; the decision, and the audit trail behind it, is yours.",
  },
];

export default function Cards() {
  return (
    <section id="how-it-works" className="py-10 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-20 text-center">
          <p className="text-xs mt-200px font-medium text-black uppercase tracking-widest mb-4">
            The Process
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-blue">
            How it works
          </h2>
        </div>

        {/* Steps — separated by 1px bg-white/5 dividers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-blue/[0.01] rounded-2xl overflow-hidden">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="bg-blue/[0.8] p-10 hover:bg-black/[0.45] transition-colors duration-300 group"
            >
              <span className="text-5xl font-semibold text-black group-hover:text-blue transition-colors duration-300 block mb-8">
                {step.number}
              </span>
              <h3 className="text-base font-semibold text-black mb-3">
                {step.title}
              </h3>
              <p className="text-sm text-black leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
