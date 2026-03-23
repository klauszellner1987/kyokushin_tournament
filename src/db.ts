import Dexie, { type EntityTable } from 'dexie';

export interface DbDocument {
  _rowId?: number;
  _collection: string;
  id: string;
  [key: string]: unknown;
}

const db = new Dexie('KyokushinTournamentManager') as Dexie & {
  documents: EntityTable<DbDocument, '_rowId'>;
};

db.version(1).stores({
  documents: '++_rowId, [_collection+id], _collection',
});

export default db;
