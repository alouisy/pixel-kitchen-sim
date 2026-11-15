export type EntityId = number & { __brand: 'EntityId' };

export function asEntityId(n: number): EntityId {
  return n as EntityId;
}

export function entityIndex(id: EntityId): number {
  return id;
}
