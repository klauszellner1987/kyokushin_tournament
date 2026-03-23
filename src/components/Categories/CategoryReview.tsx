import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Check, X, RotateCcw, GripVertical, ArrowLeftRight, Users } from 'lucide-react';
import type { Category, Participant } from '../../types';
import { getAge } from '../../types';
import { autoAssign } from '../../utils/groupAssignment';

const UNASSIGNED_ID = '__unassigned__';

interface Props {
  categories: Category[];
  participants: Participant[];
  onSave: (updates: Map<string, string[]>) => Promise<void>;
  onClose: () => void;
}

interface DraftAssignment {
  [categoryId: string]: string[];
}

function DraggableParticipant({
  participant,
  isManuallyMoved,
}: {
  participant: Participant;
  isManuallyMoved: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: participant.id,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors select-none ${
        isDragging
          ? 'opacity-30'
          : 'bg-kyokushin-bg hover:bg-kyokushin-card-hover'
      } ${isManuallyMoved ? 'border border-kyokushin-gold/50' : 'border border-transparent'}`}
      {...listeners}
      {...attributes}
    >
      <GripVertical size={14} className="text-kyokushin-text-muted shrink-0 cursor-grab" />
      <div className="flex-1 min-w-0">
        <span className="text-white truncate block">
          {participant.lastName}, {participant.firstName}
        </span>
        <div className="flex items-center gap-2 text-xs text-kyokushin-text-muted">
          <span>{participant.club}</span>
          <span>{getAge(participant.birthDate)}J.</span>
          <span>{participant.weight > 0 ? `${participant.weight}kg` : ''}</span>
          <span>{participant.gender === 'M' ? '♂' : '♀'}</span>
        </div>
      </div>
      {isManuallyMoved && (
        <ArrowLeftRight size={12} className="text-kyokushin-gold shrink-0" />
      )}
    </div>
  );
}

function ParticipantOverlay({ participant }: { participant: Participant }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-kyokushin-card border border-kyokushin-gold shadow-xl shadow-black/50">
      <GripVertical size={14} className="text-kyokushin-gold shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-white truncate block">
          {participant.lastName}, {participant.firstName}
        </span>
        <div className="flex items-center gap-2 text-xs text-kyokushin-text-muted">
          <span>{participant.club}</span>
          <span>{getAge(participant.birthDate)}J.</span>
          <span>{participant.weight > 0 ? `${participant.weight}kg` : ''}</span>
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  id,
  title,
  count,
  isOver,
  children,
}: {
  id: string;
  title: string;
  count: number;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });

  const isUnassigned = id === UNASSIGNED_ID;
  const countColor =
    isUnassigned && count > 0
      ? 'text-amber-400'
      : count === 0
        ? 'text-kyokushin-text-muted'
        : count === 1
          ? 'text-amber-400'
          : 'text-green-400';

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border transition-colors min-w-[260px] max-w-[320px] ${
        isOver
          ? 'border-kyokushin-gold bg-kyokushin-gold/5'
          : isUnassigned
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-kyokushin-border bg-kyokushin-card'
      }`}
    >
      <div className="px-4 py-3 border-b border-kyokushin-border">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-white text-sm truncate pr-2">{title}</h4>
          <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ${countColor}`}>
            <Users size={12} />
            {count}
          </span>
        </div>
      </div>
      <div className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[60px]">
        {children}
        {count === 0 && (
          <div className="text-xs text-kyokushin-text-muted text-center py-4">
            Teilnehmer hierher ziehen
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoryReview({ categories, participants, onSave, onClose }: Props) {
  const { assignments } = useMemo(
    () => autoAssign(participants, categories),
    [participants, categories],
  );

  const initialDraft = useMemo(() => {
    const draft: DraftAssignment = {};
    for (const a of assignments) {
      draft[a.categoryId] = [...a.participantIds];
    }
    const allAssigned = new Set(assignments.flatMap((a) => a.participantIds));
    draft[UNASSIGNED_ID] = participants
      .filter((p) => !allAssigned.has(p.id))
      .map((p) => p.id);
    return draft;
  }, [assignments, participants]);

  const [draft, setDraft] = useState<DraftAssignment>(() => initialDraft);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const movedParticipantIds = useMemo(() => {
    const moved = new Set<string>();
    for (const catId of Object.keys(draft)) {
      const original = initialDraft[catId] ?? [];
      const current = draft[catId] ?? [];
      for (const pid of current) {
        if (!original.includes(pid)) moved.add(pid);
      }
    }
    return moved;
  }, [draft, initialDraft]);

  const participantMap = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const p of participants) map.set(p.id, p);
    return map;
  }, [participants]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const findContainer = useCallback(
    (participantId: string): string | null => {
      for (const [catId, pids] of Object.entries(draft)) {
        if (pids.includes(participantId)) return catId;
      }
      return null;
    },
    [draft],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | undefined;
    setOverId(overId ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const participantId = active.id as string;
    const sourceContainer = findContainer(participantId);
    if (!sourceContainer) return;

    let targetContainer = over.id as string;

    const isValidContainer =
      targetContainer === UNASSIGNED_ID ||
      categories.some((c) => c.id === targetContainer);

    if (!isValidContainer) {
      const containerOfOverItem = findContainer(targetContainer);
      if (containerOfOverItem) {
        targetContainer = containerOfOverItem;
      } else {
        return;
      }
    }

    if (sourceContainer === targetContainer) return;

    setDraft((prev) => {
      const next = { ...prev };
      next[sourceContainer] = prev[sourceContainer].filter((id) => id !== participantId);
      next[targetContainer] = [...(prev[targetContainer] ?? []), participantId];
      return next;
    });
  };

  const handleReset = () => {
    setDraft(initialDraft);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = new Map<string, string[]>();

      for (const p of participants) {
        const assignedCatIds: string[] = [];
        for (const cat of categories) {
          if (draft[cat.id]?.includes(p.id)) {
            assignedCatIds.push(cat.id);
          }
        }
        updates.set(p.id, assignedCatIds);
      }

      await onSave(updates);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const activeParticipant = activeId ? participantMap.get(activeId) : null;

  const columnOrder = [
    ...categories.map((c) => c.id),
    UNASSIGNED_ID,
  ];

  return (
    <div className="fixed inset-0 z-50 bg-kyokushin-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-kyokushin-border bg-kyokushin-card">
        <div>
          <h2 className="text-lg font-bold text-white">Sichtkontrolle</h2>
          <p className="text-sm text-kyokushin-text-muted">
            Teilnehmer per Drag & Drop zwischen Kategorien verschieben
            {movedParticipantIds.size > 0 && (
              <span className="ml-2 text-kyokushin-gold">
                ({movedParticipantIds.size} verschoben)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            disabled={movedParticipantIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-kyokushin-bg border border-kyokushin-border hover:border-kyokushin-gold text-white"
          >
            <RotateCcw size={14} />
            Zurücksetzen
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-kyokushin-border hover:bg-kyokushin-card-hover text-white"
          >
            <X size={14} />
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors bg-kyokushin-red hover:bg-kyokushin-red-dark text-white disabled:opacity-60"
          >
            <Check size={14} />
            {saving ? 'Speichert...' : 'Bestätigen'}
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            {columnOrder.map((colId) => {
              const isUnassigned = colId === UNASSIGNED_ID;
              const category = categories.find((c) => c.id === colId);
              const title = isUnassigned ? 'Nicht zugeordnet' : (category?.name ?? '');
              const pids = draft[colId] ?? [];

              return (
                <DroppableColumn
                  key={colId}
                  id={colId}
                  title={title}
                  count={pids.length}
                  isOver={overId === colId}
                >
                  {pids.map((pid) => {
                    const p = participantMap.get(pid);
                    if (!p) return null;
                    return (
                      <DraggableParticipant
                        key={pid}
                        participant={p}
                        isManuallyMoved={movedParticipantIds.has(pid)}
                      />
                    );
                  })}
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeParticipant && <ParticipantOverlay participant={activeParticipant} />}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
