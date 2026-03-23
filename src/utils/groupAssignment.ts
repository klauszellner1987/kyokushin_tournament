import type { Participant, Category, BeltGrade } from '../types';
import { getBeltIndex, getAge } from '../types';

export interface AssignmentResult {
  categoryId: string;
  participantIds: string[];
}

export interface AssignmentWarning {
  type: 'unassigned' | 'single_participant' | 'too_few';
  message: string;
  participantId?: string;
  categoryId?: string;
}

function matchesCategory(p: Participant, c: Category): boolean {
  const age = getAge(p.birthDate);

  if (c.ageMin != null && age < c.ageMin) return false;
  if (c.ageMax != null && age > c.ageMax) return false;

  if (c.weightMin != null && p.weight < c.weightMin) return false;
  if (c.weightMax != null && p.weight > c.weightMax) return false;

  if (c.gender !== 'mixed' && p.gender !== c.gender) return false;

  if (!p.discipline.includes(c.discipline)) return false;

  if (c.beltMin != null) {
    const pIdx = getBeltIndex(p.beltGrade);
    const minIdx = getBeltIndex(c.beltMin as BeltGrade);
    if (pIdx < minIdx) return false;
  }

  if (c.beltMax != null) {
    const pIdx = getBeltIndex(p.beltGrade);
    const maxIdx = getBeltIndex(c.beltMax as BeltGrade);
    if (pIdx > maxIdx) return false;
  }

  return true;
}

export function autoAssign(
  participants: Participant[],
  categories: Category[],
): { assignments: AssignmentResult[]; warnings: AssignmentWarning[] } {
  const assignments: AssignmentResult[] = categories.map((c) => ({
    categoryId: c.id,
    participantIds: [],
  }));

  const warnings: AssignmentWarning[] = [];
  const assigned = new Set<string>();

  for (const p of participants) {
    if ((p.status ?? 'active') !== 'active') continue;

    if (p.categoryIds.length > 0) {
      for (let i = 0; i < categories.length; i++) {
        if (p.categoryIds.includes(categories[i].id)) {
          assignments[i].participantIds.push(p.id);
          assigned.add(p.id);
        }
      }
      continue;
    }

    let found = false;
    for (let i = 0; i < categories.length; i++) {
      if (matchesCategory(p, categories[i])) {
        assignments[i].participantIds.push(p.id);
        assigned.add(p.id);
        found = true;
      }
    }

    if (!found) {
      warnings.push({
        type: 'unassigned',
        message: `${p.firstName} ${p.lastName} passt in keine Kategorie`,
        participantId: p.id,
      });
    }
  }

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    if (a.participantIds.length === 0) {
      continue; // empty category is fine
    }
    if (a.participantIds.length === 1) {
      warnings.push({
        type: 'single_participant',
        message: `"${categories[i].name}" hat nur 1 Teilnehmer`,
        categoryId: a.categoryId,
      });
    } else if (a.participantIds.length < 3) {
      warnings.push({
        type: 'too_few',
        message: `"${categories[i].name}" hat nur ${a.participantIds.length} Teilnehmer`,
        categoryId: a.categoryId,
      });
    }
  }

  return { assignments, warnings };
}
