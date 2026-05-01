import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

const SECTION_LABELS = {
  hero: { label: "Hero (titre principal)", desc: "Bandeau d'accueil avec titre, sous-titre et CTA" },
  value_props: { label: "Avantages", desc: "Bandeau « Devis gratuit / Garantie / etc. »" },
  services: { label: "Services", desc: "Liste de prestations avec photos" },
  about: { label: "À propos", desc: "Section présentation sur fond sombre" },
  contact: { label: "Contact", desc: "Formulaire + coordonnées + carte" },
};

export const DEFAULT_SECTION_ORDER = ["hero", "value_props", "services", "about", "contact"];

function SortableItem({ id, index }) {
  const meta = SECTION_LABELS[id] || { label: id, desc: "" };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`sortable-${id}`}
      className="bg-white border border-black/10 px-4 py-3 flex items-center gap-3 cursor-default"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label={`Déplacer ${meta.label}`}
        data-testid={`drag-handle-${id}`}
        className="text-[#71717A] hover:text-[#F95A2C] cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] w-6">{String(index + 1).padStart(2, "0")}</div>
      <div className="flex-1">
        <div className="font-display font-bold text-sm tracking-tight">{meta.label}</div>
        {meta.desc && <div className="text-xs text-[#71717A] mt-0.5">{meta.desc}</div>}
      </div>
    </div>
  );
}

export default function SectionsReorder({ value, onChange }) {
  const order = (value && value.length ? value : DEFAULT_SECTION_ORDER).filter((s) => SECTION_LABELS[s]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(order, oldIndex, newIndex));
  };

  const reset = () => onChange(DEFAULT_SECTION_ORDER);

  return (
    <div data-testid="sections-reorder">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {order.map((id, i) => <SortableItem key={id} id={id} index={i} />)}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={reset}
        data-testid="sections-reset"
        className="mt-3 font-mono-grotesk text-[10px] uppercase tracking-[0.2em] text-[#71717A] hover:text-[#F95A2C] underline underline-offset-4"
      >
        Réinitialiser l'ordre par défaut
      </button>
    </div>
  );
}
