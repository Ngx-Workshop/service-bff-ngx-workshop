export enum MfeRemoteType {
  STRUCTURAL = 'structural',
  USER_JOURNEY = 'user-journey',
}

export enum StructuralOverrideMode {
  FULL = 'full',
  VERBOSE = 'verbose',
  MINIMAL = 'minimal',
  COMPACT = 'compact',
  DISABLED = 'disabled',
}

export type StructuralOverrides = {
  header?: StructuralOverrideMode;
  nav?: StructuralOverrideMode;
  footer?: StructuralOverrideMode;
};

export interface IMfeRemote {
  _id: string;
  name: string;
  remoteEntryUrl: string;
  type: MfeRemoteType;
  structuralOverrides?: StructuralOverrides;
  version: number;
  status?: string;
  description?: string;
  lastUpdated?: Date;
  archived?: boolean;
  __v?: number;
}
